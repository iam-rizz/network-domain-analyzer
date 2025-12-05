import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { TechnicalTerm, ErrorAlert } from '../components';

// DNS Record Types
type DNSRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'NS' | 'SOA';

// DNS Record interface
interface DNSRecord {
  type: DNSRecordType;
  value: string;
  ttl: number;
}

// Location Result interface
interface LocationResult {
  location: string;
  status: 'success' | 'failure' | 'unavailable';
  records: DNSRecord[];
  responseTime: number;
}

// Propagation Status interface
interface PropagationStatus {
  fullyPropagated: boolean;
  locations: LocationResult[];
  inconsistencies: string[];
}

// API Response interface
interface PropagationResponse {
  success: boolean;
  data: PropagationStatus;
}

const DNSPropagation: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [recordType, setRecordType] = useState<DNSRecordType>('A');
  const [validationError, setValidationError] = useState('');
  const { addNotification, rateLimit } = useApp();

  // All available DNS record types
  const allRecordTypes: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];

  // DNS propagation check mutation
  const propagationMutation = useMutation<PropagationResponse, any, { domain: string; recordType: DNSRecordType }>({
    mutationFn: async ({ domain, recordType }) => {
      const response = await axiosClient.post('/dns/propagation', {
        domain,
        recordType,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const status = data.data.fullyPropagated ? 'Fully Propagated' : 'Inconsistent';
      addNotification({
        type: data.data.fullyPropagated ? 'success' : 'warning',
        message: `Propagation check completed: ${status}`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to check DNS propagation',
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

    propagationMutation.mutate({
      domain: domain.trim().toLowerCase(),
      recordType,
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

  // Get status badge color
  const getStatusColor = (status: 'success' | 'failure' | 'unavailable'): string => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failure':
        return 'bg-red-100 text-red-800';
      case 'unavailable':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Check if approaching rate limit
  const isApproachingRateLimit = rateLimit && rateLimit.remaining < rateLimit.limit * 0.2;

  // Get unique record values from all locations
  const getUniqueRecordValues = (locations: LocationResult[]): Set<string> => {
    const values = new Set<string>();
    locations.forEach((location) => {
      if (location.status === 'success') {
        location.records.forEach((record) => {
          values.add(record.value);
        });
      }
    });
    return values;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">DNS Propagation Check</h2>
        <p className="mt-1 text-sm text-gray-600">
          Check <TechnicalTerm term="DNS Propagation">DNS propagation</TechnicalTerm> across multiple global locations
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

      {/* Propagation Check Form */}
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
                disabled={propagationMutation.isPending}
              />
            </div>
            {validationError && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
          </div>

          {/* Record Type Selector */}
          <div>
            <label htmlFor="recordType" className="block text-sm font-medium text-gray-700">
              Record Type
            </label>
            <div className="mt-1">
              <select
                id="recordType"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as DNSRecordType)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={propagationMutation.isPending}
              >
                {allRecordTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Select the DNS record type to check propagation
            </p>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={propagationMutation.isPending || !!validationError}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {propagationMutation.isPending ? (
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
                  Checking propagation...
                </span>
              ) : (
                'Check Propagation'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Display */}
      {propagationMutation.isSuccess && propagationMutation.data && (
        <div className="space-y-4">
          {/* Propagation Status Banner */}
          <div
            className={`rounded-lg p-4 ${
              propagationMutation.data.data.fullyPropagated
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {propagationMutation.data.data.fullyPropagated ? (
                  <svg
                    className="h-6 w-6 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6 text-yellow-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3
                  className={`text-lg font-medium ${
                    propagationMutation.data.data.fullyPropagated
                      ? 'text-green-800'
                      : 'text-yellow-800'
                  }`}
                >
                  {propagationMutation.data.data.fullyPropagated
                    ? 'Fully Propagated'
                    : 'Inconsistent Propagation'}
                </h3>
                <p
                  className={`mt-1 text-sm ${
                    propagationMutation.data.data.fullyPropagated
                      ? 'text-green-700'
                      : 'text-yellow-700'
                  }`}
                >
                  {propagationMutation.data.data.fullyPropagated
                    ? 'DNS records are consistent across all locations'
                    : 'DNS records differ across some locations'}
                </p>
              </div>
            </div>
          </div>

          {/* Inconsistencies Alert */}
          {propagationMutation.data.data.inconsistencies.length > 0 && (
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
                  <h4 className="text-sm font-medium text-orange-800">
                    Detected Inconsistencies
                  </h4>
                  <ul className="mt-2 text-sm text-orange-700 list-disc list-inside space-y-1">
                    {propagationMutation.data.data.inconsistencies.map((inconsistency, index) => (
                      <li key={index}>{inconsistency}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Location Results */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">
                Results from {propagationMutation.data.data.locations.length} Probe Locations
              </h3>
            </div>

            <div className="divide-y divide-gray-200">
              {propagationMutation.data.data.locations.map((location, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-sm font-medium text-gray-900">
                          {location.location}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            location.status
                          )}`}
                        >
                          {location.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {location.responseTime}ms
                        </span>
                      </div>

                      {/* Show records for successful locations */}
                      {location.status === 'success' && location.records.length > 0 && (
                        <div className="mt-3">
                          <div className="space-y-2">
                            {location.records.map((record, recordIndex) => (
                              <div
                                key={recordIndex}
                                className="flex items-center space-x-2 text-sm"
                              >
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {record.type}
                                </span>
                                <span className="text-gray-900 font-mono text-xs break-all">
                                  {record.value}
                                </span>
                                <span className="text-gray-500 text-xs">
                                  TTL: {record.ttl}s
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Show message for unavailable locations */}
                      {location.status === 'unavailable' && (
                        <p className="mt-2 text-sm text-gray-500">
                          This location is currently unavailable
                        </p>
                      )}

                      {/* Show message for failed locations */}
                      {location.status === 'failure' && (
                        <p className="mt-2 text-sm text-red-600">
                          Failed to query this location
                        </p>
                      )}

                      {/* Show message for successful but empty results */}
                      {location.status === 'success' && location.records.length === 0 && (
                        <p className="mt-2 text-sm text-gray-500">
                          No records found at this location
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total Locations</p>
                <p className="text-2xl font-bold text-gray-900">
                  {propagationMutation.data.data.locations.length}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-green-600">
                  {
                    propagationMutation.data.data.locations.filter(
                      (l) => l.status === 'success'
                    ).length
                  }
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Failed/Unavailable</p>
                <p className="text-2xl font-bold text-red-600">
                  {
                    propagationMutation.data.data.locations.filter(
                      (l) => l.status === 'failure' || l.status === 'unavailable'
                    ).length
                  }
                </p>
              </div>
            </div>

            {/* Unique values found */}
            {propagationMutation.data.data.locations.some((l) => l.status === 'success') && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Unique Record Values Found:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    getUniqueRecordValues(propagationMutation.data.data.locations)
                  ).map((value, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display with Retry Button - Requirements 10.3 */}
      {propagationMutation.isError && (
        <ErrorAlert
          title="Propagation Check Failed"
          message={propagationMutation.error?.message || 'An error occurred while checking DNS propagation'}
          onRetry={() => {
            if (domain && validateDomain(domain)) {
              propagationMutation.mutate({
                domain: domain.trim().toLowerCase(),
                recordType,
              });
            }
          }}
          onDismiss={() => propagationMutation.reset()}
          isRetrying={propagationMutation.isPending}
        />
      )}
    </div>
  );
};

export default DNSPropagation;
