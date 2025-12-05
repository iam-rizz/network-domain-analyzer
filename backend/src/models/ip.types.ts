/**
 * IP address-related type definitions
 */

export interface IPResult {
  ip: string;
  type: 'IPv4' | 'IPv6';
  country: string;
  city: string;
  region: string;
  isp: string;
  timezone: string;
  organization: string;
  timestamp: Date;
}
