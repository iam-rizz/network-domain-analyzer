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

// DNS Result interface
interface DNSResult {
  domain: string;
  records: DNSRecord[];
  timestamp: string;
}

// API Response interface
interface DNSLookupResponse {
  success: boolean;
  data: DNSResult;
}

const DNSChecker: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<DNSRecordType[]>([]);
  const [validationError, setValidationError] = useState('');
  const { addNotification, rateLimit } = useApp();

  // All available DNS record types
  const allRecordTypes: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];

  // DNS lookup mutation
  const dnsLookupMutation = useMutation<DNSLookupResponse, any, { domain: string; recordTypes?: DNSRecordType[] }>({
    mutationFn: async ({ domain, recordTypes }) => {
      const response = await axiosClient.post('/dns/lookup', {
        domain,
        recordTypes: recordTypes && recordTypes.length > 0 ? recordTypes : undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      addNotification({
        type: 'success',
        message: `DNS lookup completed for ${data.data.domain}`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to perform DNS lookup',
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

    dnsLookupMutation.mutate({
      domain: domain.trim().toLowerCase(),
      recordTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
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

  // Toggle record type selection
  const toggleRecordType = (type: DNSRecordType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Select all record types
  const selectAllTypes = () => {
    setSelectedTypes(allRecordTypes);
  };

  // Clear all record types
  const clearAllTypes = () => {
    setSelectedTypes([]);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Check if approaching rate limit
  const isApproachingRateLimit = rateLimit && rateLimit.remaining < rateLimit.limit * 0.2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">DNS Checker</h2>
        <p className="mt-1 text-sm text-gray-600">
          Lookup <TechnicalTerm term="A Record">DNS records</TechnicalTerm> for a domain
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

      {/* DNS Lookup Form */}
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
                disabled={dnsLookupMutation.isPending}
              />
            </div>
            {validationError && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
          </div>

          {/* Record Type Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Record Types (optional)
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={selectAllTypes}
                  className="text-xs text-blue-600 hover:text-blue-800"
                  disabled={dnsLookupMutation.isPending}
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={clearAllTypes}
                  className="text-xs text-blue-600 hover:text-blue-800"
                  disabled={dnsLookupMutation.isPending}
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allRecordTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleRecordType(type)}
                  disabled={dnsLookupMutation.isPending}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    selectedTypes.includes(type)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${dnsLookupMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Leave empty to fetch all record types
            </p>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={dnsLookupMutation.isPending || !!validationError}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dnsLookupMutation.isPending ? (
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
                  Looking up DNS records...
                </span>
              ) : (
                'Lookup DNS Records'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Display */}
      {dnsLookupMutation.isSuccess && dnsLookupMutation.data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                DNS Records for {dnsLookupMutation.data.data.domain}
              </h3>
              <span className="text-sm text-gray-500">
                {formatTimestamp(dnsLookupMutation.data.data.timestamp)}
              </span>
            </div>
          </div>

          {dnsLookupMutation.data.data.records.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-500">No DNS records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TTL
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dnsLookupMutation.data.data.records.map((record, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {record.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 break-all">
                        {record.value}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.ttl}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Error Display with Retry Button - Requirements 10.3 */}
      {dnsLookupMutation.isError && (
        <ErrorAlert
          title="DNS Lookup Failed"
          message={dnsLookupMutation.error?.message || 'An error occurred while looking up DNS records'}
          onRetry={() => {
            if (domain && !validationError) {
              dnsLookupMutation.mutate({
                domain: domain.trim().toLowerCase(),
                recordTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
              });
            }
          }}
          onDismiss={() => dnsLookupMutation.reset()}
          isRetrying={dnsLookupMutation.isPending}
        />
      )}
    </div>
  );
};

export default DNSChecker;
