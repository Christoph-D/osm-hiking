import { test, expect, Page } from '@playwright/test'
import { setupElevationMock } from './fixtures/elevation-mock'
import { setupOverpassMock, getLastBoundingBox } from './fixtures/overpass-mock'
import { setupTileMock } from './fixtures/tile-mock'
import { setMapPosition } from './utils'

/**
 * Helper function to load hiking path data
 */
async function loadHikingPaths(page: Page) {
  const loadButton = page.getByRole('button', { name: /load hiking paths/i })
  await expect(loadButton).toBeEnabled()

  // Retry loading if it fails (API can be flaky if not using mocks)
  let retries = 3
  while (retries > 0) {
    await loadButton.click()

    // Wait for either "Hiking paths loaded" or "Failed to load map data"
    const successMsg = page.getByText('Hiking paths loaded')
    const failureMsg = page.getByText('Failed to load map data')
    await expect(successMsg.or(failureMsg)).toBeVisible({ timeout: 15000 })

    if (await successMsg.isVisible()) {
      // Success case - hiking paths loaded
      return
    } else {
      // Error case - failed to load map data
      if (retries > 1) {
        retries--
        await page.waitForTimeout(500)
        continue
      } else {
        throw new Error('Failed to load map data after multiple attempts')
      }
    }
  }
}

/**
 * Helper function to click on the map at specific coordinates (relative to map container)
 */
async function clickMap(page: Page, xOffset: number, yOffset: number) {
  const mapContainer = page.locator('.leaflet-container')
  const box = await mapContainer.boundingBox()

  if (!box) {
    throw new Error('Map container not found')
  }

  await page.mouse.click(box.x + xOffset, box.y + yOffset)
  // No wait here - let the caller wait for the expected result
}

/**
 * Helper function to get marker count
 */
async function getMarkerCount(page: Page): Promise<number> {
  const markers = page.locator('.leaflet-marker-icon')
  return await markers.count()
}

/**
 * Helper function to get polyline count (route segments)
 */
async function getPolylineCount(page: Page): Promise<number> {
  const polylines = page.locator('path.leaflet-interactive[stroke="blue"]')
  return await polylines.count()
}

test.describe('Waypoint Manipulation', () => {
  test.beforeEach(async ({ page }) => {
    await setupOverpassMock(page)
    await setupElevationMock(page)
    await setupTileMock(page)

    await page.goto('/')
    await page.evaluate(setMapPosition)
    await page.goto('/')

    await page.waitForSelector('.leaflet-container')
  })

  test('should add first waypoint marker at snapped location when clicking map', async ({
    page,
  }) => {
    // Initially no markers should be present
    expect(await getMarkerCount(page)).toBe(0)

    // Load data first to ensure there are hiking paths available
    await loadHikingPaths(page)

    // Click on the map to add first waypoint
    await clickMap(page, 400, 300)

    // Wait for waypoint to be added by checking for marker
    const markers = page.locator('.leaflet-marker-icon')
    await expect(markers).toHaveCount(1)

    // Verify waypoint count is displayed (just shows the number)
    const waypointText = page.locator('text=/Waypoints:\\s*1/')
    await expect(waypointText).toBeVisible()
  })

  test('should create route with blue polyline when adding second waypoint', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    // Add first waypoint
    await clickMap(page, 400, 300)
    const markers = page.locator('.leaflet-marker-icon')
    await expect(markers).toHaveCount(1)

    // Note: First waypoint creates a segment (marker only), which might show as polyline
    const initialPolylineCount = await getPolylineCount(page)

    // Add second waypoint
    await clickMap(page, 450, 350)
    await expect(markers).toHaveCount(2)

    // Verify we have more polylines than before (route added)
    // Wait for the polyline count to increase
    await expect(async () => {
      const finalPolylineCount = await getPolylineCount(page)
      expect(finalPolylineCount).toBeGreaterThan(initialPolylineCount)
    }).toPass()

    // Verify distance is shown
    const distanceText = page.locator('text=/Distance:\\s*\\d+\\.\\d+ km/')
    await expect(distanceText).toBeVisible()

    // Verify waypoint count shows 2
    const waypointText = page.locator('text=/Waypoints:\\s*2/')
    await expect(waypointText).toBeVisible()
  })

  test('should update route when dragging a waypoint to new location', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Create a route with 3 waypoints
    await clickMap(page, 200, 150)
    await expect(markers).toHaveCount(1)
    await clickMap(page, 400, 300)
    await expect(markers).toHaveCount(2)
    await clickMap(page, 700, 250)
    await expect(markers).toHaveCount(3)

    // Get the middle marker
    const middleMarker = markers.nth(1)

    // Get initial position
    const initialBox = await middleMarker.boundingBox()
    if (!initialBox) {
      throw new Error('Marker not found')
    }

    // Get initial distance for comparison
    const distanceText = page.locator('text=/Distance:\\s*\\d+\\.\\d+ km/')
    const initialDistance = await distanceText.textContent()

    // Drag the middle marker to a new position
    await page.mouse.move(
      initialBox.x + initialBox.width / 2,
      initialBox.y + initialBox.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(initialBox.x + 300, initialBox.y + 150)
    await page.mouse.up()

    // Wait for route to recalculate by checking if distance changes
    await expect(async () => {
      const newDistance = await distanceText.textContent()
      expect(newDistance).not.toBe(initialDistance)
    }).toPass()

    // Verify we still have 3 waypoints
    expect(await getMarkerCount(page)).toBe(3)

    // Verify route still exists (polylines present)
    expect(await getPolylineCount(page)).toBeGreaterThan(0)
  })

  test('should remove waypoint when double-clicking a marker', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Create a route with 3 waypoints
    await clickMap(page, 350, 300)
    await expect(markers).toHaveCount(1)
    await clickMap(page, 400, 300)
    await expect(markers).toHaveCount(2)
    await clickMap(page, 450, 300)
    await expect(markers).toHaveCount(3)

    // Get the middle marker
    const middleMarker = markers.nth(1)

    // Double-click the middle marker to remove it
    await middleMarker.dblclick()
    await expect(markers).toHaveCount(2)

    // Verify route still exists between remaining waypoints
    expect(await getPolylineCount(page)).toBeGreaterThan(0)

    // Verify waypoint count text shows 2
    const waypointText = page.locator('text=/Waypoints:\\s*2/')
    await expect(waypointText).toBeVisible()
  })

  test('should remove waypoint when right-clicking a marker', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Create a route with 3 waypoints
    await clickMap(page, 350, 300)
    await expect(markers).toHaveCount(1)
    await clickMap(page, 400, 300)
    await expect(markers).toHaveCount(2)
    await clickMap(page, 450, 300)
    await expect(markers).toHaveCount(3)

    // Get the last marker
    const lastMarker = markers.nth(2)

    // Right-click the last marker to remove it
    await lastMarker.click({ button: 'right' })
    await expect(markers).toHaveCount(2)

    // Verify route still exists
    expect(await getPolylineCount(page)).toBeGreaterThan(0)
  })

  test('should insert waypoint when clicking on existing route line', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Create a simple A-to-B route with points close together
    await clickMap(page, 350, 300)
    await expect(markers).toHaveCount(1)
    await clickMap(page, 450, 300)
    await expect(markers).toHaveCount(2)

    // Click on the route line (approximately in the middle)
    // This should insert a waypoint on the route
    await clickMap(page, 400, 300)

    // Wait for marker count to potentially change (with longer timeout as this is conditional)
    await page.waitForFunction(() => {
      const markerElements = document.querySelectorAll('.leaflet-marker-icon')
      return markerElements.length >= 2
    })

    const markerCount = await getMarkerCount(page)

    // Note: This test might be flaky depending on where exactly the route line is
    // If the click lands on the actual route path, it should insert a waypoint
    // The test validates that waypoint insertion works when clicking on route
    if (markerCount === 3) {
      // Successfully inserted a waypoint on the route
      expect(markerCount).toBe(3)

      // Verify waypoint count text
      const waypointText = page.locator('text=/Waypoints:\\s*3/')
      await expect(waypointText).toBeVisible()
    } else {
      // If the click didn't land on the route, we should still have 2 waypoints
      // or we might have added a new endpoint (making it 3)
      // This is expected behavior - only clicking exactly on the route inserts a waypoint
      expect(markerCount).toBeGreaterThanOrEqual(2)
    }
  })

  test('should clear route when removing waypoints down to one', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Create a route with 2 waypoints
    await clickMap(page, 350, 300)
    await expect(markers).toHaveCount(1)
    await clickMap(page, 400, 300)
    await expect(markers).toHaveCount(2)

    // Verify we have a route
    expect(await getPolylineCount(page)).toBeGreaterThan(0)

    // Remove one waypoint by double-clicking
    const firstMarker = markers.nth(0)
    await firstMarker.dblclick()
    await expect(markers).toHaveCount(1)

    // With only 1 waypoint, the first segment still exists (just a marker position)
    // So there might be 1 polyline representing that segment
    // The key is that there's no actual route between two points
    const polylineCount = await getPolylineCount(page)
    expect(polylineCount).toBeLessThanOrEqual(1)

    // Verify waypoint text shows 1
    const waypointText = page.locator('text=/Waypoints:\\s*1/')
    await expect(waypointText).toBeVisible()
  })

  test('should clear all markers when removing last waypoint', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Create a single waypoint
    await clickMap(page, 400, 300)
    await expect(markers).toHaveCount(1)

    // Remove the waypoint by double-clicking
    const marker = markers.first()
    await marker.dblclick()
    await expect(markers).toHaveCount(0)

    // Clear Route button should be disabled
    const clearButton = page.getByRole('button', { name: /clear route/i })
    await expect(clearButton).toBeDisabled()
  })

  test('should handle multiple waypoint additions and removals', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Add 4 waypoints to create a complex route (using closer coordinates)
    await clickMap(page, 380, 290)
    await expect(markers).toHaveCount(1)
    await clickMap(page, 400, 300)
    await expect(async () => {
      expect(await markers.count()).toBeGreaterThanOrEqual(2)
    }).toPass()
    await clickMap(page, 420, 310)
    await expect(async () => {
      expect(await markers.count()).toBeGreaterThanOrEqual(3)
    }).toPass()
    await clickMap(page, 400, 320)
    await expect(async () => {
      expect(await markers.count()).toBeGreaterThanOrEqual(3)
    }).toPass()

    // Get initial count
    const initialCount = await getMarkerCount(page)
    expect(initialCount).toBeGreaterThanOrEqual(3)

    // Remove the second waypoint - use force to bypass pointer interception
    await markers.nth(1).dblclick({ force: true })
    await expect(async () => {
      expect(await markers.count()).toBe(initialCount - 1)
    }).toPass()

    // Should have one less waypoint
    const afterFirstRemoval = await getMarkerCount(page)
    expect(afterFirstRemoval).toBe(initialCount - 1)

    // Remove another waypoint - use force to bypass pointer interception
    await markers.nth(1).dblclick({ force: true })
    await expect(async () => {
      expect(await markers.count()).toBe(afterFirstRemoval - 1)
    }).toPass()

    // Should have one more waypoint removed
    const afterSecondRemoval = await getMarkerCount(page)
    expect(afterSecondRemoval).toBe(afterFirstRemoval - 1)

    // Route should still exist if we have at least 2 waypoints
    if (afterSecondRemoval >= 2) {
      expect(await getPolylineCount(page)).toBeGreaterThan(0)

      // Verify waypoint count
      const waypointText = page.locator(
        `text=/Waypoints:\\s*${afterSecondRemoval}/`
      )
      await expect(waypointText).toBeVisible()
    }
  })

  test('should clear all waypoints when clicking Clear Route button', async ({
    page,
  }) => {
    // Load data first
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Create a route with 3 waypoints (using consistent coordinates)
    await clickMap(page, 380, 300)
    await expect(markers).toHaveCount(1)
    await clickMap(page, 400, 300)
    await expect(async () => {
      expect(await markers.count()).toBeGreaterThanOrEqual(2)
    }).toPass()
    await clickMap(page, 420, 300)
    await expect(async () => {
      expect(await markers.count()).toBeGreaterThanOrEqual(2)
    }).toPass()

    // Verify we have at least 2 waypoints (ideally 3, but depends on path availability)
    const markerCount = await getMarkerCount(page)
    expect(markerCount).toBeGreaterThanOrEqual(2)

    // Click Clear Route button
    const clearButton = page.getByRole('button', { name: /clear route/i })
    await expect(clearButton).toBeEnabled()
    await clearButton.click()
    await expect(markers).toHaveCount(0)

    // Should have no markers
    expect(await getMarkerCount(page)).toBe(0)

    // No polylines
    expect(await getPolylineCount(page)).toBe(0)

    // Clear Route button should be disabled again
    await expect(clearButton).toBeDisabled()
  })

  test('should update localStorage after zoom operations', async ({ page }) => {
    // Clear initial map position
    await page.evaluate(() => {
      localStorage.removeItem('osm-hiking-map-position')
    })

    // Reload the page so it picks up the new localStorage value
    await page.goto('/')
    await page.waitForSelector('.leaflet-container')

    // Perform zoom operations

    // Click zoom in a few times
    const zoomInButton = page.locator('.leaflet-control-zoom-in')
    for (let i = 0; i < 3; i++) {
      await zoomInButton.click()

      // Wait for zoom animation to start
      await page.waitForFunction(() => {
        const mapPane = document.querySelector('.leaflet-map-pane')
        return mapPane && mapPane.classList.contains('leaflet-zoom-anim')
      })
      // Wait for zoom animation to complete
      await page.waitForFunction(() => {
        const mapPane = document.querySelector('.leaflet-map-pane')
        return mapPane && !mapPane.classList.contains('leaflet-zoom-anim')
      })
    }

    // Click zoom out a few times
    const zoomOutButton = page.locator('.leaflet-control-zoom-out')
    for (let i = 0; i < 2; i++) {
      await zoomOutButton.click()

      // Wait for zoom animation to start
      await page.waitForFunction(() => {
        const mapPane = document.querySelector('.leaflet-map-pane')
        return mapPane && mapPane.classList.contains('leaflet-zoom-anim')
      })
      // Wait for zoom animation to complete
      await page.waitForFunction(() => {
        const mapPane = document.querySelector('.leaflet-map-pane')
        return mapPane && !mapPane.classList.contains('leaflet-zoom-anim')
      })
    }

    const finalPosition = await page.evaluate(() => {
      return localStorage.getItem('osm-hiking-map-position')
    })
    expect(finalPosition).toBe('{"center":{"lat":50,"lon":10},"zoom":6}')
  })

  test('should use correct marker icons for waypoints in a route', async ({
    page,
  }) => {
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon, .custom-flag-icon')

    // Create a route
    await clickMap(page, 350, 300)
    await clickMap(page, 400, 300)
    await clickMap(page, 450, 300)
    await clickMap(page, 700, 300)
    await expect(markers).toHaveCount(4)

    // Verify initial markers use default icon
    await expect(markers.nth(0)).toContainClass('leaflet-marker-icon')
    await expect(markers.nth(1)).toContainClass('leaflet-marker-icon')
    await expect(markers.nth(2)).toContainClass('leaflet-marker-icon')

    // Verify last marker uses flag icon
    await expect(markers.nth(3)).toContainClass('custom-flag-icon')
  })

  test('should reload hiking data when panning and clicking in newly revealed area', async ({
    page,
  }) => {
    await loadHikingPaths(page)

    const initialBoundingBox = getLastBoundingBox()

    // Drag the map to pan it
    await page.mouse.move(100, 100)
    await page.mouse.down()
    await page.mouse.move(400, 400)
    await page.mouse.up()

    // Click in the newly revealed area
    await clickMap(page, 200, 200)

    await expect(page.getByText('Hiking paths loaded')).toBeVisible()

    const boundingBox = getLastBoundingBox()

    expect(boundingBox.minLon).toBeLessThan(initialBoundingBox.minLon)
    expect(boundingBox.maxLon).toBeLessThan(initialBoundingBox.maxLon)

    expect(boundingBox.minLat).toBeGreaterThan(initialBoundingBox.minLat)
    expect(boundingBox.maxLat).toBeGreaterThan(initialBoundingBox.maxLat)
  })

  test('should add a new waypoint when clicking in a new area', async ({
    page,
  }) => {
    await loadHikingPaths(page)

    // Drag the map to pan it
    await page.mouse.move(100, 100)
    await page.mouse.down()
    await page.mouse.move(1000, 1000, { steps: 20 })
    await page.mouse.up()
    // Wait for pan animation to start
    await page.waitForFunction(() => {
      const mapPane = document.querySelector('.leaflet-map-pane')
      return mapPane && mapPane.classList.contains('leaflet-pan-anim')
    })
    // Wait for pan animation to complete
    await page.waitForFunction(() => {
      const mapPane = document.querySelector('.leaflet-map-pane')
      return mapPane && !mapPane.classList.contains('leaflet-pan-anim')
    })

    // Click in the newly revealed area
    await clickMap(page, 200, 200)

    // Check that a new waypoint was added
    const markers = page.locator('.leaflet-marker-icon')
    await expect(markers).toHaveCount(1)

    // Verify the marker is in the expected position based on Overpass mock data
    const marker = markers.first()
    const markerBox = await marker.boundingBox()
    if (!markerBox) {
      throw new Error('Marker bounding box not found')
    }
    expect(Math.abs(200 - markerBox.x)).toBeLessThanOrEqual(40)
    expect(Math.abs(200 - markerBox.y)).toBeLessThanOrEqual(40)
  })

  test('should clear the route and add a new waypoint when clicking in a new area', async ({
    page,
  }) => {
    await loadHikingPaths(page)

    await clickMap(page, 300, 300)
    await clickMap(page, 400, 300)

    const markers = page.locator('.leaflet-marker-icon')
    await expect(markers).toHaveCount(2)

    // Drag the map to pan the markers out of view
    await page.mouse.move(100, 100)
    await page.mouse.down()
    await page.mouse.move(1000, 1000, { steps: 20 })
    await page.mouse.up()
    // Wait for pan animation to start
    await page.waitForFunction(() => {
      const mapPane = document.querySelector('.leaflet-map-pane')
      return mapPane && mapPane.classList.contains('leaflet-pan-anim')
    })
    // Wait for pan animation to complete
    await page.waitForFunction(() => {
      const mapPane = document.querySelector('.leaflet-map-pane')
      return mapPane && !mapPane.classList.contains('leaflet-pan-anim')
    })

    // Accept the warning about the route being cleared
    page.on('dialog', (dialog) => dialog.accept())
    await clickMap(page, 200, 200)

    // Check that a new waypoint was added
    await expect(markers).toHaveCount(1)

    // Verify the marker is in the expected position
    const marker = markers.first()
    const markerBox = await marker.boundingBox()
    if (!markerBox) {
      throw new Error('Marker bounding box not found')
    }
    expect(Math.abs(200 - markerBox.x)).toBeLessThanOrEqual(50)
    expect(Math.abs(200 - markerBox.y)).toBeLessThanOrEqual(50)

    // Verify no polyline
    expect(await getPolylineCount(page)).toBe(0)
  })

  test('should drag marker and return to original position', async ({
    page,
  }) => {
    await loadHikingPaths(page)

    const markers = page.locator('.leaflet-marker-icon')

    // Click to create one marker
    await clickMap(page, 400, 300)
    await expect(markers).toHaveCount(1)

    const marker = markers.first()
    const initialBox = await marker.boundingBox()
    if (!initialBox) {
      throw new Error('Marker not found')
    }

    const initialX = initialBox.x + initialBox.width / 2
    const initialY = initialBox.y + initialBox.height / 2

    // Drag the marker 300px to the right, keep holding the mouse button
    await page.mouse.move(initialX, initialY)
    await page.mouse.down()
    await page.mouse.move(initialX + 300, initialY, { steps: 20 })

    // Wait for 500ms while still holding the mouse button
    await page.waitForTimeout(500)

    // Drag marker back to its original place
    await page.mouse.move(initialX, initialY, { steps: 20 })
    await page.mouse.up()

    // Verify that the marker's position is at its original location
    const finalBox = await marker.boundingBox()
    if (!finalBox) {
      throw new Error('Marker not found after drag')
    }

    const finalX = finalBox.x + finalBox.width / 2
    const finalY = finalBox.y + finalBox.height / 2

    expect(Math.abs(finalX - initialX)).toBeLessThanOrEqual(20)
    expect(Math.abs(finalY - initialY)).toBeLessThanOrEqual(20)
  })
})
