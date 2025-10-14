import { Router } from './router'
import { RouteWaypoint } from '../types'

/**
 * Map waypoint coordinates to nearest nodes in the routing graph
 * @param router The router instance
 * @param waypoints Array of waypoint coordinates
 * @returns Array of RouteWaypoint objects (NodeWaypoint for mapped waypoints, CustomWaypoint for unmapped ones)
 */
export function mapWaypointsToNodes(
  router: Router,
  waypoints: RouteWaypoint[]
): RouteWaypoint[] {
  const routeWaypoints: RouteWaypoint[] = []

  for (let i = 0; i < waypoints.length; i++) {
    const waypoint = waypoints[i]
    if (waypoint.type == 'custom') {
      // Don't remap custom waypoints
      routeWaypoints.push(waypoint)
      continue
    }

    const nearestNode = router.findNearestNode(waypoint.lat, waypoint.lon, 500)

    if (nearestNode) {
      // Successfully mapped to node - create NodeWaypoint
      routeWaypoints.push({
        type: 'node' as const,
        id: `preserved-node-${Date.now()}-${i}`,
        lat: nearestNode.node.lat,
        lon: nearestNode.node.lon,
        nodeId: nearestNode.nodeId,
      })
    } else {
      // Couldn't map to node - create CustomWaypoint
      routeWaypoints.push({
        type: 'custom' as const,
        id: `preserved-custom-${Date.now()}-${i}`,
        lat: waypoint.lat,
        lon: waypoint.lon,
      })
    }
  }

  return routeWaypoints
}
