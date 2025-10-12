import { Waypoint } from '../types'

/**
 * Minimum zoom level required to load hiking paths
 */
export const MIN_ZOOM = 13

/**
 * Initial position for the map on page load
 */
export const INITIAL_POSITION: Waypoint = {
  lat: 50.0,
  lon: 10.0,
}
