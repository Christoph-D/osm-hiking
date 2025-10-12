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

import { useCallback, useRef, RefObject } from 'react'
import { LeafletEvent } from 'leaflet'
import { Router } from '../services/router'
import { Route, RouteSegment } from '../types'
import { recalculateSegments } from '../utils/mapHelpers'

interface UseMarkerHandlersParams {
  router: Router | null
  route: Route | null
  waypointNodeIdsRef: RefObject<string[]>
  setLastWaypoint: (nodeId: string | null) => void
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
  setLastWaypoint,
  updateWaypoint,
  deleteWaypoint,
  clearRoute,
}: UseMarkerHandlersParams) {
  const isProcessingMarkerClick = useRef(false)

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

      // Update the last waypoint reference
      setLastWaypoint(
        waypointNodeIdsRef.current[waypointNodeIdsRef.current.length - 1]
      )

      // Update the route store
      updateWaypoint(index, [node.lon, node.lat], newSegments, totalDistance)
    },
    [router, route, waypointNodeIdsRef, setLastWaypoint, updateWaypoint]
  )

  const handleMarkerClick = useCallback((event: LeafletEvent) => {
    // Mark that we're processing a marker click to prevent map click handler
    isProcessingMarkerClick.current = true
    const origEvent = (event as LeafletEvent & { originalEvent?: Event })
      .originalEvent
    if (origEvent) {
      origEvent.stopPropagation()
    }
  }, [])

  const handleMarkerDoubleClick = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      // Mark that we're processing a marker click to prevent map click handler
      isProcessingMarkerClick.current = true
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
        setLastWaypoint(null)
        return
      }

      // Recalculate all segments
      const { segments: newSegments, totalDistance } = recalculateSegments(
        waypointNodeIdsRef.current,
        router
      )

      // Update the last waypoint reference
      setLastWaypoint(
        waypointNodeIdsRef.current[waypointNodeIdsRef.current.length - 1]
      )

      // Update the route store
      deleteWaypoint(index, newSegments, totalDistance)

      // Reset the marker click flag so subsequent map clicks work
      isProcessingMarkerClick.current = false
    },
    [
      router,
      route,
      waypointNodeIdsRef,
      setLastWaypoint,
      deleteWaypoint,
      clearRoute,
    ]
  )

  return {
    isProcessingMarkerClick,
    handleMarkerDrag,
    handleMarkerClick,
    handleMarkerDoubleClick,
  }
}
