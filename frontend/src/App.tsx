import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './contexts/AppContext';
import NotificationContainer from './components/NotificationContainer';
import RateLimitIndicator from './components/RateLimitIndicator';

// Pages
import Dashboard from './pages/Dashboard';
import DNSChecker from './pages/DNSChecker';
import DNSPropagation from './pages/DNSPropagation';
import WHOISLookup from './pages/WHOISLookup';
import HostMonitor from './pages/HostMonitor';
import PortScanner from './pages/PortScanner';
import SSLChecker from './pages/SSLChecker';
import IPChecker from './pages/IPChecker';
import BatchAnalyzer from './pages/BatchAnalyzer';
import History from './pages/History';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Layout component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, rateLimit } = useApp();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Network & Domain Analyzer
              </h1>
            </Link>
            <div className="flex items-center space-x-4">
              {rateLimit && <RateLimitIndicator />}
              {isAuthenticated && (
                <span className="text-sm text-green-600 flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Authenticated
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumb navigation */}
      {location.pathname !== '/' && (
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto py-2 px-4 sm:px-6 lg:px-8">
            <Link
              to="/"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </nav>
      )}

      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">{children}</div>
        </div>
      </main>

      <NotificationContainer />
    </div>
  );
};

// Main App component
function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dns" element={<DNSChecker />} />
              <Route path="/dns-propagation" element={<DNSPropagation />} />
              <Route path="/whois" element={<WHOISLookup />} />
              <Route path="/host" element={<HostMonitor />} />
              <Route path="/port-scan" element={<PortScanner />} />
              <Route path="/ssl" element={<SSLChecker />} />
              <Route path="/ip" element={<IPChecker />} />
              <Route path="/batch" element={<BatchAnalyzer />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </Layout>
        </Router>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
