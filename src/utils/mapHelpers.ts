/**
 * Map Helper Utilities
 *
 * Pure utility functions for map operations including:
 * - Bounding box calculations
 * - Route segment recalculation
 * - Point-in-bounds checking
 *
 * These functions are stateless and can be used independently
 * throughout the application.
 */

import L from 'leaflet'
import { RouteWaypoint, NodeWaypoint, CustomWaypoint, Waypoint } from '../types'
import { Router } from '../services/router'
import { getCustomWaypointThreshold } from '../constants/waypoints'

/**
 * Gets the current bounding box from the map
 */
export function getCurrentBbox(map: L.Map) {
  const bounds = map.getBounds()
  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  }
}

/**
 * Checks if a point is within a bounding box
 */
export function isPointInBbox(
  lat: number,
  lon: number,
  bbox: { south: number; west: number; north: number; east: number }
): boolean {
  return (
    lat >= bbox.south &&
    lat <= bbox.north &&
    lon >= bbox.west &&
    lon <= bbox.east
  )
}

/**
 * Checks if loading new data would clear the current route
 * Returns true if any waypoint would be outside the new bounding box
 */
export function wouldClearRoute(
  waypoints: Waypoint[],
  newBbox: { south: number; west: number; north: number; east: number }
): boolean {
  // Check if all waypoints fit in the new bbox
  const allWaypointsFit = waypoints.every((waypoint) =>
    isPointInBbox(waypoint.lat, waypoint.lon, newBbox)
  )

  return !allWaypointsFit
}

/**
 * Creates a custom waypoint
 */
export function createCustomWaypoint(lat: number, lon: number): CustomWaypoint {
  return {
    type: 'custom',
    lat,
    lon,
  }
}

/**
 * Creates a node waypoint
 */
export function createNodeWaypoint(
  lat: number,
  lon: number,
  nodeId: number
): NodeWaypoint {
  return {
    type: 'node',
    nodeId,
    lat,
    lon,
  }
}

/**
 * Determines waypoint type based on distance to nearest node
 */
export function determineWaypointType(
  lat: number,
  lon: number,
  router: Router,
  mapCenter: { lat: number; lng: number },
  currentZoom: number
): RouteWaypoint | null {
  const customThreshold = getCustomWaypointThreshold(mapCenter.lat, currentZoom)
  const result = router.findNearestNode(lat, lon, customThreshold)

  if (result && result.distance <= customThreshold) {
    // Close enough to a node - create node waypoint
    return createNodeWaypoint(result.node.lat, result.node.lon, result.nodeId)
  } else {
    // Too far from any node - create custom waypoint
    return createCustomWaypoint(lat, lon)
  }
}
