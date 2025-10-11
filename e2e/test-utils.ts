import { Page } from '@playwright/test'

/**
 * Helper function to zoom in to the required zoom level and wait for tiles to load
 */
export async function zoomToRequiredLevel(page: Page) {
  const zoomInButton = page.locator('.leaflet-control-zoom-in')

  // Click zoom in a few times to reach the minimum required zoom level
  for (let i = 0; i < 10; i++) {
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
}
