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
import { RouteSegment, Waypoint } from '../types'
import { Router } from '../services/router'

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
 * Checks if loading new data would clear the existing route
 */
export function wouldClearRoute(
  waypoints: Waypoint[],
  newBbox: { south: number; west: number; north: number; east: number }
): boolean {
  if (waypoints.length === 0) {
    return false
  }

  // Check if all waypoints fit in the new bbox
  const allWaypointsFit = waypoints.every((waypoint) =>
    isPointInBbox(waypoint.lat, waypoint.lon, newBbox)
  )

  return !allWaypointsFit
}

/**
 * Checks if a node exists on the current route
 * Returns the segment index where the node should be inserted as a waypoint, or null if not on route
 */
export function findNodeOnRoute(
  nodeId: string,
  router: Router,
  segments: RouteSegment[]
): number | null {
  if (segments.length < 2) {
    return null
  }

  const node = router.getNode(nodeId)
  if (!node) return null

  // Check each segment (skip first segment which is just the starting waypoint marker)
  for (let segmentIdx = 1; segmentIdx < segments.length; segmentIdx++) {
    const segment = segments[segmentIdx]

    // Check if this node's coordinates match any coordinate in this segment
    for (const [lon, lat] of segment.coordinates) {
      if (
        Math.abs(lon - node.lon) < 0.000001 &&
        Math.abs(lat - node.lat) < 0.000001
      ) {
        // Node is on this segment, so it should be inserted after waypoint at segmentIdx-1
        // and before waypoint at segmentIdx
        return segmentIdx
      }
    }
  }

  return null
}

/**
 * Recalculates all route segments from a list of waypoint node IDs
 */
export function recalculateSegments(
  waypointNodeIds: string[],
  router: Router
): { segments: RouteSegment[]; totalDistance: number } {
  const newSegments: RouteSegment[] = []
  let totalDistance = 0

  for (let i = 0; i < waypointNodeIds.length; i++) {
    if (i === 0) {
      // First waypoint - just a marker
      const firstNode = router.getNode(waypointNodeIds[i])
      if (firstNode) {
        newSegments.push({
          coordinates: [[firstNode.lon, firstNode.lat]],
          distance: 0,
        })
      }
    } else {
      // Route from previous waypoint
      const segment = router.route(waypointNodeIds[i - 1], waypointNodeIds[i])
      if (segment) {
        newSegments.push(segment)
        totalDistance += segment.distance
      }
    }
  }

  return { segments: newSegments, totalDistance }
}
