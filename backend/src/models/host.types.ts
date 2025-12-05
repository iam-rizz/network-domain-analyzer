/**
 * Host monitoring-related type definitions
 */

export interface PingResult {
  alive: boolean;
  responseTime: number;
  location: string;
}

export interface HTTPResult {
  statusCode: number;
  responseTime: number;
  headers: Record<string, string>;
}

export interface SSLResult {
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  daysUntilExpiry: number;
}

export interface PortInfo {
  port: number;
  service: string;
  state: 'open' | 'closed' | 'filtered';
}

export interface PortScanResult {
  host: string;
  scannedPorts: number[];
  openPorts: PortInfo[];
  closedPorts: number[];
  scanDuration: number;
}

export interface HostMonitorResult {
  host: string;
  pingResult: PingResult;
  httpResult: HTTPResult;
  sslResult?: SSLResult;
  openPorts: number[];
  timestamp: Date;
}
