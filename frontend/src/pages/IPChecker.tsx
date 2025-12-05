import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { TechnicalTerm, ErrorAlert } from '../components';

// IP Result interface matching backend
interface IPResult {
  ip: string;
  type: 'IPv4' | 'IPv6';
  country: string;
  city: string;
  region: string;
  isp: string;
  timezone: string;
  organization: string;
  timestamp: string;
}

// API Response interface
interface IPLookupResponse {
  success: boolean;
  data: IPResult;
}

// Error response interface
interface IPError {
  code: string;
  message: string;
  details?: {
    ip?: string;
    isPrivate?: boolean;
  };
}

const IPChecker: React.FC = () => {
  const [customIP, setCustomIP] = useState('');
  const [validationError, setValidationError] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'custom'>('current');
  const { addNotification, rateLimit } = useApp();

  // Fetch current IP on component mount
  const currentIPQuery = useQuery<IPLookupResponse, IPError>({
    queryKey: ['currentIP'],
    queryFn: async () => {
      const response = await axiosClient.get('/ip/current');
      return response.data;
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Custom IP lookup mutation
  const customIPMutation = useMutation<IPLookupResponse, IPError, string>({
    mutationFn: async (ip: string) => {
      const response = await axiosClient.post('/ip/lookup', { ip });
      return response.data;
    },
    onSuccess: (data) => {
      addNotification({
        type: 'success',
        message: `IP lookup completed for ${data.data.ip}`,
        duration: 3000,
      });
    },
    onError: (error: IPError) => {
      // Check if it's a private IP error
      if (error.details?.isPrivate) {
        addNotification({
          type: 'warning',
          message: 'Private IP addresses cannot be looked up for geolocation',
          duration: 5000,
        });
      } else {
        addNotification({
          type: 'error',
          message: error.message || 'Failed to lookup IP address',
          duration: 5000,
        });
      }
    },
  });


  // Validate IP address format
  const validateIPAddress = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('IP address is required');
      return false;
    }

    const trimmedIP = value.trim();

    // IPv4 validation regex
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // IPv6 validation regex (simplified)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;

    if (!ipv4Regex.test(trimmedIP) && !ipv6Regex.test(trimmedIP)) {
      setValidationError('Invalid IP address format. Must be valid IPv4 (e.g., 8.8.8.8) or IPv6');
      return false;
    }

    setValidationError('');
    return true;
  };

  // Check if IP is private (client-side check for immediate feedback)
  const isPrivateIP = (ip: string): boolean => {
    const parts = ip.split('.').map(Number);
    
    // Check IPv4 private ranges
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      // 10.0.0.0/8
      if (parts[0] === 10) return true;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
      // 127.0.0.0/8 (loopback)
      if (parts[0] === 127) return true;
    }

    // Check IPv6 private ranges
    const lowerIP = ip.toLowerCase();
    if (lowerIP === '::1') return true;
    if (lowerIP.startsWith('fe80:')) return true;
    if (lowerIP.startsWith('fc') || lowerIP.startsWith('fd')) return true;

    return false;
  };

  // Handle custom IP form submission
  const handleCustomIPSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateIPAddress(customIP)) {
      return;
    }

    customIPMutation.mutate(customIP.trim());
  };

  // Handle custom IP input change
  const handleCustomIPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomIP(value);
    if (validationError && value.trim()) {
      validateIPAddress(value);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Check if approaching rate limit
  const isApproachingRateLimit = rateLimit && rateLimit.remaining < rateLimit.limit * 0.2;

  // Get the result to display based on active tab
  const displayResult = activeTab === 'current' 
    ? currentIPQuery.data?.data 
    : customIPMutation.data?.data;

  const isLoading = activeTab === 'current' 
    ? currentIPQuery.isLoading 
    : customIPMutation.isPending;

  const error = activeTab === 'current' 
    ? currentIPQuery.error 
    : customIPMutation.error;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">IP Checker</h2>
        <p className="mt-1 text-sm text-gray-600">
          Get <TechnicalTerm term="IP Address">IP address</TechnicalTerm> information and <TechnicalTerm term="Geolocation">geolocation</TechnicalTerm>
        </p>
      </div>

      {/* Rate limit warning */}
      {isApproachingRateLimit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('current')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'current'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My IP Address
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'custom'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Lookup IP
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Current IP Tab Content */}
          {activeTab === 'current' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Your current public IP address and location information
                </p>
                <button
                  onClick={() => currentIPQuery.refetch()}
                  disabled={currentIPQuery.isLoading || currentIPQuery.isFetching}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {currentIPQuery.isFetching ? (
                    <svg className="animate-spin h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Refresh
                </button>
              </div>
            </div>
          )}

          {/* Custom IP Tab Content */}
          {activeTab === 'custom' && (
            <form onSubmit={handleCustomIPSubmit} className="space-y-4">
              <div>
                <label htmlFor="customIP" className="block text-sm font-medium text-gray-700">
                  IP Address
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="customIP"
                    value={customIP}
                    onChange={handleCustomIPChange}
                    placeholder="e.g., 8.8.8.8 or 2001:4860:4860::8888"
                    className={`flex-1 block w-full px-3 py-2 border rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      validationError ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={customIPMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={customIPMutation.isPending || !!validationError}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {customIPMutation.isPending ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      'Lookup'
                    )}
                  </button>
                </div>
                {validationError && (
                  <p className="mt-2 text-sm text-red-600">{validationError}</p>
                )}
                {customIP && isPrivateIP(customIP) && !validationError && (
                  <p className="mt-2 text-sm text-yellow-600">
                    This appears to be a private IP address. Geolocation lookup is not available for private IPs.
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>


      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex flex-col items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">Looking up IP information...</p>
          </div>
        </div>
      )}

      {/* Results Display */}
      {displayResult && !isLoading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{displayResult.ip}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    displayResult.type === 'IPv4' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {displayResult.type}
                  </span>
                </div>
              </div>
              <span className="text-sm text-gray-500">
                {formatTimestamp(displayResult.timestamp)}
              </span>
            </div>
          </div>

          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {/* Location Section */}
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Location
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <span className="block text-xs text-gray-500 uppercase tracking-wide">Country</span>
                        <span className="block mt-1 font-medium">{displayResult.country}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500 uppercase tracking-wide">Region</span>
                        <span className="block mt-1 font-medium">{displayResult.region}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500 uppercase tracking-wide">City</span>
                        <span className="block mt-1 font-medium">{displayResult.city}</span>
                      </div>
                    </div>
                  </div>
                </dd>
              </div>

              {/* ISP */}
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  ISP
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{displayResult.isp}</dd>
              </div>

              {/* Organization */}
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Organization
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{displayResult.organization}</dd>
              </div>

              {/* Timezone */}
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Timezone
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{displayResult.timezone}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}


      {/* Error Display with Retry Button - Requirements 10.3 */}
      {error && !isLoading && (
        <ErrorAlert
          title={error.details?.isPrivate ? 'Private IP Address' : 'IP Lookup Failed'}
          message={
            error.details?.isPrivate
              ? `${error.message} Private IP addresses (such as 10.x.x.x, 172.16.x.x-172.31.x.x, 192.168.x.x, and 127.x.x.x) are used for local networks and cannot be geolocated.`
              : error.message
          }
          variant={error.details?.isPrivate ? 'warning' : 'error'}
          onRetry={
            error.details?.isPrivate
              ? undefined
              : () => {
                  if (activeTab === 'current') {
                    currentIPQuery.refetch();
                  } else if (customIP && validateIPAddress(customIP)) {
                    customIPMutation.mutate(customIP.trim());
                  }
                }
          }
          onDismiss={() => {
            if (activeTab === 'current') {
              // Can't dismiss query error, just refetch
            } else {
              customIPMutation.reset();
            }
          }}
          isRetrying={activeTab === 'current' ? currentIPQuery.isFetching : customIPMutation.isPending}
        />
      )}

      {/* Help Section with Technical Terms - Requirements 11.4 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">About IP Addresses</h4>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <TechnicalTerm term="IPv4" className="font-medium">IPv4</TechnicalTerm>: The most common format, consisting of four numbers separated by dots (e.g., 192.168.1.1).
          </p>
          <p>
            <TechnicalTerm term="IPv6" className="font-medium">IPv6</TechnicalTerm>: The newer format with eight groups of hexadecimal digits (e.g., 2001:0db8:85a3:0000:0000:8a2e:0370:7334).
          </p>
          <p>
            <TechnicalTerm term="Private IP" className="font-medium">Private IPs</TechnicalTerm>: Addresses like 10.x.x.x, 172.16-31.x.x, and 192.168.x.x are reserved for local networks and cannot be geolocated.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IPChecker;
