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
import { RouteWaypoint } from '../types'
import { Route } from '../services/route'
import {
  createNodeWaypoint,
  createCustomWaypoint,
  isPointInBbox,
  calculateBoundaryIntersection,
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
  loadedBbox: {
    south: number
    west: number
    north: number
    east: number
  } | null
}

// Helper function to determine reference point for marker boundary constraints
function getMarkerReferencePoint(
  route: Route,
  index: number,
  loadedBbox: {
    south: number
    west: number
    north: number
    east: number
  }
): { lat: number; lon: number } {
  if (route.waypoints.length === 0) {
    // If route is empty, use center of the loaded area
    return {
      lat: (loadedBbox.north + loadedBbox.south) / 2,
      lon: (loadedBbox.east + loadedBbox.west) / 2,
    }
  }

  if (index === 0 || index === route.waypoints.length - 1) {
    // First or last marker: use its neighboring waypoint
    const neighborIndex = index === 0 ? 1 : route.waypoints.length - 2
    const neighbor = route.waypoints[neighborIndex]
    return {
      lat: neighbor.lat,
      lon: neighbor.lon,
    }
  }

  // Middle marker: use center point between its two neighbors
  const prevWaypoint = route.waypoints[index - 1]
  const nextWaypoint = route.waypoints[index + 1]
  return {
    lat: (prevWaypoint.lat + nextWaypoint.lat) / 2,
    lon: (prevWaypoint.lon + nextWaypoint.lon) / 2,
  }
}

// Helper function to process marker position and calculate route segments
function processMarkerPosition(
  lat: number,
  lon: number,
  router: Router,
  route: Route,
  index: number,
  mapCenter: { lat: number; lng: number },
  currentZoom: number,
  loadedBbox: {
    south: number
    west: number
    north: number
    east: number
  } | null
): { route: Route; index: number } {
  if (!route.waypoints[index]) {
    throw new Error(`No waypoint found at index ${index}`)
  }

  // Apply boundary constraints if we have a loaded bbox
  let constrainedLat = lat
  let constrainedLon = lon

  if (loadedBbox) {
    // Get reference point for boundary intersection calculation
    const referencePoint = getMarkerReferencePoint(route, index, loadedBbox)

    // If the target position is outside the loaded bbox, constrain it
    if (!isPointInBbox(lat, lon, loadedBbox)) {
      const constrainedPosition = calculateBoundaryIntersection(
        referencePoint.lat,
        referencePoint.lon,
        lat,
        lon,
        loadedBbox
      )
      constrainedLat = constrainedPosition.lat
      constrainedLon = constrainedPosition.lon
    }
  }

  const snapThreshold = getSnapToNodeThreshold(mapCenter.lat, currentZoom)
  const nearestResult = router.findNearestNode(
    constrainedLat,
    constrainedLon,
    snapThreshold
  )

  let newWaypoint: RouteWaypoint

  if (nearestResult) {
    newWaypoint = createNodeWaypoint(
      nearestResult.node.lat,
      nearestResult.node.lon,
      nearestResult.nodeId
    )
  } else {
    newWaypoint = createCustomWaypoint(constrainedLat, constrainedLon)
  }

  // Update the waypoint in the route
  const waypoints = [...route.waypoints]
  waypoints[index] = newWaypoint

  // Create updated route with the new waypoint
  const routeWithUpdatedWaypoint = new Route(
    route.segments,
    waypoints,
    route.elevationProfile,
    route.elevationStats
  )

  // Use optimized recalculation that only updates affected segments
  const updatedRoute = routeWithUpdatedWaypoint.recalculateAffectedSegments(
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
  loadedBbox,
}: UseMarkerHandlersParams) {
  const { setRoute } = useRouteStore()
  const { router } = useRouterStore()
  const lastCallRef = useRef(0)
  const handleMarkerDragStart = useCallback(() => {
    isDraggingMarkerRef.current = true
  }, [isDraggingMarkerRef])

  const handleMarkerDrag = useCallback(
    (index: number, event: LeafletEvent) => {
      if (!router || !route) return

      const now = Date.now()
      const throttleDelay = 100 // milliseconds

      // Skip processing if not enough time has elapsed since last call
      if (now - lastCallRef.current < throttleDelay) {
        return
      }

      lastCallRef.current = now

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
          currentZoom,
          loadedBbox
        )
        setTempRoute(routeData.route)
      } catch (error) {
        console.error('Error processing marker drag:', error)
      }
    },
    [router, route, setTempRoute, mapCenter, currentZoom, loadedBbox]
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
          currentZoom,
          loadedBbox
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
      loadedBbox,
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

      const newRoute = route.deleteWaypoint(index, router)
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
