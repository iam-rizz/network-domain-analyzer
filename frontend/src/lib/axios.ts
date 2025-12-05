import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Create axios instance with base configuration
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add API key if available
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get API key from environment variable first, then localStorage as fallback
    const apiKey = import.meta.env.VITE_API_KEY || localStorage.getItem('api_key');
    
    if (apiKey && config.headers) {
      config.headers['X-API-Key'] = apiKey;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
axiosClient.interceptors.response.use(
  (response) => {
    // Extract rate limit headers if present
    const rateLimitLimit = response.headers['x-ratelimit-limit'];
    const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
    const rateLimitReset = response.headers['x-ratelimit-reset'];
    
    if (rateLimitLimit && rateLimitRemaining) {
      // Store rate limit info in sessionStorage for UI display
      sessionStorage.setItem('rateLimit', JSON.stringify({
        limit: parseInt(rateLimitLimit),
        remaining: parseInt(rateLimitRemaining),
        reset: rateLimitReset ? parseInt(rateLimitReset) : null,
      }));
    }
    
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;
      
      // Handle rate limit errors (429)
      if (status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
        
        const errorMessage = resetDate
          ? `Rate limit exceeded. Please try again after ${resetDate.toLocaleTimeString()}`
          : 'Rate limit exceeded. Please try again later.';
        
        // Dispatch custom event for rate limit error
        window.dispatchEvent(new CustomEvent('rateLimitError', {
          detail: {
            message: errorMessage,
            resetTime: resetDate,
          }
        }));
        
        return Promise.reject({
          code: 'RATE_LIMIT_EXCEEDED',
          message: errorMessage,
          resetTime: resetDate,
        });
      }
      
      // Handle authentication errors (401)
      if (status === 401) {
        const errorMessage = 'Authentication failed. Please check your API key.';
        
        // Dispatch custom event for auth error
        window.dispatchEvent(new CustomEvent('authError', {
          detail: {
            message: errorMessage,
          }
        }));
        
        // Clear invalid API key
        localStorage.removeItem('api_key');
        
        return Promise.reject({
          code: 'AUTHENTICATION_FAILED',
          message: errorMessage,
        });
      }
      
      // Handle other HTTP errors
      const errorData = data as any;
      return Promise.reject({
        code: errorData?.error?.code || 'API_ERROR',
        message: errorData?.error?.message || 'An error occurred',
        status,
      });
    }
    
    // Handle network errors
    if (error.request) {
      return Promise.reject({
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
      });
    }
    
    // Handle other errors
    return Promise.reject({
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
    });
  }
);

export default axiosClient;
