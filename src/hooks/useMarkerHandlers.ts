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
import { Route, RouteSegment, RouteWaypoint, NodeWaypoint } from '../types'
import {
  isNearNode,
  createNodeWaypoint,
  createCustomWaypoint,
  recalculateMixedSegments,
} from '../utils/mapHelpers'

interface UseMarkerHandlersParams {
  router: Router | null
  route: Route | null
  waypointNodeIdsRef: RefObject<string[]>
  isDraggingMarkerRef: RefObject<boolean>
  updateWaypoint: (
    index: number,
    routeWaypoint: RouteWaypoint,
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
  isDraggingMarkerRef,
  updateWaypoint,
  deleteWaypoint,
  clearRoute,
}: UseMarkerHandlersParams) {
  const handleMarkerDragStart = useCallback(() => {
    // Set flag to prevent map click events during drag
    isDraggingMarkerRef.current = true
  }, [isDraggingMarkerRef])

  const handleMarkerDrag = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng: lon } = marker.getLatLng()

      // Get current waypoint
      const currentWaypoint = route.waypoints[index]

      if (!currentWaypoint) {
        console.error('No waypoint found at index', index)
        return
      }

      // Create a temporary waypoint at the new position
      const tempWaypoint = { lat, lon }

      // Check if we should snap to a node or convert waypoint type
      const nearestResult = isNearNode(tempWaypoint, router)

      let newRouteWaypoint: RouteWaypoint
      let finalLat = lat
      let finalLon = lon

      if (currentWaypoint.type === 'custom' && nearestResult) {
        // Custom waypoint snapping to a node
        const node = router.getNode(nearestResult.nodeId)
        if (node) {
          newRouteWaypoint = createNodeWaypoint(
            node.lat,
            node.lon,
            nearestResult.nodeId
          )
          finalLat = node.lat
          finalLon = node.lon
          marker.setLatLng([finalLat, finalLon])
        } else {
          return
        }
      } else if (currentWaypoint.type === 'node' && !nearestResult) {
        // Node waypoint becoming custom (dragged too far)
        newRouteWaypoint = createCustomWaypoint(lat, lon)
        marker.setLatLng([lat, lon])
      } else if (currentWaypoint.type === 'node' && nearestResult) {
        // Node waypoint snapping to a different node
        const node = router.getNode(nearestResult.nodeId)
        if (node) {
          newRouteWaypoint = createNodeWaypoint(
            node.lat,
            node.lon,
            nearestResult.nodeId
          )
          finalLat = node.lat
          finalLon = node.lon
          marker.setLatLng([finalLat, finalLon])
        } else {
          return
        }
      } else {
        // Custom waypoint staying custom
        newRouteWaypoint = createCustomWaypoint(lat, lon)
        marker.setLatLng([lat, lon])
      }

      // Update the waypoint node IDs list for compatibility
      if (newRouteWaypoint.type === 'node') {
        waypointNodeIdsRef.current[index] = (
          newRouteWaypoint as NodeWaypoint
        ).nodeId
      } else {
        waypointNodeIdsRef.current[index] = ''
      }

      // Update route waypoint with final coordinates
      const updatedRouteWaypoint = {
        ...newRouteWaypoint,
        lat: finalLat,
        lon: finalLon,
      }

      // Update route waypoints array
      const newRouteWaypoints = [...route.waypoints]
      newRouteWaypoints[index] = updatedRouteWaypoint

      // Recalculate all segments using mixed routing
      const { segments: newSegments, totalDistance } = recalculateMixedSegments(
        newRouteWaypoints,
        router
      )

      // Update the route store
      updateWaypoint(index, updatedRouteWaypoint, newSegments, totalDistance)

      // Clear the dragging flag after a short delay to prevent map clicks
      // This delay is necessary because the mouseup event fires after dragend
      setTimeout(() => {
        isDraggingMarkerRef.current = false
      }, 100)
    },
    [router, route, waypointNodeIdsRef, isDraggingMarkerRef, updateWaypoint]
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

      // Create new array without the deleted waypoint
      const newRouteWaypoints = [...route.waypoints]
      newRouteWaypoints.splice(index, 1)

      // If no waypoints left, clear everything
      if (newRouteWaypoints.length === 0) {
        clearRoute()
        return
      }

      // Recalculate all segments using mixed routing
      const { segments: newSegments, totalDistance } = recalculateMixedSegments(
        newRouteWaypoints,
        router
      )

      // Update the route store
      deleteWaypoint(index, newSegments, totalDistance)
    },
    [router, route, waypointNodeIdsRef, deleteWaypoint, clearRoute]
  )

  return {
    handleMarkerDragStart,
    handleMarkerDrag,
    handleMarkerClick,
    handleMarkerDoubleClick,
  }
}
