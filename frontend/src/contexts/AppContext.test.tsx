import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';
import React from 'react';

describe('AppContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should provide initial state', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    expect(result.current.apiKey).toBeNull();
    expect(result.current.rateLimit).toBeNull();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should set and retrieve API key', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.setApiKey('test-key');
    });

    expect(result.current.apiKey).toBe('test-key');
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('api_key')).toBe('test-key');
  });

  it('should clear API key', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.setApiKey('test-key');
    });

    act(() => {
      result.current.setApiKey(null);
    });

    expect(result.current.apiKey).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('api_key')).toBeNull();
  });

  it('should add notifications', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.addNotification({
        type: 'success',
        message: 'Test notification',
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('Test notification');
    expect(result.current.notifications[0].type).toBe('success');
  });

  it('should remove notifications', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.addNotification({
        type: 'info',
        message: 'Test notification',
      });
    });

    const notificationId = result.current.notifications[0].id;

    act(() => {
      result.current.removeNotification(notificationId);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should clear all notifications', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.addNotification({
        type: 'info',
        message: 'Test 1',
      });
      result.current.addNotification({
        type: 'error',
        message: 'Test 2',
      });
    });

    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clearNotifications();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should update rate limit info', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    const rateLimitInfo = {
      limit: 100,
      remaining: 95,
      reset: 1234567890,
    };

    act(() => {
      result.current.updateRateLimit(rateLimitInfo);
    });

    expect(result.current.rateLimit).toEqual(rateLimitInfo);
  });
});
