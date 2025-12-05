import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByText('Network & Domain Analyzer')).toBeInTheDocument();
  });

  it('renders the dashboard by default', () => {
    render(<App />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders navigation cards for all features', () => {
    render(<App />);
    expect(screen.getByText('DNS Checker')).toBeInTheDocument();
    expect(screen.getByText('WHOIS Lookup')).toBeInTheDocument();
    expect(screen.getByText('Host Monitor')).toBeInTheDocument();
    expect(screen.getByText('Port Scanner')).toBeInTheDocument();
    expect(screen.getByText('SSL Checker')).toBeInTheDocument();
    expect(screen.getByText('IP Checker')).toBeInTheDocument();
    expect(screen.getByText('Batch Analyzer')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});
