/**
 * Cache Service Tests
 */

import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    // Suppress console output during tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterAll(() => {
    // Restore console
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  beforeEach(() => {
    // Create a new instance for each test
    cacheService = new CacheService();
  });

  afterEach(async () => {
    // Clean up after each test
    await cacheService.clear();
    await cacheService.disconnect();
  }, 10000);

  describe('generateKey', () => {
    it('should generate cache key with namespace and identifier', () => {
      const key = cacheService.generateKey('dns', 'example.com');
      expect(key).toBe('nda:dns:example.com');
    });

    it('should normalize identifier to lowercase', () => {
      const key = cacheService.generateKey('dns', 'EXAMPLE.COM');
      expect(key).toBe('nda:dns:example.com');
    });

    it('should trim whitespace from identifier', () => {
      const key = cacheService.generateKey('dns', '  example.com  ');
      expect(key).toBe('nda:dns:example.com');
    });

    it('should include suffix when provided', () => {
      const key = cacheService.generateKey('dns', 'example.com', 'A');
      expect(key).toBe('nda:dns:example.com:A');
    });
  });

  describe('set and get', () => {
    it('should store and retrieve string values', async () => {
      const key = 'test:string';
      const value = 'test value';

      await cacheService.set(key, value);
      const retrieved = await cacheService.get<string>(key);

      expect(retrieved).toBe(value);
    });

    it('should store and retrieve object values', async () => {
      const key = 'test:object';
      const value = { domain: 'example.com', records: ['A', 'AAAA'] };

      await cacheService.set(key, value);
      const retrieved = await cacheService.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it('should store and retrieve array values', async () => {
      const key = 'test:array';
      const value = [1, 2, 3, 4, 5];

      await cacheService.set(key, value);
      const retrieved = await cacheService.get<number[]>(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const retrieved = await cacheService.get('non:existent:key');
      expect(retrieved).toBeNull();
    });

    it('should respect TTL and expire entries', async () => {
      const key = 'test:ttl';
      const value = 'expires soon';
      const ttl = 1; // 1 second

      await cacheService.set(key, value, ttl);
      
      // Should exist immediately
      let retrieved = await cacheService.get<string>(key);
      expect(retrieved).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should be expired
      retrieved = await cacheService.get<string>(key);
      expect(retrieved).toBeNull();
    }, 10000);
  });

  describe('delete', () => {
    it('should delete existing cache entry', async () => {
      const key = 'test:delete';
      const value = 'to be deleted';

      await cacheService.set(key, value);
      
      // Verify it exists
      let retrieved = await cacheService.get<string>(key);
      expect(retrieved).toBe(value);

      // Delete it
      await cacheService.delete(key);

      // Verify it's gone
      retrieved = await cacheService.get<string>(key);
      expect(retrieved).toBeNull();
    });

    it('should not throw error when deleting non-existent key', async () => {
      await expect(cacheService.delete('non:existent:key')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      // Add multiple entries
      await cacheService.set('test:1', 'value1');
      await cacheService.set('test:2', 'value2');
      await cacheService.set('test:3', 'value3');

      // Verify they exist
      expect(await cacheService.get('test:1')).toBe('value1');
      expect(await cacheService.get('test:2')).toBe('value2');
      expect(await cacheService.get('test:3')).toBe('value3');

      // Clear all
      await cacheService.clear();

      // Verify they're all gone
      expect(await cacheService.get('test:1')).toBeNull();
      expect(await cacheService.get('test:2')).toBeNull();
      expect(await cacheService.get('test:3')).toBeNull();
    });
  });

  describe('getTTL', () => {
    it('should return correct TTL for DNS data type', () => {
      const ttl = cacheService.getTTL('DNS');
      expect(ttl).toBe(300); // 5 minutes
    });

    it('should return correct TTL for WHOIS data type', () => {
      const ttl = cacheService.getTTL('WHOIS');
      expect(ttl).toBe(86400); // 24 hours
    });

    it('should return correct TTL for IP data type', () => {
      const ttl = cacheService.getTTL('IP');
      expect(ttl).toBe(3600); // 1 hour
    });

    it('should return correct TTL for DEFAULT data type', () => {
      const ttl = cacheService.getTTL('DEFAULT');
      expect(ttl).toBe(600); // 10 minutes
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Add some entries
      await cacheService.set('test:1', 'value1');
      await cacheService.set('test:2', 'value2');

      const stats = await cacheService.getStats();

      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('size');
      expect(['redis', 'in-memory']).toContain(stats.type);
      expect(stats.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isUsingRedis', () => {
    it('should return boolean indicating Redis usage', () => {
      const usingRedis = cacheService.isUsingRedis();
      expect(typeof usingRedis).toBe('boolean');
    });
  });

  describe('TTL configuration', () => {
    it('should use DNS TTL when caching DNS data', async () => {
      const key = cacheService.generateKey('dns', 'example.com');
      const value = { records: [] };
      const dnsTTL = cacheService.getTTL('DNS');

      await cacheService.set(key, value, dnsTTL);
      
      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should use WHOIS TTL when caching WHOIS data', async () => {
      const key = cacheService.generateKey('whois', 'example.com');
      const value = { registrar: 'Test Registrar' };
      const whoisTTL = cacheService.getTTL('WHOIS');

      await cacheService.set(key, value, whoisTTL);
      
      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should use IP TTL when caching IP data', async () => {
      const key = cacheService.generateKey('ip', '8.8.8.8');
      const value = { country: 'US' };
      const ipTTL = cacheService.getTTL('IP');

      await cacheService.set(key, value, ipTTL);
      
      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(value);
    });
  });

  describe('error handling and fallback', () => {
    it('should handle cache operations gracefully even if Redis fails', async () => {
      // This test verifies that the service doesn't throw errors
      // and falls back to in-memory cache when Redis is unavailable
      
      const key = 'test:fallback';
      const value = 'fallback value';

      // These should not throw even if Redis is unavailable
      await expect(cacheService.set(key, value)).resolves.not.toThrow();
      await expect(cacheService.get(key)).resolves.not.toThrow();
      await expect(cacheService.delete(key)).resolves.not.toThrow();
      await expect(cacheService.clear()).resolves.not.toThrow();
    });

    it('should continue working after Redis connection issues', async () => {
      const key = 'test:resilience';
      const value = 'resilient value';

      // Set value
      await cacheService.set(key, value);

      // Get value - should work regardless of Redis status
      const retrieved = await cacheService.get<string>(key);
      expect(retrieved).toBe(value);
    });
  });

  describe('cache key generation strategy', () => {
    it('should generate unique keys for different namespaces', () => {
      const dnsKey = cacheService.generateKey('dns', 'example.com');
      const whoisKey = cacheService.generateKey('whois', 'example.com');
      const ipKey = cacheService.generateKey('ip', 'example.com');

      expect(dnsKey).not.toBe(whoisKey);
      expect(dnsKey).not.toBe(ipKey);
      expect(whoisKey).not.toBe(ipKey);
    });

    it('should generate unique keys for different identifiers', () => {
      const key1 = cacheService.generateKey('dns', 'example.com');
      const key2 = cacheService.generateKey('dns', 'test.com');

      expect(key1).not.toBe(key2);
    });

    it('should generate unique keys with different suffixes', () => {
      const keyA = cacheService.generateKey('dns', 'example.com', 'A');
      const keyAAAA = cacheService.generateKey('dns', 'example.com', 'AAAA');

      expect(keyA).not.toBe(keyAAAA);
    });

    it('should generate consistent keys for same inputs', () => {
      const key1 = cacheService.generateKey('dns', 'example.com', 'A');
      const key2 = cacheService.generateKey('dns', 'example.com', 'A');

      expect(key1).toBe(key2);
    });
  });

  describe('multiple data types', () => {
    it('should handle caching different data types simultaneously', async () => {
      const dnsKey = cacheService.generateKey('dns', 'example.com');
      const whoisKey = cacheService.generateKey('whois', 'example.com');
      const ipKey = cacheService.generateKey('ip', '8.8.8.8');

      const dnsData = { records: ['A', 'AAAA'] };
      const whoisData = { registrar: 'Test' };
      const ipData = { country: 'US' };

      await cacheService.set(dnsKey, dnsData, cacheService.getTTL('DNS'));
      await cacheService.set(whoisKey, whoisData, cacheService.getTTL('WHOIS'));
      await cacheService.set(ipKey, ipData, cacheService.getTTL('IP'));

      expect(await cacheService.get(dnsKey)).toEqual(dnsData);
      expect(await cacheService.get(whoisKey)).toEqual(whoisData);
      expect(await cacheService.get(ipKey)).toEqual(ipData);
    });
  });
});
