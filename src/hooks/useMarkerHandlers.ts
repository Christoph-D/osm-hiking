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
  deleteWaypoint,
  recalculateAffectedSegments,
} from '../utils/mapHelpers'
import { getSnapToNodeThreshold } from '../constants/waypoints'
import { useRouteStore } from '../store/useRouteStore'
import { useRouterStore } from '../store/routerStore'

interface UseMarkerHandlersParams {
  route: Route | null
  isDraggingMarkerRef: RefObject<boolean>
  setTempRoute: (route: Route | null) => void
  mapCenter: { lat: number; lng: number }
  currentZoom: number
}

// Helper function to process marker position and calculate route segments
function processMarkerPosition(
  lat: number,
  lon: number,
  router: Router,
  route: Route,
  index: number,
  mapCenter: { lat: number; lng: number },
  currentZoom: number
): { route: Route; index: number } {
  if (!route.waypoints[index]) {
    throw new Error(`No waypoint found at index ${index}`)
  }

  const snapThreshold = getSnapToNodeThreshold(mapCenter.lat, currentZoom)
  const nearestResult = router.findNearestNode(lat, lon, snapThreshold)

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

  // Update the waypoint in the route
  const waypoints = [...route.waypoints]
  waypoints[index] = newWaypoint

  // Create updated route with the new waypoint
  const routeWithUpdatedWaypoint = {
    ...route,
    waypoints,
  }

  // Use optimized recalculation that only updates affected segments
  const updatedRoute = recalculateAffectedSegments(
    routeWithUpdatedWaypoint,
    index,
    router
  )

  return {
    route: updatedRoute,
    index,
  }
}

export function useMarkerHandlers({
  route,
  isDraggingMarkerRef,
  setTempRoute,
  mapCenter,
  currentZoom,
}: UseMarkerHandlersParams) {
  const { setRoute } = useRouteStore()
  const { router } = useRouterStore()
  const handleMarkerDragStart = useCallback(() => {
    isDraggingMarkerRef.current = true
  }, [isDraggingMarkerRef])

  const handleMarkerDrag = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng: lon } = marker.getLatLng()

      try {
        const routeData = processMarkerPosition(
          lat,
          lon,
          router,
          route,
          index,
          mapCenter,
          currentZoom
        )
        setTempRoute(routeData.route)
      } catch (error) {
        console.error('Error processing marker drag:', error)
      }
    },
    [router, route, setTempRoute, mapCenter, currentZoom]
  )

  const handleMarkerDragEnd = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const marker = event.target
      const { lat, lng: lon } = marker.getLatLng()

      try {
        const routeData = processMarkerPosition(
          lat,
          lon,
          router,
          route,
          index,
          mapCenter,
          currentZoom
        )
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
    [
      router,
      route,
      setTempRoute,
      isDraggingMarkerRef,
      setRoute,
      mapCenter,
      currentZoom,
    ]
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

      const newRoute = deleteWaypoint(route, index, router)
      setRoute(newRoute)
    },
    [router, route, setRoute]
  )

  return {
    handleMarkerDragStart,
    handleMarkerDrag,
    handleMarkerDragEnd,
    handleMarkerClick,
    handleMarkerDoubleClick,
  }
}
