import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../contexts/AppContext';
import DNSPropagation from './DNSPropagation';

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

describe('DNSPropagation Component', () => {
  it('renders the DNS Propagation Check page', () => {
    render(<DNSPropagation />, { wrapper: createWrapper() });
    
    // Check if the main heading is present
    expect(screen.getByText('DNS Propagation Check')).toBeDefined();
    // The description contains a TechnicalTerm component, so we check for partial text
    expect(screen.getByText(/DNS propagation/)).toBeDefined();
  });

  it('renders the domain input field', () => {
    render(<DNSPropagation />, { wrapper: createWrapper() });
    
    // Check if the domain input is present
    const domainInput = screen.getByPlaceholderText('example.com');
    expect(domainInput).toBeDefined();
  });

  it('renders the record type selector', () => {
    render(<DNSPropagation />, { wrapper: createWrapper() });
    
    // Check if the record type selector is present
    expect(screen.getByText('Record Type')).toBeDefined();
    
    // Check if the select element exists
    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeDefined();
  });

  it('renders the submit button', () => {
    render(<DNSPropagation />, { wrapper: createWrapper() });
    
    // Check if the submit button is present
    expect(screen.getByText('Check Propagation')).toBeDefined();
  });

  it('has A record type selected by default', () => {
    render(<DNSPropagation />, { wrapper: createWrapper() });
    
    // Check if A is the default selected value
    const selectElement = screen.getByRole('combobox') as HTMLSelectElement;
    expect(selectElement.value).toBe('A');
  });
});
