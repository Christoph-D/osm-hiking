import { test, expect } from '@playwright/test'
import { setupOverpassMock } from './fixtures/overpass-mock'
import { Jimp } from 'jimp'
import { setupElevationMock } from './fixtures/elevation-mock'
import { setupTileMock } from './fixtures/tile-mock'

test.describe('OSM Hiking Route Planner', () => {
  test.beforeEach(async ({ page }) => {
    await setupOverpassMock(page)
    await setupElevationMock(page)
    await setupTileMock(page)
    await page.goto('/')
    await page.waitForSelector('.leaflet-container')
  })

  test('should display map controls', async ({ page }) => {
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible()
  })

  test('should hide zoom level warning after zooming in enough levels', async ({
    page,
  }) => {
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
    // Check for the route planner heading
    const heading = page.getByRole('heading', { name: /route planner/i })
    await expect(heading).toBeVisible()
  })

  test('should have clear route button', async ({ page }) => {
    // Look for Clear Route button
    const clearButton = page.getByRole('button', { name: /clear route/i })
    await expect(clearButton).toBeVisible()
    await expect(clearButton).toBeDisabled()
  })

  test('should have load hiking paths button', async ({ page }) => {
    // Look for Load Hiking Paths button
    const loadButton = page.getByRole('button', { name: /load hiking paths/i })
    await expect(loadButton).toBeVisible()
    await expect(loadButton).toBeDisabled()
  })

  test('should display instruction text', async ({ page }) => {
    // Check for instruction text
    const instructionText = page.getByText(/zoom in enough.*click on the map/i)
    await expect(instructionText).toBeVisible()
  })

  test('should render map tiles', async ({ page }) => {
    // Wait for network to be idle (tile requests finished)
    await page.waitForLoadState('networkidle')

    // Check if a tile is a green image (they should all be the same in the test)
    // Take a screenshot of the page and check the color of the center pixel
    const screenshot = await page.screenshot()
    const image = await Jimp.read(screenshot)

    const centerX = Math.floor(image.bitmap.width / 2)
    const centerY = Math.floor(image.bitmap.height / 2)
    const color = image.getPixelColor(centerX, centerY)

    // The mocked test tiles are all green (1x1 green PNG).
    expect(color).toBe(0x226f2fff)
  })

  test('should persist map position in localStorage', async ({ page }) => {
    // Use zoom controls to trigger a moveend event
    const zoomInButton = page.locator('.leaflet-control-zoom-in')
    await zoomInButton.click()

    // Wait for localStorage to be updated by checking for the saved position
    await page.waitForFunction(() => {
      const savedPosition = localStorage.getItem('osm-hiking-map-position')
      return (
        savedPosition &&
        savedPosition.includes('center') &&
        savedPosition.includes('zoom')
      )
    })

    // Check localStorage for saved position
    const savedPosition = await page.evaluate(() => {
      return localStorage.getItem('osm-hiking-map-position')
    })

    expect(savedPosition).toBeTruthy()
    expect(savedPosition).toContain('center')
    expect(savedPosition).toContain('zoom')
  })
})
