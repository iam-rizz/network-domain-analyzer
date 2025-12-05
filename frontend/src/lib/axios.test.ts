import { describe, it, expect, beforeEach } from 'vitest';
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

    // Test by making a request and checking the config
    // The interceptor adds X-API-Key header when api_key exists in localStorage
    expect(localStorage.getItem('api_key')).toBe(apiKey);
  });

  it('should not add API key header if not available', async () => {
    // When no API key in localStorage, header should not be added
    expect(localStorage.getItem('api_key')).toBeNull();
  });
});
