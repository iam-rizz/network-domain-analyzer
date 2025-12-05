/**
 * IP Service
 * Provides IP address detection and geolocation lookup functionality
 */

import axios, { AxiosError } from 'axios';
import { Request } from 'express';
import { IPResult } from '../models/ip.types';
import { AppError } from '../models/error.types';
import { validateIP, isPrivateIP } from '../utils/validation';

// Free IP geolocation API (no key required for basic usage)
const IP_API_BASE_URL = 'http://ip-api.com/json';
const IP_API_TIMEOUT = 5000; // 5 seconds

// External service to detect public IP when running locally
const PUBLIC_IP_API_URL = 'https://ipinfo.io/json';

export class IPService {
  /**
   * Get current IP address from request
   * Extracts IP from various headers (X-Forwarded-For, X-Real-IP) or socket
   * @param request - Express request object
   * @returns IP address string
   */
  getCurrentIP(request: Request): string {
    // Try X-Forwarded-For header (proxy/load balancer)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) 
        ? forwardedFor[0] 
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // Try X-Real-IP header
    const realIP = request.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    // Fallback to socket remote address
    return request.socket.remoteAddress || '127.0.0.1';
  }

  /**
   * Fetch public IP from external service
   * Used when the detected IP is private/localhost
   * @returns Public IP address string
   */
  async fetchPublicIP(): Promise<string> {
    try {
      const response = await axios.get(PUBLIC_IP_API_URL, {
        timeout: IP_API_TIMEOUT,
      });
      
      if (response.data && response.data.ip) {
        return response.data.ip;
      }
      
      throw new Error('No IP in response');
    } catch (error: any) {
      throw new AppError(
        'PUBLIC_IP_FETCH_FAILED',
        'Failed to fetch public IP address',
        500,
        { error: error.message }
      );
    }
  }

  /**
   * Get current IP with automatic public IP detection for localhost
   * @param request - Express request object
   * @returns IP address string (public IP if running locally)
   */
  async getCurrentIPWithPublicFallback(request: Request): Promise<string> {
    const detectedIP = this.getCurrentIP(request);
    
    // Check if the detected IP is private/localhost
    if (isPrivateIP(detectedIP)) {
      // Fetch public IP from external service
      return this.fetchPublicIP();
    }
    
    return detectedIP;
  }

  /**
   * Lookup IP address information including geolocation
   * @param ip - IP address to lookup
   * @returns IPResult with geolocation and ISP information
   */
  async lookupIP(ip: string): Promise<IPResult> {
    // Validate IP format
    const validation = validateIP(ip);
    if (!validation.valid) {
      throw new AppError(
        'INVALID_IP',
        validation.errors[0]?.message || 'Invalid IP address format',
        400,
        { errors: validation.errors }
      );
    }

    const normalizedIP = validation.ip!;
    const ipType = validation.type!;

    // Check if private IP
    if (isPrivateIP(normalizedIP)) {
      throw new AppError(
        'INVALID_IP',
        'Cannot lookup geolocation for private IP addresses (10.x.x.x, 172.16.x.x, 192.168.x.x, 127.x.x.x)',
        400,
        { ip: normalizedIP, isPrivate: true }
      );
    }

    try {
      // Query IP geolocation API
      const response = await axios.get(`${IP_API_BASE_URL}/${normalizedIP}`, {
        timeout: IP_API_TIMEOUT,
        params: {
          fields: 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query'
        }
      });

      const data = response.data;

      // Check if API returned error
      if (data.status === 'fail') {
        throw new AppError(
          'IP_LOOKUP_FAILED',
          data.message || 'Failed to lookup IP address',
          404,
          { ip: normalizedIP }
        );
      }

      // Build result
      const result: IPResult = {
        ip: normalizedIP,
        type: ipType,
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        region: data.regionName || data.region || 'Unknown',
        isp: data.isp || 'Unknown',
        timezone: data.timezone || 'Unknown',
        organization: data.org || data.as || 'Unknown',
        timestamp: new Date(),
      };

      return result;
    } catch (error: any) {
      // Re-throw AppError instances
      if (error instanceof AppError) {
        throw error;
      }

      // Handle axios errors
      if (error.isAxiosError || axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          throw new AppError(
            'TIMEOUT_ERROR',
            'IP lookup request timed out',
            408,
            { ip: normalizedIP, timeout: IP_API_TIMEOUT }
          );
        }

        if (axiosError.response?.status === 429) {
          throw new AppError(
            'RATE_LIMIT_EXCEEDED',
            'IP lookup rate limit exceeded. Please try again later',
            429,
            { ip: normalizedIP }
          );
        }

        throw new AppError(
          'IP_LOOKUP_FAILED',
          'Failed to lookup IP address information',
          500,
          { ip: normalizedIP, error: axiosError.message }
        );
      }

      // Handle unexpected errors
      throw new AppError(
        'IP_LOOKUP_FAILED',
        'An unexpected error occurred during IP lookup',
        500,
        { ip: normalizedIP, error: error.message }
      );
    }
  }
}
