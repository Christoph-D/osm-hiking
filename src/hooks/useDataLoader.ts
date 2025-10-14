/**
 * Data Loader Hook
 *
 * Custom React hook that manages OSM (OpenStreetMap) data loading and routing graph construction.
 * This hook handles:
 * - Fetching hiking path data from Overpass API for the visible map area
 * - Building a routing graph from OSM data
 * - Preserving and recalculating routes when data is reloaded
 * - Validating zoom levels before loading data
 * - User confirmations when loading would clear existing routes
 *
 * Returns the router instance, loading state, and a loadData function.
 */

import { useState, useCallback } from 'react'
import L from 'leaflet'
import { Router } from '../services/router'
import { fetchOSMData } from '../services/overpass'
import { buildRoutingGraph } from '../services/graphBuilder'
import { RouteSegment, Route, CustomWaypoint, RouteWaypoint } from '../types'
import { getCurrentBbox, wouldClearRoute } from '../utils/mapHelpers'
import { MIN_ZOOM } from '../constants/map'
import { mapWaypointsToNodes } from '../services/routePreservation'
import { recalculateMixedSegments } from '../utils/mapHelpers'

interface UseDataLoaderParams {
  map: L.Map
  route: Route | null
  clearRoute: () => void
  addSegment: (segment: RouteSegment, routeWaypoint: CustomWaypoint) => void
  clearRouteStore: () => void
  setError: (error: string | null) => void
}

interface LoadedBbox {
  south: number
  west: number
  north: number
  east: number
}

export function useDataLoader({
  map,
  route,
  clearRoute,
  addSegment,
  clearRouteStore,
  setError,
}: UseDataLoaderParams) {
  const [router, setRouter] = useState<Router | null>(null)
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [loadedBbox, setLoadedBbox] = useState<LoadedBbox | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadData = useCallback(
    async (
      onSuccess?: (router: Router, currentRoute: Route | null) => void,
      skipConfirmation = false
    ) => {
      try {
        // Check zoom level - only load if zoomed in enough
        if (map.getZoom() < MIN_ZOOM) {
          setError(`Zoom in to at least level ${MIN_ZOOM} to load hiking paths`)
          setIsDataLoaded(false)
          return
        }

        // Get current bounding box
        const bbox = getCurrentBbox(map)

        setIsLoading(true)
        setError(null)

        // Check if we have an existing route and handle preservation/clearing
        let waypointsToPreserve: RouteWaypoint[] = []
        let wouldClear = false

        if (route) {
          wouldClear = wouldClearRoute(route.waypoints, bbox)

          // Show confirmation if needed
          if (!skipConfirmation && wouldClear) {
            const confirmed = window.confirm(
              'Loading hiking paths for this area will clear your current route because some waypoints are outside the visible area. Continue?'
            )
            if (!confirmed) {
              setIsLoading(false)
              return
            }
          }

          // If route would NOT be cleared, preserve all waypoints
          // If route would be cleared, preserve none
          waypointsToPreserve = wouldClear ? [] : route.waypoints

          if (wouldClear) {
            clearRoute()
          }
        }

        const osmData = await fetchOSMData(bbox)
        setIsLoading(false)

        const graph = buildRoutingGraph(osmData)

        const newRouter = new Router(graph)
        setRouter(newRouter)
        setLoadedBbox(bbox)
        setIsDataLoaded(true)

        // Recalculate route if we have preserved waypoints
        if (waypointsToPreserve.length > 0) {
          // Map waypoints to nodes and recalculate route
          const routeWaypoints = mapWaypointsToNodes(
            newRouter,
            waypointsToPreserve
          )

          const { segments: newSegments, totalDistance } =
            recalculateMixedSegments(routeWaypoints, newRouter)

          if (newSegments.length === 0) {
            clearRoute()
            return { router: newRouter, waypointNodeIds: [] }
          }

          // Construct the new route object
          const newRoute: Route = {
            segments: newSegments,
            waypoints: routeWaypoints,
            totalDistance,
          }

          // Clear the route store and set the new recalculated route
          clearRouteStore()
          // We need to add each segment with its corresponding waypoint
          for (let i = 0; i < newRoute.waypoints.length; i++) {
            addSegment(
              newRoute.segments[i],
              newRoute.waypoints[i] as CustomWaypoint
            )
          }

          // Call success callback if provided
          if (onSuccess) {
            onSuccess(newRouter, newRoute)
          }

          return { router: newRouter, waypointNodeIds: routeWaypoints }
        }

        // Call success callback
        if (onSuccess) {
          const emptyRoute: Route = {
            segments: [],
            waypoints: [],
            totalDistance: 0,
          }
          onSuccess(newRouter, emptyRoute)
        }

        return { router: newRouter, waypointNodeIds: [] }
      } catch (error) {
        console.error('Failed to load OSM data:', error)
        const currentZoom = map.getZoom()
        const maxZoom = map.getMaxZoom()
        const errorMessage =
          currentZoom < maxZoom
            ? 'Failed to load map data. Try zooming in more and try again.'
            : 'Failed to load map data. Please try again.'
        setError(errorMessage)
        return undefined
      } finally {
        setIsLoading(false)
      }
    },
    [map, route, clearRoute, addSegment, clearRouteStore, setError]
  )

  return {
    router,
    isDataLoaded,
    loadedBbox,
    loadData,
    isLoading,
  }
}
