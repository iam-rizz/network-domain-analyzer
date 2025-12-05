import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import HostMonitor from './HostMonitor';
import { AppProvider } from '../contexts/AppContext';
import axiosClient from '../lib/axios';

// Mock axios client
vi.mock('../lib/axios');

// Helper function to render component with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  );
};

describe('HostMonitor', () => {
  it('renders the component with both forms', () => {
    renderWithProviders(<HostMonitor />);

    // Check for main heading
    expect(screen.getByText('Host Monitor')).toBeInTheDocument();

    // Check for ping form
    expect(screen.getByText('Ping Test')).toBeInTheDocument();
    expect(screen.getByLabelText('Host or IP Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ping Host/i })).toBeInTheDocument();

    // Check for HTTP check form
    expect(screen.getByText('HTTP/HTTPS Check')).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check HTTP Endpoint/i })).toBeInTheDocument();
  });

  it('validates host input for ping test', async () => {
    renderWithProviders(<HostMonitor />);

    const hostInput = screen.getByLabelText('Host or IP Address');
    const pingButton = screen.getByRole('button', { name: /Ping Host/i });

    // Enter invalid host
    fireEvent.change(hostInput, { target: { value: 'invalid..host' } });
    fireEvent.click(pingButton);
    await waitFor(() => {
      expect(screen.getByText(/Invalid host format/i)).toBeInTheDocument();
    });

    // Clear and verify button is disabled when empty
    fireEvent.change(hostInput, { target: { value: '' } });
    expect(pingButton).not.toBeDisabled();
  });

  it('validates URL input for HTTP check', async () => {
    renderWithProviders(<HostMonitor />);

    const urlInput = screen.getByLabelText('URL');
    const httpButton = screen.getByRole('button', { name: /Check HTTP Endpoint/i });

    // Enter URL without protocol
    fireEvent.change(urlInput, { target: { value: 'example.com' } });
    fireEvent.click(httpButton);
    await waitFor(() => {
      expect(screen.getByText(/URL must start with http/i)).toBeInTheDocument();
    });

    // Clear and verify button is not disabled when empty
    fireEvent.change(urlInput, { target: { value: '' } });
    expect(httpButton).not.toBeDisabled();
  });

  it('displays ping results from multiple locations', async () => {
    const mockPingResponse = {
      success: true,
      data: [
        { alive: true, responseTime: 50, location: 'Primary' },
        { alive: true, responseTime: 75, location: 'Secondary' },
        { alive: false, responseTime: 5000, location: 'Tertiary' },
      ],
    };

    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: mockPingResponse });

    renderWithProviders(<HostMonitor />);

    const hostInput = screen.getByLabelText('Host or IP Address');
    const pingButton = screen.getByRole('button', { name: /Ping Host/i });

    // Enter valid host and submit
    fireEvent.change(hostInput, { target: { value: 'example.com' } });
    fireEvent.click(pingButton);

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText('Ping Results from 3 Probe Locations')).toBeInTheDocument();
    });

    // Check that all locations are displayed
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Secondary')).toBeInTheDocument();
    expect(screen.getByText('Tertiary')).toBeInTheDocument();

    // Check status badges
    expect(screen.getAllByText('Alive')).toHaveLength(2);
    expect(screen.getByText('Unreachable')).toBeInTheDocument();

    // Check response times
    expect(screen.getByText('50ms')).toBeInTheDocument();
    expect(screen.getByText('75ms')).toBeInTheDocument();
  });

  it('displays slow response indicator for ping results', async () => {
    const mockPingResponse = {
      success: true,
      data: [
        { alive: true, responseTime: 6000, location: 'Primary' },
      ],
    };

    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: mockPingResponse });

    renderWithProviders(<HostMonitor />);

    const hostInput = screen.getByLabelText('Host or IP Address');
    const pingButton = screen.getByRole('button', { name: /Ping Host/i });

    fireEvent.change(hostInput, { target: { value: 'example.com' } });
    fireEvent.click(pingButton);

    await waitFor(() => {
      expect(screen.getByText('Slow Response')).toBeInTheDocument();
    });
  });

  it('displays HTTP check results with status code', async () => {
    const mockHttpResponse = {
      success: true,
      data: {
        statusCode: 200,
        responseTime: 150,
        headers: {
          'content-type': 'text/html',
          'server': 'nginx',
        },
      },
    };

    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: mockHttpResponse });

    renderWithProviders(<HostMonitor />);

    const urlInput = screen.getByLabelText('URL');
    const httpButton = screen.getByRole('button', { name: /Check HTTP Endpoint/i });

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.click(httpButton);

    await waitFor(() => {
      expect(screen.getByText('HTTP Check Results')).toBeInTheDocument();
    });

    // Check status code
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();

    // Check response time
    expect(screen.getByText('150ms')).toBeInTheDocument();

    // Check headers
    expect(screen.getByText('content-type:')).toBeInTheDocument();
    expect(screen.getByText('text/html')).toBeInTheDocument();
  });

  it('displays slow response indicator for HTTP check', async () => {
    const mockHttpResponse = {
      success: true,
      data: {
        statusCode: 200,
        responseTime: 7000,
        headers: {},
      },
    };

    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: mockHttpResponse });

    renderWithProviders(<HostMonitor />);

    const urlInput = screen.getByLabelText('URL');
    const httpButton = screen.getByRole('button', { name: /Check HTTP Endpoint/i });

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.click(httpButton);

    await waitFor(() => {
      expect(screen.getAllByText('Slow Response')).toHaveLength(1);
    });
  });

  it('handles ping error gracefully', async () => {
    const mockError = new Error('Host unreachable');
    vi.mocked(axiosClient.post).mockRejectedValueOnce(mockError);

    renderWithProviders(<HostMonitor />);

    const hostInput = screen.getByLabelText('Host or IP Address');
    const pingButton = screen.getByRole('button', { name: /Ping Host/i });

    fireEvent.change(hostInput, { target: { value: 'example.com' } });
    fireEvent.click(pingButton);

    await waitFor(() => {
      expect(screen.getByText('Ping Test Failed')).toBeInTheDocument();
    });
  });

  it('handles HTTP check error gracefully', async () => {
    const mockError = new Error('Connection timeout');
    vi.mocked(axiosClient.post).mockRejectedValueOnce(mockError);

    renderWithProviders(<HostMonitor />);

    const urlInput = screen.getByLabelText('URL');
    const httpButton = screen.getByRole('button', { name: /Check HTTP Endpoint/i });

    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.click(httpButton);

    await waitFor(() => {
      expect(screen.getByText('HTTP Check Failed')).toBeInTheDocument();
    });
  });
});
