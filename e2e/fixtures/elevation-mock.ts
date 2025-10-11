import { Page } from '@playwright/test'
import { createNoise2D } from 'simplex-noise'

interface ElevationRequest {
  locations: Array<{
    latitude: number
    longitude: number
  }>
}

/**
 * Generates consistent elevation data based on the request payload using simplex noise.
 */
function generateElevationResponse(request: ElevationRequest) {
  const { locations } = request
  const noise2D = createNoise2D()

  const results = locations.map(
    (location: { latitude: number; longitude: number }) => {
      // Use a combination of latitude and longitude to generate a unique seed for each location
      const elevation = Math.floor(
        (noise2D(location.latitude, location.longitude) + 1) * 1500
      )

      return {
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: elevation,
      }
    }
  )

  return { results }
}

/**
 * Sets up mocking for the Open-Elevation API
 * This intercepts all requests to api.open-elevation.com and returns dynamically generated elevation data
 */
export async function setupElevationMock(page: Page) {
  await page.route('**/api.open-elevation.com/api/v1/lookup', async (route) => {
    const requestBody = route.request().postData()
    if (!requestBody) {
      throw new Error('No request body found')
    }

    const request = JSON.parse(requestBody)
    const response = generateElevationResponse(request)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  })
}
