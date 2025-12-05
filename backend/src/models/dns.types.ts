/**
 * DNS-related type definitions
 */

export type DNSRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS' | 'SOA';

export interface DNSRecord {
  type: DNSRecordType;
  value: string;
  ttl: number;
}

export interface DNSResult {
  domain: string;
  records: DNSRecord[];
  timestamp: Date;
  propagationStatus?: PropagationStatus;
}

export interface PropagationStatus {
  fullyPropagated: boolean;
  locations: LocationResult[];
  inconsistencies: string[];
}

export interface LocationResult {
  location: string;
  status: 'success' | 'failure' | 'unavailable';
  records: DNSRecord[];
  responseTime: number;
}
