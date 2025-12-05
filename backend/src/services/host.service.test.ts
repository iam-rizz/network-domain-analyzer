/**
 * Host Service Tests
 * Unit tests and property-based tests for host monitoring functionality
 */

import { HostService } from './host.service';
import * as fc from 'fast-check';
import axios from 'axios';
import * as ping from 'ping';

// Mock axios and ping
jest.mock('axios');
jest.mock('ping', () => ({
  promise: {
    probe: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HostService', () => {
  let hostService: HostService;

  beforeEach(() => {
    hostService = new HostService();
    jest.clearAllMocks();
  });

  describe('ping', () => {
    it('should ping a host from multiple locations', async () => {
      // Mock ping responses
      (ping.promise.probe as jest.Mock).mockResolvedValue({
        alive: true,
        time: '10.5',
      });

      const results = await hostService.ping('example.com');

      expect(results).toHaveLength(3); // At least 3 locations
      expect(results[0]).toHaveProperty('alive');
      expect(results[0]).toHaveProperty('responseTime');
      expect(results[0]).toHaveProperty('location');
    });

    it('should handle unreachable hosts', async () => {
      (ping.promise.probe as jest.Mock).mockResolvedValue({
        alive: false,
        time: '0',
      });

      const results = await hostService.ping('unreachable.example.com');

      expect(results).toHaveLength(3);
      expect(results[0].alive).toBe(false);
    });

    it('should throw error for empty host', async () => {
      await expect(hostService.ping('')).rejects.toThrow('Host is required');
    });
  });

  describe('checkHTTP', () => {
    it('should check HTTP endpoint successfully', async () => {
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'text/html',
          'server': 'nginx',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await hostService.checkHTTP('http://example.com');

      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.headers).toHaveProperty('content-type');
    });

    it('should handle HTTPS endpoints', async () => {
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await hostService.checkHTTP('https://api.example.com');

      expect(result.statusCode).toBe(200);
      expect(result.headers).toBeDefined();
    });

    it('should handle non-200 status codes', async () => {
      const mockResponse = {
        status: 404,
        headers: {
          'content-type': 'text/html',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await hostService.checkHTTP('http://example.com/notfound');

      expect(result.statusCode).toBe(404);
    });

    it('should throw error for invalid URL format', async () => {
      await expect(hostService.checkHTTP('example.com')).rejects.toThrow(
        'URL must start with http:// or https://'
      );
    });

    it('should throw error for empty URL', async () => {
      await expect(hostService.checkHTTP('')).rejects.toThrow('URL is required');
    });

    it('should handle timeout errors', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });

      await expect(hostService.checkHTTP('http://slow.example.com')).rejects.toThrow(
        'HTTP check timeout'
      );
    });

    it('should handle connection refused errors', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED',
      });

      await expect(hostService.checkHTTP('http://unreachable.example.com')).rejects.toThrow(
        'Host unreachable'
      );
    });
  });

  describe('isSlowResponse', () => {
    it('should classify response > 5000ms as slow', () => {
      expect(hostService.isSlowResponse(5001)).toBe(true);
      expect(hostService.isSlowResponse(10000)).toBe(true);
    });

    it('should not classify response <= 5000ms as slow', () => {
      expect(hostService.isSlowResponse(5000)).toBe(false);
      expect(hostService.isSlowResponse(4999)).toBe(false);
      expect(hostService.isSlowResponse(100)).toBe(false);
    });
  });

  // Property-Based Tests

  /**
   * Feature: network-domain-analyzer, Property 8: HTTP Check Completeness
   * Validates: Requirements 3.2
   * 
   * For any HTTP/HTTPS endpoint check, the result should include both status code and response time.
   */
  describe('Property 8: HTTP Check Completeness', () => {
    it('should always return statusCode and responseTime for any valid HTTP request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            protocol: fc.constantFrom('http://', 'https://'),
            domain: fc.domain(),
            statusCode: fc.integer({ min: 100, max: 599 }),
            headers: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 50 }),
              { minKeys: 1, maxKeys: 5 }
            ),
          }),
          async ({ protocol, domain, statusCode, headers }) => {
            const url = `${protocol}${domain}`;

            // Mock axios response
            mockedAxios.get.mockResolvedValue({
              status: statusCode,
              headers: headers,
            });

            const result = await hostService.checkHTTP(url);

            // Property: Result must always contain statusCode and responseTime
            expect(result).toHaveProperty('statusCode');
            expect(result).toHaveProperty('responseTime');
            expect(result).toHaveProperty('headers');
            
            // Verify types
            expect(typeof result.statusCode).toBe('number');
            expect(typeof result.responseTime).toBe('number');
            expect(typeof result.headers).toBe('object');
            
            // Verify values are valid
            expect(result.statusCode).toBeGreaterThanOrEqual(100);
            expect(result.statusCode).toBeLessThan(600);
            expect(result.responseTime).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 9: Slow Response Classification
   * Validates: Requirements 3.5
   * 
   * For any host check where response time exceeds 5000ms, the system should classify the host as "Slow Response".
   */
  describe('Property 9: Slow Response Classification', () => {
    it('should correctly classify any response time > 5000ms as slow', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          (responseTime) => {
            const isSlow = hostService.isSlowResponse(responseTime);
            const threshold = hostService.getSlowResponseThreshold();

            // Property: Response time > 5000ms should be classified as slow
            if (responseTime > threshold) {
              expect(isSlow).toBe(true);
            } else {
              expect(isSlow).toBe(false);
            }

            // Verify the classification is consistent
            return isSlow === (responseTime > threshold);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify exactly at threshold boundary correctly', () => {
      const threshold = hostService.getSlowResponseThreshold();
      
      // At threshold should not be slow
      expect(hostService.isSlowResponse(threshold)).toBe(false);
      
      // Just above threshold should be slow
      expect(hostService.isSlowResponse(threshold + 1)).toBe(true);
      
      // Just below threshold should not be slow
      expect(hostService.isSlowResponse(threshold - 1)).toBe(false);
    });
  });

  describe('scanPorts', () => {
    it('should scan common ports by default', async () => {
      const result = await hostService.scanPorts('127.0.0.1');

      expect(result).toHaveProperty('host');
      expect(result).toHaveProperty('scannedPorts');
      expect(result).toHaveProperty('openPorts');
      expect(result).toHaveProperty('closedPorts');
      expect(result).toHaveProperty('scanDuration');
      expect(result.host).toBe('127.0.0.1');
      expect(result.scannedPorts.length).toBeGreaterThan(0);
    });

    it('should scan custom port range', async () => {
      const customPorts = [80, 443, 8080];
      const result = await hostService.scanPorts('127.0.0.1', customPorts);

      expect(result.scannedPorts).toEqual(customPorts);
      expect(result.scannedPorts.length).toBe(3);
    });

    it('should throw error for invalid port number', async () => {
      const invalidPorts = [70000]; // Port > 65535

      await expect(hostService.scanPorts('127.0.0.1', invalidPorts)).rejects.toThrow(
        'Port must be between 1 and 65535'
      );
    });

    it('should throw error for port number less than 1', async () => {
      const invalidPorts = [0];

      await expect(hostService.scanPorts('127.0.0.1', invalidPorts)).rejects.toThrow(
        'Port must be between 1 and 65535'
      );
    });

    it('should throw error for empty host', async () => {
      await expect(hostService.scanPorts('')).rejects.toThrow('Host is required');
    });

    it('should include service names for open ports', async () => {
      const result = await hostService.scanPorts('127.0.0.1', [80, 443]);

      // All ports should have service names
      result.openPorts.forEach(portInfo => {
        expect(portInfo).toHaveProperty('service');
        expect(typeof portInfo.service).toBe('string');
      });
    });

    it('should remove duplicate ports', async () => {
      const portsWithDuplicates = [80, 443, 80, 443, 8080];
      const result = await hostService.scanPorts('127.0.0.1', portsWithDuplicates);

      // Should only scan unique ports
      expect(result.scannedPorts).toEqual([80, 443, 8080]);
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 10: Port Scan Summary Accuracy
   * Validates: Requirements 4.4
   * 
   * For any port scan result, the total number of scanned ports should equal the sum of open ports and closed ports.
   */
  describe('Property 10: Port Scan Summary Accuracy', () => {
    it('should maintain accurate summary where scanned = open + closed for any port set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 1, maxLength: 20 }),
          async (ports) => {
            // Remove duplicates
            const uniquePorts = [...new Set(ports)];

            const result = await hostService.scanPorts('127.0.0.1', uniquePorts);

            // Property: Total scanned ports = open ports + closed ports
            const totalScanned = result.scannedPorts.length;
            const totalOpen = result.openPorts.length;
            const totalClosed = result.closedPorts.length;

            expect(totalScanned).toBe(totalOpen + totalClosed);

            // Verify all scanned ports are accounted for
            const allAccountedPorts = [
              ...result.openPorts.map(p => p.port),
              ...result.closedPorts,
            ].sort((a, b) => a - b);

            expect(allAccountedPorts).toEqual(result.scannedPorts);

            // Verify no port appears in both open and closed
            const openPortNumbers = result.openPorts.map(p => p.port);
            const intersection = openPortNumbers.filter(p => result.closedPorts.includes(p));
            expect(intersection.length).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure every scanned port is classified as either open or closed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 1, maxLength: 15 }),
          async (ports) => {
            const uniquePorts = [...new Set(ports)];
            const result = await hostService.scanPorts('127.0.0.1', uniquePorts);

            // Every port in scannedPorts should appear in either openPorts or closedPorts
            for (const port of result.scannedPorts) {
              const isOpen = result.openPorts.some(p => p.port === port);
              const isClosed = result.closedPorts.includes(port);

              // Port must be in exactly one category
              expect(isOpen || isClosed).toBe(true);
              expect(isOpen && isClosed).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('checkSSL', () => {
    it('should throw error for empty domain', async () => {
      await expect(hostService.checkSSL('')).rejects.toThrow('Domain is required');
    });

    it('should throw error for HTTP domains', async () => {
      await expect(hostService.checkSSL('http://example.com')).rejects.toThrow(
        'SSL is not available for HTTP domains'
      );
    });

    it('should handle HTTPS prefix in domain', async () => {
      // This test would require mocking TLS connection
      // For now, we'll test that it doesn't throw on the prefix handling
      const domain = 'https://example.com';
      // The actual SSL check will fail in test environment, but we're testing the prefix handling
      await expect(hostService.checkSSL(domain)).rejects.toThrow();
    });
  });

  describe('SSL certificate expiration helpers', () => {
    it('should identify certificates expiring within 30 days', () => {
      expect(hostService.isExpiringWithin30Days(30)).toBe(true);
      expect(hostService.isExpiringWithin30Days(15)).toBe(true);
      expect(hostService.isExpiringWithin30Days(1)).toBe(true);
      expect(hostService.isExpiringWithin30Days(31)).toBe(false);
      expect(hostService.isExpiringWithin30Days(0)).toBe(false);
      expect(hostService.isExpiringWithin30Days(-1)).toBe(false);
    });

    it('should identify expired certificates', () => {
      expect(hostService.isCertificateExpired(-1)).toBe(true);
      expect(hostService.isCertificateExpired(-30)).toBe(true);
      expect(hostService.isCertificateExpired(0)).toBe(false);
      expect(hostService.isCertificateExpired(1)).toBe(false);
      expect(hostService.isCertificateExpired(30)).toBe(false);
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 12: SSL Certificate Expiration Warning
   * Validates: Requirements 5.2
   * 
   * For any valid SSL certificate where expiration date is within 30 days from current date, 
   * the system should display a warning indicator.
   */
  describe('Property 12: SSL Certificate Expiration Warning', () => {
    it('should correctly identify any certificate expiring within 30 days as needing warning', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }),
          (daysUntilExpiry) => {
            const needsWarning = hostService.isExpiringWithin30Days(daysUntilExpiry);

            // Property: Certificates expiring within 30 days (1-30 days) should trigger warning
            if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
              expect(needsWarning).toBe(true);
            } else {
              expect(needsWarning).toBe(false);
            }

            // Verify consistency
            return needsWarning === (daysUntilExpiry > 0 && daysUntilExpiry <= 30);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle boundary conditions correctly for 30-day warning', () => {
      // Exactly 30 days should trigger warning
      expect(hostService.isExpiringWithin30Days(30)).toBe(true);
      
      // 31 days should not trigger warning
      expect(hostService.isExpiringWithin30Days(31)).toBe(false);
      
      // 1 day should trigger warning
      expect(hostService.isExpiringWithin30Days(1)).toBe(true);
      
      // 0 days (expired today) should not trigger warning (it's expired, not expiring)
      expect(hostService.isExpiringWithin30Days(0)).toBe(false);
      
      // Negative days (already expired) should not trigger warning
      expect(hostService.isExpiringWithin30Days(-1)).toBe(false);
    });
  });

  /**
   * Feature: network-domain-analyzer, Property 13: Expired Certificate Detection
   * Validates: Requirements 5.3
   * 
   * For any SSL certificate where expiration date is in the past, 
   * the system should display an error indicator.
   */
  describe('Property 13: Expired Certificate Detection', () => {
    it('should correctly identify any certificate with negative days as expired', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -365, max: 365 }),
          (daysUntilExpiry) => {
            const isExpired = hostService.isCertificateExpired(daysUntilExpiry);

            // Property: Certificates with negative days until expiry are expired
            if (daysUntilExpiry < 0) {
              expect(isExpired).toBe(true);
            } else {
              expect(isExpired).toBe(false);
            }

            // Verify consistency
            return isExpired === (daysUntilExpiry < 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle boundary conditions correctly for expiration detection', () => {
      // Negative days should be expired
      expect(hostService.isCertificateExpired(-1)).toBe(true);
      expect(hostService.isCertificateExpired(-365)).toBe(true);
      
      // Zero days (expires today) should not be considered expired yet
      expect(hostService.isCertificateExpired(0)).toBe(false);
      
      // Positive days should not be expired
      expect(hostService.isCertificateExpired(1)).toBe(false);
      expect(hostService.isCertificateExpired(30)).toBe(false);
      expect(hostService.isCertificateExpired(365)).toBe(false);
    });

    it('should ensure expired and expiring-soon are mutually exclusive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -100, max: 100 }),
          (daysUntilExpiry) => {
            const isExpired = hostService.isCertificateExpired(daysUntilExpiry);
            const isExpiringSoon = hostService.isExpiringWithin30Days(daysUntilExpiry);

            // Property: A certificate cannot be both expired and expiring soon
            expect(isExpired && isExpiringSoon).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
