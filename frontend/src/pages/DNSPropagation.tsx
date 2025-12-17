import React, { useState, useCallback } from 'react';
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

// Location Result interface with streaming support
interface LocationResult {
  index?: number;
  location: string;
  server?: string;
  region?: string;
  country?: string;
  status: 'pending' | 'success' | 'failure' | 'unavailable';
  records: DNSRecord[];
  responseTime: number;
  error?: string;
}

// Streaming state
interface StreamingState {
  isStreaming: boolean;
  locations: LocationResult[];
  completed: number;
  total: number;
  fullyPropagated: boolean | null;
  inconsistencies: string[];
  error: string | null;
}

const DNSPropagation: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [recordType, setRecordType] = useState<DNSRecordType>('A');
  const [validationError, setValidationError] = useState('');
  const { addNotification, rateLimit } = useApp();

  // Streaming state
  const [streamState, setStreamState] = useState<StreamingState>({
    isStreaming: false,
    locations: [],
    completed: 0,
    total: 0,
    fullyPropagated: null,
    inconsistencies: [],
    error: null,
  });

  // All available DNS record types
  const allRecordTypes: DNSRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];

  // Validate domain format
  const validateDomain = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('Domain is required');
      return false;
    }

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(value)) {
      setValidationError('Invalid domain format (e.g., example.com)');
      return false;
    }

    setValidationError('');
    return true;
  };

  // Handle streaming propagation check
  const startPropagationCheck = useCallback(() => {
    if (!validateDomain(domain)) return;

    const normalizedDomain = domain.trim().toLowerCase();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const url = `${apiBaseUrl}/dns/propagation/stream?domain=${encodeURIComponent(normalizedDomain)}&recordType=${recordType}`;

    // Reset state
    setStreamState({
      isStreaming: true,
      locations: [],
      completed: 0,
      total: 0,
      fullyPropagated: null,
      inconsistencies: [],
      error: null,
    });

    const eventSource = new EventSource(url);

    // Handle init event - receive all locations with pending status
    eventSource.addEventListener('init', (event) => {
      const data = JSON.parse(event.data);
      setStreamState(prev => ({
        ...prev,
        locations: data.locations.map((loc: any, index: number) => ({
          index,
          location: loc.location,
          server: loc.server,
          region: loc.region,
          country: loc.country,
          status: 'pending',
          records: [],
          responseTime: 0,
        })),
        total: data.total,
      }));
    });

    // Handle result event - update individual location
    eventSource.addEventListener('result', (event) => {
      const data = JSON.parse(event.data);
      setStreamState(prev => ({
        ...prev,
        locations: prev.locations.map((loc, idx) =>
          idx === data.index
            ? {
                ...loc,
                status: data.status,
                records: data.records || [],
                responseTime: data.responseTime,
                error: data.error,
              }
            : loc
        ),
        completed: data.progress.completed,
      }));
    });

    // Handle complete event - final summary
    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);
      setStreamState(prev => ({
        ...prev,
        isStreaming: false,
        fullyPropagated: data.fullyPropagated,
        inconsistencies: data.inconsistencies || [],
      }));

      eventSource.close();

      addNotification({
        type: data.fullyPropagated ? 'success' : 'warning',
        message: `Propagation check completed: ${data.fullyPropagated ? 'Fully Propagated' : 'Inconsistent'}`,
        duration: 3000,
      });
    });

    // Handle errors
    eventSource.onerror = () => {
      setStreamState(prev => ({
        ...prev,
        isStreaming: false,
        error: 'Connection error. Please try again.',
      }));
      eventSource.close();

      addNotification({
        type: 'error',
        message: 'Failed to check DNS propagation',
        duration: 5000,
      });
    };
  }, [domain, recordType, addNotification]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startPropagationCheck();
  };

  // Handle domain input change
  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDomain(value);
    if (validationError && value.trim()) {
      validateDomain(value);
    }
  };

  // Get status badge color and icon
  const getStatusDisplay = (status: LocationResult['status']) => {
    switch (status) {
      case 'pending':
        return {
          color: 'bg-gray-100 text-gray-600',
          icon: (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ),
          text: 'checking...',
        };
      case 'success':
        return {
          color: 'bg-green-100 text-green-800',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
          text: 'success',
        };
      case 'failure':
        return {
          color: 'bg-red-100 text-red-800',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
          text: 'failure',
        };
      case 'unavailable':
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ),
          text: 'unavailable',
        };
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

  const hasResults = streamState.locations.length > 0;
  const isComplete = !streamState.isStreaming && hasResults && streamState.fullyPropagated !== null;

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
                disabled={streamState.isStreaming}
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
                disabled={streamState.isStreaming}
              >
                {allRecordTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={streamState.isStreaming || !!validationError}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {streamState.isStreaming ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Checking... ({streamState.completed}/{streamState.total})
                </span>
              ) : (
                'Check Propagation'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Progress Bar */}
      {streamState.isStreaming && streamState.total > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Checking DNS servers...</span>
            <span>{streamState.completed} / {streamState.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(streamState.completed / streamState.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Display */}
      {hasResults && (
        <div className="space-y-4">
          {/* Propagation Status Banner - only show when complete */}
          {isComplete && (
            <div
              className={`rounded-lg p-4 ${
                streamState.fullyPropagated
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {streamState.fullyPropagated ? (
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3 className={`text-lg font-medium ${streamState.fullyPropagated ? 'text-green-800' : 'text-yellow-800'}`}>
                    {streamState.fullyPropagated ? 'Fully Propagated' : 'Inconsistent Propagation'}
                  </h3>
                  <p className={`mt-1 text-sm ${streamState.fullyPropagated ? 'text-green-700' : 'text-yellow-700'}`}>
                    {streamState.fullyPropagated
                      ? 'DNS records are consistent across all locations'
                      : 'DNS records differ across some locations'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Inconsistencies Alert */}
          {isComplete && streamState.inconsistencies.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-orange-800">Detected Inconsistencies</h4>
                  <ul className="mt-2 text-sm text-orange-700 list-disc list-inside space-y-1">
                    {streamState.inconsistencies.map((inconsistency, index) => (
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
                Results from {streamState.locations.length} Probe Locations
              </h3>
            </div>

            <div className="divide-y divide-gray-200">
              {streamState.locations.map((location, index) => {
                const statusDisplay = getStatusDisplay(location.status);
                return (
                  <div
                    key={index}
                    className={`px-6 py-4 transition-all duration-300 ${
                      location.status === 'pending' ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-sm font-medium text-gray-900">
                            {location.location}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.color}`}
                          >
                            <span className="mr-1">{statusDisplay.icon}</span>
                            {statusDisplay.text}
                          </span>
                          {location.status !== 'pending' && (
                            <span className="text-xs text-gray-500">
                              {location.responseTime}ms
                            </span>
                          )}
                        </div>

                        {/* Region/Country info */}
                        {location.region && (
                          <p className="mt-1 text-xs text-gray-500">
                            {location.country && `${location.country} • `}
                            {location.region.charAt(0).toUpperCase() + location.region.slice(1)}
                          </p>
                        )}

                        {/* Show records for successful locations */}
                        {location.status === 'success' && location.records.length > 0 && (
                          <div className="mt-3">
                            <div className="space-y-2">
                              {location.records.map((record, recordIndex) => (
                                <div key={recordIndex} className="flex items-center space-x-2 text-sm">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {record.type}
                                  </span>
                                  <span className="text-gray-900 font-mono text-xs break-all">
                                    {record.value}
                                  </span>
                                  <span className="text-gray-500 text-xs">TTL: {record.ttl}s</span>
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
                );
              })}
            </div>
          </div>

          {/* Summary Statistics - only show when complete */}
          {isComplete && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Locations</p>
                  <p className="text-2xl font-bold text-gray-900">{streamState.locations.length}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">
                    {streamState.locations.filter((l) => l.status === 'success').length}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Failed/Unavailable</p>
                  <p className="text-2xl font-bold text-red-600">
                    {streamState.locations.filter((l) => l.status === 'failure' || l.status === 'unavailable').length}
                  </p>
                </div>
              </div>

              {/* Unique values found */}
              {streamState.locations.some((l) => l.status === 'success') && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Unique Record Values Found:</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(getUniqueRecordValues(streamState.locations)).map((value, index) => (
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
          )}
        </div>
      )}

      {/* Error Display */}
      {streamState.error && (
        <ErrorAlert
          title="Propagation Check Failed"
          message={streamState.error}
          onRetry={startPropagationCheck}
          onDismiss={() => setStreamState(prev => ({ ...prev, error: null }))}
          isRetrying={streamState.isStreaming}
        />
      )}
    </div>
  );
};

export default DNSPropagation;
