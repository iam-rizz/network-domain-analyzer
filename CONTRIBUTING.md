# Contributing to Network & Domain Analyzer

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Getting Started

1. Fork the repository at https://github.com/iam-rizz/network-domain-analyzer
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/network-domain-analyzer.git
   cd network-domain-analyzer
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

1. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

2. Start development servers:
   ```bash
   npm run dev
   ```

## Code Style

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Testing

- Write tests for new features
- Ensure all existing tests pass before submitting PR
- Run tests with:
  ```bash
  npm test
  ```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md with your changes
5. Create a Pull Request with a clear description

## Commit Messages

Use clear and descriptive commit messages:
- `feat: add new DNS lookup feature`
- `fix: resolve port scanning timeout issue`
- `docs: update API documentation`
- `test: add unit tests for WHOIS service`
- `refactor: improve error handling in routes`

## Reporting Issues

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)

## Questions?

Feel free to open an issue for any questions or discussions.
