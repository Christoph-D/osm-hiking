# E2E Test Fixtures

This directory contains cached map data and mock interceptors for external APIs
used in e2e testing.

## Files

- **overpass-response.json**: Cached Overpass API response containing map data
  for the default test region
- **overpass-metadata.json**: Metadata about the cached data including the
  bounding box, capture timestamp, and element count
- **overpass-mock.ts**: Playwright route interceptor that mocks Overpass API
  calls with the cached data
- **elevation-mock.ts**: Playwright route interceptor that mocks Open-Elevation
  API calls with dynamically generated elevation data using simplex noise
- **tile-mock.ts**: Playwright route interceptor that mocks OpenStreetMap tile
  requests with a 1x1 green PNG image

## Updating the Overpass API Mock Data

If you need to update the mock data (e.g., after changing the test region or
zoom level):

1. Edit `e2e/capture-overpass.spec.ts` and change `test.skip` to `test.only`
2. Run the capture test:

   ```bash
   npx playwright test e2e/capture-overpass.spec.ts --timeout=180000
   ```

3. Change `test.only` back to `test.skip`
4. Verify all tests still pass:

   ```bash
   npx playwright test e2e/
   ```

## How the Bounding Box is Determined

The bounding box is automatically determined by the map view in the tests:

1. Tests start at the default center position: `[50.0, 10.0]` (latitude,
   longitude)
2. Tests zoom in 10 times using the zoom button
3. When "Load Hiking Paths" is clicked, the app fetches data for the current map
   viewport
4. The capture test intercepts this API call and records the bounding box

If you change the initial map position or zoom level in the tests, the bounding
box will automatically adjust to match when you re-run the capture test.
