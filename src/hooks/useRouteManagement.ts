/**
 * Route Management Hook
 *
 * Custom React hook that manages route creation and waypoint operations.
 * This hook coordinates:
 * - Processing map clicks to add waypoints
 * - Managing waypoint node IDs and their relationships
 * - Inserting waypoints on existing routes (when clicking on a route line)
 * - Clearing routes and resetting state
 * - Preserving waypoints when data is reloaded
 *
 * This is the central coordination point for route state management.
 */

import { useCallback, useRef } from 'react'
import { Router } from '../services/router'
import { RouteSegment, Route, Waypoint } from '../types'
import { findNodeOnRoute, recalculateSegments } from '../utils/mapHelpers'

interface UseRouteManagementParams {
  route: Route | null
  addSegment: (segment: RouteSegment, waypoint: Waypoint) => void
  insertWaypoint: (
    index: number,
    waypoint: Waypoint,
    segments: RouteSegment[],
    totalDistance: number
  ) => void
  clearRouteStore: () => void
  setError: (error: string | null) => void
}

export function useRouteManagement({
  route,
  addSegment,
  insertWaypoint,
  clearRouteStore,
  setError,
}: UseRouteManagementParams) {
  const waypointNodeIds = useRef<string[]>([])
  const preservedWaypoints = useRef<Waypoint[]>([])

  const clearRoute = useCallback(() => {
    clearRouteStore()
    waypointNodeIds.current = []
    preservedWaypoints.current = []
  }, [clearRouteStore])

  const processMapClick = useCallback(
    (router: Router, lat: number, lng: number) => {
      // Find nearest node with increased search radius
      const nodeId = router.findNearestNode(lat, lng, 500)

      if (!nodeId) {
        setError('No path found nearby. Click closer to a hiking trail.')
        return
      }

      setError(null)

      // Get the actual node coordinates
      const node = router.getNode(nodeId)
      if (!node) {
        setError('Invalid node selected.')
        return
      }

      // First waypoint - just mark it
      if (waypointNodeIds.current.length === 0) {
        waypointNodeIds.current = [nodeId]
        addSegment(
          { coordinates: [{ lat: node.lat, lon: node.lon }], distance: 0 },
          { lat: node.lat, lon: node.lon }
        )
        return
      }

      // Check if this node is on the existing route
      const insertIndex = findNodeOnRoute(nodeId, router, route?.segments || [])

      if (insertIndex !== null) {
        // Node is on the route - insert it at the correct position
        // Insert the node ID in the waypoint list
        waypointNodeIds.current.splice(insertIndex, 0, nodeId)

        // Recalculate all segments
        const { segments: newSegments, totalDistance } = recalculateSegments(
          waypointNodeIds.current,
          router
        )

        // Update the route store
        insertWaypoint(
          insertIndex,
          { lat: node.lat, lon: node.lon },
          newSegments,
          totalDistance
        )
        return
      }

      // Node is not on the route - add to the end
      const segment = router.route(
        waypointNodeIds.current[waypointNodeIds.current.length - 1],
        nodeId
      )

      if (!segment) {
        setError('Could not find a route between these points.')
        return
      }

      waypointNodeIds.current.push(nodeId)
      addSegment(segment, { lat: node.lat, lon: node.lon })
    },
    [route, addSegment, insertWaypoint, setError]
  )

  return {
    waypointNodeIds,
    preservedWaypointsRef: preservedWaypoints,
    clearRoute,
    processMapClick,
  }
}
