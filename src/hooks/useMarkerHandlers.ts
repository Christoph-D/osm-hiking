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
import { Route, RouteWaypoint } from '../types'
import {
  createNodeWaypoint,
  createCustomWaypoint,
  recalculateMixedSegments,
} from '../utils/mapHelpers'
import { WAYPOINT_CONSTANTS } from '../constants/waypoints'
import { useRouteStore } from '../store/useRouteStore'

interface UseMarkerHandlersParams {
  router: Router | null
  route: Route | null
  isDraggingMarkerRef: RefObject<boolean>
  setTempRoute: (route: Route | null) => void
}

// Helper function to process marker position and calculate route segments
function processMarkerPosition(
  lat: number,
  lon: number,
  router: Router,
  route: Route,
  index: number
): { route: Route; index: number } {
  if (!route.waypoints[index]) {
    throw new Error(`No waypoint found at index ${index}`)
  }

  const nearestResult = router.findNearestNode(
    lat,
    lon,
    WAYPOINT_CONSTANTS.SNAP_TO_NODE_THRESHOLD
  )

  let newWaypoint: RouteWaypoint

  if (nearestResult) {
    newWaypoint = createNodeWaypoint(
      nearestResult.node.lat,
      nearestResult.node.lon,
      nearestResult.nodeId
    )
  } else {
    newWaypoint = createCustomWaypoint(lat, lon)
  }

  const waypoints = [...route.waypoints]
  waypoints[index] = newWaypoint

  const updatedRoute = recalculateMixedSegments(waypoints, router)

  return {
    route: updatedRoute,
    index,
  }
}

export function useMarkerHandlers({
  router,
  route,
  isDraggingMarkerRef,
  setTempRoute,
}: UseMarkerHandlersParams) {
  const { setRoute, clearRoute } = useRouteStore()
  const handleMarkerDragStart = useCallback(() => {
    isDraggingMarkerRef.current = true
  }, [isDraggingMarkerRef])

  const handleMarkerDrag = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng: lon } = marker.getLatLng()

      try {
        const routeData = processMarkerPosition(lat, lon, router, route, index)
        setTempRoute(routeData.route)
      } catch (error) {
        console.error('Error processing marker drag:', error)
      }
    },
    [router, route, setTempRoute]
  )

  const handleMarkerDragEnd = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng: lon } = marker.getLatLng()

      try {
        const routeData = processMarkerPosition(lat, lon, router, route, index)
        const updatedWaypoint = routeData.route.waypoints[routeData.index]

        marker.setLatLng([updatedWaypoint.lat, updatedWaypoint.lon])
        setRoute(routeData.route)

        setTempRoute(null)

        // Clear the dragging flag after a short delay to prevent map clicks
        // This delay is necessary because the mouseup event fires after dragend
        setTimeout(() => {
          isDraggingMarkerRef.current = false
        }, 100)
      } catch (error) {
        console.error('Error processing marker drag end:', error)
      }
    },
    [router, route, setTempRoute, isDraggingMarkerRef, setRoute]
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
      const newRoute = recalculateMixedSegments(newRouteWaypoints, router)

      // Update the route store
      setRoute(newRoute)
    },
    [router, route, setRoute, clearRoute]
  )

  return {
    handleMarkerDragStart,
    handleMarkerDrag,
    handleMarkerDragEnd,
    handleMarkerClick,
    handleMarkerDoubleClick,
  }
}
