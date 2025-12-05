/**
 * Error-related type definitions
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_DOMAIN'
  | 'INVALID_IP'
  | 'INVALID_PORT'
  | 'DNS_LOOKUP_FAILED'
  | 'WHOIS_LOOKUP_FAILED'
  | 'RDAP_LOOKUP_FAILED'
  | 'RDAP_TIMEOUT'
  | 'RDAP_QUERY_FAILED'
  | 'RDAP_PARSE_FAILED'
  | 'BOOTSTRAP_LOAD_FAILED'
  | 'HOST_UNREACHABLE'
  | 'HTTP_CHECK_FAILED'
  | 'SSL_CHECK_FAILED'
  | 'SSL_NOT_AVAILABLE'
  | 'INVALID_CERTIFICATE'
  | 'DOMAIN_NOT_FOUND'
  | 'PORT_SCAN_FAILED'
  | 'IP_LOOKUP_FAILED'
  | 'PUBLIC_IP_FETCH_FAILED'
  | 'TIMEOUT_ERROR'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'CACHE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'BATCH_SIZE_EXCEEDED'
  | 'EMPTY_BATCH'
  | 'MALICIOUS_INPUT';

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: any;
  timestamp?: Date;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
