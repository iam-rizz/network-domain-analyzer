import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../contexts/AppContext';
import DNSChecker from './DNSChecker';

// Create a test wrapper with all required providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  );
};

describe('DNSChecker Component', () => {
  it('renders the DNS Checker page', () => {
    render(<DNSChecker />, { wrapper: createWrapper() });
    
    // Check if the main heading is present
    expect(screen.getByText('DNS Checker')).toBeDefined();
    // The description contains a TechnicalTerm component, so we check for partial text
    expect(screen.getByText(/DNS records/)).toBeDefined();
  });

  it('renders the domain input field', () => {
    render(<DNSChecker />, { wrapper: createWrapper() });
    
    // Check if the domain input is present
    const domainInput = screen.getByPlaceholderText('example.com');
    expect(domainInput).toBeDefined();
  });

  it('renders all DNS record type buttons', () => {
    render(<DNSChecker />, { wrapper: createWrapper() });
    
    // Check if all record type buttons are present
    const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
    recordTypes.forEach(type => {
      expect(screen.getByText(type)).toBeDefined();
    });
  });

  it('renders the submit button', () => {
    render(<DNSChecker />, { wrapper: createWrapper() });
    
    // Check if the submit button is present
    expect(screen.getByText('Lookup DNS Records')).toBeDefined();
  });
});
