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

/**
 * Constrains a point to be within a bounding box
 * If the point is outside, it clamps it to the nearest boundary edge
 */
export function constrainPointToBbox(
  lat: number,
  lon: number,
  bbox: { south: number; west: number; north: number; east: number }
): { lat: number; lon: number } {
  return {
    lat: Math.max(bbox.south, Math.min(bbox.north, lat)),
    lon: Math.max(bbox.west, Math.min(bbox.east, lon)),
  }
}

/**
 * Calculates where a line from start to end point intersects a bounding box boundary
 * Returns the intersection point on the boundary
 */
export function calculateBoundaryIntersection(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  bbox: { south: number; west: number; north: number; east: number }
): { lat: number; lon: number } {
  // If start point is outside bbox, constrain it first
  const constrainedStart = isPointInBbox(startLat, startLon, bbox)
    ? { lat: startLat, lon: startLon }
    : constrainPointToBbox(startLat, startLon, bbox)

  // If end point is inside bbox, return it directly
  if (isPointInBbox(endLat, endLon, bbox)) {
    return { lat: endLat, lon: endLon }
  }

  // Calculate direction vector
  const dx = endLon - constrainedStart.lon
  const dy = endLat - constrainedStart.lat

  // Handle case where start and end are at the same position
  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
    return constrainedStart
  }

  // Check intersection with each boundary edge
  const intersections: { lat: number; lon: number; t: number }[] = []

  // North boundary
  if (dy !== 0) {
    const t = (bbox.north - constrainedStart.lat) / dy
    if (t > 0) {
      const lon = constrainedStart.lon + t * dx
      if (lon >= bbox.west && lon <= bbox.east) {
        intersections.push({ lat: bbox.north, lon, t })
      }
    }
  }

  // South boundary
  if (dy !== 0) {
    const t = (bbox.south - constrainedStart.lat) / dy
    if (t > 0) {
      const lon = constrainedStart.lon + t * dx
      if (lon >= bbox.west && lon <= bbox.east) {
        intersections.push({ lat: bbox.south, lon, t })
      }
    }
  }

  // East boundary
  if (dx !== 0) {
    const t = (bbox.east - constrainedStart.lon) / dx
    if (t > 0) {
      const lat = constrainedStart.lat + t * dy
      if (lat >= bbox.south && lat <= bbox.north) {
        intersections.push({ lat, lon: bbox.east, t })
      }
    }
  }

  // West boundary
  if (dx !== 0) {
    const t = (bbox.west - constrainedStart.lon) / dx
    if (t > 0) {
      const lat = constrainedStart.lat + t * dy
      if (lat >= bbox.south && lat <= bbox.north) {
        intersections.push({ lat, lon: bbox.west, t })
      }
    }
  }

  // Return the intersection with the smallest positive t (closest to start)
  if (intersections.length > 0) {
    intersections.sort((a, b) => a.t - b.t)
    return { lat: intersections[0].lat, lon: intersections[0].lon }
  }

  // Fallback to simple constraining if no intersection found
  return constrainPointToBbox(endLat, endLon, bbox)
}
