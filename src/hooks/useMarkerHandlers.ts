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
import { Route, RouteSegment, RouteWaypoint } from '../types'
import {
  createNodeWaypoint,
  createCustomWaypoint,
  recalculateMixedSegments,
} from '../utils/mapHelpers'
import { WAYPOINT_CONSTANTS } from '../constants/waypoints'

interface UseMarkerHandlersParams {
  router: Router | null
  route: Route | null
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
  setTempRoute: (route: Route | null) => void
}

export function useMarkerHandlers({
  router,
  route,
  isDraggingMarkerRef,
  updateWaypoint,
  deleteWaypoint,
  clearRoute,
  setTempRoute,
}: UseMarkerHandlersParams) {
  const handleMarkerDragStart = useCallback(() => {
    isDraggingMarkerRef.current = true
  }, [isDraggingMarkerRef])

  const handleMarkerDrag = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng: lon } = marker.getLatLng()

      const currentWaypoint = route.waypoints[index]

      if (!currentWaypoint) return

      // Create temporary waypoint at new position
      const nearestResult = router.findNearestNode(
        lat,
        lon,
        WAYPOINT_CONSTANTS.SNAP_TO_NODE_THRESHOLD
      )

      let newRouteWaypoint: RouteWaypoint
      let finalLat = lat
      let finalLon = lon

      if (nearestResult) {
        newRouteWaypoint = createNodeWaypoint(
          nearestResult.node.lat,
          nearestResult.node.lon,
          nearestResult.nodeId
        )
        finalLat = nearestResult.node.lat
        finalLon = nearestResult.node.lon
      } else {
        newRouteWaypoint = createCustomWaypoint(lat, lon)
      }

      const updatedRouteWaypoint = {
        ...newRouteWaypoint,
        lat: finalLat,
        lon: finalLon,
      }

      // Create temporary waypoints with the dragged marker at new position
      const tempWaypoints = [...route.waypoints]
      tempWaypoints[index] = updatedRouteWaypoint

      // Calculate temporary route
      const { segments: newSegments, totalDistance } = recalculateMixedSegments(
        tempWaypoints,
        router
      )

      // Set temporary route for display
      setTempRoute({
        segments: newSegments,
        waypoints: tempWaypoints,
        totalDistance,
      })
    },
    [router, route, setTempRoute]
  )

  const handleMarkerDragEnd = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng: lon } = marker.getLatLng()

      // Use the same logic as handleMarkerDrag but update the main store
      const currentWaypoint = route.waypoints[index]
      if (!currentWaypoint) {
        console.error('No waypoint found at index', index)
        return
      }

      const nearestResult = router.findNearestNode(
        lat,
        lon,
        WAYPOINT_CONSTANTS.SNAP_TO_NODE_THRESHOLD
      )

      let newRouteWaypoint: RouteWaypoint = createCustomWaypoint(lat, lon)
      let finalLat = lat
      let finalLon = lon

      if (nearestResult) {
        newRouteWaypoint = createNodeWaypoint(
          nearestResult.node.lat,
          nearestResult.node.lon,
          nearestResult.nodeId
        )
        finalLat = nearestResult.node.lat
        finalLon = nearestResult.node.lon
      } else {
        newRouteWaypoint = createCustomWaypoint(lat, lon)
      }

      const updatedRouteWaypoint = {
        ...newRouteWaypoint,
        lat: finalLat,
        lon: finalLon,
      }

      // Update marker position to final coordinates
      marker.setLatLng([finalLat, finalLon])

      // Update main route store
      const newRouteWaypoints = [...route.waypoints]
      newRouteWaypoints[index] = updatedRouteWaypoint

      const { segments: newSegments, totalDistance } = recalculateMixedSegments(
        newRouteWaypoints,
        router
      )

      updateWaypoint(index, updatedRouteWaypoint, newSegments, totalDistance)

      // Clear temporary state
      setTempRoute(null)

      // Clear the dragging flag after a short delay to prevent map clicks
      // This delay is necessary because the mouseup event fires after dragend
      setTimeout(() => {
        isDraggingMarkerRef.current = false
      }, 100)
    },
    [router, route, updateWaypoint, setTempRoute, isDraggingMarkerRef]
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
    [router, route, deleteWaypoint, clearRoute]
  )

  return {
    handleMarkerDragStart,
    handleMarkerDrag,
    handleMarkerDragEnd,
    handleMarkerClick,
    handleMarkerDoubleClick,
  }
}
