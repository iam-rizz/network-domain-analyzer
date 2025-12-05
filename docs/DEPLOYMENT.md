# Deployment Guide

Guide for deploying Network & Domain Analyzer to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Building for Production](#building-for-production)
- [Deployment Options](#deployment-options)
- [Database Setup](#database-setup)
- [Redis Setup](#redis-setup)
- [Reverse Proxy Configuration](#reverse-proxy-configuration)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring](#monitoring)
- [Security Checklist](#security-checklist)

---

## Prerequisites

### System Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL 14+ (production database)
- Redis 6+ (optional, for caching and rate limiting)
- Nginx or similar reverse proxy
- SSL certificate

### Hardware Recommendations

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4+ GB |
| Storage | 20 GB | 50+ GB |

---

## Environment Setup

### 1. Create Production Environment File

```bash
cp backend/.env.example backend/.env.production
```

### 2. Configure Environment Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/netanalyzer
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Security Configuration
API_KEY_SECRET=<generate-strong-secret>
ALLOWED_ORIGINS=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# External APIs (if needed)
IP_GEOLOCATION_API_KEY=your-api-key
```

### 3. Generate Secrets

```bash
# Generate API_KEY_SECRET
openssl rand -hex 32
```

---

## Building for Production

### Build Both Frontend and Backend

```bash
npm run build
```

### Build Individually

```bash
# Backend only
npm run build:backend

# Frontend only
npm run build:frontend
```

### Verify Build

```bash
# Check backend build
ls -la backend/dist/

# Check frontend build
ls -la frontend/dist/
```

---

## Deployment Options

### Option 1: Traditional Server (PM2)

#### Install PM2

```bash
npm install -g pm2
```

#### Create PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'netanalyzer-api',
    script: 'backend/dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
};
```

#### Start Application

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Option 2: Docker

#### Dockerfile (Backend)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/dist ./dist
COPY dns.json ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/netanalyzer
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=netanalyzer
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/dist:/usr/share/nginx/html
      - ./certs:/etc/nginx/certs
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

### Option 3: Cloud Platforms

#### AWS (Elastic Beanstalk)

1. Create `.ebextensions/nodecommand.config`:
```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "node backend/dist/index.js"
```

2. Deploy:
```bash
eb init
eb create production
eb deploy
```

#### Heroku

1. Create `Procfile`:
```
web: node backend/dist/index.js
```

2. Deploy:
```bash
heroku create
git push heroku main
```

---

## Database Setup

### PostgreSQL Setup

```bash
# Create database
createdb netanalyzer

# Create user
createuser -P netanalyzer_user

# Grant permissions
psql -d netanalyzer -c "GRANT ALL PRIVILEGES ON DATABASE netanalyzer TO netanalyzer_user;"
```

### Run Migrations

```bash
# If using migrations
npm run migrate:production
```

### Database Backup

```bash
# Backup
pg_dump netanalyzer > backup_$(date +%Y%m%d).sql

# Restore
psql netanalyzer < backup_20241205.sql
```

---

## Redis Setup

### Install Redis

```bash
# Ubuntu/Debian
sudo apt install redis-server

# Start service
sudo systemctl start redis
sudo systemctl enable redis
```

### Configure Redis

```bash
# /etc/redis/redis.conf
bind 127.0.0.1
port 6379
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Verify Connection

```bash
redis-cli ping
# Should return: PONG
```

---

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/netanalyzer

upstream api {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (static files)
    location / {
        root /var/www/netanalyzer/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # API Proxy
    location /api {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    location /api {
        limit_req zone=api burst=20 nodelay;
        # ... proxy settings
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    gzip_min_length 1000;
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/netanalyzer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL/TLS Configuration

### Using Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Certificate Renewal Cron

```bash
# /etc/cron.d/certbot
0 0,12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## Monitoring

### Application Monitoring

#### PM2 Monitoring

```bash
pm2 monit
pm2 logs
pm2 status
```

#### Health Check Endpoint

```bash
curl http://localhost:5000/api/health
```

### Log Management

#### Configure Winston Logging

```typescript
// Already configured in backend/src/utils/logger.ts
// Logs are written to:
// - backend/logs/combined.log
// - backend/logs/error.log
```

#### Log Rotation

```bash
# /etc/logrotate.d/netanalyzer
/var/www/netanalyzer/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Alerting

Set up alerts for:
- High error rates
- Response time degradation
- Rate limit violations
- Database connection issues
- Redis connection issues
- SSL certificate expiration

---

## Security Checklist

### Pre-Deployment

- [ ] `NODE_ENV` set to `production`
- [ ] Strong `API_KEY_SECRET` generated
- [ ] `ALLOWED_ORIGINS` configured (no wildcards)
- [ ] Database credentials secured
- [ ] Redis password set (if exposed)
- [ ] SSL/TLS configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] Error messages sanitized
- [ ] Debug endpoints removed
- [ ] Logging configured (no sensitive data)

### Infrastructure

- [ ] Firewall configured
- [ ] SSH key authentication only
- [ ] Database not publicly accessible
- [ ] Redis not publicly accessible
- [ ] Regular security updates scheduled
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented

### Monitoring

- [ ] Application monitoring enabled
- [ ] Log aggregation configured
- [ ] Alerting set up
- [ ] Uptime monitoring enabled
- [ ] SSL certificate monitoring

### Ongoing

- [ ] Regular dependency updates
- [ ] Security audit schedule
- [ ] API key rotation policy
- [ ] Incident response plan
- [ ] Access review schedule

---

## Troubleshooting

### Common Issues

#### Application Won't Start

```bash
# Check logs
pm2 logs netanalyzer-api

# Check port availability
lsof -i :5000

# Verify environment
node -e "console.log(process.env.NODE_ENV)"
```

#### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostgreSQL status
sudo systemctl status postgresql
```

#### Redis Connection Issues

```bash
# Test connection
redis-cli ping

# Check Redis status
sudo systemctl status redis
```

#### High Memory Usage

```bash
# Check PM2 memory
pm2 monit

# Restart with memory limit
pm2 restart netanalyzer-api --max-memory-restart 1G
```

---

## Rollback Procedure

### Quick Rollback

```bash
# If using PM2
pm2 deploy production revert 1

# Manual rollback
cd /var/www/netanalyzer
git checkout <previous-tag>
npm run build
pm2 restart all
```

### Database Rollback

```bash
# Restore from backup
psql netanalyzer < backup_previous.sql
```

---

## Support

For deployment issues:
1. Check application logs
2. Review this documentation
3. Search existing issues
4. Create a new issue with:
   - Environment details
   - Error messages
   - Steps to reproduce
