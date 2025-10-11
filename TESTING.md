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

## Test Structure

### Unit Tests (`src/**/*.test.ts`)

Fast tests for business logic and services. These tests run in jsdom and mock
external dependencies.

**Current Coverage:**

- ✅ `elevation.ts` - 23 tests covering distance calculations, path subdivision,
  elevation stats, and API calls
- ✅ `gpxExport.ts` - 11 tests covering GPX generation, metadata, elevation
  data, and file downloads
- ✅ `graphBuilder.ts` - 11 tests covering graph construction, edge creation,
  and highway weights

**Example:**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateDistances } from './elevation'

describe('calculateDistances', () => {
  it('should calculate cumulative distances', () => {
    const coordinates = [
      [10.0, 50.0],
      [10.0, 51.0],
    ]
    const result = calculateDistances(coordinates)
    expect(result[0]).toBe(0)
    expect(result[1]).toBeGreaterThan(110000) // ~111km
  })
})
```

### Component Tests (`src/**/*.test.tsx`)

Tests for React components using @testing-library/react. These verify component
rendering and user interactions.

**Planned:**

- `Controls.tsx` - Button clicks, display updates
- `ElevationProfile.tsx` - Chart rendering, hover interactions
- `MapContainer.tsx` - Map initialization, waypoint management

### End-to-End Tests (`e2e/**/*.spec.ts`)

Playwright tests that run in a real browser and test complete user workflows.

**Current:**

- ✅ Basic UI tests - Map loading, controls, zoom, localStorage persistence

**Planned:**

- Route planning workflow (load data → place waypoints → export GPX)
- Waypoint interactions (drag, remove, insert)
- Error handling (zoom warnings, no path found, API failures)

## Test Configuration

### Vitest Configuration

Located in `vitest.config.ts`. Key settings:

- **Environment**: jsdom (for DOM testing)
- **Globals**: true (no need to import describe/it/expect)
- **Setup**: `src/test/setup.ts` (mocks Leaflet components)
- **Coverage**: v8 provider with HTML reports

### Playwright Configuration

Located in `playwright.config.ts`. Key settings:

- **Test Directory**: `e2e/`
- **Base URL**: http://localhost:5173 (auto-starts dev server)
- **Browsers**: Chromium (can add Firefox, WebKit)
- **Retries**: 2 in CI, 0 locally

### Test Setup

`src/test/setup.ts` includes:

- @testing-library/jest-dom matchers
- Leaflet mocks (to avoid map rendering issues in tests)
- react-leaflet component mocks

### Test Utilities

`src/test/utils.ts` provides helpers:

- `createMockOSMData()` - Generate mock OSM nodes and ways
- `createMockElevations()` - Generate elevation patterns (flat, uphill,
  downhill, mountain)
- `createMockCoordinates()` - Generate coordinate arrays for testing

## Writing Tests

### Unit Test Best Practices

**Do:**

- Test one behavior per test
- Use descriptive test names ("should calculate distance correctly")
- Mock external dependencies (fetch, APIs)
- Test edge cases (empty arrays, null values, errors)
- Keep tests fast (< 10ms each)

**Don't:**

- Test implementation details
- Make tests depend on each other
- Use real network calls
- Test external library code

**Example:**

```typescript
describe('subdividePathEqually', () => {
  it('should generate requested number of points', () => {
    const coordinates = [
      [10.0, 50.0],
      [10.1, 50.1],
    ]
    const result = subdividePathEqually(coordinates, 10)
    expect(result).toHaveLength(10)
  })

  it('should start and end at original coordinates', () => {
    const coordinates = [
      [10.0, 50.0],
      [10.1, 50.1],
      [10.2, 50.2],
    ]
    const result = subdividePathEqually(coordinates, 20)
    expect(result[0]).toEqual(coordinates[0])
    expect(result[result.length - 1]).toEqual(
      coordinates[coordinates.length - 1]
    )
  })
})
```

### Mocking in Tests

**Mock fetch:**

```typescript
import { vi, beforeEach } from 'vitest'

beforeEach(() => {
  global.fetch = vi.fn()
})

it('should fetch data', async () => {
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: 'test' }),
  } as Response)

  const result = await fetchData()
  expect(result).toEqual({ data: 'test' })
})
```

**Mock modules:**

```typescript
import { vi } from 'vitest'

vi.mock('./elevation', () => ({
  fetchElevations: vi.fn(),
}))

// In test:
vi.mocked(fetchElevations).mockResolvedValue([100, 200])
```

### Component Test Best Practices

**Do:**

- Render components with realistic props
- Test user interactions (clicks, typing, hover)
- Verify rendered output (text, attributes, styling)
- Use accessible queries (getByRole, getByLabelText)

**Don't:**

- Test component implementation (state, methods)
- Query by class names or test IDs unless necessary
- Test styling details (use visual regression for that)

**Example:**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('should call callback when button clicked', async () => {
  const mockCallback = vi.fn()
  render(<Controls onLoadData={mockCallback} />)

  const button = screen.getByRole('button', { name: /load data/i })
  await userEvent.click(button)

  expect(mockCallback).toHaveBeenCalledTimes(1)
})
```

### E2E Test Best Practices

**Do:**

- Test complete user workflows
- Use Playwright's auto-waiting features
- Take screenshots on failure
- Test real browser interactions (clicks, drags)

**Don't:**

- Test implementation details
- Make tests depend on each other
- Use fixed waits (use waitForSelector instead)
- Mock external APIs (test real integration)

**Example:**

```typescript
import { test, expect } from '@playwright/test'

test('should create route', async ({ page }) => {
  await page.goto('/')

  // Zoom in
  await page.locator('.leaflet-control-zoom-in').click()

  // Click map to place waypoint
  await page
    .locator('.leaflet-container')
    .click({ position: { x: 400, y: 300 } })

  // Verify waypoint appeared
  await expect(page.locator('.leaflet-marker-icon')).toBeVisible()
})
```

## Coverage Reports

After running `npm run test:coverage`, open `coverage/index.html` in a browser
to see:

- Line coverage per file
- Branch coverage
- Function coverage
- Uncovered lines highlighted

**Current Coverage:**

- **elevation.ts**: ~100% (all functions fully tested)
- **gpxExport.ts**: ~95% (main paths covered)
- **graphBuilder.ts**: ~100% (all scenarios covered)

## Debugging Tests

### Debug Unit Tests

```bash
# Run specific test file
npm test -- src/services/elevation.test.ts

# Run tests matching pattern
npm test -- --grep "should calculate"

# Run with detailed output
npm test -- --reporter=verbose
```

### Debug with VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--no-coverage"],
  "console": "integratedTerminal"
}
```

### Debug E2E Tests

```bash
# Run E2E tests with UI (see browser actions)
npm run test:e2e:ui

# Run in headed mode
npx playwright test --headed

# Debug specific test
npx playwright test --debug e2e/basic.spec.ts
```

## Continuous Integration

Tests automatically run on:

- Pre-commit (via Husky hook) - unit tests only
- Pull requests - all tests with coverage
- Main branch pushes - all tests with coverage reports

**GitHub Actions** (recommended workflow):

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

## Troubleshooting

### "Module not found" errors

- Ensure all dependencies installed: `npm install`
- Check import paths (use relative paths)
- Verify tsconfig.json includes test files

### "fetch is not defined"

- Mock fetch in test setup or individual tests
- Example in `src/test/setup.ts` or use `vi.stubGlobal('fetch', vi.fn())`

### Leaflet errors in tests

- Leaflet is mocked in `src/test/setup.ts`
- Don't test Leaflet internals, test component logic

### Playwright browser launch fails

- Install browsers: `npx playwright install`
- Check system dependencies: `npx playwright install-deps`
- Use `--headed` mode to see browser window

### Tests timeout

- Increase timeout: `test('...', { timeout: 10000 }, async () => {})`
- Check for unresolved promises
- Verify mocks are properly set up

## Next Steps

To complete the testing strategy:

1. **Add remaining unit tests:**
   - `router.ts` - Pathfinding logic (high priority)
   - `overpass.ts` - API integration
   - `useRouteStore.ts` - State management

2. **Add component tests:**
   - `Controls.tsx` - UI interactions
   - `ElevationProfile.tsx` - Chart rendering
   - `MapContainer.tsx` - Map integration

3. **Expand E2E tests:**
   - Complete route planning workflow
   - Waypoint drag & drop
   - Error scenarios
   - Data persistence across sessions

4. **Set up CI/CD:**
   - GitHub Actions workflow
   - Code coverage reporting
   - Automated PR checks

See [PLAN.md](./PLAN.md) for detailed testing strategy and implementation plan.
