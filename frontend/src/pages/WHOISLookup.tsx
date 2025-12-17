import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { TechnicalTerm, ErrorAlert } from '../components';

// RDAP/WHOIS Result interface matching backend response
interface DomainLookupResult {
  domain: string;
  registrar: string;
  registrationDate: string;
  expirationDate: string;
  nameServers: string[];
  status: string[];
  source: 'rdap' | 'whois';
  timestamp: string;
}

// API Response interface
interface DomainLookupResponse {
  success: boolean;
  data: DomainLookupResult;
}

const WHOISLookup: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [validationError, setValidationError] = useState('');
  const { addNotification, rateLimit } = useApp();

  // Domain lookup mutation (uses RDAP with WHOIS fallback)
  const domainLookupMutation = useMutation<DomainLookupResponse, any, { domain: string }>({
    mutationFn: async ({ domain }) => {
      const response = await axiosClient.post('/rdap/lookup', { domain });
      return response.data;
    },
    onSuccess: (data) => {
      const sourceLabel = data.data.source === 'rdap' ? 'RDAP' : 'WHOIS';
      addNotification({
        type: 'success',
        message: `Domain lookup completed via ${sourceLabel} for ${data.data.domain}`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to perform domain lookup',
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

    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(value)) {
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

    domainLookupMutation.mutate({
      domain: domain.trim().toLowerCase(),
    });
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
    if (isNaN(date.getTime()) || date.getTime() === 0) {
      return 'Unknown';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Calculate days until expiration
  const getDaysUntilExpiry = (expirationDate: string): number | null => {
    const date = new Date(expirationDate);
    if (isNaN(date.getTime()) || date.getTime() === 0) {
      return null;
    }
    const now = new Date();
    return Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Check if domain needs renewal reminder (within 60 days)
  const needsRenewalReminder = (expirationDate: string): boolean => {
    const days = getDaysUntilExpiry(expirationDate);
    return days !== null && days > 0 && days <= 60;
  };

  // Check if domain is expired
  const isExpired = (expirationDate: string): boolean => {
    const days = getDaysUntilExpiry(expirationDate);
    return days !== null && days < 0;
  };

  // Check if domain is available for registration
  const isAvailableForRegistration = (status: string[]): boolean => {
    return status.some(s => s.toLowerCase().includes('available for registration'));
  };

  // Check if data is privacy protected
  const isPrivacyProtected = (registrar: string, status: string[]): boolean => {
    return (
      registrar.toLowerCase().includes('privacy') ||
      status.some(s => s.toLowerCase().includes('privacy'))
    );
  };

  // Check if approaching rate limit
  const isApproachingRateLimit = rateLimit && rateLimit.remaining < rateLimit.limit * 0.2;

  const result = domainLookupMutation.data?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Domain Lookup</h2>
        <p className="mt-1 text-sm text-gray-600">
          Get domain registration information via <TechnicalTerm term="RDAP">RDAP</TechnicalTerm> or <TechnicalTerm term="WHOIS">WHOIS</TechnicalTerm>
        </p>
      </div>

      {/* Rate limit warning */}
      {isApproachingRateLimit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
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

      {/* Domain Lookup Form */}
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
                disabled={domainLookupMutation.isPending}
              />
            </div>
            {validationError && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={domainLookupMutation.isPending || !!validationError}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {domainLookupMutation.isPending ? (
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
                  Looking up domain...
                </span>
              ) : (
                'Lookup Domain'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Display */}
      {domainLookupMutation.isSuccess && result && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header with domain and source indicator */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-medium text-gray-900">{result.domain}</h3>
                {/* Data source indicator */}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    result.source === 'rdap'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                  title={
                    result.source === 'rdap'
                      ? 'Data retrieved via RDAP (Registration Data Access Protocol)'
                      : 'Data retrieved via traditional WHOIS lookup'
                  }
                >
                  {result.source === 'rdap' ? 'RDAP' : 'WHOIS'}
                </span>
              </div>
              <span className="text-sm text-gray-500">{formatTimestamp(result.timestamp)}</span>
            </div>
            {/* Fallback message if using WHOIS */}
            {result.source === 'whois' && (
              <p className="mt-2 text-sm text-gray-500">
                RDAP was not available for this TLD. Data retrieved via traditional WHOIS lookup.
              </p>
            )}
          </div>

          {/* Available for Registration */}
          {isAvailableForRegistration(result.status) ? (
            <div className="px-6 py-8 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Available for Registration</h3>
              <p className="mt-2 text-sm text-gray-500">
                This domain is not currently registered and may be available for purchase.
              </p>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-6">
              {/* Renewal Reminder */}
              {needsRenewalReminder(result.expirationDate) && (
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
                      <h3 className="text-sm font-medium text-yellow-800">Renewal Reminder</h3>
                      <p className="mt-1 text-sm text-yellow-700">
                        This domain expires in {getDaysUntilExpiry(result.expirationDate)} days.
                        Consider renewing soon to avoid losing it.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Expired Warning */}
              {isExpired(result.expirationDate) && (
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
                      <h3 className="text-sm font-medium text-red-800">Domain Expired</h3>
                      <p className="mt-1 text-sm text-red-700">
                        This domain expired {Math.abs(getDaysUntilExpiry(result.expirationDate) || 0)}{' '}
                        days ago.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Protected Notice */}
              {isPrivacyProtected(result.registrar, result.status) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-blue-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">Privacy Protected</h3>
                      <p className="mt-1 text-sm text-blue-700">
                        Some registration details are protected by a privacy service.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Registration Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Registration Information</h4>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="bg-gray-50 px-4 py-3 rounded-lg">
                    <dt className="text-sm font-medium text-gray-500">Registrar</dt>
                    <dd className="mt-1 text-sm text-gray-900">{result.registrar}</dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 rounded-lg">
                    <dt className="text-sm font-medium text-gray-500">Registration Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDate(result.registrationDate)}
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 rounded-lg">
                    <dt className="text-sm font-medium text-gray-500">Expiration Date</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center">
                      {formatDate(result.expirationDate)}
                      {needsRenewalReminder(result.expirationDate) && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Expiring Soon
                        </span>
                      )}
                      {isExpired(result.expirationDate) && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Expired
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 rounded-lg">
                    <dt className="text-sm font-medium text-gray-500">Days Until Expiry</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {getDaysUntilExpiry(result.expirationDate) !== null
                        ? getDaysUntilExpiry(result.expirationDate)! > 0
                          ? `${getDaysUntilExpiry(result.expirationDate)} days`
                          : 'Expired'
                        : 'Unknown'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Nameservers */}
              {result.nameServers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Nameservers</h4>
                  <ul className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                    {result.nameServers.map((ns, index) => (
                      <li key={index} className="px-4 py-3 text-sm text-gray-900">
                        {ns}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Domain Status */}
              {result.status.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Domain Status</h4>
                  <div className="space-y-2">
                    {result.status.map((status, index) => {
                      const description = getStatusDescription(status);
                      const formattedName = formatStatusName(status);
                      return (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 whitespace-nowrap">
                            {formattedName}
                          </span>
                          {description !== status && (
                            <span className="text-xs text-gray-500 pt-0.5">
                              {description}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Display with Retry Button - Requirements 10.3 */}
      {domainLookupMutation.isError && (
        <ErrorAlert
          title="Domain Lookup Failed"
          message={domainLookupMutation.error?.message || 'An error occurred while looking up domain information'}
          onRetry={() => {
            if (domain && validateDomain(domain)) {
              domainLookupMutation.mutate({ domain: domain.trim().toLowerCase() });
            }
          }}
          onDismiss={() => domainLookupMutation.reset()}
          isRetrying={domainLookupMutation.isPending}
        />
      )}
    </div>
  );
};

// Helper function to format status name
// Handles both camelCase (e.g., "clientTransferProhibited") 
// and already formatted (e.g., "client transfer prohibited")
function formatStatusName(status: string): string {
  // Remove any URL suffix (e.g., "clientTransferProhibited https://icann.org/...")
  const statusCode = status.split(' ')[0];
  
  // Check if already formatted (contains spaces or is all lowercase)
  if (status.includes(' ') && !status.includes('http')) {
    // Already formatted, just return as-is
    return status;
  }
  
  // Convert camelCase to space-separated lowercase
  // e.g., "clientTransferProhibited" -> "client transfer prohibited"
  const formatted = statusCode
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .toLowerCase()
    .trim();
  
  return formatted;
}

// Helper function to get status descriptions
function getStatusDescription(status: string): string {
  const statusDescriptions: Record<string, string> = {
    // Keys with spaces (new format from backend)
    'client transfer prohibited': 'The domain cannot be transferred to another registrar without authorization.',
    'client delete prohibited': 'The domain cannot be deleted without authorization.',
    'client update prohibited': 'The domain cannot be updated without authorization.',
    'client hold': 'The domain is on hold and may not resolve.',
    'server transfer prohibited': 'The registry has prohibited transfer of this domain.',
    'server delete prohibited': 'The registry has prohibited deletion of this domain.',
    'server update prohibited': 'The registry has prohibited updates to this domain.',
    'server hold': 'The registry has placed this domain on hold.',
    'pending delete': 'The domain is scheduled for deletion.',
    'pending transfer': 'A transfer request is pending for this domain.',
    'redemption period': 'The domain is in the redemption period after expiration.',
    // Keys without spaces (legacy camelCase format)
    'clienttransferprohibited': 'The domain cannot be transferred to another registrar without authorization.',
    'clientdeleteprohibited': 'The domain cannot be deleted without authorization.',
    'clientupdateprohibited': 'The domain cannot be updated without authorization.',
    'clienthold': 'The domain is on hold and may not resolve.',
    'servertransferprohibited': 'The registry has prohibited transfer of this domain.',
    'serverdeleteprohibited': 'The registry has prohibited deletion of this domain.',
    'serverupdateprohibited': 'The registry has prohibited updates to this domain.',
    'serverhold': 'The registry has placed this domain on hold.',
    'pendingdelete': 'The domain is scheduled for deletion.',
    'pendingtransfer': 'A transfer request is pending for this domain.',
    'redemptionperiod': 'The domain is in the redemption period after expiration.',
    // Simple statuses
    'active': 'The domain is active and functioning normally.',
    'ok': 'The domain is in a normal state.',
  };

  // Normalize the status: remove URL suffix and convert to lowercase
  const normalizedStatus = status
    .split('http')[0]  // Remove URL suffix
    .trim()
    .toLowerCase();
  
  return statusDescriptions[normalizedStatus] || status;
}

export default WHOISLookup;
