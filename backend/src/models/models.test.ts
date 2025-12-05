/**
 * Tests for data models and types
 */

import {
  DNSResult,
  DNSRecord,
  PropagationStatus,
  LocationResult,
  WHOISResult,
  RDAPResult,
  HostMonitorResult,
  PingResult,
  HTTPResult,
  SSLResult,
  PortScanResult,
  IPResult,
  Analysis,
  AnalysisType,
  BatchResult,
  ValidationError,
  ValidationResult,
  DomainValidationResult,
  IPValidationResult,
  PortValidationResult,
  BatchValidationResult,
  AppError,
  ErrorCode,
} from './index';

describe('Data Models and Types', () => {
  describe('DNS Types', () => {
    it('should create a valid DNSRecord', () => {
      const record: DNSRecord = {
        type: 'A',
        value: '192.0.2.1',
        ttl: 3600,
      };

      expect(record.type).toBe('A');
      expect(record.value).toBe('192.0.2.1');
      expect(record.ttl).toBe(3600);
    });

    it('should create a valid DNSResult', () => {
      const result: DNSResult = {
        domain: 'example.com',
        records: [
          { type: 'A', value: '192.0.2.1', ttl: 3600 },
          { type: 'AAAA', value: '2001:db8::1', ttl: 3600 },
        ],
        timestamp: new Date(),
      };

      expect(result.domain).toBe('example.com');
      expect(result.records).toHaveLength(2);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should create a valid PropagationStatus', () => {
      const status: PropagationStatus = {
        fullyPropagated: true,
        locations: [],
        inconsistencies: [],
      };

      expect(status.fullyPropagated).toBe(true);
      expect(status.locations).toEqual([]);
      expect(status.inconsistencies).toEqual([]);
    });

    it('should create a valid LocationResult', () => {
      const location: LocationResult = {
        location: 'US-East',
        status: 'success',
        records: [{ type: 'A', value: '192.0.2.1', ttl: 3600 }],
        responseTime: 150,
      };

      expect(location.location).toBe('US-East');
      expect(location.status).toBe('success');
      expect(location.responseTime).toBe(150);
    });
  });

  describe('WHOIS Types', () => {
    it('should create a valid WHOISResult', () => {
      const result: WHOISResult = {
        domain: 'example.com',
        registrar: 'Example Registrar',
        registrationDate: new Date('2020-01-01'),
        expirationDate: new Date('2025-01-01'),
        nameServers: ['ns1.example.com', 'ns2.example.com'],
        status: ['clientTransferProhibited'],
        timestamp: new Date(),
      };

      expect(result.domain).toBe('example.com');
      expect(result.registrar).toBe('Example Registrar');
      expect(result.nameServers).toHaveLength(2);
    });

    it('should create a valid RDAPResult', () => {
      const result: RDAPResult = {
        domain: 'example.com',
        registrar: 'Example Registrar',
        registrationDate: new Date('2020-01-01'),
        expirationDate: new Date('2025-01-01'),
        nameServers: ['ns1.example.com'],
        status: ['active'],
        source: 'rdap',
        timestamp: new Date(),
      };

      expect(result.source).toBe('rdap');
      expect(result.domain).toBe('example.com');
    });
  });

  describe('Host Types', () => {
    it('should create a valid PingResult', () => {
      const result: PingResult = {
        alive: true,
        responseTime: 25,
        location: 'US-West',
      };

      expect(result.alive).toBe(true);
      expect(result.responseTime).toBe(25);
    });

    it('should create a valid HTTPResult', () => {
      const result: HTTPResult = {
        statusCode: 200,
        responseTime: 150,
        headers: { 'content-type': 'text/html' },
      };

      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBe(150);
    });

    it('should create a valid SSLResult', () => {
      const result: SSLResult = {
        valid: true,
        issuer: 'Let\'s Encrypt',
        subject: 'example.com',
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2025-01-01'),
        daysUntilExpiry: 365,
      };

      expect(result.valid).toBe(true);
      expect(result.daysUntilExpiry).toBe(365);
    });

    it('should create a valid PortScanResult', () => {
      const result: PortScanResult = {
        host: 'example.com',
        scannedPorts: [80, 443, 22],
        openPorts: [
          { port: 80, service: 'http', state: 'open' },
          { port: 443, service: 'https', state: 'open' },
        ],
        closedPorts: [22],
        scanDuration: 5000,
      };

      expect(result.scannedPorts).toHaveLength(3);
      expect(result.openPorts).toHaveLength(2);
      expect(result.closedPorts).toHaveLength(1);
    });

    it('should create a valid HostMonitorResult', () => {
      const result: HostMonitorResult = {
        host: 'example.com',
        pingResult: { alive: true, responseTime: 25, location: 'US-West' },
        httpResult: { statusCode: 200, responseTime: 150, headers: {} },
        openPorts: [80, 443],
        timestamp: new Date(),
      };

      expect(result.host).toBe('example.com');
      expect(result.pingResult.alive).toBe(true);
      expect(result.openPorts).toHaveLength(2);
    });
  });

  describe('IP Types', () => {
    it('should create a valid IPResult', () => {
      const result: IPResult = {
        ip: '192.0.2.1',
        type: 'IPv4',
        country: 'United States',
        city: 'New York',
        region: 'NY',
        isp: 'Example ISP',
        timezone: 'America/New_York',
        organization: 'Example Org',
        timestamp: new Date(),
      };

      expect(result.ip).toBe('192.0.2.1');
      expect(result.type).toBe('IPv4');
      expect(result.country).toBe('United States');
    });
  });

  describe('Analysis Types', () => {
    it('should create a valid Analysis', () => {
      const analysis: Analysis = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'dns_lookup',
        domain: 'example.com',
        result: { records: [] },
        status: 'success',
        createdAt: new Date(),
      };

      expect(analysis.id).toBeTruthy();
      expect(analysis.type).toBe('dns_lookup');
      expect(analysis.status).toBe('success');
    });

    it('should support all AnalysisType values', () => {
      const types: AnalysisType[] = [
        'dns_lookup',
        'dns_propagation',
        'whois',
        'rdap',
        'ping',
        'http_check',
        'port_scan',
        'ssl_check',
        'ip_lookup',
      ];

      types.forEach((type) => {
        const analysis: Analysis = {
          id: '123',
          type,
          result: {},
          status: 'success',
          createdAt: new Date(),
        };
        expect(analysis.type).toBe(type);
      });
    });

    it('should create a valid BatchResult', () => {
      const result: BatchResult = {
        domain: 'example.com',
        status: 'success',
        result: { records: [] },
      };

      expect(result.domain).toBe('example.com');
      expect(result.status).toBe('success');
    });
  });

  describe('Validation Types', () => {
    it('should create a valid ValidationError', () => {
      const error: ValidationError = {
        field: 'domain',
        message: 'Invalid domain format',
        code: 'INVALID_DOMAIN',
      };

      expect(error.field).toBe('domain');
      expect(error.code).toBe('INVALID_DOMAIN');
    });

    it('should create a valid ValidationResult', () => {
      const result: ValidationResult = {
        valid: false,
        errors: [
          { field: 'domain', message: 'Invalid format', code: 'INVALID_DOMAIN' },
        ],
      };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should create a valid DomainValidationResult', () => {
      const result: DomainValidationResult = {
        valid: true,
        errors: [],
        domain: 'example.com',
      };

      expect(result.valid).toBe(true);
      expect(result.domain).toBe('example.com');
    });

    it('should create a valid IPValidationResult', () => {
      const result: IPValidationResult = {
        valid: true,
        errors: [],
        ip: '192.0.2.1',
        type: 'IPv4',
        isPrivate: false,
      };

      expect(result.valid).toBe(true);
      expect(result.type).toBe('IPv4');
      expect(result.isPrivate).toBe(false);
    });

    it('should create a valid PortValidationResult', () => {
      const result: PortValidationResult = {
        valid: true,
        errors: [],
        port: 443,
      };

      expect(result.valid).toBe(true);
      expect(result.port).toBe(443);
    });

    it('should create a valid BatchValidationResult', () => {
      const result: BatchValidationResult = {
        valid: true,
        errors: [],
        domains: ['example.com', 'test.com'],
        count: 2,
      };

      expect(result.valid).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe('Error Types', () => {
    it('should create a valid AppError', () => {
      const error = new AppError(
        'INVALID_DOMAIN',
        'The domain format is invalid',
        400,
        { domain: 'invalid..domain' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('INVALID_DOMAIN');
      expect(error.message).toBe('The domain format is invalid');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ domain: 'invalid..domain' });
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain proper stack trace', () => {
      const error = new AppError('INTERNAL_ERROR', 'Something went wrong', 500);
      expect(error.stack).toBeTruthy();
      expect(error.stack).toContain('Something went wrong');
    });

    it('should support all ErrorCode values', () => {
      const codes: ErrorCode[] = [
        'VALIDATION_ERROR',
        'INVALID_DOMAIN',
        'INVALID_IP',
        'INVALID_PORT',
        'DNS_LOOKUP_FAILED',
        'WHOIS_LOOKUP_FAILED',
        'RDAP_LOOKUP_FAILED',
        'HOST_UNREACHABLE',
        'HTTP_CHECK_FAILED',
        'SSL_CHECK_FAILED',
        'PORT_SCAN_FAILED',
        'IP_LOOKUP_FAILED',
        'TIMEOUT_ERROR',
        'NETWORK_ERROR',
        'RATE_LIMIT_EXCEEDED',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'PAYLOAD_TOO_LARGE',
        'INTERNAL_ERROR',
        'DATABASE_ERROR',
        'CACHE_ERROR',
        'EXTERNAL_SERVICE_ERROR',
        'BATCH_SIZE_EXCEEDED',
        'MALICIOUS_INPUT',
      ];

      codes.forEach((code) => {
        const error = new AppError(code, 'Test error', 500);
        expect(error.code).toBe(code);
      });
    });
  });
});
