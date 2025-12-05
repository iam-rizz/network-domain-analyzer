/**
 * Validation-related type definitions
 */

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface DomainValidationResult extends ValidationResult {
  domain?: string;
}

export interface IPValidationResult extends ValidationResult {
  ip?: string;
  type?: 'IPv4' | 'IPv6';
  isPrivate?: boolean;
}

export interface PortValidationResult extends ValidationResult {
  port?: number;
}

export interface BatchValidationResult extends ValidationResult {
  domains?: string[];
  count?: number;
}
