/**
 * IP Service Tests
 * Unit and property-based tests for IP service functionality
 */

import { IPService } from './ip.service';
import { Request } from 'express';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IPService', () => {
  let ipService: IPService;

  beforeEach(() => {
    ipService = new IPService();
    jest.clearAllMocks();
  });

  describe('getCurrentIP', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
        },
        socket: {
          remoteAddress: '192.168.1.1',
        },
      } as unknown as Request;

      const ip = ipService.getCurrentIP(mockRequest);
      expect(ip).toBe('203.0.113.1');
    });

    it('should extract IP from X-Real-IP header when X-Forwarded-For is not present', () => {
      const mockRequest = {
        headers: {
          'x-real-ip': '203.0.113.5',
        },
        socket: {
          remoteAddress: '192.168.1.1',
        },
      } as unknown as Request;

      const ip = ipService.getCurrentIP(mockRequest);
      expect(ip).toBe('203.0.113.5');
    });

    it('should fallback to socket remoteAddress when no headers present', () => {
      const mockRequest = {
        headers: {},
        socket: {
          remoteAddress: '203.0.113.10',
        },
      } as unknown as Request;

      const ip = ipService.getCurrentIP(mockRequest);
      expect(ip).toBe('203.0.113.10');
    });

    it('should return 127.0.0.1 when no IP information available', () => {
      const mockRequest = {
        headers: {},
        socket: {},
      } as unknown as Request;

      const ip = ipService.getCurrentIP(mockRequest);
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('lookupIP', () => {
    it('should successfully lookup public IPv4 address', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          country: 'United States',
          countryCode: 'US',
          region: 'CA',
          regionName: 'California',
          city: 'Mountain View',
          zip: '94043',
          lat: 37.386,
          lon: -122.0838,
          timezone: 'America/Los_Angeles',
          isp: 'Google LLC',
          org: 'Google Public DNS',
          as: 'AS15169 Google LLC',
          query: '8.8.8.8',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await ipService.lookupIP('8.8.8.8');

      expect(result).toMatchObject({
        ip: '8.8.8.8',
        type: 'IPv4',
        country: 'United States',
        city: 'Mountain View',
        region: 'California',
        isp: 'Google LLC',
        timezone: 'America/Los_Angeles',
        organization: 'Google Public DNS',
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should successfully lookup public IPv6 address', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          country: 'United States',
          city: 'Mountain View',
          regionName: 'California',
          isp: 'Google LLC',
          org: 'Google',
          timezone: 'America/Los_Angeles',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await ipService.lookupIP('2001:4860:4860::8888');

      expect(result.type).toBe('IPv6');
      expect(result.ip).toBe('2001:4860:4860::8888');
    });

    it('should reject invalid IP format', async () => {
      await expect(ipService.lookupIP('invalid-ip')).rejects.toThrow('Invalid IP address format');
    });

    it('should reject private IPv4 addresses', async () => {
      await expect(ipService.lookupIP('192.168.1.1')).rejects.toThrow(
        'Cannot lookup geolocation for private IP addresses'
      );
    });

    it('should reject private IPv4 10.x.x.x range', async () => {
      await expect(ipService.lookupIP('10.0.0.1')).rejects.toThrow(
        'Cannot lookup geolocation for private IP addresses'
      );
    });

    it('should reject private IPv4 172.16.x.x range', async () => {
      await expect(ipService.lookupIP('172.16.0.1')).rejects.toThrow(
        'Cannot lookup geolocation for private IP addresses'
      );
    });

    it('should reject loopback address', async () => {
      await expect(ipService.lookupIP('127.0.0.1')).rejects.toThrow(
        'Cannot lookup geolocation for private IP addresses'
      );
    });

    it('should handle API failure response', async () => {
      const mockResponse = {
        data: {
          status: 'fail',
          message: 'invalid query',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await expect(ipService.lookupIP('8.8.8.8')).rejects.toThrow('invalid query');
    });

    it('should handle timeout errors', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ETIMEDOUT',
        message: 'timeout',
      });

      await expect(ipService.lookupIP('8.8.8.8')).rejects.toThrow('IP lookup request timed out');
    });

    it('should handle rate limit errors', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: { status: 429 },
        message: 'Too many requests',
      });

      await expect(ipService.lookupIP('8.8.8.8')).rejects.toThrow(
        'IP lookup rate limit exceeded'
      );
    });

    it('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        message: 'Network error',
      });

      await expect(ipService.lookupIP('8.8.8.8')).rejects.toThrow(
        'Failed to lookup IP address information'
      );
    });

    it('should provide default values for missing geolocation fields', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          query: '8.8.8.8',
          // Missing most fields
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await ipService.lookupIP('8.8.8.8');

      expect(result.country).toBe('Unknown');
      expect(result.city).toBe('Unknown');
      expect(result.region).toBe('Unknown');
      expect(result.isp).toBe('Unknown');
      expect(result.timezone).toBe('Unknown');
      expect(result.organization).toBe('Unknown');
    });
  });
});
