# RDAP Bootstrap Data Documentation

Documentation for the RDAP (Registration Data Access Protocol) bootstrap data used by Network & Domain Analyzer.

## Overview

RDAP is a modern protocol for querying domain registration information, designed to replace the legacy WHOIS protocol. It provides structured JSON responses and better internationalization support.

The application uses a bootstrap file (`dns.json`) to determine which RDAP server to query for each Top-Level Domain (TLD).

## Bootstrap File Location

```
/dns.json
```

This file is loaded at application startup by the RDAP Service.

## File Format

The bootstrap file follows the IANA RDAP Bootstrap format (RFC 7484).

### Structure

```json
{
  "description": "RDAP bootstrap file for Domain Name System registrations",
  "publication": "2025-12-02T19:00:02Z",
  "services": [
    [
      ["tld1", "tld2"],
      ["https://rdap.server.example/"]
    ],
    [
      ["com", "net"],
      ["https://rdap.verisign.com/com/v1/", "https://rdap.verisign.com/net/v1/"]
    ]
  ],
  "version": "1.0"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Human-readable description |
| `publication` | string | ISO 8601 timestamp of last update |
| `services` | array | Array of TLD-to-server mappings |
| `version` | string | Bootstrap file version |

### Services Array

Each entry in the `services` array is a tuple:
- First element: Array of TLDs served by this RDAP server
- Second element: Array of RDAP server URLs (in order of preference)

```json
[
  ["com", "net"],           // TLDs
  [                         // RDAP servers
    "https://rdap.verisign.com/com/v1/",
    "https://rdap.verisign.com/net/v1/"
  ]
]
```

## How It Works

### 1. TLD Extraction

When a domain lookup is requested, the system extracts the TLD:

```
example.com → com
subdomain.example.co.uk → co.uk
```

### 2. Server Lookup

The system searches the bootstrap data for a matching TLD:

```typescript
// Simplified lookup logic
function findRDAPServer(tld: string): string | null {
  for (const [tlds, servers] of bootstrapData.services) {
    if (tlds.includes(tld)) {
      return servers[0]; // Return first (preferred) server
    }
  }
  return null; // TLD not found
}
```

### 3. RDAP Query

If a server is found, the system queries it:

```
GET https://rdap.verisign.com/com/v1/domain/example.com
```

### 4. Fallback to WHOIS

If no RDAP server is found or the query fails, the system falls back to traditional WHOIS lookup.

## Updating Bootstrap Data

### Official Source

The official IANA RDAP bootstrap file is available at:
```
https://data.iana.org/rdap/dns.json
```

### Update Script

```bash
#!/bin/bash
# update-rdap-bootstrap.sh

curl -o dns.json.new https://data.iana.org/rdap/dns.json

if [ $? -eq 0 ]; then
  mv dns.json dns.json.backup
  mv dns.json.new dns.json
  echo "Bootstrap data updated successfully"
else
  echo "Failed to download bootstrap data"
  exit 1
fi
```

### Automated Updates

Set up a cron job to update weekly:

```bash
# /etc/cron.weekly/update-rdap
#!/bin/bash
cd /var/www/netanalyzer
./update-rdap-bootstrap.sh
pm2 restart netanalyzer-api
```

## RDAP Service API

### Initialization

```typescript
import { RDAPService } from './services/rdap.service';

const rdapService = new RDAPService('./dns.json');
await rdapService.initialize();
```

### Domain Lookup

```typescript
const result = await rdapService.lookupDomain('example.com');
```

### Response Format

```typescript
interface RDAPResult {
  domain: string;
  registrar: string;
  registrationDate: Date;
  expirationDate: Date;
  nameServers: string[];
  status: string[];
  source: 'rdap' | 'whois';  // Indicates data source
  timestamp: Date;
}
```

### Bootstrap Info

```typescript
const info = rdapService.getBootstrapInfo();
// Returns: { tldCount: 1200, serverCount: 150, lastUpdated: "..." }
```

## Supported TLDs

The bootstrap file includes RDAP servers for:

- Generic TLDs (gTLDs): `.com`, `.net`, `.org`, `.info`, etc.
- Country Code TLDs (ccTLDs): `.uk`, `.de`, `.jp`, `.au`, etc.
- New gTLDs: `.app`, `.dev`, `.blog`, `.shop`, etc.
- Internationalized TLDs: `.中国`, `.日本`, etc.

### Checking TLD Support

```typescript
// Check if TLD has RDAP support
const server = rdapService.findRDAPServer('com');
if (server) {
  console.log('RDAP supported:', server);
} else {
  console.log('RDAP not available, will use WHOIS');
}
```

## RDAP vs WHOIS

| Feature | RDAP | WHOIS |
|---------|------|-------|
| Response Format | JSON | Plain text |
| Standardized | Yes (RFC 7480-7484) | No |
| Internationalization | Full Unicode support | Limited |
| Access Control | Built-in | None |
| Rate Limiting | Standardized headers | Varies |
| Structured Data | Yes | Requires parsing |

## Error Handling

### TLD Not Found

If the TLD is not in the bootstrap data:
- System automatically falls back to WHOIS
- Response includes `source: 'whois'`

### RDAP Server Unavailable

If the RDAP server doesn't respond within 10 seconds:
- System falls back to WHOIS
- Error is logged for monitoring

### Invalid Response

If the RDAP response cannot be parsed:
- System falls back to WHOIS
- Error is logged with response details

## Troubleshooting

### Bootstrap File Not Loading

```bash
# Check file exists and is valid JSON
cat dns.json | jq . > /dev/null
echo $?  # Should be 0
```

### RDAP Queries Failing

```bash
# Test RDAP server directly
curl -v "https://rdap.verisign.com/com/v1/domain/example.com"
```

### High Latency

- Check network connectivity to RDAP servers
- Consider caching RDAP responses
- Monitor RDAP server response times

## References

- [RFC 7480 - HTTP Usage in RDAP](https://tools.ietf.org/html/rfc7480)
- [RFC 7481 - Security Services for RDAP](https://tools.ietf.org/html/rfc7481)
- [RFC 7482 - RDAP Query Format](https://tools.ietf.org/html/rfc7482)
- [RFC 7483 - JSON Responses for RDAP](https://tools.ietf.org/html/rfc7483)
- [RFC 7484 - RDAP Bootstrap](https://tools.ietf.org/html/rfc7484)
- [IANA RDAP Bootstrap Registry](https://data.iana.org/rdap/)
