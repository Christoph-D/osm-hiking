import { Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load the mock response data
const mockResponsePath = path.join(__dirname, 'overpass-response.json')
const mockResponse = JSON.parse(fs.readFileSync(mockResponsePath, 'utf-8'))

/**
 * Sets up mocking for the Overpass API
 * This intercepts all requests to overpass-api.de and returns cached fixture data
 */
export async function setupOverpassMock(page: Page) {
  await page.route('**/overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    })
  })
}
