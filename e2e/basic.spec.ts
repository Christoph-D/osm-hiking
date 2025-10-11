import { test, expect } from '@playwright/test'
import { setupOverpassMock } from './fixtures/overpass-mock'

test.describe('OSM Hiking Route Planner', () => {
  test.beforeEach(async ({ page }) => {
    // Set up Overpass API mocking before each test
    await setupOverpassMock(page)
  })

  test('should load the application successfully', async ({ page }) => {
    await page.goto('/')

    // Check that the map container is present
    await expect(page.locator('.leaflet-container')).toBeVisible()
  })

  test('should display map controls', async ({ page }) => {
    await page.goto('/')

    // Wait for the map to load
    await page.waitForSelector('.leaflet-container')

    // Check for zoom controls
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible()
  })

  test('should hide zoom level warning after zooming in enough levels', async ({
    page,
  }) => {
    await page.goto('/')

    // Wait for the map to load
    await page.waitForSelector('.leaflet-container')

    // Check if zoom warning is initially visible
    const zoomWarning = page.getByText(/Please zoom in more/i)
    await expect(zoomWarning).toBeVisible()

    // Find and click the zoom in button multiple times to reach sufficient zoom level
    const zoomInButton = page.locator('.leaflet-control-zoom-in')

    // Click zoom in several times to ensure we reach the minimum required zoom level
    for (let i = 0; i < 8; i++) {
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

    // Verify the zoom warning is no longer visible
    await expect(zoomWarning).not.toBeVisible()
  })

  test('should display route planner panel', async ({ page }) => {
    await page.goto('/')

    await page.waitForSelector('.leaflet-container')

    // Check for the route planner heading
    const heading = page.getByRole('heading', { name: /route planner/i })
    await expect(heading).toBeVisible()
  })

  test('should have clear route button', async ({ page }) => {
    await page.goto('/')

    await page.waitForSelector('.leaflet-container')

    // Look for Clear Route button
    const clearButton = page.getByRole('button', { name: /clear route/i })
    await expect(clearButton).toBeVisible()
    await expect(clearButton).toBeDisabled()
  })

  test('should have load hiking paths button', async ({ page }) => {
    await page.goto('/')

    await page.waitForSelector('.leaflet-container')

    // Look for Load Hiking Paths button
    const loadButton = page.getByRole('button', { name: /load hiking paths/i })
    await expect(loadButton).toBeVisible()
    await expect(loadButton).toBeDisabled()
  })

  test('should display instruction text', async ({ page }) => {
    await page.goto('/')

    await page.waitForSelector('.leaflet-container')

    // Check for instruction text
    const instructionText = page.getByText(/zoom in enough.*click on the map/i)
    await expect(instructionText).toBeVisible()
  })

  test('should render map tiles', async ({ page }) => {
    await page.goto('/')

    // Wait for map container
    await page.waitForSelector('.leaflet-container')

    // Wait for at least one tile to be visible
    const tiles = page.locator('.leaflet-tile')
    await expect(tiles.first()).toBeVisible({ timeout: 10000 })

    // Check if any tiles are present (they should have loaded)
    const tileCount = await tiles.count()
    expect(tileCount).toBeGreaterThan(0)
  })

  test('should persist map position in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.leaflet-container')

    // Use zoom controls to trigger a moveend event
    const zoomInButton = page.locator('.leaflet-control-zoom-in')
    await zoomInButton.click()

    // Wait for localStorage to be updated by checking for the saved position
    await page.waitForFunction(
      () => {
        const savedPosition = localStorage.getItem('osm-hiking-map-position')
        return (
          savedPosition &&
          savedPosition.includes('center') &&
          savedPosition.includes('zoom')
        )
      },
      { timeout: 5000 }
    )

    // Check localStorage for saved position
    const savedPosition = await page.evaluate(() => {
      return localStorage.getItem('osm-hiking-map-position')
    })

    expect(savedPosition).toBeTruthy()
    expect(savedPosition).toContain('center')
    expect(savedPosition).toContain('zoom')
  })
})
