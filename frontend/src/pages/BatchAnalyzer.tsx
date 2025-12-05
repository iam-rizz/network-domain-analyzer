import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { ErrorAlert } from '../components';

// Analysis types available for batch processing
type AnalysisType = 'dns' | 'whois' | 'rdap' | 'host' | 'all';

// Batch result interface
interface BatchResult {
  domain: string;
  status: 'success' | 'error';
  result?: any;
  error?: string;
}

// Batch summary interface
interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    domain: string;
    status: 'success' | 'error';
    error?: string;
    hasData?: boolean;
    timestamp?: string;
  }>;
}

// API Response interface
interface BatchAnalyzeResponse {
  success: boolean;
  data: {
    summary: BatchSummary;
    results: BatchResult[];
  };
}

const MAX_BATCH_SIZE = 10;

const BatchAnalyzer: React.FC = () => {
  const [domainsInput, setDomainsInput] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<AnalysisType[]>(['dns']);
  const [validationError, setValidationError] = useState('');
  const { addNotification, isAuthenticated } = useApp();

  // All available analysis types
  const allAnalysisTypes: { value: AnalysisType; label: string; description: string }[] = [
    { value: 'dns', label: 'DNS', description: 'DNS records lookup' },
    { value: 'whois', label: 'WHOIS', description: 'Domain registration info' },
    { value: 'rdap', label: 'RDAP', description: 'Registration data (modern)' },
    { value: 'host', label: 'Host', description: 'HTTP availability check' },
    { value: 'all', label: 'All', description: 'Run all analysis types' },
  ];

  // Parse domains from input
  const parseDomains = (input: string): string[] => {
    if (!input || typeof input !== 'string') {
      return [];
    }
    return input
      .split(/[\n,]+/)
      .map(domain => domain.trim().toLowerCase())
      .filter(domain => domain.length > 0);
  };

  // Get domain count from input
  const getDomainCount = (): number => {
    return parseDomains(domainsInput).length;
  };

  // Batch analyze mutation
  const batchAnalyzeMutation = useMutation<BatchAnalyzeResponse, any, { domains: string; analysisTypes: AnalysisType[] }>({
    mutationFn: async ({ domains, analysisTypes }) => {
      const response = await axiosClient.post('/batch/analyze', {
        domains,
        analysisTypes,
      });
      return response.data;
    },
    onSuccess: (data) => {
      addNotification({
        type: 'success',
        message: `Batch analysis completed: ${data.data.summary.successful} successful, ${data.data.summary.failed} failed`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to perform batch analysis',
        duration: 5000,
      });
    },
  });

  // Validate input
  const validateInput = (): boolean => {
    const domains = parseDomains(domainsInput);

    if (domains.length === 0) {
      setValidationError('Please enter at least one domain');
      return false;
    }

    if (domains.length > MAX_BATCH_SIZE) {
      setValidationError(`Maximum ${MAX_BATCH_SIZE} domains allowed. You entered ${domains.length} domains.`);
      return false;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z]{2,})+$/;
    const invalidDomains = domains.filter(d => !domainRegex.test(d));
    if (invalidDomains.length > 0) {
      setValidationError(`Invalid domain format: ${invalidDomains.slice(0, 3).join(', ')}${invalidDomains.length > 3 ? '...' : ''}`);
      return false;
    }

    if (selectedTypes.length === 0) {
      setValidationError('Please select at least one analysis type');
      return false;
    }

    setValidationError('');
    return true;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInput()) {
      return;
    }

    batchAnalyzeMutation.mutate({
      domains: domainsInput,
      analysisTypes: selectedTypes,
    });
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDomainsInput(value);
    if (validationError) {
      setValidationError('');
    }
  };

  // Toggle analysis type selection
  const toggleAnalysisType = (type: AnalysisType) => {
    if (type === 'all') {
      // If selecting 'all', clear other selections
      setSelectedTypes(['all']);
    } else {
      setSelectedTypes((prev) => {
        // Remove 'all' if selecting specific types
        const filtered = prev.filter(t => t !== 'all');
        if (filtered.includes(type)) {
          return filtered.filter((t) => t !== type);
        } else {
          return [...filtered, type];
        }
      });
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get status badge color
  const getStatusColor = (status: 'success' | 'error'): string => {
    return status === 'success'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const domainCount = getDomainCount();
  const isOverLimit = domainCount > MAX_BATCH_SIZE;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Batch Analyzer</h2>
        <p className="mt-1 text-sm text-gray-600">
          Analyze multiple domains at once (max {MAX_BATCH_SIZE} domains)
        </p>
      </div>

      {/* API Key Warning */}
      {!isAuthenticated && (
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
                Batch analysis requires API key authentication. Please set your API key in settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Batch Size Warning */}
      {isOverLimit && (
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
              <p className="text-sm text-red-700">
                Batch size limit exceeded! Maximum {MAX_BATCH_SIZE} domains allowed. You have {domainCount} domains.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Batch Analysis Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Domains Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="domains" className="block text-sm font-medium text-gray-700">
                Domains
              </label>
              <span className={`text-sm ${isOverLimit ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {domainCount} / {MAX_BATCH_SIZE} domains
              </span>
            </div>
            <div className="mt-1">
              <textarea
                id="domains"
                value={domainsInput}
                onChange={handleInputChange}
                placeholder="Enter domains (one per line or comma-separated)&#10;example.com&#10;google.com, github.com&#10;amazon.com"
                rows={8}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono ${
                  validationError || isOverLimit ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={batchAnalyzeMutation.isPending}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Supports newline-separated or comma-separated domains
            </p>
            {validationError && (
              <p className="mt-2 text-sm text-red-600">{validationError}</p>
            )}
          </div>

          {/* Analysis Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Types
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {allAnalysisTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleAnalysisType(type.value)}
                  disabled={batchAnalyzeMutation.isPending}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors border ${
                    selectedTypes.includes(type.value)
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } ${batchAnalyzeMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={type.description}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={batchAnalyzeMutation.isPending || isOverLimit || !isAuthenticated || domainCount === 0}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchAnalyzeMutation.isPending ? (
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
                  Analyzing {domainCount} domains...
                </span>
              ) : (
                `Analyze ${domainCount > 0 ? domainCount : ''} Domain${domainCount !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Progress Indicator (during analysis) */}
      {batchAnalyzeMutation.isPending && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="animate-spin h-5 w-5 text-blue-600 mr-3"
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
            <div>
              <p className="text-sm font-medium text-blue-800">
                Processing batch analysis...
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Analyzing {domainCount} domains. This may take a while.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {batchAnalyzeMutation.isSuccess && batchAnalyzeMutation.data && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Summary Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Batch Analysis Results</h3>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <span className="text-gray-600">
                Total: <span className="font-medium">{batchAnalyzeMutation.data.data.summary.total}</span>
              </span>
              <span className="text-green-600">
                Successful: <span className="font-medium">{batchAnalyzeMutation.data.data.summary.successful}</span>
              </span>
              <span className="text-red-600">
                Failed: <span className="font-medium">{batchAnalyzeMutation.data.data.summary.failed}</span>
              </span>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {batchAnalyzeMutation.data.data.results.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.domain}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                        {result.status === 'success' ? (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Success
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Error
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {result.status === 'error' ? (
                        <span className="text-red-600">{result.error}</span>
                      ) : result.result?.timestamp ? (
                        <span className="text-gray-500">
                          Analyzed at {formatTimestamp(result.result.timestamp)}
                        </span>
                      ) : (
                        <span className="text-green-600">Analysis complete</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error Display with Retry Button - Requirements 10.3 */}
      {batchAnalyzeMutation.isError && (
        <ErrorAlert
          title="Batch Analysis Failed"
          message={batchAnalyzeMutation.error?.message || 'An error occurred while performing batch analysis'}
          onRetry={() => {
            if (validateInput()) {
              batchAnalyzeMutation.mutate({
                domains: domainsInput,
                analysisTypes: selectedTypes,
              });
            }
          }}
          onDismiss={() => batchAnalyzeMutation.reset()}
          isRetrying={batchAnalyzeMutation.isPending}
        />
      )}
    </div>
  );
};

export default BatchAnalyzer;
