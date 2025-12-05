#!/bin/bash

echo "=========================================="
echo "Network & Domain Analyzer - Setup Verification"
echo "=========================================="
echo ""

# Check Node.js version
echo "✓ Checking Node.js version..."
node --version
echo ""

# Check npm version
echo "✓ Checking npm version..."
npm --version
echo ""

# Check if dependencies are installed
echo "✓ Checking dependencies..."
if [ -d "node_modules" ]; then
  echo "  Root dependencies: ✓"
else
  echo "  Root dependencies: ✗ (run 'npm install')"
fi

if [ -d "backend/node_modules" ]; then
  echo "  Backend dependencies: ✓"
else
  echo "  Backend dependencies: ✗ (run 'npm install --workspace=backend')"
fi

if [ -d "frontend/node_modules" ]; then
  echo "  Frontend dependencies: ✓"
else
  echo "  Frontend dependencies: ✗ (run 'npm install --workspace=frontend')"
fi
echo ""

# Check TypeScript compilation
echo "✓ Checking TypeScript compilation..."
echo "  Backend:"
npm run build --workspace=backend > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "    Build: ✓"
else
  echo "    Build: ✗"
fi

echo "  Frontend:"
npm run build --workspace=frontend > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "    Build: ✓"
else
  echo "    Build: ✗"
fi
echo ""

# Run tests
echo "✓ Running tests..."
echo "  Backend tests:"
npm run test --workspace=backend > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "    Tests: ✓"
else
  echo "    Tests: ✗"
fi

echo "  Frontend tests:"
npm run test --workspace=frontend > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "    Tests: ✓"
else
  echo "    Tests: ✗"
fi
echo ""

echo "=========================================="
echo "Setup verification complete!"
echo "=========================================="
echo ""
echo "To start development:"
echo "  npm run dev          # Start both backend and frontend"
echo "  npm run dev:backend  # Start backend only"
echo "  npm run dev:frontend # Start frontend only"
echo ""
