import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';
import { ExportButton, ErrorAlert } from '../components';

// Analysis type definition
interface Analysis {
  id: string;
  type: string;
  domain?: string;
  ip?: string;
  result: any;
  status: 'success' | 'error';
  error?: string;
  createdAt: string;
}

// API response type
interface HistoryResponse {
  success: boolean;
  data: {
    history: Analysis[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  };
}

// Pagination state
interface PaginationState {
  limit: number;
  offset: number;
}

const History: React.FC = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useApp();
  
  // State
  const [pagination, setPagination] = useState<PaginationState>({ limit: 10, offset: 0 });
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [comparisonAnalysis, setComparisonAnalysis] = useState<Analysis | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch history
  const { data: historyData, isLoading, error, refetch } = useQuery<HistoryResponse>({
    queryKey: ['history', pagination],
    queryFn: async () => {
      const response = await axiosClient.get('/history', {
        params: { limit: pagination.limit, offset: pagination.offset },
      });
      return response.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['recentAnalyses'] });
      addNotification({
        type: 'success',
        message: 'Analysis deleted successfully',
        duration: 3000,
      });
      setShowDeleteConfirm(null);
      if (selectedAnalysis && selectedAnalysis.id === showDeleteConfirm) {
        setSelectedAnalysis(null);
        setShowDetailModal(false);
      }
    },
    onError: () => {
      addNotification({
        type: 'error',
        message: 'Failed to delete analysis',
        duration: 5000,
      });
    },
  });

  // Format analysis type for display
  const formatAnalysisType = (type: string): string => {
    const typeMap: Record<string, string> = {
      dns_lookup: 'DNS Lookup',
      dns_propagation: 'DNS Propagation',
      whois: 'WHOIS',
      rdap: 'RDAP',
      ping: 'Ping',
      http_check: 'HTTP Check',
      port_scan: 'Port Scan',
      ssl_check: 'SSL Check',
      ip_lookup: 'IP Lookup',
    };
    return typeMap[type] || type;
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    return status === 'success' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      dns_lookup: 'bg-blue-100 text-blue-800',
      dns_propagation: 'bg-cyan-100 text-cyan-800',
      whois: 'bg-purple-100 text-purple-800',
      rdap: 'bg-violet-100 text-violet-800',
      ping: 'bg-green-100 text-green-800',
      http_check: 'bg-emerald-100 text-emerald-800',
      port_scan: 'bg-yellow-100 text-yellow-800',
      ssl_check: 'bg-red-100 text-red-800',
      ip_lookup: 'bg-indigo-100 text-indigo-800',
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  };

  // Handle page change
  const handlePageChange = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
  };

  // Handle view details
  const handleViewDetails = useCallback(async (analysis: Analysis) => {
    setSelectedAnalysis(analysis);
    setShowDetailModal(true);
    
    // Find previous analysis for comparison
    if (historyData?.data.history) {
      const target = analysis.domain || analysis.ip;
      const previousAnalyses = historyData.data.history.filter(
        a => a.id !== analysis.id && 
             a.type === analysis.type && 
             (a.domain === target || a.ip === target)
      );
      
      if (previousAnalyses.length > 0) {
        // Get the most recent previous analysis
        setComparisonAnalysis(previousAnalyses[0]);
      } else {
        setComparisonAnalysis(null);
      }
    }
  }, [historyData]);

  // Handle delete
  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteMutation.mutate(showDeleteConfirm);
    }
  };

  // Handle selection toggle
  const handleSelectToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    if (!historyData?.data.history) return;
    
    const allIds = historyData.data.history.map(a => a.id);
    const allSelected = allIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      // Deselect all on current page
      setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      // Select all on current page
      setSelectedIds(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  // Check if all items on current page are selected
  const isAllSelected = historyData?.data.history 
    ? historyData.data.history.length > 0 && historyData.data.history.every(a => selectedIds.includes(a.id))
    : false;

  // Check if some items are selected
  const isSomeSelected = selectedIds.length > 0;

  // Render result details
  const renderResultDetails = (result: any, type: string): React.ReactNode => {
    if (!result) return <p className="text-gray-500">No result data</p>;

    try {
      switch (type) {
        case 'dns_lookup':
          return (
            <div className="space-y-2">
              {result.records && Array.isArray(result.records) && (
                <div>
                  <h5 className="font-medium text-gray-700 mb-1">DNS Records:</h5>
                  <div className="bg-gray-50 rounded p-2 max-h-60 overflow-y-auto">
                    {result.records.map((record: any, idx: number) => (
                      <div key={idx} className="text-sm py-1 border-b border-gray-200 last:border-0">
                        <span className="font-mono text-blue-600">{record.type}</span>
                        <span className="mx-2">→</span>
                        <span className="font-mono">{record.value}</span>
                        {record.ttl && <span className="text-gray-500 ml-2">(TTL: {record.ttl})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

        case 'whois':
        case 'rdap':
          return (
            <div className="space-y-2 text-sm">
              {result.registrar && <p><span className="font-medium">Registrar:</span> {result.registrar}</p>}
              {result.registrationDate && <p><span className="font-medium">Registered:</span> {new Date(result.registrationDate).toLocaleDateString()}</p>}
              {result.expirationDate && <p><span className="font-medium">Expires:</span> {new Date(result.expirationDate).toLocaleDateString()}</p>}
              {result.nameServers && result.nameServers.length > 0 && (
                <div>
                  <span className="font-medium">Name Servers:</span>
                  <ul className="list-disc list-inside ml-2">
                    {result.nameServers.map((ns: string, idx: number) => (
                      <li key={idx} className="font-mono text-xs">{ns}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );

        case 'ssl_check':
          return (
            <div className="space-y-2 text-sm">
              {result.valid !== undefined && (
                <p>
                  <span className="font-medium">Valid:</span>{' '}
                  <span className={result.valid ? 'text-green-600' : 'text-red-600'}>
                    {result.valid ? 'Yes' : 'No'}
                  </span>
                </p>
              )}
              {result.issuer && <p><span className="font-medium">Issuer:</span> {result.issuer}</p>}
              {result.subject && <p><span className="font-medium">Subject:</span> {result.subject}</p>}
              {result.validFrom && <p><span className="font-medium">Valid From:</span> {new Date(result.validFrom).toLocaleDateString()}</p>}
              {result.validTo && <p><span className="font-medium">Valid To:</span> {new Date(result.validTo).toLocaleDateString()}</p>}
              {result.daysUntilExpiry !== undefined && (
                <p>
                  <span className="font-medium">Days Until Expiry:</span>{' '}
                  <span className={result.daysUntilExpiry <= 30 ? 'text-yellow-600' : 'text-green-600'}>
                    {result.daysUntilExpiry}
                  </span>
                </p>
              )}
            </div>
          );

        case 'port_scan':
          return (
            <div className="space-y-2 text-sm">
              {result.openPorts && Array.isArray(result.openPorts) && (
                <div>
                  <span className="font-medium">Open Ports ({result.openPorts.length}):</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.openPorts.map((port: any, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                        {typeof port === 'object' ? `${port.port} (${port.service})` : port}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result.scanDuration && <p><span className="font-medium">Scan Duration:</span> {result.scanDuration}ms</p>}
            </div>
          );

        case 'ip_lookup':
          return (
            <div className="space-y-2 text-sm">
              {result.ip && <p><span className="font-medium">IP:</span> {result.ip}</p>}
              {result.country && <p><span className="font-medium">Country:</span> {result.country}</p>}
              {result.city && <p><span className="font-medium">City:</span> {result.city}</p>}
              {result.region && <p><span className="font-medium">Region:</span> {result.region}</p>}
              {result.isp && <p><span className="font-medium">ISP:</span> {result.isp}</p>}
              {result.timezone && <p><span className="font-medium">Timezone:</span> {result.timezone}</p>}
              {result.organization && <p><span className="font-medium">Organization:</span> {result.organization}</p>}
            </div>
          );

        case 'ping':
        case 'http_check':
          return (
            <div className="space-y-2 text-sm">
              {result.alive !== undefined && (
                <p>
                  <span className="font-medium">Status:</span>{' '}
                  <span className={result.alive ? 'text-green-600' : 'text-red-600'}>
                    {result.alive ? 'Reachable' : 'Unreachable'}
                  </span>
                </p>
              )}
              {result.statusCode && <p><span className="font-medium">Status Code:</span> {result.statusCode}</p>}
              {result.responseTime !== undefined && (
                <p>
                  <span className="font-medium">Response Time:</span>{' '}
                  <span className={result.responseTime > 5000 ? 'text-yellow-600' : 'text-green-600'}>
                    {result.responseTime}ms
                  </span>
                </p>
              )}
            </div>
          );

        default:
          return (
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          );
      }
    } catch {
      return (
        <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-60">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
    }
  };

  // Render comparison view
  const renderComparison = (): React.ReactNode => {
    if (!selectedAnalysis || !comparisonAnalysis) return null;

    return (
      <div className="mt-4 border-t pt-4">
        <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Comparison with Previous Result
        </h4>
        <p className="text-xs text-gray-500 mb-3">
          Previous analysis from {formatDate(comparisonAnalysis.createdAt)}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded">
            <h5 className="text-sm font-medium text-blue-800 mb-2">Current</h5>
            {renderResultDetails(selectedAnalysis.result, selectedAnalysis.type)}
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Previous</h5>
            {renderResultDetails(comparisonAnalysis.result, comparisonAnalysis.type)}
          </div>
        </div>
      </div>
    );
  };

  // Calculate pagination info
  const totalPages = historyData ? Math.ceil(historyData.data.pagination.total / pagination.limit) : 0;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analysis History</h2>
          <p className="mt-1 text-sm text-gray-600">
            View and manage your past analysis results
            {isSomeSelected && (
              <span className="ml-2 text-blue-600">
                ({selectedIds.length} selected)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Export Button - Requirements 8.1, 8.4, 8.5 */}
          <ExportButton ids={selectedIds} />
          
          {/* Clear Selection Button */}
          {isSomeSelected && (
            <button
              onClick={() => setSelectedIds([])}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Clear Selection
            </button>
          )}
          
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-sm text-gray-600">Loading history...</p>
        </div>
      )}

      {/* Error state with Retry Button - Requirements 10.3 */}
      {error && (
        <ErrorAlert
          title="Failed to Load History"
          message="Unable to load analysis history. Please try again."
          onRetry={() => refetch()}
          isRetrying={isLoading}
        />
      )}

      {/* Empty state */}
      {!isLoading && !error && historyData?.data.history.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <span className="text-4xl mb-2 block">📜</span>
          <p className="text-gray-600">No analysis history yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Start by running an analysis from the dashboard
          </p>
        </div>
      )}

      {/* History table */}
      {!isLoading && !error && historyData && historyData.data.history.length > 0 && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                        title="Select all on this page"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyData.data.history.map((analysis) => (
                    <tr 
                      key={analysis.id} 
                      className={`hover:bg-gray-50 ${selectedIds.includes(analysis.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(analysis.id)}
                          onChange={() => handleSelectToggle(analysis.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(analysis.type)}`}>
                          {formatAnalysisType(analysis.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {analysis.domain || analysis.ip || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                          {analysis.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={formatDate(analysis.createdAt)}>
                        {formatRelativeTime(analysis.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleViewDetails(analysis)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDelete(analysis.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-lg">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, historyData.data.pagination.total)} of {historyData.data.pagination.total} results
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                disabled={pagination.offset === 0}
                className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                disabled={!historyData.data.pagination.hasMore}
                className="px-3 py-1 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Analysis Details
              </h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedAnalysis(null);
                  setComparisonAnalysis(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Analysis info */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Type</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(selectedAnalysis.type)}`}>
                    {formatAnalysisType(selectedAnalysis.type)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAnalysis.status)}`}>
                    {selectedAnalysis.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Target</p>
                  <p className="font-medium">{selectedAnalysis.domain || selectedAnalysis.ip || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Timestamp</p>
                  <p className="font-medium">{formatDate(selectedAnalysis.createdAt)}</p>
                </div>
              </div>

              {/* Error message if any */}
              {selectedAnalysis.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-800">
                    <span className="font-medium">Error:</span> {selectedAnalysis.error}
                  </p>
                </div>
              )}

              {/* Result details */}
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Result</h4>
                {renderResultDetails(selectedAnalysis.result, selectedAnalysis.type)}
              </div>

              {/* Comparison section */}
              {comparisonAnalysis && renderComparison()}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => handleDelete(selectedAnalysis.id)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800"
              >
                Delete
              </button>
              <div className="flex space-x-3">
                {/* Export single analysis */}
                <ExportButton ids={[selectedAnalysis.id]} />
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedAnalysis(null);
                    setComparisonAnalysis(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Delete
              </h3>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this analysis? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
