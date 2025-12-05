/**
 * Rate Limiter Middleware
 * Implements rate limiting using sliding window algorithm
 * Supports both Redis and in-memory storage
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  timestamps: number[];
}

export class RateLimiter {
  private config: RateLimitConfig;
  private inMemoryStore: Map<string, RateLimitEntry>;
  private redisClient: any = null;
  private useRedis: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: this.defaultKeyGenerator,
      ...config,
    };
    this.inMemoryStore = new Map();
    this.initializeRedis();
    this.startCleanupInterval();
  }

  /**
   * Default key generator - uses IP address
   */
  private defaultKeyGenerator(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Initialize Redis client (optional)
   */
  private async initializeRedis(): Promise<void> {
    try {
      let redis: any;
      try {
        redis = require('redis');
      } catch (requireError) {
        this.useRedis = false;
        return;
      }

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.redisClient = redis.createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
        },
      });

      this.redisClient.on('error', () => {
        this.useRedis = false;
      });

      this.redisClient.on('connect', () => {
        this.useRedis = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      this.useRedis = false;
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 1000); // Clean up every minute
  }

  /**
   * Remove expired entries from in-memory store
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    for (const [key, entry] of this.inMemoryStore.entries()) {
      // Filter out old timestamps
      entry.timestamps = entry.timestamps.filter(ts => ts > cutoff);
      
      // Remove entry if no timestamps left
      if (entry.timestamps.length === 0) {
        this.inMemoryStore.delete(key);
      }
    }
  }

  /**
   * Get rate limit info from Redis
   */
  private async getFromRedis(key: string): Promise<number[]> {
    try {
      if (!this.useRedis || !this.redisClient) {
        return [];
      }

      const data = await this.redisClient.get(`ratelimit:${key}`);
      if (!data) {
        return [];
      }

      return JSON.parse(data);
    } catch (error) {
      this.useRedis = false;
      return [];
    }
  }

  /**
   * Set rate limit info in Redis
   */
  private async setInRedis(key: string, timestamps: number[]): Promise<void> {
    try {
      if (!this.useRedis || !this.redisClient) {
        return;
      }

      const ttlSeconds = Math.ceil(this.config.windowMs / 1000);
      await this.redisClient.setEx(
        `ratelimit:${key}`,
        ttlSeconds,
        JSON.stringify(timestamps)
      );
    } catch (error) {
      this.useRedis = false;
    }
  }

  /**
   * Check and update rate limit for a key
   */
  private async checkRateLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    let timestamps: number[] = [];

    // Try to get from Redis first
    if (this.useRedis) {
      timestamps = await this.getFromRedis(key);
    } else {
      // Use in-memory store
      const entry = this.inMemoryStore.get(key);
      if (entry) {
        timestamps = entry.timestamps;
      }
    }

    // Filter out old timestamps (sliding window)
    timestamps = timestamps.filter(ts => ts > cutoff);

    // Check if limit exceeded
    const allowed = timestamps.length < this.config.maxRequests;

    if (allowed) {
      // Add current timestamp
      timestamps.push(now);

      // Store updated timestamps
      if (this.useRedis) {
        await this.setInRedis(key, timestamps);
      } else {
        this.inMemoryStore.set(key, { timestamps });
      }
    }

    // Calculate remaining requests
    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);

    // Calculate reset time (when oldest timestamp expires)
    const resetTime = timestamps.length > 0
      ? timestamps[0] + this.config.windowMs
      : now + this.config.windowMs;

    return {
      allowed,
      remaining,
      resetTime,
    };
  }

  /**
   * Express middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const keyGenerator = this.config.keyGenerator || this.defaultKeyGenerator;
        const key = keyGenerator(req);

        const result = await this.checkRateLimit(key);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

        if (!result.allowed) {
          const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
          res.setHeader('Retry-After', retryAfter.toString());

          res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests, please try again later',
              retryAfter,
            },
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // On error, allow the request to proceed
        next();
      }
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetLimit(key: string): Promise<void> {
    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.del(`ratelimit:${key}`);
      } catch (error) {
        // Ignore errors
      }
    }
    this.inMemoryStore.delete(key);
  }

  /**
   * Get remaining requests for a key
   */
  async getRemainingRequests(key: string): Promise<number> {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    let timestamps: number[] = [];

    if (this.useRedis) {
      timestamps = await this.getFromRedis(key);
    } else {
      const entry = this.inMemoryStore.get(key);
      if (entry) {
        timestamps = entry.timestamps;
      }
    }

    timestamps = timestamps.filter(ts => ts > cutoff);
    return Math.max(0, this.config.maxRequests - timestamps.length);
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.redisClient && this.useRedis) {
      try {
        if (this.redisClient.isOpen) {
          await this.redisClient.quit();
        }
      } catch (error) {
        // Ignore disconnect errors
      }
    }

    this.inMemoryStore.clear();
  }
}

/**
 * Create rate limiter with predefined configuration
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}
