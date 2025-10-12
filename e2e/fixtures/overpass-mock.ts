import { Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load the mock response data
const mockResponsePath = path.join(__dirname, 'overpass-response.json')
const mockResponse = JSON.parse(fs.readFileSync(mockResponsePath, 'utf-8'))

// Store the last request data for testing purposes
let lastRequestData: string | null = null

/**
 * Gets the last request data sent to the Overpass API
 */
export function getLastBoundingBox() {
  if (!lastRequestData) {
    throw new Error('No Overpass API query yet or the last query was empty')
  }

  // Extract the data part (after "data=")
  const dataPart = lastRequestData.substring(5)

  const decodedData = decodeURIComponent(dataPart)

  // Parse the Overpass QL query to extract the bounding box
  // The bounding box is in the format (minLat,minLon,maxLat,maxLon)
  const bboxMatch = decodedData.match(/\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/)

  if (!bboxMatch) {
    throw new Error('No bounding box in last Overpass API query')
  }

  const minLat = parseFloat(bboxMatch[1])
  const minLon = parseFloat(bboxMatch[2])
  const maxLat = parseFloat(bboxMatch[3])
  const maxLon = parseFloat(bboxMatch[4])
  return {
    minLat,
    minLon,
    maxLat,
    maxLon,
  }
}

/**
 * Sets up mocking for the Overpass API
 * This intercepts all requests to overpass-api.de and returns cached fixture data
 */
export async function setupOverpassMock(page: Page) {
  await page.route('**/overpass-api.de/api/interpreter', async (route) => {
    // Store the request data for testing
    const request = route.request()
    const postData = request.postData()
    if (postData) {
      lastRequestData = postData
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    })
  })
}
