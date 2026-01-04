[![Quality Gate Status](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=alert_status&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)
[![Maintainability Rating](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=software_quality_maintainability_rating&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)
[![Security Rating](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=software_quality_security_rating&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)

# Network & Domain Analyzer

All-in-one platform for DNS checking, WHOIS lookup, host monitoring, and network analysis.

## Features

- **DNS Lookup**: Query all DNS record types (A, AAAA, MX, TXT, CNAME, NS, SOA)
- **DNS Propagation Check**: Verify DNS propagation across multiple global locations
- **RDAP Lookup**: Modern domain registration lookup using RDAP protocol with WHOIS fallback
- **WHOIS Lookup**: Traditional domain registration information
- **Host Monitoring**: Ping tests and HTTP/HTTPS availability checks
- **Port Scanning**: Scan common or custom port ranges
- **SSL Certificate Validation**: Check certificate validity and expiration
- **IP Address Lookup**: Get geolocation and ISP information with dual IPv4/IPv6 support
- **Batch Analysis**: Process multiple domains simultaneously
- **History Tracking**: Save and compare analysis results over time
- **Export Functionality**: Export results in JSON or CSV format

## Code Quality (SonarQube)

[![Quality Gate Status](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=alert_status&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)
[![Lines of Code](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=ncloc&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)

[![Reliability Rating](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=software_quality_reliability_rating&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)
[![Maintainability Rating](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=software_quality_maintainability_rating&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)

[![Security Rating](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=software_quality_security_rating&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)
[![Security Issues](https://sonarqube.rizzcode.id/api/project_badges/measure?project=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f&metric=software_quality_security_issues&token=sqb_8a0848ceeaa7c9f71c452b209382032dcdcbac97)](https://sonarqube.rizzcode.id/dashboard?id=iam-rizz_network-domain-analyzer_87614f1a-2aad-4844-9f04-968d893ac75f)

## Tech Stack

### Backend
- Node.js 18+ with TypeScript
- Express.js for REST API
- SQLite (development) / PostgreSQL (production)
- Redis for caching (optional)
- Jest + fast-check for testing

### Frontend
- React 18+ with TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- Vite for build tooling
- Vitest for testing

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Redis (optional, for production caching)

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/iam-rizz/network-domain-analyzer.git
cd network-domain-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

4. Start development servers:
```bash
npm run dev
```

The backend runs on `http://localhost:5000` and frontend on `http://localhost:3000`.

## Configuration

See [backend/.env.example](backend/.env.example) for all available configuration options.

### Key Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | 5000 |
| `NODE_ENV` | Environment (development/production) | development |
| `DATABASE_URL` | Database connection string | ./data/analyses.db |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `ALLOWED_ORIGINS` | CORS allowed origins | http://localhost:3000 |
| `API_KEY_SECRET` | Secret for API key generation | (required for production) |

## API Documentation

See [docs/API.md](docs/API.md) for complete API documentation.

### Quick API Reference

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/dns/lookup` | POST | DNS record lookup | No |
| `/api/dns/propagation` | POST | DNS propagation check | No |
| `/api/rdap/lookup` | POST | RDAP domain lookup | No |
| `/api/rdap/bootstrap` | GET | RDAP bootstrap info | No |
| `/api/whois/lookup` | POST | WHOIS lookup | No |
| `/api/host/ping` | POST | Ping host | No |
| `/api/host/http-check` | POST | HTTP/HTTPS check | No |
| `/api/host/port-scan` | POST | Port scanning | No |
| `/api/host/ssl-check` | POST | SSL certificate check | No |
| `/api/ip/current` | GET | Get current IP | No |
| `/api/ip/dual` | GET | Get IPv4 and IPv6 | No |
| `/api/ip/lookup` | POST | IP geolocation lookup | No |
| `/api/batch/analyze` | POST | Batch domain analysis | **Yes** |
| `/api/history` | GET | Get analysis history | No |
| `/api/history/:id` | GET | Get specific analysis | No |
| `/api/history/:id` | DELETE | Delete analysis | No |
| `/api/history/export` | POST | Export analyses | **Yes** |

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for security best practices and configuration.

### Key Security Features

- **Rate Limiting**: Sliding window algorithm with Redis/in-memory support
- **Input Sanitization**: Protection against SQL injection and XSS
- **API Key Authentication**: Required for sensitive operations
- **CORS Protection**: Configurable origin whitelist
- **Security Headers**: Helmet.js for HTTP security headers
- **Request Size Limits**: 1MB maximum request body

## Testing

```bash
# Run all tests
npm test

# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run with coverage
cd backend && npm run test:coverage
```

## Building for Production

```bash
# Build both backend and frontend
npm run build

# Build individually
npm run build:backend
npm run build:frontend
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment guide and security checklist.

## Project Structure

```
network-domain-analyzer/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── services/         # Business logic
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Express middleware
│   │   ├── models/           # Data models
│   │   └── utils/            # Utilities
│   └── data/                 # SQLite database
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # Entry point
│   │   ├── App.tsx           # Root component
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   └── contexts/         # React contexts
│   └── dist/                 # Built files
├── docs/                     # Documentation
│   ├── API.md               # API documentation
│   ├── SECURITY.md          # Security guide
│   └── DEPLOYMENT.md        # Deployment guide
└── dns.json                  # RDAP bootstrap data
```

## RDAP Bootstrap Data

The `dns.json` file contains RDAP bootstrap data for domain lookups. See [docs/RDAP.md](docs/RDAP.md) for details on the format and usage.

## License

MIT
