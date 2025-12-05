import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { TechnicalTerm, ErrorAlert } from '../components';

// Port Info interface
interface PortInfo {
  port: number;
  service: string;
  state: 'open' | 'closed' | 'filtered';
}

// Port Scan Result interface
interface PortScanResult {
  host: string;
  scannedPorts: number[];
  openPorts: PortInfo[];
  closedPorts: number[];
  scanDuration: number;
}

// API Response interface
interface PortScanResponse {
  success: boolean;
  data: PortScanResult;
}

const PortScanner: React.FC = () => {
  const [host, setHost] = useState('');
  const [useCustomPorts, setUseCustomPorts] = useState(false);
  const [customPortRange, setCustomPortRange] = useState('');
  const [validationError, setValidationError] = useState('');
  const { addNotification, rateLimit } = useApp();

  // Common ports (default)
  const COMMON_PORTS = [21, 22, 25, 80, 443, 3306, 5432, 8080];

  // Port scan mutation
  const portScanMutation = useMutation<PortScanResponse, any, { host: string; ports?: number[] }>({
    mutationFn: async ({ host, ports }) => {
      const response = await axiosClient.post('/host/port-scan', {
        host,
        ports: ports && ports.length > 0 ? ports : undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const openCount = data.data.openPorts.length;
      addNotification({
        type: openCount > 0 ? 'success' : 'info',
        message: `Port scan completed: ${openCount} open port${openCount !== 1 ? 's' : ''} found`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to scan ports',
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

  // Parse custom port range
  const parsePortRange = (range: string): number[] | null => {
    const ports: number[] = [];
    const parts = range.split(',').map(p => p.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        // Range format: 80-85
        const [start, end] = part.split('-').map(p => parseInt(p.trim(), 10));
        if (isNaN(start) || isNaN(end) || start < 1 || end > 65535 || start > end) {
          setValidationError(`Invalid port range: ${part}. Ports must be between 1 and 65535`);
          return null;
        }
        for (let i = start; i <= end; i++) {
          ports.push(i);
        }
      } else {
        // Single port
        const port = parseInt(part, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          setValidationError(`Invalid port number: ${part}. Port must be between 1 and 65535`);
          return null;
        }
        ports.push(port);
      }
    }

    setValidationError('');
    return ports;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateHost(host)) {
      return;
    }

    let ports: number[] | undefined = undefined;

    if (useCustomPorts) {
      if (!customPortRange.trim()) {
        setValidationError('Custom port range is required when enabled');
        return;
      }

      const parsedPorts = parsePortRange(customPortRange);
      if (!parsedPorts) {
        return;
      }
      ports = parsedPorts;
    }

    portScanMutation.mutate({
      host: host.trim(),
      ports,
    });
  };

  // Handle host input change
  const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHost(value);
    if (validationError && value.trim()) {
      validateHost(value);
    }
  };

  // Handle custom port range change
  const handleCustomPortRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomPortRange(value);
    if (validationError && value.trim()) {
      parsePortRange(value);
    }
  };

  // Handle custom ports toggle
  const handleCustomPortsToggle = () => {
    setUseCustomPorts(!useCustomPorts);
    setValidationError('');
  };

  // Check if approaching rate limit
  const isApproachingRateLimit = rateLimit && rateLimit.remaining < rateLimit.limit * 0.2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Port Scanner</h2>
        <p className="mt-1 text-sm text-gray-600">
          Scan for open <TechnicalTerm term="Port">ports</TechnicalTerm> on a host
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

      {/* Port Scan Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                  validationError && !useCustomPorts ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={portScanMutation.isPending}
              />
            </div>
            {validationError && !useCustomPorts && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
          </div>

          {/* Custom Port Range Toggle */}
          <div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useCustomPorts"
                checked={useCustomPorts}
                onChange={handleCustomPortsToggle}
                disabled={portScanMutation.isPending}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="useCustomPorts" className="ml-2 block text-sm text-gray-700">
                Use custom port range
              </label>
            </div>
            {!useCustomPorts && (
              <p className="mt-2 text-xs text-gray-500">
                Default: Common ports ({COMMON_PORTS.join(', ')})
              </p>
            )}
          </div>

          {/* Custom Port Range Input */}
          {useCustomPorts && (
            <div>
              <label htmlFor="customPortRange" className="block text-sm font-medium text-gray-700">
                Custom Port Range
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="customPortRange"
                  value={customPortRange}
                  onChange={handleCustomPortRangeChange}
                  placeholder="80,443,8080-8090"
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    validationError && useCustomPorts ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={portScanMutation.isPending}
                />
              </div>
              {validationError && useCustomPorts && (
                <p className="mt-2 text-sm text-red-600">{validationError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Enter ports separated by commas. Use ranges like 80-85. Example: 80,443,8080-8090
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={portScanMutation.isPending || !!validationError}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {portScanMutation.isPending ? (
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
                  Scanning ports...
                </span>
              ) : (
                'Scan Ports'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Display */}
      {portScanMutation.isSuccess && portScanMutation.data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Port Scan Results for {portScanMutation.data.data.host}
              </h3>
              <span className="text-sm text-gray-500">
                Scan duration: {portScanMutation.data.data.scanDuration}ms
              </span>
            </div>
          </div>

          {/* Scan Summary */}
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Scanned</p>
                <p className="text-2xl font-bold text-gray-900">
                  {portScanMutation.data.data.scannedPorts.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Open Ports</p>
                <p className="text-2xl font-bold text-green-600">
                  {portScanMutation.data.data.openPorts.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Closed Ports</p>
                <p className="text-2xl font-bold text-red-600">
                  {portScanMutation.data.data.closedPorts.length}
                </p>
              </div>
            </div>
          </div>

          {/* Open Ports List */}
          {portScanMutation.data.data.openPorts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Port
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      State
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {portScanMutation.data.data.openPorts.map((portInfo, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {portInfo.port}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {portInfo.service}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {portInfo.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No open ports found</p>
              <p className="text-xs text-gray-400 mt-1">
                All scanned ports are closed or filtered
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Display with Retry Button - Requirements 10.3 */}
      {portScanMutation.isError && (
        <ErrorAlert
          title="Port Scan Failed"
          message={portScanMutation.error?.message || 'An error occurred while scanning ports'}
          onRetry={() => {
            if (host && validateHost(host)) {
              let ports: number[] | undefined = undefined;
              if (useCustomPorts && customPortRange.trim()) {
                const parsedPorts = parsePortRange(customPortRange);
                if (parsedPorts) {
                  ports = parsedPorts;
                }
              }
              portScanMutation.mutate({ host: host.trim(), ports });
            }
          }}
          onDismiss={() => portScanMutation.reset()}
          isRetrying={portScanMutation.isPending}
        />
      )}
    </div>
  );
};

export default PortScanner;
