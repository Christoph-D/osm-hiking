# Testing Guide

This project uses a comprehensive testing strategy with unit tests, component
tests, and end-to-end tests.

## Quick Start

```bash
# Run all unit tests
npm test

# Run tests in watch mode (for development)
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run E2E tests (requires proper browser environment)
npm run test:e2e
```

## Test Locations

- **Unit tests**: `src/services/*.test.ts`
- **Component tests**: `src/components/*.test.tsx`
- **E2E tests**: `e2e/*.spec.ts`
