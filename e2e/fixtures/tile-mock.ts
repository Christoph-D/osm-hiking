import { Page } from '@playwright/test'
import { Buffer } from 'buffer'

/**
 * Base64-encoded 1x1 green PNG image
 * This is used to mock OpenStreetMap tile requests
 */
const GREEN_1X1_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNUytf/DwADPAHB5a+U3gAAAABJRU5ErkJggg=='

/**
 * Sets up mocking for OpenStreetMap tile requests
 * This intercepts all requests to tile.openstreetmap.org and returns a 1x1 green image
 */
export async function setupTileMock(page: Page) {
  await page.route('**/*.tile.openstreetmap.org/**/*.png', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(GREEN_1X1_PNG, 'base64'),
    })
  })
}
