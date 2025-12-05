# Cache Service Integration Guide

## Quick Start

### 1. Import the Cache Service

```typescript
import { cacheService } from './services/cache.service';
```

### 2. Basic Pattern

```typescript
async function cachedOperation(identifier: string) {
  // 1. Generate cache key
  const key = cacheService.generateKey('namespace', identifier);
  
  // 2. Try to get from cache
  const cached = await cacheService.get<ResultType>(key);
  if (cached) {
    return cached;
  }
  
  // 3. Perform expensive operation
  const result = await expensiveOperation(identifier);
  
  // 4. Store in cache
  await cacheService.set(key, result, cacheService.getTTL('DNS'));
  
  return result;
}
```

## Integration Examples

### DNS Service Integration

```typescript
// backend/src/services/dns.service.ts
import { cacheService } from './cache.service';

export class DNSService {
  async lookupRecords(domain: string, types?: DNSRecordType[]): Promise<DNSResult> {
    // Generate cache key with record types as suffix
    const suffix = types?.join(',') || 'all';
    const cacheKey = cacheService.generateKey('dns', domain, suffix);
    
    // Try cache
    const cached = await cacheService.get<DNSResult>(cacheKey);
    if (cached) {
      console.log(`Cache hit for DNS lookup: ${domain}`);
      return cached;
    }
    
    // Cache miss - perform lookup
    console.log(`Cache miss for DNS lookup: ${domain}`);
    const result = await this.performDNSLookup(domain, types);
    
    // Store in cache with DNS TTL (5 minutes)
    await cacheService.set(cacheKey, result, cacheService.getTTL('DNS'));
    
    return result;
  }
  
  private async performDNSLookup(domain: string, types?: DNSRecordType[]): Promise<DNSResult> {
    // Existing DNS lookup logic
    // ...
  }
}
```

### WHOIS Service Integration

```typescript
// backend/src/services/whois.service.ts
import { cacheService } from './cache.service';

export class WHOISService {
  async lookup(domain: string): Promise<WHOISResult> {
    const cacheKey = cacheService.generateKey('whois', domain);
    
    // Try cache
    const cached = await cacheService.get<WHOISResult>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Perform WHOIS lookup
    const result = await this.performWHOISLookup(domain);
    
    // Store with WHOIS TTL (24 hours)
    await cacheService.set(cacheKey, result, cacheService.getTTL('WHOIS'));
    
    return result;
  }
}
```

### RDAP Service Integration

```typescript
// backend/src/services/rdap.service.ts
import { cacheService } from './cache.service';

export class RDAPService {
  async lookupDomain(domain: string): Promise<RDAPResult | null> {
    const cacheKey = cacheService.generateKey('rdap', domain);
    
    // Try cache
    const cached = await cacheService.get<RDAPResult>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Perform RDAP lookup
    const result = await this.performRDAPLookup(domain);
    
    if (result) {
      // Store with WHOIS TTL (24 hours) - RDAP is similar to WHOIS
      await cacheService.set(cacheKey, result, cacheService.getTTL('WHOIS'));
    }
    
    return result;
  }
}
```

### IP Service Integration

```typescript
// backend/src/services/ip.service.ts
import { cacheService } from './cache.service';

export class IPService {
  async lookupIP(ip: string): Promise<IPResult> {
    const cacheKey = cacheService.generateKey('ip', ip);
    
    // Try cache
    const cached = await cacheService.get<IPResult>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Perform IP lookup
    const result = await this.performIPLookup(ip);
    
    // Store with IP TTL (1 hour)
    await cacheService.set(cacheKey, result, cacheService.getTTL('IP'));
    
    return result;
  }
}
```

### Host Service Integration

```typescript
// backend/src/services/host.service.ts
import { cacheService } from './cache.service';

export class HostService {
  async checkHTTP(url: string): Promise<HTTPResult> {
    const cacheKey = cacheService.generateKey('http', url);
    
    // Try cache
    const cached = await cacheService.get<HTTPResult>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Perform HTTP check
    const result = await this.performHTTPCheck(url);
    
    // Store with shorter TTL (5 minutes) - HTTP status can change frequently
    await cacheService.set(cacheKey, result, cacheService.getTTL('DNS'));
    
    return result;
  }
  
  async checkSSL(domain: string): Promise<SSLResult> {
    const cacheKey = cacheService.generateKey('ssl', domain);
    
    // Try cache
    const cached = await cacheService.get<SSLResult>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Perform SSL check
    const result = await this.performSSLCheck(domain);
    
    // Store with IP TTL (1 hour) - SSL certs don't change often
    await cacheService.set(cacheKey, result, cacheService.getTTL('IP'));
    
    return result;
  }
}
```

## Cache Invalidation

### Manual Invalidation

```typescript
// After updating data, invalidate cache
async function updateDomain(domain: string) {
  // Perform update
  await performUpdate(domain);
  
  // Invalidate all related cache entries
  await cacheService.delete(cacheService.generateKey('dns', domain));
  await cacheService.delete(cacheService.generateKey('whois', domain));
  await cacheService.delete(cacheService.generateKey('rdap', domain));
}
```

### Batch Invalidation

```typescript
async function invalidateDomainCache(domain: string) {
  const namespaces = ['dns', 'whois', 'rdap', 'ssl'];
  
  await Promise.all(
    namespaces.map(ns => 
      cacheService.delete(cacheService.generateKey(ns, domain))
    )
  );
}
```

## API Endpoint Integration

### Express Middleware Pattern

```typescript
// backend/src/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cache.service';

export function cacheMiddleware(namespace: string, ttlType: 'DNS' | 'WHOIS' | 'IP') {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Generate cache key from request
    const identifier = req.body.domain || req.body.ip || req.params.id;
    const cacheKey = cacheService.generateKey(namespace, identifier);
    
    // Try cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Store original res.json
    const originalJson = res.json.bind(res);
    
    // Override res.json to cache response
    res.json = (data: any) => {
      // Cache the response
      cacheService.set(cacheKey, data, cacheService.getTTL(ttlType));
      return originalJson(data);
    };
    
    next();
  };
}
```

### Usage in Routes

```typescript
// backend/src/routes/dns.routes.ts
import { Router } from 'express';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();

router.post('/lookup', 
  cacheMiddleware('dns', 'DNS'),
  async (req, res) => {
    // Your DNS lookup logic
    const result = await dnsService.lookupRecords(req.body.domain);
    res.json(result);
  }
);
```

## Testing with Cache

### Mocking Cache in Tests

```typescript
// In your test file
import { cacheService } from './cache.service';

describe('DNSService', () => {
  beforeEach(() => {
    // Clear cache before each test
    await cacheService.clear();
  });
  
  it('should use cache on second call', async () => {
    const domain = 'example.com';
    
    // First call - cache miss
    const result1 = await dnsService.lookupRecords(domain);
    
    // Second call - cache hit
    const result2 = await dnsService.lookupRecords(domain);
    
    expect(result1).toEqual(result2);
    // Verify only one actual DNS lookup was performed
  });
});
```

## Monitoring Cache Performance

### Add Cache Metrics

```typescript
// backend/src/services/cache.service.ts
export class CacheService {
  private hits = 0;
  private misses = 0;
  
  async get<T>(key: string): Promise<T | null> {
    const result = await this.getInternal<T>(key);
    
    if (result) {
      this.hits++;
    } else {
      this.misses++;
    }
    
    return result;
  }
  
  getMetrics() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(2) + '%'
    };
  }
}
```

### Expose Metrics Endpoint

```typescript
// backend/src/routes/metrics.routes.ts
router.get('/cache/metrics', async (req, res) => {
  const stats = await cacheService.getStats();
  const metrics = cacheService.getMetrics();
  
  res.json({
    ...stats,
    ...metrics
  });
});
```

## Best Practices

### 1. Always Use Type Safety

```typescript
// Good
const result = await cacheService.get<DNSResult>(key);

// Bad
const result = await cacheService.get(key);
```

### 2. Use Appropriate TTL

```typescript
// Frequently changing data - short TTL
await cacheService.set(key, data, cacheService.getTTL('DNS')); // 5 min

// Stable data - long TTL
await cacheService.set(key, data, cacheService.getTTL('WHOIS')); // 24 hours
```

### 3. Handle Cache Misses Gracefully

```typescript
const cached = await cacheService.get(key);
if (cached) {
  return cached;
}

// Always have fallback logic
const result = await performOperation();
await cacheService.set(key, result, ttl);
return result;
```

### 4. Use Consistent Key Naming

```typescript
// Good - use generateKey
const key = cacheService.generateKey('dns', domain, 'A');

// Bad - manual key construction
const key = `dns:${domain}:A`;
```

### 5. Clear Cache on Updates

```typescript
async function updateRecord(domain: string) {
  await performUpdate(domain);
  await cacheService.delete(cacheService.generateKey('dns', domain));
}
```

## Troubleshooting

### Cache Not Working

1. Check if cache service is initialized
2. Verify key generation is consistent
3. Check TTL values
4. Monitor cache statistics

### Redis Connection Issues

1. Verify REDIS_URL environment variable
2. Check Redis server status
3. Service automatically falls back to in-memory

### Memory Issues

1. Monitor cache size with `getStats()`
2. Reduce TTL values if needed
3. Consider using Redis for production

## Production Deployment

### Environment Setup

```bash
# .env
REDIS_URL=redis://your-redis-server:6379
CACHE_TTL_DNS=300
CACHE_TTL_WHOIS=86400
CACHE_TTL_IP=3600
```

### Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
  
  backend:
    build: ./backend
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

volumes:
  redis-data:
```

### Health Check

```typescript
router.get('/health/cache', async (req, res) => {
  const stats = await cacheService.getStats();
  const isHealthy = stats.type === 'redis' || stats.type === 'in-memory';
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    ...stats
  });
});
```

## Summary

The cache service is now ready for integration across all services. Follow the patterns above for consistent caching behavior and optimal performance.

For more details, see:
- `CACHE_README.md` - Complete documentation
- `cache.service.example.ts` - More examples
- `cache.service.test.ts` - Test examples
