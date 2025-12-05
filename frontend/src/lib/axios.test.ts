import { describe, it, expect, beforeEach, vi } from 'vitest';
import axiosClient from './axios';

describe('Axios Client', () => {
  beforeEach(() => {
    // Clear localStorage and sessionStorage before each test
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be configured with correct base URL', () => {
    expect(axiosClient.defaults.baseURL).toBe('/api');
  });

  it('should have correct timeout', () => {
    expect(axiosClient.defaults.timeout).toBe(30000);
  });

  it('should have correct default headers', () => {
    expect(axiosClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('should add API key to request headers if available', async () => {
    const apiKey = 'test-api-key';
    localStorage.setItem('api_key', apiKey);

    // Mock the request interceptor
    const config = {
      headers: {} as any,
    };

    const interceptor = axiosClient.interceptors.request.handlers[0];
    if (interceptor && 'fulfilled' in interceptor) {
      const result = await (interceptor.fulfilled as any)(config);
      expect(result.headers['X-API-Key']).toBe(apiKey);
    }
  });

  it('should not add API key header if not available', async () => {
    const config = {
      headers: {} as any,
    };

    const interceptor = axiosClient.interceptors.request.handlers[0];
    if (interceptor && 'fulfilled' in interceptor) {
      const result = await (interceptor.fulfilled as any)(config);
      expect(result.headers['X-API-Key']).toBeUndefined();
    }
  });
});
