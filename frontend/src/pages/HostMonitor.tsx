import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { TechnicalTerm, ErrorAlert } from '../components';

// Ping Result interface
interface PingResult {
  alive: boolean;
  responseTime: number;
  location: string;
}

// HTTP Result interface
interface HTTPResult {
  statusCode: number;
  responseTime: number;
  headers: Record<string, string>;
}

// API Response interfaces
interface PingResponse {
  success: boolean;
  data: PingResult[];
}

interface HTTPCheckResponse {
  success: boolean;
  data: HTTPResult;
}

const HostMonitor: React.FC = () => {
  const [host, setHost] = useState('');
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');
  const { addNotification, rateLimit } = useApp();

  // Slow response threshold (5000ms as per requirement 3.5)
  const SLOW_RESPONSE_THRESHOLD = 5000;

  // Ping mutation
  const pingMutation = useMutation<PingResponse, any, { host: string }>({
    mutationFn: async ({ host }) => {
      const response = await axiosClient.post('/host/ping', { host });
      return response.data;
    },
    onSuccess: (data) => {
      const aliveCount = data.data.filter(r => r.alive).length;
      addNotification({
        type: aliveCount > 0 ? 'success' : 'warning',
        message: `Ping completed: ${aliveCount}/${data.data.length} locations responded`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to ping host',
        duration: 5000,
      });
    },
  });

  // HTTP check mutation
  const httpCheckMutation = useMutation<HTTPCheckResponse, any, { url: string }>({
    mutationFn: async ({ url }) => {
      const response = await axiosClient.post('/host/http-check', { url });
      return response.data;
    },
    onSuccess: (data) => {
      const statusCode = data.data.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      addNotification({
        type: isSuccess ? 'success' : 'warning',
        message: `HTTP check completed: Status ${statusCode}`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to check HTTP endpoint',
        duration: 5000,
      });
    },
  });

  // Validate host format
  const validateHost = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('Host is required');
      return false;
    }

    // Basic hostname/IP validation
    const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;

    if (!hostnameRegex.test(value) && !ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      setValidationError('Invalid host format (e.g., example.com or 192.168.1.1)');
      return false;
    }

    setValidationError('');
    return true;
  };

  // Validate URL format
  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError('URL is required');
      return false;
    }

    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      setValidationError('URL must start with http:// or https://');
      return false;
    }

    setValidationError('');
    return true;
  };

  // Handle ping form submission
  const handlePingSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateHost(host)) {
      return;
    }

    pingMutation.mutate({ host: host.trim() });
  };

  // Handle HTTP check form submission
  const handleHttpCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateUrl(url)) {
      return;
    }

    httpCheckMutation.mutate({ url: url.trim() });
  };

  // Handle host input change
  const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHost(value);
    if (validationError && value.trim()) {
      validateHost(value);
    }
  };

  // Handle URL input change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    if (validationError && value.trim()) {
      validateUrl(value);
    }
  };

  // Get status code color
  const getStatusCodeColor = (statusCode: number): string => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-600';
    if (statusCode >= 300 && statusCode < 400) return 'text-blue-600';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get status code badge color
  const getStatusCodeBadgeColor = (statusCode: number): string => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 text-green-800';
    if (statusCode >= 300 && statusCode < 400) return 'bg-blue-100 text-blue-800';
    if (statusCode >= 400 && statusCode < 500) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Check if response is slow
  const isSlowResponse = (responseTime: number): boolean => {
    return responseTime > SLOW_RESPONSE_THRESHOLD;
  };

  // Check if approaching rate limit
  const isApproachingRateLimit = rateLimit && rateLimit.remaining < rateLimit.limit * 0.2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Host Monitor</h2>
        <p className="mt-1 text-sm text-gray-600">
          Monitor host availability using <TechnicalTerm term="Ping">ping</TechnicalTerm> and <TechnicalTerm term="HTTP Status Code">HTTP</TechnicalTerm> checks
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

      {/* Ping Test Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ping Test</h3>
        <form onSubmit={handlePingSubmit} className="space-y-4">
          {/* Host Input */}
          <div>
            <label htmlFor="host" className="block text-sm font-medium text-gray-700">
              Host or IP Address
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="host"
                value={host}
                onChange={handleHostChange}
                placeholder="example.com or 192.168.1.1"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  validationError && host ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={pingMutation.isPending}
              />
            </div>
            {validationError && host && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={pingMutation.isPending || (!!validationError && !!host)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pingMutation.isPending ? (
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
                  Pinging host...
                </span>
              ) : (
                'Ping Host'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Ping Results Display */}
      {pingMutation.isSuccess && pingMutation.data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">
              Ping Results from {pingMutation.data.data.length} Probe Locations
            </h3>
          </div>

          <div className="divide-y divide-gray-200">
            {pingMutation.data.data.map((result, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      {result.location}
                    </h4>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        result.alive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {result.alive ? 'Alive' : 'Unreachable'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Response Time</p>
                      <p
                        className={`text-lg font-semibold ${
                          result.alive
                            ? isSlowResponse(result.responseTime)
                              ? 'text-yellow-600'
                              : 'text-green-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {result.responseTime.toFixed(0)}ms
                      </p>
                    </div>
                    {result.alive && isSlowResponse(result.responseTime) && (
                      <div className="flex items-center">
                        <svg
                          className="h-5 w-5 text-yellow-500"
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
                        <span className="ml-2 text-sm text-yellow-600 font-medium">
                          Slow Response
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Alive Locations</p>
                <p className="text-xl font-bold text-green-600">
                  {pingMutation.data.data.filter(r => r.alive).length} / {pingMutation.data.data.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Average Response Time</p>
                <p className="text-xl font-bold text-gray-900">
                  {(
                    pingMutation.data.data
                      .filter(r => r.alive)
                      .reduce((sum, r) => sum + r.responseTime, 0) /
                    (pingMutation.data.data.filter(r => r.alive).length || 1)
                  ).toFixed(0)}ms
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ping Error Display with Retry Button - Requirements 10.3 */}
      {pingMutation.isError && (
        <ErrorAlert
          title="Ping Test Failed"
          message={pingMutation.error?.message || 'An error occurred while pinging the host'}
          onRetry={() => {
            if (host && validateHost(host)) {
              pingMutation.mutate({ host: host.trim() });
            }
          }}
          onDismiss={() => pingMutation.reset()}
          isRetrying={pingMutation.isPending}
        />
      )}

      {/* HTTP Check Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">HTTP/HTTPS Check</h3>
        <form onSubmit={handleHttpCheckSubmit} className="space-y-4">
          {/* URL Input */}
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700">
              URL
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://example.com"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  validationError && url ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={httpCheckMutation.isPending}
              />
            </div>
            {validationError && url && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Must include protocol (http:// or https://)
            </p>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={httpCheckMutation.isPending || (!!validationError && !!url)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {httpCheckMutation.isPending ? (
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
                  Checking endpoint...
                </span>
              ) : (
                'Check HTTP Endpoint'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* HTTP Check Results Display */}
      {httpCheckMutation.isSuccess && httpCheckMutation.data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">HTTP Check Results</h3>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Status Code */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Status Code</p>
                  <div className="flex items-center space-x-3 mt-1">
                    <span
                      className={`text-3xl font-bold ${getStatusCodeColor(
                        httpCheckMutation.data.data.statusCode
                      )}`}
                    >
                      {httpCheckMutation.data.data.statusCode}
                    </span>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusCodeBadgeColor(
                        httpCheckMutation.data.data.statusCode
                      )}`}
                    >
                      {httpCheckMutation.data.data.statusCode >= 200 &&
                      httpCheckMutation.data.data.statusCode < 300
                        ? 'Success'
                        : httpCheckMutation.data.data.statusCode >= 300 &&
                          httpCheckMutation.data.data.statusCode < 400
                        ? 'Redirect'
                        : httpCheckMutation.data.data.statusCode >= 400 &&
                          httpCheckMutation.data.data.statusCode < 500
                        ? 'Client Error'
                        : 'Server Error'}
                    </span>
                  </div>
                </div>

                {/* Response Time */}
                <div className="text-right">
                  <p className="text-sm text-gray-600">Response Time</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <p
                      className={`text-3xl font-bold ${
                        isSlowResponse(httpCheckMutation.data.data.responseTime)
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      {httpCheckMutation.data.data.responseTime}ms
                    </p>
                    {isSlowResponse(httpCheckMutation.data.data.responseTime) && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Slow Response
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Response Headers */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Response Headers</h4>
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {Object.entries(httpCheckMutation.data.data.headers).map(([key, value]) => (
                    <div key={key} className="flex items-start">
                      <span className="text-sm font-medium text-gray-700 min-w-[200px]">
                        {key}:
                      </span>
                      <span className="text-sm text-gray-600 break-all ml-2">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HTTP Check Error Display with Retry Button - Requirements 10.3 */}
      {httpCheckMutation.isError && (
        <ErrorAlert
          title="HTTP Check Failed"
          message={httpCheckMutation.error?.message || 'An error occurred while checking the HTTP endpoint'}
          onRetry={() => {
            if (url && validateUrl(url)) {
              httpCheckMutation.mutate({ url: url.trim() });
            }
          }}
          onDismiss={() => httpCheckMutation.reset()}
          isRetrying={httpCheckMutation.isPending}
        />
      )}
    </div>
  );
};

export default HostMonitor;
