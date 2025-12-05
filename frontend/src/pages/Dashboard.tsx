import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../lib/axios';

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

const Dashboard: React.FC = () => {
  const features = [
    {
      title: 'DNS Checker',
      description: 'Lookup DNS records for a domain',
      path: '/dns',
      icon: '🌐',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      title: 'DNS Propagation',
      description: 'Check DNS propagation across global locations',
      path: '/dns-propagation',
      icon: '🌍',
      color: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
    },
    {
      title: 'WHOIS Lookup',
      description: 'Get domain registration information',
      path: '/whois',
      icon: '📋',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      title: 'Host Monitor',
      description: 'Check host availability and response times',
      path: '/host',
      icon: '🖥️',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      title: 'Port Scanner',
      description: 'Scan for open ports on a host',
      path: '/port-scan',
      icon: '🔍',
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    },
    {
      title: 'SSL Checker',
      description: 'Validate SSL certificates',
      path: '/ssl',
      icon: '🔒',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      title: 'IP Checker',
      description: 'Get IP address information and geolocation',
      path: '/ip',
      icon: '📍',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      title: 'Batch Analyzer',
      description: 'Analyze multiple domains at once',
      path: '/batch',
      icon: '📊',
      color: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
    },
    {
      title: 'History',
      description: 'View past analysis results',
      path: '/history',
      icon: '📜',
      color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
    },
  ];

  // Fetch recent analyses
  const { data: historyData, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: ['recentAnalyses'],
    queryFn: async () => {
      const response = await axiosClient.get('/history', {
        params: { limit: 5, offset: 0 },
      });
      return response.data;
    },
    staleTime: 30000, // 30 seconds
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    return status === 'success' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-2 text-sm text-gray-600">
          Select a tool to get started with network and domain analysis
        </p>
      </div>

      {/* Navigation Cards */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tools</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((feature) => (
            <Link
              key={feature.path}
              to={feature.path}
              className={`block p-6 border rounded-lg shadow-sm transition-all duration-200 ${feature.color}`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-3xl">{feature.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900">
                  {feature.title}
                </h3>
              </div>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Analyses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Analyses</h3>
          <Link
            to="/history"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all →
          </Link>
        </div>

        {isLoading && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-sm text-gray-600">Loading recent analyses...</p>
          </div>
        )}

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Unable to load recent analyses. Please try again later.
            </p>
          </div>
        )}

        {!isLoading && !error && historyData?.data.history.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <span className="text-4xl mb-2 block">📊</span>
            <p className="text-gray-600">No analyses yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Start by selecting a tool above
            </p>
          </div>
        )}

        {!isLoading && !error && historyData && historyData.data.history.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyData.data.history.map((analysis) => (
                    <tr key={analysis.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatAnalysisType(analysis.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {analysis.domain || analysis.ip || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            analysis.status
                          )}`}
                        >
                          {analysis.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(analysis.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/history`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
