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

import { useCallback } from 'react'
import { Router } from '../services/router'
import { Route } from '../types'
import {
  determineWaypointType,
  recalculateMixedSegments,
} from '../utils/mapHelpers'
import { useRouteStore } from '../store/useRouteStore'

export function useRouteManagement() {
  const { setRoute, setError } = useRouteStore()

  const processMapClick = useCallback(
    (router: Router, lat: number, lng: number, route: Route | null) => {
      // Determine waypoint type based on distance to nearest node
      const routeWaypoint = determineWaypointType(lat, lng, router)

      if (!routeWaypoint) {
        setError('Invalid location selected.')
        return
      }

      setError(null)

      // First waypoint - just mark it
      if (!route || route.waypoints.length === 0) {
        const newRoute: Route = {
          segments: [
            {
              coordinates: [{ lat: routeWaypoint.lat, lon: routeWaypoint.lon }],
              distance: 0,
            },
          ],
          waypoints: [routeWaypoint],
          totalDistance: 0,
        }
        setRoute(newRoute)
        return
      }

      // For subsequent waypoints, we need to handle mixed routing
      const currentRouteWaypoints = route?.waypoints || []
      const newRouteWaypoints = [...currentRouteWaypoints, routeWaypoint]

      // Recalculate segments using mixed routing
      try {
        const newRoute = recalculateMixedSegments(newRouteWaypoints, router)
        setRoute(newRoute)
      } catch (error) {
        console.error('Error in recalculateMixedSegments:', error)
        setError('Failed to calculate route segment')
      }
    },
    [setRoute, setError]
  )

  return {
    processMapClick,
  }
}
