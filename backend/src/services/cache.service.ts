/**
 * Cache Service
 * Provides caching functionality with Redis (optional) and in-memory fallback
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheTTLConfig {
  DNS: number;
  WHOIS: number;
  IP: number;
  DEFAULT: number;
}

export type CacheDataType = 'DNS' | 'WHOIS' | 'IP' | 'DEFAULT';

export class CacheService {
  private inMemoryCache: Map<string, CacheEntry<any>>;
  private redisClient: any = null;
  private useRedis: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // TTL configuration in seconds
  private readonly TTL: CacheTTLConfig = {
    DNS: 300,      // 5 minutes
    WHOIS: 86400,  // 24 hours
    IP: 3600,      // 1 hour
    DEFAULT: 600,  // 10 minutes
  };

  constructor() {
    this.inMemoryCache = new Map();
    this.initializeRedis();
    this.startCleanupInterval();
  }

  /**
   * Initialize Redis client (optional)
   * Falls back to in-memory cache if Redis is not available
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Try to load redis module dynamically
      // This will fail gracefully if redis is not installed
      let redis: any;
      try {
        redis = require('redis');
      } catch (requireError) {
        // Redis module not installed
        console.log('Redis module not installed, using in-memory cache');
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

      this.redisClient.on('error', (err: Error) => {
        console.warn('Redis client error, falling back to in-memory cache:', err.message);
        this.useRedis = false;
      });

      this.redisClient.on('connect', () => {
        console.log('Redis client connected successfully');
        this.useRedis = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      // Redis connection failed
      console.log('Redis not available, using in-memory cache');
      this.useRedis = false;
    }
  }

  /**
   * Start periodic cleanup of expired in-memory cache entries
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Remove expired entries from in-memory cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.inMemoryCache.delete(key);
      }
    }
  }

  /**
   * Generate cache key with namespace
   * @param namespace - Cache namespace (e.g., 'dns', 'whois', 'ip')
   * @param identifier - Unique identifier (e.g., domain name, IP address)
   * @param suffix - Optional suffix for additional specificity
   * @returns Generated cache key
   */
  generateKey(namespace: string, identifier: string, suffix?: string): string {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    const parts = ['nda', namespace, normalizedIdentifier];
    
    if (suffix) {
      parts.push(suffix);
    }
    
    return parts.join(':');
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found or expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useRedis && this.redisClient) {
        // Try Redis first
        const value = await this.redisClient.get(key);
        if (value) {
          return JSON.parse(value) as T;
        }
        return null;
      }
    } catch (error) {
      console.warn(`Redis get error for key ${key}, falling back to in-memory:`, error);
      this.useRedis = false;
    }

    // Fallback to in-memory cache
    const entry = this.inMemoryCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional, uses default based on data type)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlSeconds = ttl || this.TTL.DEFAULT;

    try {
      if (this.useRedis && this.redisClient) {
        // Try Redis first
        await this.redisClient.setEx(
          key,
          ttlSeconds,
          JSON.stringify(value)
        );
        return;
      }
    } catch (error) {
      console.warn(`Redis set error for key ${key}, falling back to in-memory:`, error);
      this.useRedis = false;
    }

    // Fallback to in-memory cache
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.inMemoryCache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Delete value from cache
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        // Try Redis first
        await this.redisClient.del(key);
      }
    } catch (error) {
      console.warn(`Redis delete error for key ${key}:`, error);
      this.useRedis = false;
    }

    // Also delete from in-memory cache
    this.inMemoryCache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        // Clear only keys with our namespace prefix
        const keys = await this.redisClient.keys('nda:*');
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }
    } catch (error) {
      console.warn('Redis clear error:', error);
      this.useRedis = false;
    }

    // Clear in-memory cache
    this.inMemoryCache.clear();
  }

  /**
   * Get TTL for a specific data type
   * @param dataType - Type of data being cached
   * @returns TTL in seconds
   */
  getTTL(dataType: CacheDataType): number {
    return this.TTL[dataType];
  }

  /**
   * Check if Redis is being used
   * @returns True if Redis is active, false if using in-memory
   */
  isUsingRedis(): boolean {
    return this.useRedis;
  }

  /**
   * Get cache statistics
   * @returns Object with cache statistics
   */
  async getStats(): Promise<{
    type: 'redis' | 'in-memory';
    size: number;
  }> {
    if (this.useRedis && this.redisClient) {
      try {
        const keys = await this.redisClient.keys('nda:*');
        return {
          type: 'redis',
          size: keys.length,
        };
      } catch (error) {
        console.warn('Redis stats error:', error);
      }
    }

    return {
      type: 'in-memory',
      size: this.inMemoryCache.size,
    };
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect Redis if connected
    if (this.redisClient && this.useRedis) {
      try {
        if (this.redisClient.isOpen) {
          await this.redisClient.quit();
        }
      } catch (error) {
        // Silently ignore disconnect errors
      }
    }

    // Clear in-memory cache
    this.inMemoryCache.clear();
  }
}

// Export singleton instance
export const cacheService = new CacheService();
