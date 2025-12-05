import React from 'react';

interface RetryButtonProps {
  onRetry: () => void;
  isLoading?: boolean;
  text?: string;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * RetryButton Component
 * Provides retry functionality for failed operations
 * 
 * Requirements: 10.3 - WHEN network error terjadi THEN THE System SHALL menampilkan user-friendly error message dengan opsi untuk retry
 */
const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  isLoading = false,
  text = 'Retry',
  loadingText = 'Retrying...',
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 border-red-600';
      case 'primary':
      default:
        return 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2.5 py-1.5 text-xs';
      case 'lg':
        return 'px-4 py-2.5 text-base';
      case 'md':
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3';
      case 'lg':
        return 'h-5 w-5';
      case 'md':
      default:
        return 'h-4 w-4';
    }
  };

  return (
    <button
      onClick={onRetry}
      disabled={isLoading}
      className={`inline-flex items-center justify-center font-medium rounded-md border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${getVariantClasses()} ${getSizeClasses()} ${className}`}
    >
      {isLoading ? (
        <>
          <svg
            className={`animate-spin -ml-0.5 mr-2 ${getIconSize()}`}
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
          {loadingText}
        </>
      ) : (
        <>
          <svg
            className={`-ml-0.5 mr-2 ${getIconSize()}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {text}
        </>
      )}
    </button>
  );
};

export default RetryButton;
