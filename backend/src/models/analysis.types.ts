/**
 * Analysis-related type definitions
 */

export type AnalysisType = 
  | 'dns_lookup'
  | 'dns_propagation'
  | 'whois'
  | 'rdap'
  | 'ping'
  | 'http_check'
  | 'port_scan'
  | 'ssl_check'
  | 'ip_lookup';

export interface Analysis {
  id: string;
  type: AnalysisType;
  domain?: string;
  ip?: string;
  result: any;
  status: 'success' | 'error';
  error?: string;
  createdAt: Date;
}

export interface BatchResult {
  domain: string;
  status: 'success' | 'error';
  result?: any;
  error?: string;
}
