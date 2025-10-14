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
import { Waypoint } from '../types'
import {
  determineWaypointType,
  recalculateMixedSegments,
} from '../utils/mapHelpers'
import { useRouteStore } from '../store/useRouteStore'

export function useRouteManagement() {
  const {
    route,
    addSegment,
    clearRoute: clearRouteStore,
    setError,
  } = useRouteStore()

  const preservedWaypoints = useRef<Waypoint[]>([])

  const clearRoute = useCallback(() => {
    clearRouteStore()
    preservedWaypoints.current = []
  }, [clearRouteStore])

  const processMapClick = useCallback(
    (router: Router, lat: number, lng: number) => {
      // Determine waypoint type based on distance to nearest node
      const routeWaypoint = determineWaypointType(lat, lng, router)

      if (!routeWaypoint) {
        setError('Invalid location selected.')
        return
      }

      setError(null)

      // First waypoint - just mark it
      if (!route || route.waypoints.length === 0) {
        addSegment(
          {
            coordinates: [{ lat: routeWaypoint.lat, lon: routeWaypoint.lon }],
            distance: 0,
          },
          routeWaypoint
        )
        return
      }

      // For subsequent waypoints, we need to handle mixed routing
      const currentRouteWaypoints = route?.waypoints || []
      const newRouteWaypoints = [...currentRouteWaypoints, routeWaypoint]

      // Recalculate segments using mixed routing
      const { segments: newSegments } = recalculateMixedSegments(
        newRouteWaypoints,
        router
      )

      // Update the route store
      addSegment(newSegments[newSegments.length - 1], routeWaypoint)
    },
    [route, addSegment, setError]
  )

  return {
    preservedWaypointsRef: preservedWaypoints,
    clearRoute,
    processMapClick,
  }
}
