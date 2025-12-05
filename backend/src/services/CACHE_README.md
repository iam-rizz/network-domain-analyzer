# Cache Service Documentation

## Overview

The Cache Service provides a flexible caching layer with optional Redis support and automatic fallback to in-memory caching. It's designed to improve performance by caching frequently accessed data like DNS lookups, WHOIS information, and IP geolocation results.

## Features

- **Dual Storage**: Redis (optional) with automatic fallback to in-memory cache
- **Configurable TTL**: Different TTL values for different data types
- **Automatic Cleanup**: Periodic cleanup of expired in-memory entries
- **Error Resilience**: Graceful handling of Redis failures
- **Type-Safe**: Full TypeScript support with generics
- **Cache Key Strategy**: Consistent key generation with namespace support

## Installation

The cache service works out of the box with in-memory caching. To enable Redis support:

```bash
npm install redis
```

## Configuration

### Environment Variables

```bash
# Optional: Redis connection URL
REDIS_URL=redis://localhost:6379

# Optional: Custom TTL values (in seconds)
CACHE_TTL_DNS=300      # 5 minutes (default)
CACHE_TTL_WHOIS=86400  # 24 hours (default)
CACHE_TTL_IP=3600      # 1 hour (default)
```

### TTL Configuration

The service comes with pre-configured TTL values for different data types:

| Data Type | TTL | Description |
|-----------|-----|-------------|
| DNS | 5 minutes | DNS records change infrequently |
| WHOIS | 24 hours | Domain registration data is stable |
| IP | 1 hour | IP geolocation data is relatively stable |
| DEFAULT | 10 minutes | Fallback for other data types |

## Usage

### Basic Usage

```typescript
import { cacheService } from './services/cache.service';

// Generate a cache key
const key = cacheService.generateKey('dns', 'example.com');

// Set a value with DNS TTL
await cacheService.set(key, dnsData, cacheService.getTTL('DNS'));

// Get a value
const cached = await cacheService.get<DNSResult>(key);

// Delete a value
await cacheService.delete(key);

// Clear all cache
await cacheService.clear();
```

### Integration with Services

```typescript
import { cacheService } from './cache.service';
import { DNSService } from './dns.service';

export class CachedDNSService {
  private dnsService = new DNSService();

  async lookupRecords(domain: string): Promise<DNSResult> {
    // Generate cache key
    const cacheKey = cacheService.generateKey('dns', domain);
    
    // Try cache first
    const cached = await cacheService.get<DNSResult>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Cache miss - perform lookup
    const result = await this.dnsService.lookupRecords(domain);
    
    // Store in cache
    await cacheService.set(
      cacheKey,
      result,
      cacheService.getTTL('DNS')
    );
    
    return result;
  }
}
```

### Cache Key Generation

The service provides a consistent key generation strategy:

```typescript
// Basic key: nda:dns:example.com
const key1 = cacheService.generateKey('dns', 'example.com');

// Key with suffix: nda:dns:example.com:A
const key2 = cacheService.generateKey('dns', 'example.com', 'A');

// Keys are normalized (lowercase, trimmed)
const key3 = cacheService.generateKey('dns', '  EXAMPLE.COM  ');
// Result: nda:dns:example.com
```

### Custom TTL

```typescript
// Use custom TTL (in seconds)
await cacheService.set('custom:key', data, 3600); // 1 hour

// Or use predefined TTL
await cacheService.set(
  'dns:example.com',
  data,
  cacheService.getTTL('DNS')
);
```

### Cache Statistics

```typescript
// Get cache statistics
const stats = await cacheService.getStats();
console.log(`Cache type: ${stats.type}`); // 'redis' or 'in-memory'
console.log(`Cache size: ${stats.size} entries`);

// Check if using Redis
const usingRedis = cacheService.isUsingRedis();
```

## API Reference

### Methods

#### `generateKey(namespace: string, identifier: string, suffix?: string): string`

Generates a consistent cache key with namespace.

- **namespace**: Cache namespace (e.g., 'dns', 'whois', 'ip')
- **identifier**: Unique identifier (e.g., domain name, IP address)
- **suffix**: Optional suffix for additional specificity
- **Returns**: Generated cache key

#### `async get<T>(key: string): Promise<T | null>`

Retrieves a value from cache.

- **key**: Cache key
- **Returns**: Cached value or null if not found/expired

#### `async set<T>(key: string, value: T, ttl?: number): Promise<void>`

Stores a value in cache with TTL.

- **key**: Cache key
- **value**: Value to cache
- **ttl**: Time to live in seconds (optional)

#### `async delete(key: string): Promise<void>`

Deletes a value from cache.

- **key**: Cache key

#### `async clear(): Promise<void>`

Clears all cache entries with 'nda:' prefix.

#### `getTTL(dataType: CacheDataType): number`

Gets the configured TTL for a data type.

- **dataType**: 'DNS' | 'WHOIS' | 'IP' | 'DEFAULT'
- **Returns**: TTL in seconds

#### `isUsingRedis(): boolean`

Checks if Redis is being used.

- **Returns**: True if Redis is active, false if using in-memory

#### `async getStats(): Promise<{ type: 'redis' | 'in-memory'; size: number }>`

Gets cache statistics.

- **Returns**: Object with cache type and size

#### `async disconnect(): Promise<void>`

Cleanup and disconnect (call on application shutdown).

## Error Handling

The cache service is designed to be resilient:

1. **Redis Unavailable**: Automatically falls back to in-memory cache
2. **Redis Connection Lost**: Switches to in-memory cache and continues operation
3. **Cache Failures**: Operations fail gracefully without throwing errors
4. **Expired Entries**: Automatically cleaned up in in-memory cache

## Best Practices

### 1. Use Appropriate TTL

```typescript
// Short TTL for frequently changing data
await cacheService.set(key, data, cacheService.getTTL('DNS'));

// Long TTL for stable data
await cacheService.set(key, data, cacheService.getTTL('WHOIS'));
```

### 2. Namespace Your Keys

```typescript
// Good: Clear namespace
const key = cacheService.generateKey('dns', domain);

// Bad: Generic key
const key = `cache:${domain}`;
```

### 3. Handle Cache Misses

```typescript
const cached = await cacheService.get(key);
if (!cached) {
  // Perform expensive operation
  const result = await expensiveOperation();
  await cacheService.set(key, result, ttl);
  return result;
}
return cached;
```

### 4. Invalidate When Needed

```typescript
// After updating data, invalidate cache
await updateDomain(domain);
await cacheService.delete(cacheService.generateKey('dns', domain));
```

### 5. Use Type Safety

```typescript
// Good: Type-safe retrieval
const result = await cacheService.get<DNSResult>(key);

// Bad: Untyped
const result = await cacheService.get(key);
```

## Performance Considerations

### In-Memory Cache

- **Pros**: Fast, no external dependencies, works everywhere
- **Cons**: Limited by process memory, not shared across instances
- **Best for**: Development, single-instance deployments

### Redis Cache

- **Pros**: Shared across instances, persistent, scalable
- **Cons**: Requires Redis server, network latency
- **Best for**: Production, multi-instance deployments

### Memory Management

The in-memory cache automatically cleans up expired entries every 5 minutes to prevent memory leaks.

## Testing

The cache service includes comprehensive tests:

```bash
npm test -- cache.service.test.ts
```

Tests cover:
- Key generation
- Set/get operations
- TTL expiration
- Delete and clear operations
- Error handling and fallback
- Multiple data types
- Cache statistics

## Troubleshooting

### Redis Connection Issues

If you see "Redis not available" messages:

1. Check if Redis is running: `redis-cli ping`
2. Verify REDIS_URL environment variable
3. Check network connectivity
4. The service will automatically fall back to in-memory cache

### Memory Issues

If in-memory cache grows too large:

1. Reduce TTL values
2. Implement cache size limits
3. Consider using Redis for production
4. Monitor cache statistics regularly

### Performance Issues

If cache operations are slow:

1. Check Redis server performance
2. Monitor network latency
3. Consider using in-memory cache for local development
4. Review TTL configuration

## Migration Guide

### From No Cache to Cache Service

```typescript
// Before
async lookupDomain(domain: string) {
  return await this.dnsService.lookup(domain);
}

// After
async lookupDomain(domain: string) {
  const key = cacheService.generateKey('dns', domain);
  const cached = await cacheService.get(key);
  if (cached) return cached;
  
  const result = await this.dnsService.lookup(domain);
  await cacheService.set(key, result, cacheService.getTTL('DNS'));
  return result;
}
```

### From In-Memory to Redis

1. Install Redis: `npm install redis`
2. Set REDIS_URL environment variable
3. Restart application
4. Cache service automatically uses Redis

No code changes required!

## License

Part of the Network & Domain Analysis Tool project.
