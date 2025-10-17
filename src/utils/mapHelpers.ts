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
} from '../types'
import { Route } from '../services/route'
import { Router } from '../services/router'
import { getCustomWaypointThreshold } from '../constants/waypoints'

/**
 * Creates a route segment with fallback logic (local helper for mapHelpers)
 * Tries routing first for node-to-node connections, falls back to straight line if routing fails
 */
function createSegmentWithFallback(
  fromWaypoint: RouteWaypoint,
  toWaypoint: RouteWaypoint,
  router: Router
): RouteSegment {
  if (fromWaypoint.type === 'node' && toWaypoint.type === 'node') {
    // Both are node waypoints - try routing first
    const segment = router.route(
      (fromWaypoint as NodeWaypoint).nodeId,
      (toWaypoint as NodeWaypoint).nodeId
    )
    if (segment) {
      return segment
    }
    // Fallback to straight line if routing fails
  }

  // Default to straight line for mixed waypoint types or routing fallback
  return router.createStraightSegment(fromWaypoint, toWaypoint)
}

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
 * Deletes a waypoint from a route and recalculates only the affected segments
 * Optimized to only recalculate the segment that connects the waypoints around the deleted waypoint
 *
 * @param route - The current route
 * @param index - Index of the waypoint to delete
 * @param router - Router instance for pathfinding
 * @returns New route with the waypoint deleted and affected segments recalculated
 */
export function deleteWaypoint(
  route: Route,
  index: number,
  router: Router
): Route {
  if (
    !route ||
    !route.waypoints ||
    index < 0 ||
    index >= route.waypoints.length
  ) {
    return route
  }

  // Create new waypoints array without the deleted waypoint
  const newWaypoints = [...route.waypoints]
  newWaypoints.splice(index, 1)

  // If no waypoints left, return empty route
  if (newWaypoints.length === 0) {
    return new Route([], [])
  }

  // Create new segments array that matches the new waypoints structure
  const newSegments: RouteSegment[] = []

  for (let i = 0; i < newWaypoints.length; i++) {
    if (i === 0) {
      // First waypoint - just a marker
      newSegments.push({
        coordinates: [{ lat: newWaypoints[i].lat, lon: newWaypoints[i].lon }],
        distance: 0,
      })
    } else {
      // Determine which original segment to preserve or recalculate
      if (index === 0) {
        // Deleted first waypoint, all segments need recalculation
        const fromWaypoint = newWaypoints[i - 1]
        const toWaypoint = newWaypoints[i]
        newSegments.push(
          createSegmentWithFallback(fromWaypoint, toWaypoint, router)
        )
      } else if (i < index) {
        // Segments before deleted waypoint can be preserved
        newSegments.push(route.segments[i])
      } else if (i === index) {
        // This is the segment that needs recalculation (connects waypoints around deleted waypoint)
        const fromWaypoint = newWaypoints[i - 1]
        const toWaypoint = newWaypoints[i]
        newSegments.push(
          createSegmentWithFallback(fromWaypoint, toWaypoint, router)
        )
      } else {
        // Segments after deleted waypoint can be preserved (shifted by 1)
        newSegments.push(route.segments[i + 1])
      }
    }
  }

  return new Route(newSegments, newWaypoints)
}

/**
 * Adds a waypoint to an existing route with optimized segment recalculation
 * Appends to the end unless the waypoint lies on the existing route, in which
 * case it's inserted at the correct position
 *
 * @example
 * ```typescript
 * // Add a waypoint to a route (either append or insert)
 * const newRoute = addWaypointToRoute(existingRoute, newWaypoint, router)
 * // Only affected segments are recalculated, all other segments are preserved
 * ```
 */
export function addWaypointToRoute(
  route: Route,
  newWaypoint: RouteWaypoint,
  router: Router
): Route {
  if (!route || !route.waypoints || route.waypoints.length === 0) {
    return route
  }

  const insertIndex = findInsertionIndex(newWaypoint, route, router)

  if (insertIndex !== null) {
    // Insert waypoint at the correct position - only recalculate affected segments
    const newRouteWaypoints = [...route.waypoints]
    newRouteWaypoints.splice(insertIndex, 0, newWaypoint)
    const tempRoute = new Route(
      [
        ...route.segments.slice(0, insertIndex),
        { coordinates: [], distance: 0 }, // dummy segment for inserted waypoint
        ...route.segments.slice(insertIndex),
      ],
      newRouteWaypoints,
      route.elevationProfile,
      route.elevationStats
    )
    return recalculateAffectedSegments(tempRoute, insertIndex, router)
  } else {
    // Append to end - recalculate only the last segment
    const tempRoute = new Route(
      [...route.segments, { coordinates: [], distance: 0 }], // dummy segment
      [...route.waypoints, newWaypoint],
      route.elevationProfile,
      route.elevationStats
    )
    return recalculateAffectedSegments(
      tempRoute,
      route.waypoints.length,
      router
    )
  }
}

/**
 * Recalculates only the segment at the given index
 */
export function recalculateSegment(
  route: Route,
  index: number,
  router: Router
): Route {
  if (!route) {
    return route
  }

  if (index < 0 || index >= route.segments.length) {
    console.warn(
      `recalculateSegment: Invalid index ${index} for route with ${route.segments.length} segments`
    )
    return route
  }

  // For the first segment (index 0), it's just a marker and shouldn't be recalculated
  if (index === 0) {
    return route
  }

  const newSegments = [...route.segments]

  const fromWaypoint = route.waypoints[index - 1]
  const toWaypoint = route.waypoints[index]
  newSegments[index] = createSegmentWithFallback(
    fromWaypoint,
    toWaypoint,
    router
  )

  return new Route(newSegments, route.waypoints)
}

/**
 * Recalculates only the segments affected by dragging a waypoint
 * Optimized version that only recalculates segments before and after the dragged waypoint
 *
 * @example
 * ```typescript
 * // When dragging waypoint at index 2 in a 5-waypoint route
 * const optimizedRoute = recalculateAffectedSegments(originalRoute, 2, router)
 * // Only segments 1-2 and 2-3 are recalculated, segments 0-1 and 3-4 are preserved
 * ```
 */
export function recalculateAffectedSegments(
  route: Route,
  affectedIndex: number,
  router: Router
): Route {
  if (!route) {
    return route
  }

  let newRoute = route

  // Recalculate segment before the dragged waypoint (if it exists)
  if (affectedIndex > 0) {
    newRoute = recalculateSegment(newRoute, affectedIndex, router)
  }

  // Recalculate segment after the dragged waypoint (if it exists)
  if (affectedIndex < route.waypoints.length - 1) {
    newRoute = recalculateSegment(newRoute, affectedIndex + 1, router)
  }

  return newRoute
}
