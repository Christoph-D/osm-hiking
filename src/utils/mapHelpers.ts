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
  RouteSegment,
  Waypoint,
  RouteWaypoint,
  CustomWaypoint,
  NodeWaypoint,
  GraphNode,
} from '../types'
import { Router } from '../services/router'
import { WAYPOINT_CONSTANTS } from '../constants/waypoints'

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
    for (const waypoint of segment.coordinates) {
      if (
        Math.abs(waypoint.lon - node.lon) < 0.000001 &&
        Math.abs(waypoint.lat - node.lat) < 0.000001
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
          coordinates: [{ lat: firstNode.lat, lon: firstNode.lon }],
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

/**
 * Checks if a waypoint is within snapping distance of any node
 */
export function isNearNode(
  waypoint: Waypoint,
  router: Router,
  threshold: number = WAYPOINT_CONSTANTS.SNAP_TO_NODE_THRESHOLD
): { nodeId: string; distance: number; node: GraphNode } | null {
  const result = router.findNearestNode(waypoint.lat, waypoint.lon, threshold)
  return result
}

/**
 * Creates a custom waypoint with a unique ID
 */
export function createCustomWaypoint(lat: number, lon: number): CustomWaypoint {
  return {
    type: 'custom',
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  nodeId: string
): NodeWaypoint {
  return {
    type: 'node',
    id: `node-${nodeId}-${Date.now()}`,
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
  router: Router
): RouteWaypoint | null {
  const result = router.findNearestNode(
    lat,
    lon,
    WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD
  )

  if (
    result &&
    result.distance <= WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD
  ) {
    // Close enough to a node - create node waypoint
    return createNodeWaypoint(result.node.lat, result.node.lon, result.nodeId)
  } else {
    // Too far from any node - create custom waypoint
    return createCustomWaypoint(lat, lon)
  }
}

/**
 * Recalculates route segments for mixed waypoint types (node + custom)
 */
export function recalculateMixedSegments(
  routeWaypoints: RouteWaypoint[],
  router: Router
): { segments: RouteSegment[]; totalDistance: number } {
  const newSegments: RouteSegment[] = []
  let totalDistance = 0

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
          totalDistance += segment.distance
        }
      } else {
        // At least one is a custom waypoint - use straight line
        const segment = router.createStraightSegment(fromWaypoint, toWaypoint)
        newSegments.push(segment)
        totalDistance += segment.distance
      }
    }
  }

  return { segments: newSegments, totalDistance }
}

/**
 * Converts a waypoint from one type to another during drag operations
 */
export function convertWaypointType(
  waypoint: RouteWaypoint,
  router: Router
): RouteWaypoint {
  if (waypoint.type === 'custom') {
    // Custom waypoint - check if it should snap to a nearby node
    const nearestResult = isNearNode(
      waypoint,
      router,
      WAYPOINT_CONSTANTS.SNAP_TO_NODE_THRESHOLD
    )

    if (nearestResult) {
      // Custom waypoint near a node - convert to node waypoint
      return createNodeWaypoint(
        nearestResult.node.lat,
        nearestResult.node.lon,
        nearestResult.nodeId
      )
    }
  } else if (waypoint.type === 'node') {
    // Node waypoint - check if it should convert to custom (dragged too far)
    const nearestResult = router.findNearestNode(
      waypoint.lat,
      waypoint.lon,
      WAYPOINT_CONSTANTS.UNSNAP_FROM_NODE_THRESHOLD
    )

    if (!nearestResult) {
      // Node waypoint far from any node - convert to custom waypoint
      return createCustomWaypoint(waypoint.lat, waypoint.lon)
    }
  }

  // No conversion needed
  return waypoint
}
