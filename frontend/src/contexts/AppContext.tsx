import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Rate limit information
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number | null;
}

// Global notification
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// App state interface
interface AppState {
  apiKey: string | null;
  rateLimit: RateLimitInfo | null;
  notifications: Notification[];
  isAuthenticated: boolean;
}

// App context interface
interface AppContextType extends AppState {
  setApiKey: (key: string | null) => void;
  updateRateLimit: (info: RateLimitInfo) => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider props
interface AppProviderProps {
  children: ReactNode;
}

// Provider component
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Initialize API key from environment variable or localStorage
  useEffect(() => {
    // Check environment variable first, then localStorage
    const envKey = import.meta.env.VITE_API_KEY;
    const storedKey = localStorage.getItem('api_key');
    
    if (envKey) {
      setApiKeyState(envKey);
    } else if (storedKey) {
      setApiKeyState(storedKey);
    }
  }, []);

  // Listen for rate limit updates from sessionStorage
  useEffect(() => {
    const checkRateLimit = () => {
      const rateLimitData = sessionStorage.getItem('rateLimit');
      if (rateLimitData) {
        try {
          const parsed = JSON.parse(rateLimitData);
          setRateLimit(parsed);
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    // Check initially
    checkRateLimit();

    // Check periodically
    const interval = setInterval(checkRateLimit, 1000);

    return () => clearInterval(interval);
  }, []);

  // Listen for rate limit errors
  useEffect(() => {
    const handleRateLimitError = (event: Event) => {
      const customEvent = event as CustomEvent;
      addNotification({
        type: 'error',
        message: customEvent.detail.message,
        duration: 5000,
      });
    };

    window.addEventListener('rateLimitError', handleRateLimitError);

    return () => {
      window.removeEventListener('rateLimitError', handleRateLimitError);
    };
  }, []);

  // Listen for auth errors
  useEffect(() => {
    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent;
      addNotification({
        type: 'error',
        message: customEvent.detail.message,
        duration: 5000,
      });
    };

    window.addEventListener('authError', handleAuthError);

    return () => {
      window.removeEventListener('authError', handleAuthError);
    };
  }, []);

  // Set API key
  const setApiKey = (key: string | null) => {
    if (key) {
      localStorage.setItem('api_key', key);
    } else {
      localStorage.removeItem('api_key');
    }
    setApiKeyState(key);
  };

  // Update rate limit info
  const updateRateLimit = (info: RateLimitInfo) => {
    setRateLimit(info);
  };

  // Add notification
  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification: Notification = {
      ...notification,
      id,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove notification after duration
    if (notification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }
  };

  // Remove notification
  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  const value: AppContextType = {
    apiKey,
    rateLimit,
    notifications,
    isAuthenticated: !!apiKey,
    setApiKey,
    updateRateLimit,
    addNotification,
    removeNotification,
    clearNotifications,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Custom hook to use app context
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
