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
import {
  Route,
  RouteSegment,
  Waypoint,
  RouteWaypoint,
  CustomWaypoint,
  NodeWaypoint,
} from '../types'
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
 * Calculates total distance from an array of route segments
 */
export function calculateTotalDistance(segments: RouteSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.distance, 0)
}

/**
 * Finds the insertion index for a waypoint if it's on an existing route
 * Returns the index where the waypoint should be inserted, or null if it should be appended
 */
export function findInsertionIndex(
  routeWaypoint: RouteWaypoint,
  route: Route,
  router: Router
): number | null {
  if (!route || route.segments.length < 2) {
    return null
  }

  // Only node waypoints can be inserted - custom waypoints are always appended
  if (routeWaypoint.type !== 'node') {
    return null
  }

  const node = router.getNode(routeWaypoint.nodeId)
  if (!node) return null

  // Check each segment (skip first segment which is just the starting waypoint marker)
  for (let segmentIdx = 1; segmentIdx < route.segments.length; segmentIdx++) {
    const segment = route.segments[segmentIdx]

    // Check if this node's coordinates match any coordinate in this segment
    for (const coordinate of segment.coordinates) {
      if (coordinate.lon === node.lon && coordinate.lat === node.lat) {
        // Node is on this segment, so it should be inserted after waypoint at segmentIdx-1
        // and before waypoint at segmentIdx
        return segmentIdx
      }
    }
  }

  return null
}

/**
 * Recalculates route segments for mixed waypoint types (node + custom)
 */
export function recalculateMixedSegments(
  routeWaypoints: RouteWaypoint[],
  router: Router
): Route {
  const newSegments: RouteSegment[] = []

  for (let i = 0; i < routeWaypoints.length; i++) {
    if (i === 0) {
      // First waypoint - just a marker
      newSegments.push({
        coordinates: [
          { lat: routeWaypoints[i].lat, lon: routeWaypoints[i].lon },
        ],
        distance: 0,
      })
    } else {
      const fromWaypoint = routeWaypoints[i - 1]
      const toWaypoint = routeWaypoints[i]

      // Determine segment type based on waypoint types
      if (fromWaypoint.type === 'node' && toWaypoint.type === 'node') {
        // Both are node waypoints - use routing
        const segment = router.route(
          (fromWaypoint as NodeWaypoint).nodeId,
          (toWaypoint as NodeWaypoint).nodeId
        )
        if (segment) {
          newSegments.push(segment)
        }
      } else {
        // At least one is a custom waypoint - use straight line
        const segment = router.createStraightSegment(fromWaypoint, toWaypoint)
        newSegments.push(segment)
      }
    }
  }

  const totalDistance = calculateTotalDistance(newSegments)
  return {
    segments: newSegments,
    waypoints: routeWaypoints,
    totalDistance,
  }
}
