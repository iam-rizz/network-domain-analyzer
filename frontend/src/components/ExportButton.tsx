import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../lib/axios';
import { useApp } from '../contexts/AppContext';

// Export format type
type ExportFormat = 'json' | 'csv';

// Props interface
interface ExportButtonProps {
  ids: string[];
  disabled?: boolean;
  className?: string;
}

/**
 * ExportButton Component
 * Provides export functionality with format selector (JSON/CSV)
 * Triggers browser download with descriptive filename
 * Shows error for empty data
 * 
 * Requirements: 8.1, 8.4, 8.5
 */
const ExportButton: React.FC<ExportButtonProps> = ({ ids, disabled = false, className = '' }) => {
  const [showFormatSelector, setShowFormatSelector] = useState(false);
  const { addNotification, isAuthenticated } = useApp();

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async ({ ids, format }: { ids: string[]; format: ExportFormat }) => {
      const response = await axiosClient.post(
        '/history/export',
        { ids, format },
        { responseType: 'blob' }
      );
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = `analysis-export.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      return { blob: response.data, filename, format };
    },
    onSuccess: ({ blob, filename }) => {
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      addNotification({
        type: 'success',
        message: `Export completed: ${filename}`,
        duration: 3000,
      });
      
      setShowFormatSelector(false);
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to export data';
      addNotification({
        type: 'error',
        message: errorMessage,
        duration: 5000,
      });
      setShowFormatSelector(false);
    },
  });

  // Handle export button click
  const handleExportClick = () => {
    // Show error for empty data (Requirement 8.5)
    if (!ids || ids.length === 0) {
      addNotification({
        type: 'error',
        message: 'No data available for export. Please select items to export.',
        duration: 5000,
      });
      return;
    }
    
    // Check authentication for export endpoint
    if (!isAuthenticated) {
      addNotification({
        type: 'warning',
        message: 'API key required for export. Please set your API key in settings.',
        duration: 5000,
      });
      return;
    }
    
    setShowFormatSelector(true);
  };

  // Handle format selection
  const handleFormatSelect = (format: ExportFormat) => {
    exportMutation.mutate({ ids, format });
  };

  // Close format selector
  const handleClose = () => {
    setShowFormatSelector(false);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Export Button */}
      <button
        onClick={handleExportClick}
        disabled={disabled || exportMutation.isPending}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export analysis results"
      >
        {exportMutation.isPending ? (
          <>
            <svg
              className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-gray-500"
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Exporting...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </>
        )}
      </button>

      {/* Format Selector Dropdown */}
      {showFormatSelector && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={handleClose}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1" role="menu">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                Select Format
              </div>
              
              {/* JSON Option (Requirement 8.1) */}
              <button
                onClick={() => handleFormatSelect('json')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                role="menuitem"
              >
                <svg
                  className="w-4 h-4 mr-3 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <div>
                  <div className="font-medium">JSON</div>
                  <div className="text-xs text-gray-500">Structured data format</div>
                </div>
              </button>
              
              {/* CSV Option (Requirement 8.1) */}
              <button
                onClick={() => handleFormatSelect('csv')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                role="menuitem"
              >
                <svg
                  className="w-4 h-4 mr-3 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <div className="font-medium">CSV</div>
                  <div className="text-xs text-gray-500">Spreadsheet compatible</div>
                </div>
              </button>
              
              {/* Cancel */}
              <div className="border-t border-gray-100">
                <button
                  onClick={handleClose}
                  className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportButton;
