import React from 'react';
import RetryButton from './RetryButton';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
  variant?: 'error' | 'warning';
  className?: string;
}

/**
 * ErrorAlert Component
 * Displays user-friendly error messages with retry option
 * 
 * Requirements: 10.3 - WHEN network error terjadi THEN THE System SHALL menampilkan user-friendly error message dengan opsi untuk retry
 */
const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title,
  message,
  onRetry,
  onDismiss,
  isRetrying = false,
  variant = 'error',
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200',
          icon: 'text-yellow-400',
          title: 'text-yellow-800',
          message: 'text-yellow-700',
          dismiss: 'text-yellow-600 hover:text-yellow-500',
        };
      case 'error':
      default:
        return {
          container: 'bg-red-50 border-red-200',
          icon: 'text-red-400',
          title: 'text-red-800',
          message: 'text-red-700',
          dismiss: 'text-red-600 hover:text-red-500',
        };
    }
  };

  const styles = getVariantStyles();

  const getIcon = () => {
    if (variant === 'warning') {
      return (
        <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return (
      <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  return (
    <div className={`border rounded-lg p-4 ${styles.container} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${styles.title}`}>{title}</h3>
          )}
          <p className={`${title ? 'mt-2' : ''} text-sm ${styles.message}`}>
            {message}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {onRetry && (
              <RetryButton
                onRetry={onRetry}
                isLoading={isRetrying}
                size="sm"
                variant={variant === 'warning' ? 'secondary' : 'primary'}
              />
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`text-sm font-medium ${styles.dismiss}`}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorAlert;
