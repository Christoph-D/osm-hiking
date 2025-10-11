import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

interface OverpassResponse {
  elements?: Array<unknown>
  [key: string]: unknown
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * This test captures the real Overpass API response and saves it as a fixture.
 * It's skipped by default - only run it when you need to update the mock data.
 *
 * To run this test, change `test.skip` to `test.only` below, then run:
 *   npx playwright test e2e/capture-overpass.spec.ts --timeout=180000
 *
 * Don't forget to change it back to `test.skip` after capturing the data!
 */
test.skip('capture Overpass API response', async ({ page }) => {
  let capturedResponse: OverpassResponse | null = null
  let capturedBbox: {
    south: number
    west: number
    north: number
    east: number
  } | null = null

  // Intercept and capture the Overpass API response and bounding box
  await page.route('**/overpass-api.de/api/interpreter', async (route) => {
    const response = await route.fetch()
    const data: OverpassResponse = await response.json()
    capturedResponse = data

    // Extract bounding box from the request body
    const requestBody = route.request().postData()
    if (requestBody) {
      const decodedBody = decodeURIComponent(requestBody)
      const bboxMatch = decodedBody.match(
        /\(([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)\)/
      )
      if (bboxMatch) {
        capturedBbox = {
          south: parseFloat(bboxMatch[1]),
          west: parseFloat(bboxMatch[2]),
          north: parseFloat(bboxMatch[3]),
          east: parseFloat(bboxMatch[4]),
        }
      }
    }

    route.fulfill({ response, json: data })
  })

  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'osm-hiking-map-position',
      JSON.stringify({
        center: [50, 10],
        zoom: 15,
      })
    )
  })
  await page.goto('/')
  await page.waitForSelector('.leaflet-container')

  // Click Load Hiking Paths to trigger the API call
  const loadButton = page.getByRole('button', { name: /load hiking paths/i })
  await loadButton.click()
  await page.getByText('Hiking paths loaded').waitFor({ timeout: 60000 })

  // Save the captured response
  if (!capturedResponse) {
    throw new Error('No response was captured')
  }

  const fixturesDir = path.join(__dirname, 'fixtures')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  fs.writeFileSync(
    path.join(fixturesDir, 'overpass-response.json'),
    JSON.stringify(capturedResponse, null, 2) + '\n'
  )

  // Save metadata including the bounding box
  const metadata = {
    capturedAt: new Date().toISOString(),
    bbox: capturedBbox,
    elementCount: (capturedResponse as OverpassResponse).elements?.length || 0,
  }

  fs.writeFileSync(
    path.join(fixturesDir, 'overpass-metadata.json'),
    JSON.stringify(metadata, null, 2) + '\n'
  )

  console.log(
    `Captured ${(capturedResponse as OverpassResponse).elements?.length || 0} elements`
  )
  console.log('Data saved to e2e/fixtures/overpass-response.json')
  console.log('Metadata saved to e2e/fixtures/overpass-metadata.json')
  if (capturedBbox) {
    console.log('Bounding box:', capturedBbox)
  }
})
