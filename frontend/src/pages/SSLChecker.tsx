import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { TechnicalTerm, ErrorAlert } from '../components';

// SSL Result interface matching backend response
interface SSLResult {
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  // Extended info
  serialNumber?: string;
  signatureAlgorithm?: string;
  publicKeyAlgorithm?: string;
  publicKeySize?: number;
  fingerprint?: string;
  fingerprintSHA256?: string;
  subjectAltNames?: string[];
  issuerOrganization?: string;
  issuerCountry?: string;
  isWildcard?: boolean;
  isSelfSigned?: boolean;
  protocol?: string;
  cipher?: string;
}

// API Response interface
interface SSLCheckResponse {
  success: boolean;
  data: SSLResult;
}

const SSLChecker: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [validationError, setValidationError] = useState('');
  const { addNotification, rateLimit } = useApp();

  // SSL check mutation
  const sslCheckMutation = useMutation<SSLCheckResponse, any, { domain: string }>({
    mutationFn: async ({ domain }) => {
      const response = await axiosClient.post('/host/ssl-check', { domain });
      return response.data;
    },
    onSuccess: (data) => {
      const result = data.data;
      if (result.isExpired) {
        addNotification({
          type: 'error',
          message: `SSL certificate for ${domain} has expired!`,
          duration: 5000,
        });
      } else if (result.isExpiringSoon) {
        addNotification({
          type: 'warning',
          message: `SSL certificate for ${domain} expires in ${result.daysUntilExpiry} days`,
          duration: 5000,
        });
      } else if (result.valid) {
        addNotification({
          type: 'success',
          message: `SSL certificate for ${domain} is valid`,
          duration: 3000,
        });
      } else {
        addNotification({
          type: 'warning',
          message: `SSL certificate for ${domain} has validation issues`,
          duration: 5000,
        });
      }
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to check SSL certificate',
        duration: 5000,
      });
    },
  });

  // Validate domain format
  const validateDomain = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('Domain is required');
      return false;
    }

    // Remove protocol if provided for validation
    let cleanValue = value.trim().toLowerCase();
    if (cleanValue.startsWith('https://')) {
      cleanValue = cleanValue.substring(8);
    } else if (cleanValue.startsWith('http://')) {
      // Allow http:// - backend will strip it and check SSL anyway
      cleanValue = cleanValue.substring(7);
    }

    // Remove trailing slash, path, and port
    cleanValue = cleanValue.split('/')[0];
    cleanValue = cleanValue.split(':')[0];

    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(cleanValue)) {
      setValidationError('Invalid domain format (e.g., example.com)');
      return false;
    }

    setValidationError('');
    return true;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateDomain(domain)) {
      return;
    }

    // Clean domain before sending (backend also does this, but clean for display)
    let cleanDomain = domain.trim().toLowerCase();
    if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.substring(8);
    } else if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.substring(7);
    }
    cleanDomain = cleanDomain.split('/')[0];
    cleanDomain = cleanDomain.split(':')[0];

    sslCheckMutation.mutate({ domain: cleanDomain });
  };

  // Handle domain input change
  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDomain(value);
    if (validationError && value.trim()) {
      validateDomain(value);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get certificate status badge
  const getCertificateStatusBadge = (result: SSLResult) => {
    if (result.isExpired) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          Expired
        </span>
      );
    }
    if (result.isExpiringSoon) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Expiring Soon
        </span>
      );
    }
    if (!result.valid) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Invalid Certificate
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Valid
      </span>
    );
  };

  // Get days until expiry display
  const getDaysUntilExpiryDisplay = (result: SSLResult) => {
    const days = result.daysUntilExpiry;
    if (days < 0) {
      return (
        <span className="text-red-600 font-semibold">
          Expired {Math.abs(days)} days ago
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="text-yellow-600 font-semibold">
          {days} days remaining
        </span>
      );
    }
    return (
      <span className="text-green-600 font-semibold">
        {days} days remaining
      </span>
    );
  };

  // Check if approaching rate limit
  const isApproachingRateLimit = rateLimit && rateLimit.remaining < rateLimit.limit * 0.2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">SSL Checker</h2>
        <p className="mt-1 text-sm text-gray-600">
          Validate <TechnicalTerm term="SSL Certificate">SSL certificates</TechnicalTerm> and check expiration dates
        </p>
      </div>

      {/* Rate limit warning */}
      {isApproachingRateLimit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You are approaching your rate limit. {rateLimit?.remaining} requests remaining.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SSL Check Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Domain Input */}
          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
              Domain Name
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="domain"
                value={domain}
                onChange={handleDomainChange}
                placeholder="example.com"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  validationError ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={sslCheckMutation.isPending}
              />
            </div>
            {validationError && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Enter domain without protocol (e.g., example.com) or with https://
            </p>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={sslCheckMutation.isPending || !!validationError}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sslCheckMutation.isPending ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Checking SSL certificate...
                </span>
              ) : (
                'Check SSL Certificate'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Display */}
      {sslCheckMutation.isSuccess && sslCheckMutation.data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                SSL Certificate Details
              </h3>
              {getCertificateStatusBadge(sslCheckMutation.data.data)}
            </div>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Certificate Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subject */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Subject (Domain)
                </h4>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {sslCheckMutation.data.data.subject}
                </p>
              </div>

              {/* Issuer */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Issuer (Certificate Authority)
                </h4>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {sslCheckMutation.data.data.issuer}
                </p>
              </div>
            </div>

            {/* Validity Period */}
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                Validity Period
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Valid From */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Valid From</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDate(sslCheckMutation.data.data.validFrom)}
                  </p>
                </div>

                {/* Valid To */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Valid Until</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDate(sslCheckMutation.data.data.validTo)}
                  </p>
                </div>

                {/* Days Until Expiry */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Time Remaining</p>
                  <p className="mt-1 text-sm">
                    {getDaysUntilExpiryDisplay(sslCheckMutation.data.data)}
                  </p>
                </div>
              </div>
            </div>

            {/* Expiration Warning */}
            {sslCheckMutation.data.data.isExpiringSoon && !sslCheckMutation.data.data.isExpired && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Certificate Expiring Soon
                    </h3>
                    <p className="mt-2 text-sm text-yellow-700">
                      This SSL certificate will expire in {sslCheckMutation.data.data.daysUntilExpiry} days. 
                      Consider renewing it soon to avoid service interruptions.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Expired Error */}
            {sslCheckMutation.data.data.isExpired && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Certificate Expired
                    </h3>
                    <p className="mt-2 text-sm text-red-700">
                      This SSL certificate expired {Math.abs(sslCheckMutation.data.data.daysUntilExpiry)} days ago. 
                      Users visiting this site will see security warnings. Renew the certificate immediately.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Invalid Certificate Warning */}
            {!sslCheckMutation.data.data.valid && !sslCheckMutation.data.data.isExpired && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-orange-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-orange-800">
                      Certificate Validation Issue
                    </h3>
                    <p className="mt-2 text-sm text-orange-700">
                      {sslCheckMutation.data.data.isSelfSigned 
                        ? 'This is a self-signed certificate. Users will see security warnings.'
                        : 'This certificate may have validation issues. Users may see security warnings when visiting this site.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Extended Certificate Info */}
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                Certificate Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Issuer Organization */}
                {sslCheckMutation.data.data.issuerOrganization && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase">Issuer Organization</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {sslCheckMutation.data.data.issuerOrganization}
                      {sslCheckMutation.data.data.issuerCountry && (
                        <span className="text-gray-500"> ({sslCheckMutation.data.data.issuerCountry})</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Protocol & Cipher */}
                {sslCheckMutation.data.data.protocol && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase">TLS Protocol</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {sslCheckMutation.data.data.protocol}
                    </p>
                  </div>
                )}

                {sslCheckMutation.data.data.cipher && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase">Cipher Suite</p>
                    <p className="mt-1 text-sm font-medium text-gray-900 break-all">
                      {sslCheckMutation.data.data.cipher}
                    </p>
                  </div>
                )}

                {/* Public Key Info */}
                {sslCheckMutation.data.data.publicKeyAlgorithm && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase">Public Key</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {sslCheckMutation.data.data.publicKeyAlgorithm}
                      {sslCheckMutation.data.data.publicKeySize && (
                        <span> ({sslCheckMutation.data.data.publicKeySize} bits)</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Serial Number */}
                {sslCheckMutation.data.data.serialNumber && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase">Serial Number</p>
                    <p className="mt-1 text-xs font-mono text-gray-900 break-all">
                      {sslCheckMutation.data.data.serialNumber}
                    </p>
                  </div>
                )}

                {/* Certificate Type Badges */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Certificate Type</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sslCheckMutation.data.data.isWildcard && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        Wildcard
                      </span>
                    )}
                    {sslCheckMutation.data.data.isSelfSigned && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        Self-Signed
                      </span>
                    )}
                    {!sslCheckMutation.data.data.isSelfSigned && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        CA-Signed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Subject Alternative Names */}
            {sslCheckMutation.data.data.subjectAltNames && sslCheckMutation.data.data.subjectAltNames.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                  Subject Alternative Names (SAN)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {sslCheckMutation.data.data.subjectAltNames.map((san, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {san}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  This certificate is valid for {sslCheckMutation.data.data.subjectAltNames.length} domain(s)
                </p>
              </div>
            )}

            {/* Fingerprints */}
            {(sslCheckMutation.data.data.fingerprint || sslCheckMutation.data.data.fingerprintSHA256) && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                  Certificate Fingerprints
                </h4>
                <div className="space-y-3">
                  {sslCheckMutation.data.data.fingerprint && (
                    <div>
                      <p className="text-xs text-gray-500">SHA-1</p>
                      <p className="mt-1 text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded">
                        {sslCheckMutation.data.data.fingerprint}
                      </p>
                    </div>
                  )}
                  {sslCheckMutation.data.data.fingerprintSHA256 && (
                    <div>
                      <p className="text-xs text-gray-500">SHA-256</p>
                      <p className="mt-1 text-xs font-mono text-gray-700 break-all bg-gray-50 p-2 rounded">
                        {sslCheckMutation.data.data.fingerprintSHA256}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display with Retry Button - Requirements 10.3 */}
      {sslCheckMutation.isError && (
        <ErrorAlert
          title="SSL Check Failed"
          message={
            sslCheckMutation.error?.code === 'SSL_NOT_AVAILABLE'
              ? `${sslCheckMutation.error?.message || 'An error occurred'}. This domain may not support HTTPS or the SSL port (443) is not accessible.`
              : sslCheckMutation.error?.message || 'An error occurred while checking the SSL certificate'
          }
          onRetry={() => {
            if (domain && !validationError) {
              let cleanDomain = domain.trim().toLowerCase();
              if (cleanDomain.startsWith('https://')) {
                cleanDomain = cleanDomain.substring(8);
              }
              cleanDomain = cleanDomain.split('/')[0];
              sslCheckMutation.mutate({ domain: cleanDomain });
            }
          }}
          onDismiss={() => sslCheckMutation.reset()}
          isRetrying={sslCheckMutation.isPending}
        />
      )}
    </div>
  );
};

export default SSLChecker;
