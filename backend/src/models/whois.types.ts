/**
 * WHOIS and RDAP-related type definitions
 */

export interface WHOISResult {
  domain: string;
  registrar: string;
  registrationDate: Date;
  expirationDate: Date;
  nameServers: string[];
  status: string[];
  timestamp: Date;
}

export interface RDAPBootstrapData {
  description: string;
  publication: string;
  services: Array<[string[], string[]]>;
  version: string;
}

export interface RDAPResult {
  domain: string;
  registrar: string;
  registrationDate: Date;
  expirationDate: Date;
  nameServers: string[];
  status: string[];
  source: 'rdap' | 'whois';
  timestamp: Date;
}
