import React from 'react';
import { useApp } from '../contexts/AppContext';

const RateLimitIndicator: React.FC = () => {
  const { rateLimit } = useApp();

  if (!rateLimit) {
    return null;
  }

  const percentage = (rateLimit.remaining / rateLimit.limit) * 100;
  const isLow = percentage < 20;
  const isWarning = percentage < 50 && percentage >= 20;

  const getColorClass = () => {
    if (isLow) return 'text-red-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getResetTime = () => {
    if (!rateLimit.reset) return null;
    const resetDate = new Date(rateLimit.reset * 1000);
    return resetDate.toLocaleTimeString();
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <span className="text-gray-600">API Requests:</span>
      <span className={`font-medium ${getColorClass()}`}>
        {rateLimit.remaining} / {rateLimit.limit}
      </span>
      {isLow && rateLimit.reset && (
        <span className="text-xs text-gray-500">
          (Resets at {getResetTime()})
        </span>
      )}
    </div>
  );
};

export default RateLimitIndicator;
