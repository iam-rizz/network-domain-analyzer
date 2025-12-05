# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-06

### Added

#### IP Checker - Dual IPv4/IPv6 Support
- Display both IPv4 and IPv6 addresses simultaneously
- IP fetched directly from user's browser for accuracy
- Uses `api.ipify.org` for IPv4 and `api64.ipify.org` for IPv6
- Shows message when IPv6 is not available (network doesn't support)
- New endpoint `/api/ip/dual` for dual IP lookup

#### IP Checker - UI Improvements
- Copy button to copy IP address with one click
- Responsive design for mobile (long IPv6 doesn't overflow)
- Icon changes to checkmark on successful copy
- Different badge colors for IPv4 (green) and IPv6 (purple)

#### History Integration
- All analysis results now saved to database history automatically
- Integrated routes: DNS Lookup, DNS Propagation, IP Lookup, WHOIS, RDAP, Ping, HTTP Check, Port Scan, SSL Check

### Fixed
- Unused `React` import in `AppContext.test.tsx`
- Unused `vi` import in `axios.test.ts`
- `.handlers` property usage error in axios interceptors

---

## [1.0.0] - 2025-12-05

### Added

#### Core Features
- **DNS Lookup**: Query all DNS record types (A, AAAA, MX, TXT, CNAME, NS, SOA)
- **DNS Propagation Check**: Verify DNS propagation across multiple global DNS servers
- **RDAP Lookup**: Modern domain registration lookup using RDAP protocol with automatic WHOIS fallback
- **WHOIS Lookup**: Traditional domain registration information retrieval
- **Host Monitoring**: Ping tests and HTTP/HTTPS availability checks
- **Port Scanning**: Scan common ports or custom port ranges
- **SSL Certificate Validation**: Check certificate validity, expiration, and chain
- **IP Address Lookup**: Geolocation and ISP information lookup
- **Batch Analysis**: Process multiple domains simultaneously
- **History Tracking**: Save and compare analysis results over time
- **Export Functionality**: Export results in JSON or CSV format

#### Backend
- Express.js REST API with TypeScript
- SQLite database for development (PostgreSQL ready for production)
- Redis caching support (optional)
- Rate limiting with sliding window algorithm
- Input sanitization and validation
- API key authentication for sensitive operations
- Comprehensive logging with Winston
- Jest + fast-check for property-based testing

#### Frontend
- React 18 with TypeScript
- Tailwind CSS for responsive styling
- React Query for efficient data fetching and caching
- React Router for navigation
- Vite for fast development and optimized builds
- Vitest for unit testing

#### Security
- Helmet.js for HTTP security headers
- CORS protection with configurable origins
- Request size limits (1MB max)
- SQL injection and XSS protection
- Secure API key generation

#### Documentation
- Complete API documentation
- Security best practices guide
- Deployment guide with checklist
- RDAP bootstrap data documentation

### Technical Details
- Node.js 18+ required
- npm workspaces for monorepo management
- TypeScript strict mode enabled
- ESLint and Prettier configured

---

## [Unreleased]

### Planned
- PostgreSQL production database support
- Docker containerization
- CI/CD pipeline configuration
- Additional DNS server locations
- Real-time monitoring dashboard
- Email notifications for monitoring alerts
- Bulk domain import from file
