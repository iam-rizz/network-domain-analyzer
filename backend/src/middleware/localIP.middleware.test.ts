/**
 * Tests for Local IP Blocking Middleware
 */

import {
  isLocalTarget,
  isLocalURL,
  isLocalHostname,
  resolveAndCheckLocal,
  getServerIPs,
  isSelfIP,
} from '../utils/validation';

describe('Local IP/Hostname Validation', () => {
  describe('isLocalHostname', () => {
    it('should detect localhost', () => {
      expect(isLocalHostname('localhost')).toBe(true);
      expect(isLocalHostname('LOCALHOST')).toBe(true);
      expect(isLocalHostname('localhost.localdomain')).toBe(true);
    });

    it('should detect .local TLD', () => {
      expect(isLocalHostname('myserver.local')).toBe(true);
      expect(isLocalHostname('printer.local')).toBe(true);
    });

    it('should detect .internal TLD', () => {
      expect(isLocalHostname('api.internal')).toBe(true);
    });

    it('should allow public hostnames', () => {
      expect(isLocalHostname('google.com')).toBe(false);
      expect(isLocalHostname('example.org')).toBe(false);
    });
  });

  describe('isLocalTarget - IPv4', () => {
    it('should block loopback addresses', () => {
      expect(isLocalTarget('127.0.0.1').isLocal).toBe(true);
      expect(isLocalTarget('127.0.0.2').isLocal).toBe(true);
      expect(isLocalTarget('127.255.255.255').isLocal).toBe(true);
    });

    it('should block private Class A (10.x.x.x)', () => {
      expect(isLocalTarget('10.0.0.1').isLocal).toBe(true);
      expect(isLocalTarget('10.255.255.255').isLocal).toBe(true);
    });

    it('should block private Class B (172.16-31.x.x)', () => {
      expect(isLocalTarget('172.16.0.1').isLocal).toBe(true);
      expect(isLocalTarget('172.31.255.255').isLocal).toBe(true);
      expect(isLocalTarget('172.15.0.1').isLocal).toBe(false); // Not in range
      expect(isLocalTarget('172.32.0.1').isLocal).toBe(false); // Not in range
    });

    it('should block private Class C (192.168.x.x)', () => {
      expect(isLocalTarget('192.168.0.1').isLocal).toBe(true);
      expect(isLocalTarget('192.168.1.1').isLocal).toBe(true);
      expect(isLocalTarget('192.168.255.255').isLocal).toBe(true);
    });

    it('should block link-local (169.254.x.x)', () => {
      expect(isLocalTarget('169.254.0.1').isLocal).toBe(true);
      expect(isLocalTarget('169.254.255.255').isLocal).toBe(true);
    });

    it('should block 0.0.0.0/8', () => {
      expect(isLocalTarget('0.0.0.0').isLocal).toBe(true);
      expect(isLocalTarget('0.0.0.1').isLocal).toBe(true);
    });

    it('should block broadcast', () => {
      expect(isLocalTarget('255.255.255.255').isLocal).toBe(true);
    });

    it('should block multicast (224-239.x.x.x)', () => {
      expect(isLocalTarget('224.0.0.1').isLocal).toBe(true);
      expect(isLocalTarget('239.255.255.255').isLocal).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isLocalTarget('8.8.8.8').isLocal).toBe(false);
      expect(isLocalTarget('1.1.1.1').isLocal).toBe(false);
      expect(isLocalTarget('142.250.185.78').isLocal).toBe(false);
    });
  });

  describe('isLocalTarget - IPv6', () => {
    it('should block loopback ::1', () => {
      expect(isLocalTarget('::1').isLocal).toBe(true);
    });

    it('should block unspecified ::', () => {
      expect(isLocalTarget('::').isLocal).toBe(true);
    });

    it('should block link-local fe80::', () => {
      expect(isLocalTarget('fe80::1').isLocal).toBe(true);
      expect(isLocalTarget('fe80::abcd:1234').isLocal).toBe(true);
    });

    it('should block unique local fc00::/fd00::', () => {
      expect(isLocalTarget('fc00::1').isLocal).toBe(true);
      expect(isLocalTarget('fd00::1').isLocal).toBe(true);
    });

    it('should block multicast ff00::', () => {
      expect(isLocalTarget('ff02::1').isLocal).toBe(true);
    });

    it('should allow public IPv6', () => {
      expect(isLocalTarget('2001:4860:4860::8888').isLocal).toBe(false);
    });
  });

  describe('isLocalURL', () => {
    it('should block URLs with localhost', () => {
      expect(isLocalURL('http://localhost:3000').isLocal).toBe(true);
      expect(isLocalURL('https://localhost/api').isLocal).toBe(true);
    });

    it('should block URLs with private IPs', () => {
      expect(isLocalURL('http://192.168.1.1:8080').isLocal).toBe(true);
      expect(isLocalURL('http://10.0.0.1/admin').isLocal).toBe(true);
      expect(isLocalURL('http://127.0.0.1:5000').isLocal).toBe(true);
    });

    it('should allow URLs with public domains', () => {
      expect(isLocalURL('https://google.com').isLocal).toBe(false);
      expect(isLocalURL('http://example.org:8080/api').isLocal).toBe(false);
    });

    it('should handle URLs without protocol', () => {
      expect(isLocalURL('localhost:3000').isLocal).toBe(true);
      expect(isLocalURL('google.com').isLocal).toBe(false);
    });
  });

  describe('resolveAndCheckLocal - DNS Resolution', () => {
    it('should block localhost without DNS lookup', async () => {
      const result = await resolveAndCheckLocal('localhost');
      expect(result.isLocal).toBe(true);
    });

    it('should block direct IP addresses', async () => {
      const result = await resolveAndCheckLocal('127.0.0.1');
      expect(result.isLocal).toBe(true);
      expect(result.resolvedIPs).toContain('127.0.0.1');
    });

    it('should allow public IPs without DNS lookup', async () => {
      const result = await resolveAndCheckLocal('8.8.8.8');
      expect(result.isLocal).toBe(false);
      expect(result.resolvedIPs).toContain('8.8.8.8');
    });

    it('should resolve and check public domains', async () => {
      // This test requires network access
      const result = await resolveAndCheckLocal('google.com');
      expect(result.isLocal).toBe(false);
      expect(result.resolvedIPs.length).toBeGreaterThan(0);
    }, 10000);

    it('should handle non-existent domains gracefully', async () => {
      const result = await resolveAndCheckLocal('this-domain-does-not-exist-12345.com');
      // Should not be marked as local, let the actual operation fail
      expect(result.isLocal).toBe(false);
      expect(result.resolvedIPs.length).toBe(0);
    }, 10000);
  });

  describe('Self IP Detection', () => {
    it('should get server IPs', () => {
      const serverIPs = getServerIPs();
      // Should return an array (may be empty in some test environments)
      expect(Array.isArray(serverIPs)).toBe(true);
    });

    it('should detect self IP when blockSelfIP is enabled', async () => {
      const serverIPs = getServerIPs();
      
      // Skip if no server IPs available (e.g., in isolated test environment)
      if (serverIPs.length === 0) {
        console.log('No server IPs detected, skipping self IP test');
        return;
      }

      const selfIP = serverIPs[0];
      expect(isSelfIP(selfIP)).toBe(true);

      // Test resolveAndCheckLocal with self IP
      const result = await resolveAndCheckLocal(selfIP, { blockSelfIP: true });
      
      // Self IP might be a private IP (e.g., 192.168.x.x), which is blocked as local
      // In that case, isLocal will be true instead of isSelf
      // Both cases are valid - the request will be blocked either way
      expect(result.isLocal || result.isSelf).toBe(true);
    });

    it('should allow self IP when blockSelfIP is disabled', async () => {
      const serverIPs = getServerIPs();
      
      if (serverIPs.length === 0) {
        console.log('No server IPs detected, skipping test');
        return;
      }

      const selfIP = serverIPs[0];
      const result = await resolveAndCheckLocal(selfIP, { blockSelfIP: false });
      expect(result.isSelf).toBe(false);
    });

    it('should not detect random public IP as self', () => {
      expect(isSelfIP('8.8.8.8')).toBe(false);
      expect(isSelfIP('1.1.1.1')).toBe(false);
    });
  });
});
