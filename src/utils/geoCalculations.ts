import { distance } from '@turf/turf'
import { Waypoint } from '../types'

/**
 * Calculate the distance between two waypoints using Turf.js
 * @param coord1 First waypoint
 * @param coord2 Second waypoint
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Waypoint, coord2: Waypoint): number {
  return distance([coord1.lon, coord1.lat], [coord2.lon, coord2.lat], {
    units: 'meters',
  })
}

/**
 * Calculate cumulative distances along a path
 * @param coordinates Array of waypoints
 * @returns Array of cumulative distances in meters, starting with 0
 */
export function calculateDistances(coordinates: Waypoint[]): number[] {
  const distances: number[] = [0]
  let cumulative = 0

  for (let i = 1; i < coordinates.length; i++) {
    const segmentDistance = calculateDistance(
      coordinates[i - 1],
      coordinates[i]
    )
    cumulative += segmentDistance
    distances.push(cumulative)
  }

  return distances
}
