/**
 * Marker Handlers Hook
 *
 * Custom React hook that manages waypoint marker interactions on the map.
 * This hook provides handlers for:
 * - Dragging waypoint markers to new locations (snaps to nearest hiking path node)
 * - Clicking markers (prevents map click events from firing)
 * - Double-clicking or right-clicking markers to remove waypoints
 *
 * All handlers automatically recalculate the route when waypoints are modified.
 */

import { useCallback, RefObject } from 'react'
import { LeafletEvent } from 'leaflet'
import { Router } from '../services/router'
import { Route, RouteSegment } from '../types'
import { recalculateSegments } from '../utils/mapHelpers'

interface UseMarkerHandlersParams {
  router: Router | null
  route: Route | null
  waypointNodeIdsRef: RefObject<string[]>
  updateWaypoint: (
    index: number,
    waypoint: [number, number],
    segments: RouteSegment[],
    totalDistance: number
  ) => void
  deleteWaypoint: (
    index: number,
    segments: RouteSegment[],
    totalDistance: number
  ) => void
  clearRoute: () => void
}

export function useMarkerHandlers({
  router,
  route,
  waypointNodeIdsRef,
  updateWaypoint,
  deleteWaypoint,
  clearRoute,
}: UseMarkerHandlersParams) {
  const handleMarkerDrag = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng } = marker.getLatLng()

      // Find nearest node to new position
      const nodeId = router.findNearestNode(lat, lng, 500)
      if (!nodeId) return

      const node = router.getNode(nodeId)
      if (!node) return

      // Snap marker to the node
      marker.setLatLng([node.lat, node.lon])

      // Update the waypoint node ID
      waypointNodeIdsRef.current[index] = nodeId

      // Recalculate all segments
      const { segments: newSegments, totalDistance } = recalculateSegments(
        waypointNodeIdsRef.current,
        router
      )

      // Update the route store
      updateWaypoint(index, [node.lon, node.lat], newSegments, totalDistance)
    },
    [router, route, waypointNodeIdsRef, updateWaypoint]
  )

  const handleMarkerClick = useCallback((event: LeafletEvent) => {
    // Stop propagation to prevent map click handler from firing
    const origEvent = (event as LeafletEvent & { originalEvent?: Event })
      .originalEvent
    if (origEvent) {
      origEvent.stopPropagation()
    }
  }, [])

  const handleMarkerDoubleClick = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      // Stop propagation to prevent map click handler from firing
      const origEvent = (event as LeafletEvent & { originalEvent?: Event })
        .originalEvent
      if (origEvent) {
        origEvent.stopPropagation()
      }

      // Remove this waypoint from the node IDs list
      waypointNodeIdsRef.current.splice(index, 1)

      // If no waypoints left, clear everything
      if (waypointNodeIdsRef.current.length === 0) {
        clearRoute()
        return
      }

      // Recalculate all segments
      const { segments: newSegments, totalDistance } = recalculateSegments(
        waypointNodeIdsRef.current,
        router
      )

      // Update the route store
      deleteWaypoint(index, newSegments, totalDistance)
    },
    [router, route, waypointNodeIdsRef, deleteWaypoint, clearRoute]
  )

  return {
    handleMarkerDrag,
    handleMarkerClick,
    handleMarkerDoubleClick,
  }
}
