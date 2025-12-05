# API Documentation

Network & Domain Analyzer REST API documentation.

## Base URL

- Development: `http://localhost:5000/api`
- Production: Configure via `VITE_API_BASE_URL`

## Authentication

Some endpoints require API key authentication. Include the API key in the `X-API-Key` header:

```bash
curl -X POST http://localhost:5000/api/batch/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: nda_your_api_key_here" \
  -d '{"domains": ["example.com"]}'
```

### API Key Format

API keys follow the format: `nda_` + 32 hexadecimal characters

Example: `nda_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Generating API Keys

Use the Security Service to generate API keys:

```typescript
import { securityService } from './services/security.service';

const apiKey = securityService.generateAPIKey();
const hash = await securityService.hashAPIKey(apiKey);
// Store hash in database, give apiKey to user
```

## Rate Limiting

All endpoints are rate limited. Rate limit information is included in response headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |
| `Retry-After` | Seconds until retry (only on 429 response) |

### Rate Limits by Endpoint

| Endpoint Group | Requests | Window |
|----------------|----------|--------|
| DNS | 50 | 15 minutes |
| RDAP | 50 | 15 minutes |
| WHOIS | 30 | 15 minutes |
| Host | 50 | 15 minutes |
| IP | 100 | 15 minutes |
| Batch | 5 | 15 minutes |
| History | 100 | 15 minutes |

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `MISSING_API_KEY` | 401 | API key required but not provided |
| `INVALID_API_KEY` | 401 | API key invalid or expired |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## DNS Endpoints

### POST /api/dns/lookup

Lookup DNS records for a domain.

**Request Body:**

```json
{
  "domain": "example.com",
  "recordTypes": ["A", "MX", "TXT"]  // optional, defaults to all types
}
```

**Valid Record Types:** `A`, `AAAA`, `MX`, `TXT`, `CNAME`, `NS`, `SOA`

**Response:**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "records": [
      {
        "type": "A",
        "value": "93.184.216.34",
        "ttl": 300
      },
      {
        "type": "MX",
        "value": "mail.example.com",
        "priority": 10,
        "ttl": 3600
      }
    ],
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

### POST /api/dns/propagation

Check DNS propagation across multiple locations.

**Request Body:**

```json
{
  "domain": "example.com",
  "recordType": "A"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "recordType": "A",
    "fullyPropagated": true,
    "locations": [
      {
        "location": "US-East",
        "status": "success",
        "records": [{"type": "A", "value": "93.184.216.34", "ttl": 300}],
        "responseTime": 45
      },
      {
        "location": "EU-West",
        "status": "success",
        "records": [{"type": "A", "value": "93.184.216.34", "ttl": 300}],
        "responseTime": 78
      }
    ],
    "inconsistencies": [],
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

---

## RDAP Endpoints

### POST /api/rdap/lookup

Lookup domain registration information using RDAP protocol with WHOIS fallback.

**Request Body:**

```json
{
  "domain": "example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "registrar": "Example Registrar, Inc.",
    "registrationDate": "1995-08-14T00:00:00.000Z",
    "expirationDate": "2025-08-13T00:00:00.000Z",
    "nameServers": ["ns1.example.com", "ns2.example.com"],
    "status": ["clientTransferProhibited"],
    "source": "rdap",
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

**Source Values:**
- `rdap` - Data retrieved via RDAP protocol
- `whois` - Fallback to traditional WHOIS

### GET /api/rdap/bootstrap

Get RDAP bootstrap information.

**Response:**

```json
{
  "success": true,
  "data": {
    "tldCount": 1200,
    "serverCount": 150,
    "lastUpdated": "2024-12-02T19:00:02Z"
  }
}
```

---

## WHOIS Endpoints

### POST /api/whois/lookup

Lookup WHOIS information for a domain.

**Request Body:**

```json
{
  "domain": "example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "registrar": "Example Registrar, Inc.",
    "registrationDate": "1995-08-14T00:00:00.000Z",
    "expirationDate": "2025-08-13T00:00:00.000Z",
    "nameServers": ["ns1.example.com", "ns2.example.com"],
    "status": ["clientTransferProhibited"],
    "privacyProtected": false,
    "needsRenewal": false,
    "daysUntilExpiry": 250,
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

---

## Host Monitoring Endpoints

### POST /api/host/ping

Ping a host from multiple locations.

**Request Body:**

```json
{
  "host": "example.com",
  "locations": ["US-East", "EU-West"]  // optional
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "location": "US-East",
      "alive": true,
      "responseTime": 45,
      "timestamp": "2024-12-05T10:30:00.000Z"
    }
  ]
}
```

### POST /api/host/http-check

Check HTTP/HTTPS endpoint availability.

**Request Body:**

```json
{
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "statusCode": 200,
    "responseTime": 234,
    "headers": {
      "content-type": "text/html; charset=UTF-8"
    },
    "isSlow": false,
    "slowResponseThreshold": 5000,
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

### POST /api/host/port-scan

Scan ports on a host.

**Request Body:**

```json
{
  "host": "example.com",
  "ports": [80, 443, 22, 3306]  // optional, defaults to common ports
}
```

**Default Ports:** 80, 443, 22, 21, 25, 3306, 5432

**Response:**

```json
{
  "success": true,
  "data": {
    "host": "example.com",
    "scannedPorts": [80, 443, 22, 3306],
    "openPorts": [
      {"port": 80, "service": "HTTP", "state": "open"},
      {"port": 443, "service": "HTTPS", "state": "open"}
    ],
    "closedPorts": [22, 3306],
    "summary": {
      "total": 4,
      "open": 2,
      "closed": 2
    },
    "scanDuration": 1234,
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

### POST /api/host/ssl-check

Check SSL certificate for a domain.

**Request Body:**

```json
{
  "domain": "example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "valid": true,
    "issuer": "DigiCert Inc",
    "subject": "example.com",
    "validFrom": "2024-01-01T00:00:00.000Z",
    "validTo": "2025-01-01T00:00:00.000Z",
    "daysUntilExpiry": 27,
    "isExpiringSoon": true,
    "isExpired": false,
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

---

## IP Endpoints

### GET /api/ip/current

Get current IP address of the requester with geolocation.

**Response:**

```json
{
  "success": true,
  "data": {
    "ip": "203.0.113.45",
    "type": "IPv4",
    "country": "United States",
    "city": "San Francisco",
    "region": "California",
    "isp": "Example ISP",
    "timezone": "America/Los_Angeles",
    "organization": "Example Corp",
    "isPrivate": false,
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

### POST /api/ip/lookup

Lookup IP address information.

**Request Body:**

```json
{
  "ip": "8.8.8.8"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "ip": "8.8.8.8",
    "type": "IPv4",
    "country": "United States",
    "city": "Mountain View",
    "region": "California",
    "isp": "Google LLC",
    "timezone": "America/Los_Angeles",
    "organization": "Google LLC",
    "isPrivate": false,
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

**Private IP Response:**

```json
{
  "success": true,
  "data": {
    "ip": "192.168.1.1",
    "type": "IPv4",
    "isPrivate": true,
    "message": "Private IP addresses cannot be geolocated",
    "timestamp": "2024-12-05T10:30:00.000Z"
  }
}
```

---

## Batch Analysis Endpoints

### POST /api/batch/analyze

**🔐 Requires API Key**

Analyze multiple domains in batch.

**Request Body:**

```json
{
  "domains": "example.com\ngoogle.com\ngithub.com",
  "analysisTypes": ["dns", "whois"]
}
```

Or as array:

```json
{
  "domains": ["example.com", "google.com", "github.com"],
  "analysisTypes": ["dns"]
}
```

**Valid Analysis Types:** `dns`, `whois`, `rdap`, `host`, `all`

**Maximum Domains:** 50

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 3,
      "successful": 3,
      "failed": 0
    },
    "results": [
      {
        "domain": "example.com",
        "status": "success",
        "result": { ... }
      },
      {
        "domain": "google.com",
        "status": "success",
        "result": { ... }
      }
    ]
  }
}
```

---

## History Endpoints

### GET /api/history

Get analysis history with pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Results per page (1-100) |
| `offset` | number | 0 | Offset for pagination |

**Response:**

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "abc123",
        "type": "dns_lookup",
        "domain": "example.com",
        "status": "success",
        "createdAt": "2024-12-05T10:30:00.000Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 45,
      "hasMore": true
    }
  }
}
```

### GET /api/history/:id

Get a specific analysis by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "type": "dns_lookup",
    "domain": "example.com",
    "result": { ... },
    "status": "success",
    "createdAt": "2024-12-05T10:30:00.000Z"
  }
}
```

### DELETE /api/history/:id

Delete a specific analysis.

**Response:**

```json
{
  "success": true,
  "message": "Analysis deleted successfully"
}
```

### POST /api/history/export

**🔐 Requires API Key**

Export analyses to JSON or CSV format.

**Request Body:**

```json
{
  "ids": ["abc123", "def456"],
  "format": "json"
}
```

**Valid Formats:** `json`, `csv`

**Response:**

File download with appropriate Content-Type header.

---

## Error Handling

### Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Domain is required",
    "details": {
      "field": "domain"
    }
  }
}
```

### Rate Limit Errors

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "retryAfter": 300
  }
}
```

### Authentication Errors

```json
{
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API key is required for this endpoint"
  }
}
```
