# Security Guide

Security best practices and configuration for Network & Domain Analyzer.

## Table of Contents

- [API Key Authentication](#api-key-authentication)
- [Rate Limiting](#rate-limiting)
- [Input Sanitization](#input-sanitization)
- [CORS Configuration](#cors-configuration)
- [Security Headers](#security-headers)
- [Request Size Limits](#request-size-limits)
- [Environment Variables](#environment-variables)
- [Production Checklist](#production-checklist)

---

## API Key Authentication

### Overview

Sensitive operations require API key authentication:
- Batch domain analysis (`POST /api/batch/analyze`)
- History export (`POST /api/history/export`)

### API Key Format

```
nda_<32 hexadecimal characters>
```

Example: `nda_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Generating API Keys

```typescript
import { securityService } from './services/security.service';

// Generate a new API key
const apiKey = securityService.generateAPIKey();
console.log('API Key:', apiKey);

// Hash for storage (never store plain text keys)
const hash = await securityService.hashAPIKey(apiKey);
console.log('Hash for storage:', hash);
```

### Using API Keys

Include the API key in the `X-API-Key` header:

```bash
curl -X POST http://localhost:5000/api/batch/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: nda_your_api_key_here" \
  -d '{"domains": ["example.com"]}'
```

### Validating API Keys

```typescript
import { securityService } from './services/security.service';

// Validate format only
const isValidFormat = securityService.isValidAPIKeyFormat(apiKey);

// Validate against stored hash
const isValid = await securityService.validateAPIKey(apiKey, storedHash);
```

### Best Practices

1. **Never log API keys** - Use hashes for identification
2. **Rotate keys regularly** - Implement key expiration
3. **Use HTTPS** - Always transmit keys over encrypted connections
4. **Store hashes only** - Never store plain text API keys
5. **Limit key scope** - Create separate keys for different purposes

---

## Rate Limiting

### Overview

Rate limiting protects against abuse using a sliding window algorithm.

### Configuration

Rate limits are configured per endpoint group:

| Endpoint Group | Requests | Window |
|----------------|----------|--------|
| DNS | 50 | 15 minutes |
| RDAP | 50 | 15 minutes |
| WHOIS | 30 | 15 minutes |
| Host | 50 | 15 minutes |
| IP | 100 | 15 minutes |
| Batch | 5 | 15 minutes |
| History | 100 | 15 minutes |

### Response Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1701776400
```

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "retryAfter": 300
  }
}
```

HTTP Status: `429 Too Many Requests`

### Storage Backends

1. **Redis** (recommended for production)
   - Distributed rate limiting
   - Persistent across restarts
   - Configure via `REDIS_URL`

2. **In-Memory** (development/fallback)
   - Single server only
   - Lost on restart
   - Automatic fallback if Redis unavailable

### Custom Rate Limiter

```typescript
import { createRateLimiter } from './middleware/rateLimiter.middleware';

const customLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,
  keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
});

router.post('/endpoint', customLimiter.middleware(), handler);
```

---

## Input Sanitization

### Overview

All user inputs are sanitized to prevent injection attacks.

### Protected Against

1. **SQL Injection**
   - `' OR '1'='1`
   - `'; DROP TABLE users; --`
   - URL-encoded variants (`%27`, `%23`)

2. **Cross-Site Scripting (XSS)**
   - `<script>alert('xss')</script>`
   - Event handlers (`onclick`, `onerror`)
   - JavaScript protocol (`javascript:`)

3. **Path Traversal**
   - `../../../etc/passwd`
   - URL-encoded variants

### Malicious Pattern Detection

```typescript
import { securityService } from './services/security.service';

const result = securityService.detectMaliciousPatterns(userInput);
if (result.detected) {
  console.log('Detected patterns:', result.patterns);
  // Reject request
}
```

### Input Sanitization

```typescript
import { securityService } from './services/security.service';

// Sanitize general input
const sanitized = securityService.sanitizeInput(userInput);

// Validate and sanitize domain
const domain = securityService.validateDomain(userInput);
if (!domain) {
  // Invalid domain
}

// Validate and sanitize IP
const ip = securityService.validateIP(userInput);
if (!ip) {
  // Invalid IP
}
```

### Middleware Usage

```typescript
import { sanitizeBody, sanitizeQuery } from './middleware/sanitization.middleware';

// Sanitize POST body
router.post('/endpoint', sanitizeBody(), handler);

// Sanitize query parameters
router.get('/endpoint', sanitizeQuery(), handler);
```

---

## CORS Configuration

### Overview

Cross-Origin Resource Sharing (CORS) restricts which origins can access the API.

### Configuration

Set allowed origins in environment:

```bash
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

### Default Configuration

```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    if (!origin || allowedOrigins.includes(origin)) {
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
};
```

### Best Practices

1. **Never use `*` in production** - Always specify allowed origins
2. **Limit methods** - Only allow necessary HTTP methods
3. **Limit headers** - Only expose necessary headers
4. **Use credentials carefully** - Only enable if needed

---

## Security Headers

### Overview

Helmet.js provides security headers to protect against common attacks.

### Headers Applied

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Restrictive policy | Prevent XSS |
| `Strict-Transport-Security` | max-age=31536000 | Force HTTPS |
| `X-Content-Type-Options` | nosniff | Prevent MIME sniffing |
| `X-Frame-Options` | DENY | Prevent clickjacking |
| `X-XSS-Protection` | 1; mode=block | XSS filter |
| `Referrer-Policy` | strict-origin-when-cross-origin | Control referrer |

### Configuration

```typescript
import helmet from 'helmet';

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
  }
}));
```

---

## Request Size Limits

### Overview

Request body size is limited to prevent denial-of-service attacks.

### Configuration

Maximum request body size: **1MB**

```typescript
import { requestSizeLimit } from './middleware/requestSize.middleware';

app.use(requestSizeLimit({ maxSize: 1024 * 1024 })); // 1MB
```

### Error Response

```json
{
  "error": {
    "code": "REQUEST_TOO_LARGE",
    "message": "Request body exceeds maximum size of 1MB"
  }
}
```

HTTP Status: `413 Payload Too Large`

---

## Environment Variables

### Security-Related Variables

```bash
# Required for production
NODE_ENV=production
API_KEY_SECRET=<strong-random-secret>

# CORS
ALLOWED_ORIGINS=https://app.example.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (recommended for production)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

### Generating Secrets

```bash
# Generate API_KEY_SECRET
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Production Checklist

### Before Deployment

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `API_KEY_SECRET`
- [ ] Configure `ALLOWED_ORIGINS` (no wildcards)
- [ ] Enable Redis for rate limiting
- [ ] Configure HTTPS/TLS
- [ ] Review and test rate limits
- [ ] Generate and securely distribute API keys
- [ ] Remove development/debug endpoints
- [ ] Enable all security headers
- [ ] Configure proper logging (no sensitive data)
- [ ] Set up monitoring and alerting
- [ ] Review database security
- [ ] Implement backup strategy

### Ongoing Security

- [ ] Rotate API keys periodically
- [ ] Monitor rate limit violations
- [ ] Review access logs regularly
- [ ] Keep dependencies updated
- [ ] Perform security audits
- [ ] Test for vulnerabilities
- [ ] Have incident response plan

### Security Testing

```bash
# Test for common vulnerabilities
npm audit

# Check for outdated packages
npm outdated

# Run security linter
npm run lint:security  # if configured
```

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do not** create a public GitHub issue
2. Email security concerns to the maintainers
3. Include detailed reproduction steps
4. Allow time for a fix before public disclosure

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
