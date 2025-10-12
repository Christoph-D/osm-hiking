import { Router } from './router'
import { RouteSegment, Route } from '../types'
import { isPointInBbox } from '../utils/mapHelpers'

/**
 * Determine if a route should be preserved when loading new data
 * @param route The current route
 * @param bbox The new bounding box
 * @returns Array of waypoints to preserve, or empty array if route shouldn't be preserved
 */
export function shouldPreserveRoute(
  route: Route | null,
  bbox: { south: number; west: number; north: number; east: number }
): [number, number][] {
  if (!route || route.waypoints.length === 0) {
    return []
  }

  // Check if all waypoints fit in the new bbox
  const allWaypointsFit = route.waypoints.every(([lon, lat]) =>
    isPointInBbox(lon, lat, bbox)
  )

  return allWaypointsFit ? [...route.waypoints] : []
}

/**
 * Map waypoint coordinates to nearest nodes in the routing graph
 * @param router The router instance
 * @param waypoints Array of waypoint coordinates
 * @returns Array of node IDs or null if any waypoint can't be mapped
 */
export function mapWaypointsToNodes(
  router: Router,
  waypoints: [number, number][]
): string[] | null {
  const nodeIds: string[] = []

  for (const [lon, lat] of waypoints) {
    const nodeId = router.findNearestNode(lat, lon, 500)
    if (!nodeId) {
      return null
    }
    nodeIds.push(nodeId)
  }

  return nodeIds
}

/**
 * Recalculate route segments using new graph
 * @param router The router instance
 * @param waypointNodeIds Array of node IDs for waypoints
 * @param addSegment Function to add segments to the route
 * @param clearRouteStore Function to clear the route store
 * @returns Array of recalculated route segments
 */
export function recalculateRoute(
  router: Router,
  waypointNodeIds: string[],
  addSegment: (segment: RouteSegment, waypoint: [number, number]) => void,
  clearRouteStore: () => void,
  waypoints: [number, number][]
): RouteSegment[] {
  const newSegments: RouteSegment[] = []

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
      } else {
        // If routing fails, return empty array
        return []
      }
    }
  }

  // Clear the route first then rebuild it
  clearRouteStore()
  for (let i = 0; i < waypoints.length; i++) {
    addSegment(newSegments[i], waypoints[i])
  }

  return newSegments
}
