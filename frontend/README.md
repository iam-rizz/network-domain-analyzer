# Network & Domain Analyzer - Frontend

React-based frontend application for the Network & Domain Analysis Tool.

## Features Implemented

### Task 20: Frontend Setup ✅

- **React with TypeScript**: Modern React 18 application with full TypeScript support
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React Router**: Client-side routing with navigation between tools
- **React Query**: Data fetching and caching with @tanstack/react-query
- **Axios Client**: Configured HTTP client with interceptors
- **Global State Management**: Context API for app-wide state
- **Error Handling**: 
  - Rate limit errors (429) with user-friendly messages
  - Authentication errors (401) with automatic API key cleanup
  - Network error handling
- **Rate Limit Indicator**: Visual display of remaining API requests
- **Notification System**: Toast-style notifications for user feedback
- **API Key Management**: Automatic header injection for authenticated requests

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── NotificationContainer.tsx
│   │   └── RateLimitIndicator.tsx
│   ├── contexts/            # React Context providers
│   │   └── AppContext.tsx   # Global app state
│   ├── lib/                 # Utilities and configurations
│   │   └── axios.ts         # Axios client with interceptors
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx
│   │   ├── DNSChecker.tsx
│   │   ├── WHOISLookup.tsx
│   │   ├── HostMonitor.tsx
│   │   ├── PortScanner.tsx
│   │   ├── SSLChecker.tsx
│   │   ├── IPChecker.tsx
│   │   ├── BatchAnalyzer.tsx
│   │   └── History.tsx
│   ├── App.tsx              # Main app component with routing
│   ├── main.tsx             # Application entry point
│   └── vite-env.d.ts        # TypeScript environment definitions
├── .env.example             # Environment variables template
└── package.json
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
VITE_API_BASE_URL=http://localhost:5000/api
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Building

Build for production:
```bash
npm run build
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Key Features

### Axios Client Configuration

The Axios client (`src/lib/axios.ts`) includes:
- Base URL configuration from environment variables
- 30-second timeout for all requests
- Automatic API key injection from localStorage
- Response interceptor for rate limit tracking
- Error handling for 429 (rate limit) and 401 (auth) errors
- Custom event dispatching for error notifications

### Global State Management

The AppContext (`src/contexts/AppContext.tsx`) provides:
- API key storage and management
- Rate limit information tracking
- Notification system
- Authentication status
- Custom hooks for easy access (`useApp()`)

### Error Handling

The application handles:
- **Rate Limit Errors (429)**: Displays user-friendly message with reset time
- **Authentication Errors (401)**: Clears invalid API key and notifies user
- **Network Errors**: Shows connection error messages
- **API Errors**: Displays error messages from backend

### Notification System

Toast-style notifications with:
- Multiple types: success, error, warning, info
- Auto-dismiss with configurable duration
- Manual dismiss option
- Color-coded styling

### Rate Limit Indicator

Visual indicator showing:
- Current remaining requests
- Total request limit
- Color-coded status (green/yellow/red)
- Reset time when limit is low

## Next Steps

The following tasks will implement the actual functionality for each tool:
- Task 21: Dashboard Component
- Task 22: DNS Checker Component
- Task 23: DNS Propagation Component
- Task 24: Host Monitor Component
- Task 25: Port Scanner Component
- Task 26: SSL Checker Component
- Task 27: RDAP/WHOIS Lookup Component
- Task 28: IP Checker Component
- Task 29: Batch Analyzer Component
- Task 30: History Component
- Task 31: Export functionality
- Task 32: UI/UX enhancements

## Requirements Validated

This implementation satisfies:
- **Requirement 11.1**: Dashboard with clear navigation to all features
- **Requirement 14.2**: Rate limit error handling with user feedback
- **Requirement 14.6**: API key authentication support
