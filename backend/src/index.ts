import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { requestSizeLimit } from './middleware/requestSize.middleware';
import { detectMaliciousInput } from './middleware/sanitization.middleware';
import { storeAPIKey } from './middleware/auth.middleware';
import logger from './utils/logger';
import apiRoutes from './routes';

// Load environment variables
dotenv.config();

// Initialize API keys from environment or generate default for development
async function initializeAPIKeys(): Promise<void> {
  // Check for pre-configured API keys in environment
  const configuredKeys = process.env.API_KEYS?.split(',').filter(k => k.trim()) || [];
  
  if (configuredKeys.length > 0) {
    // Register configured API keys
    for (const key of configuredKeys) {
      await storeAPIKey(key.trim());
      logger.info('Registered configured API key');
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // In development, generate and register a default API key
    const defaultKey = 'nda_0fb717a8df049cbb454849a4adf401a6';
    await storeAPIKey(defaultKey);
    logger.info(`Development API key registered: ${defaultKey}`);
  } else {
    logger.warn('No API keys configured. Protected endpoints will be inaccessible.');
  }
}

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS configuration with whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400
}));

// Request size limit middleware (1MB max)
app.use(requestSizeLimit({ maxSize: 1024 * 1024 }));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Malicious input detection middleware
app.use(detectMaliciousInput());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', apiRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handler - must be last
app.use(errorHandler);

// Start server
if (require.main === module) {
  // Initialize API keys before starting server
  initializeAPIKeys().then(() => {
    app.listen(PORT, () => {
      logger.info(`Backend server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }).catch((error) => {
    logger.error('Failed to initialize API keys:', error);
    process.exit(1);
  });
}

export default app;
