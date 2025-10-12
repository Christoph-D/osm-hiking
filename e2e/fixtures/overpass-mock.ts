/**
 * Overpass API Mock
 *
 * Mock implementation for testing Overpass API interactions in end-to-end tests.
 * This module intercepts requests to the Overpass API and provides mock responses
 * with coordinate translation to simulate different map areas.
 *
 * Used in Playwright tests to simulate Overpass API responses without making
 * actual network requests.
 */

import { Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from '../../src/constants/map'

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  lat?: number
  lon?: number
}

interface OverpassResponse {
  elements: OverpassElement[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load the mock response data
const mockResponsePath = path.join(__dirname, 'overpass-response.json')
const mockResponse = JSON.parse(fs.readFileSync(mockResponsePath, 'utf-8'))

// Store the last request data for testing purposes
let lastRequestData: string | null = null

function decodeBoundingBox(queryData: string) {
  if (!queryData) {
    return null
  }

  // Extract the data part (after "data=")
  const dataPart = queryData.substring(5)

  const decodedData = decodeURIComponent(dataPart)

  // Parse the Overpass QL query to extract the bounding box
  // The bounding box is in the format (minLat,minLon,maxLat,maxLon)
  const bboxMatch = decodedData.match(/\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/)

  if (!bboxMatch) {
    return null
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
 * Gets the last request data sent to the Overpass API
 */
export function getLastBoundingBox() {
  if (!lastRequestData) {
    throw new Error('No Overpass API query yet or the last query was empty')
  }
  const bb = decodeBoundingBox(lastRequestData)
  if (!bb) {
    throw new Error('Could not decode bounding box from Overpass API query')
  }
  return bb
}

/**
 * Translates all coordinates in the mock response by applying the given offsets
 * Returns a new copy of the data.
 */
function translateMockData(
  data: OverpassResponse,
  offsetLat: number,
  offsetLon: number
) {
  // Create a deep copy of the data to avoid modifying the original
  const translatedData = JSON.parse(JSON.stringify(data)) as OverpassResponse

  // Translate all node coordinates
  for (const element of translatedData.elements) {
    if (element.type === 'node') {
      if (element.lat) {
        element.lat += offsetLat
      }
      if (element.lon) {
        element.lon += offsetLon
      }
    }
  }

  return translatedData
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

    const boundingBox = decodeBoundingBox(postData || '')
    if (!boundingBox) {
      await route.fulfill({
        status: 404,
      })
      return
    }

    const offsetLat =
      (boundingBox.minLat + boundingBox.maxLat) / 2 - DEFAULT_LATITUDE
    const offsetLon =
      (boundingBox.minLon + boundingBox.maxLon) / 2 - DEFAULT_LONGITUDE
    const translatedData = translateMockData(mockResponse, offsetLat, offsetLon)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(translatedData),
    })
  })
}
