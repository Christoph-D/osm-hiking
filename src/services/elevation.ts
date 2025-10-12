import { Route, ElevationPoint } from '../types'

interface ElevationResult {
  latitude: number
  longitude: number
  elevation: number
}

interface ElevationAPIResponse {
  results: ElevationResult[]
}

// Open-Elevation API endpoint
const ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup'

/**
 * Fetch elevation data for an array of coordinates
 * Coordinates should be in [lon, lat] format (GeoJSON convention)
 * API accepts max ~500 locations per request, but we'll batch at 100 for reliability
 */
export async function fetchElevations(
  coordinates: [number, number][]
): Promise<number[]> {
  const BATCH_SIZE = 100
  const results: number[] = []

  // Process in batches
  for (let i = 0; i < coordinates.length; i += BATCH_SIZE) {
    const batch = coordinates.slice(i, i + BATCH_SIZE)
    const batchResults = await fetchElevationBatch(batch)
    results.push(...batchResults)
  }

  return results
}

async function fetchElevationBatch(
  coordinates: [number, number][]
): Promise<number[]> {
  // Convert [lon, lat] to {latitude, longitude} format for API
  const locations = coordinates.map(([lon, lat]) => ({
    latitude: lat,
    longitude: lon,
  }))

  try {
    const response = await fetch(ELEVATION_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locations }),
    })

    if (!response.ok) {
      throw new Error(`Elevation API error: ${response.statusText}`)
    }

    const data: ElevationAPIResponse = await response.json()
    return data.results.map((result) => result.elevation)
  } catch (error) {
    console.error('Failed to fetch elevations:', error)
    // Return zeros as fallback
    return coordinates.map(() => 0)
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1
  const [lon2, lat2] = coord2
  const R = 6371000 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Interpolate a point along a line segment
 */
function interpolatePoint(
  p1: [number, number],
  p2: [number, number],
  fraction: number
): [number, number] {
  return [
    p1[0] + (p2[0] - p1[0]) * fraction,
    p1[1] + (p2[1] - p1[1]) * fraction,
  ]
}

/**
 * Subdivide a path into equally spaced points along its length
 * @param coordinates Array of [lon, lat] coordinates representing the path
 * @param numPoints Number of points to generate (default 100)
 * @returns Array of equally spaced coordinates along the path
 */
export function subdividePathEqually(
  coordinates: [number, number][],
  numPoints: number = 100
): [number, number][] {
  if (coordinates.length < 2) {
    return coordinates
  }

  // Calculate cumulative distances along the path
  const distances: number[] = [0]
  let totalDistance = 0

  for (let i = 1; i < coordinates.length; i++) {
    const segmentDistance = haversineDistance(
      coordinates[i - 1],
      coordinates[i]
    )
    totalDistance += segmentDistance
    distances.push(totalDistance)
  }

  if (totalDistance === 0) {
    return [coordinates[0]]
  }

  // Generate equally spaced target distances
  const result: [number, number][] = []
  const spacing = totalDistance / (numPoints - 1)

  for (let i = 0; i < numPoints; i++) {
    const targetDistance = i * spacing

    // Find the segment containing this distance
    let segmentIndex = 0
    for (let j = 1; j < distances.length; j++) {
      if (distances[j] >= targetDistance) {
        segmentIndex = j - 1
        break
      }
    }

    // Handle edge case: last point
    if (i === numPoints - 1) {
      result.push(coordinates[coordinates.length - 1])
      continue
    }

    // Interpolate within the segment
    const segmentStart = distances[segmentIndex]
    const segmentEnd = distances[segmentIndex + 1]
    const segmentLength = segmentEnd - segmentStart

    if (segmentLength === 0) {
      result.push(coordinates[segmentIndex])
    } else {
      const fraction = (targetDistance - segmentStart) / segmentLength
      const interpolated = interpolatePoint(
        coordinates[segmentIndex],
        coordinates[segmentIndex + 1],
        fraction
      )
      result.push(interpolated)
    }
  }

  return result
}

/**
 * Calculate cumulative distance along a path
 */
export function calculateDistances(coordinates: [number, number][]): number[] {
  const distances: number[] = [0]
  let cumulative = 0

  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1]
    const [lon2, lat2] = coordinates[i]

    // Haversine distance
    const R = 6371000 // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    cumulative += distance
    distances.push(cumulative)
  }

  return distances
}

/**
 * Calculate elevation statistics
 */
export function calculateElevationStats(elevations: number[]): {
  gain: number
  loss: number
  min: number
  max: number
} {
  let gain = 0
  let loss = 0
  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < elevations.length; i++) {
    const ele = elevations[i]
    min = Math.min(min, ele)
    max = Math.max(max, ele)

    if (i > 0) {
      const diff = ele - elevations[i - 1]
      if (diff > 0) {
        gain += diff
      } else {
        loss += Math.abs(diff)
      }
    }
  }

  return { gain, loss, min, max }
}

/**
 * Collect all coordinates from route segments, handling segment connections
 * @param route The route containing segments to process
 * @returns Array of all coordinates in order
 */
export function collectRouteCoordinates(route: Route): [number, number][] {
  const allCoordinates: [number, number][] = []

  for (let i = 0; i < route.segments.length; i++) {
    const segment = route.segments[i]
    if (i === 0) {
      // First segment: include all coordinates (usually just one point)
      allCoordinates.push(...segment.coordinates)
    } else {
      // Check if this segment connects to the previous one
      const prevLastCoord = allCoordinates[allCoordinates.length - 1]
      const currFirstCoord = segment.coordinates[0]
      const coordsMatch =
        prevLastCoord &&
        Math.abs(prevLastCoord[0] - currFirstCoord[0]) < 0.000001 &&
        Math.abs(prevLastCoord[1] - currFirstCoord[1]) < 0.000001

      if (coordsMatch) {
        // Skip the first coordinate (it's the same as the last coordinate of the previous segment)
        allCoordinates.push(...segment.coordinates.slice(1))
      } else {
        // Segments don't connect, include all coordinates
        allCoordinates.push(...segment.coordinates)
      }
    }
  }

  return allCoordinates
}

/**
 * Calculate theoretical distances for subdivided points
 * @param originalDistances Cumulative distances along the original path
 * @param numPoints Number of points in the subdivided path
 * @returns Array of distances for each subdivided point
 */
export function calculateSubdividedDistances(
  originalDistances: number[],
  numPoints: number
): number[] {
  const totalDistance = originalDistances[originalDistances.length - 1]
  const spacing = totalDistance / (numPoints - 1)

  return Array.from({ length: numPoints }, (_, i) => i * spacing)
}

/**
 * Build elevation profile from coordinates and elevations
 * @param coordinates Array of [lon, lat] coordinates
 * @param elevations Array of elevation values
 * @param distances Array of distances for each point
 * @returns Array of ElevationPoint objects
 */
export function buildElevationProfile(
  coordinates: [number, number][],
  elevations: number[],
  distances: number[]
): ElevationPoint[] {
  return coordinates.map((coord, i) => ({
    distance: distances[i],
    elevation: elevations[i],
    lat: coord[1], // coord[1] is latitude
    lon: coord[0], // coord[0] is longitude
  }))
}
