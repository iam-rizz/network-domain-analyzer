import React from 'react';
import Tooltip from './Tooltip';

// Predefined technical terms and their explanations
const TECHNICAL_TERMS: Record<string, string> = {
  // DNS Terms
  'A Record': 'Maps a domain name to an IPv4 address. This is the most common DNS record type.',
  'AAAA Record': 'Maps a domain name to an IPv6 address, the newer IP address format.',
  'MX Record': 'Mail Exchange record that specifies the mail server responsible for receiving email for the domain.',
  'TXT Record': 'Text record that can hold arbitrary text data, often used for domain verification and email security.',
  'CNAME Record': 'Canonical Name record that creates an alias from one domain name to another.',
  'NS Record': 'Name Server record that specifies the authoritative DNS servers for the domain.',
  'SOA Record': 'Start of Authority record containing administrative information about the DNS zone.',
  'TTL': 'Time To Live - how long (in seconds) a DNS record should be cached before being refreshed.',
  'DNS Propagation': 'The process of DNS changes spreading across all DNS servers worldwide, which can take up to 48 hours.',
  
  // SSL/TLS Terms
  'SSL Certificate': 'A digital certificate that authenticates a website\'s identity and enables encrypted connections.',
  'Certificate Authority': 'A trusted organization that issues digital certificates to verify website identities.',
  'HTTPS': 'HTTP Secure - a protocol that encrypts data between your browser and the website.',
  'Self-Signed Certificate': 'A certificate signed by its own creator rather than a trusted Certificate Authority.',
  
  // Network Terms
  'IP Address': 'A unique numerical identifier assigned to each device connected to a network.',
  'IPv4': 'Internet Protocol version 4 - uses 32-bit addresses (e.g., 192.168.1.1).',
  'IPv6': 'Internet Protocol version 6 - uses 128-bit addresses to support more devices.',
  'Private IP': 'An IP address used within a local network, not routable on the public internet.',
  'Public IP': 'An IP address that is accessible from the internet.',
  'ISP': 'Internet Service Provider - the company that provides your internet connection.',
  'Geolocation': 'The process of determining the geographic location of an IP address.',
  
  // Host/Server Terms
  'Ping': 'A network utility that tests connectivity by sending packets to a host and measuring response time.',
  'Response Time': 'The time it takes for a server to respond to a request, measured in milliseconds.',
  'Port': 'A virtual endpoint for network communication. Common ports: 80 (HTTP), 443 (HTTPS), 22 (SSH).',
  'Port Scanning': 'The process of checking which network ports are open and accepting connections.',
  'HTTP Status Code': 'A three-digit code indicating the result of an HTTP request (e.g., 200 OK, 404 Not Found).',
  
  // WHOIS/RDAP Terms
  'WHOIS': 'A protocol for querying databases that store domain registration information.',
  'RDAP': 'Registration Data Access Protocol - a modern replacement for WHOIS with structured data.',
  'Registrar': 'A company authorized to register domain names on behalf of customers.',
  'Name Server': 'A server that translates domain names into IP addresses.',
  'Domain Expiration': 'The date when a domain registration expires and must be renewed.',
  
  // Rate Limiting Terms
  'Rate Limit': 'A restriction on the number of API requests allowed within a time period.',
  'API Key': 'A unique identifier used to authenticate and authorize API requests.',
};

interface TechnicalTermProps {
  term: keyof typeof TECHNICAL_TERMS | string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * TechnicalTerm Component
 * Wraps technical terms with tooltips showing explanations
 * 
 * Requirements: 11.4 - WHEN user hover pada technical terms THEN THE System SHALL menampilkan tooltip dengan penjelasan singkat
 */
const TechnicalTerm: React.FC<TechnicalTermProps> = ({
  term,
  children,
  className = '',
}) => {
  const explanation = TECHNICAL_TERMS[term];

  if (!explanation) {
    // If no explanation found, just render the children or term
    return <span className={className}>{children || term}</span>;
  }

  return (
    <Tooltip content={explanation}>
      <span
        className={`border-b border-dotted border-gray-400 cursor-help ${className}`}
      >
        {children || term}
      </span>
    </Tooltip>
  );
};

// Export the terms dictionary for use elsewhere
export { TECHNICAL_TERMS };
export default TechnicalTerm;
