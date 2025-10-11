# E2E Test Fixtures

This directory contains cached map data from the Overpass API used for e2e
testing.

## Files

- **overpass-response.json**: Cached Overpass API response containing map data
  for the default test region
- **overpass-metadata.json**: Metadata about the cached data including the
  bounding box, capture timestamp, and element count
- **overpass-mock.ts**: Playwright route interceptor that mocks Overpass API
  calls with the cached data
- **README.md**: This file

## Updating the Mock Data

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

## Captured Region

The current cached data covers this region (see `overpass-metadata.json` for
exact values):

**Bounding Box:**

- South: 49.990°
- West: 9.973°
- North: 50.010°
- East: 10.027°

**Data Summary:**

- 1,565 OSM elements (nodes and ways)
- Contains paths, footways, roads, and other walkable routes in central Germany
- Corresponds to zoom level 15 after 10 zoom-in operations from the default view
- Captured: 2025-10-11
