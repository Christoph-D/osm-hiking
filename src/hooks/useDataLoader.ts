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
import { RouteSegment, Route } from '../types'
import { getCurrentBbox, wouldClearRoute } from '../utils/mapHelpers'
import { MIN_ZOOM } from '../constants/map'
import {
  shouldPreserveRoute,
  mapWaypointsToNodes,
  recalculateRoute,
} from '../services/routePreservation'

interface UseDataLoaderParams {
  map: L.Map
  route: Route | null
  clearRoute: () => void
  addSegment: (segment: RouteSegment, waypoint: [number, number]) => void
  clearRouteStore: () => void
  setLoading: (loading: boolean) => void
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
  setLoading,
  setError,
}: UseDataLoaderParams) {
  const [router, setRouter] = useState<Router | null>(null)
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [loadedBbox, setLoadedBbox] = useState<LoadedBbox | null>(null)

  const loadData = useCallback(
    async (
      onSuccess?: (router: Router, treatAsFirstWaypoint: boolean) => void,
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

        // Check if loading would clear existing route and confirm with user
        if (
          !skipConfirmation &&
          route &&
          wouldClearRoute(route.waypoints, bbox)
        ) {
          const confirmed = window.confirm(
            'Loading hiking paths for this area will clear your current route because some waypoints are outside the visible area. Continue?'
          )
          if (!confirmed) {
            return
          }
        }

        setLoading(true)
        setError(null)

        // Check if we have an existing route and preserve waypoints if they fit in new bbox
        let waypointsToPreserve: [number, number][] = []
        if (route) {
          waypointsToPreserve = shouldPreserveRoute(route, bbox)
          if (waypointsToPreserve.length === 0) {
            // Route doesn't fit in new bbox, clear it
            clearRoute()
            console.log('Route does not fit in new bbox, clearing')
          } else {
            console.log('Preserving route with waypoints:', waypointsToPreserve)
          }
        }

        const osmData = await fetchOSMData(bbox)

        const graph = buildRoutingGraph(osmData)
        console.log(
          `Loaded ${osmData.nodes.size} nodes, ${osmData.ways.length} ways`
        )
        console.log(`Built graph with ${graph.nodes.size} nodes`)

        const newRouter = new Router(graph)
        setRouter(newRouter)
        setLoadedBbox(bbox)
        setIsDataLoaded(true)

        // Track if we successfully preserved waypoints
        const hadPreservedWaypoints = waypointsToPreserve.length > 0

        // Recalculate route if we have preserved waypoints
        if (hadPreservedWaypoints) {
          // Map waypoints to nodes and recalculate route
          const nodeIds = mapWaypointsToNodes(newRouter, waypointsToPreserve)
          if (!nodeIds) {
            clearRoute()
            setLoading(false)
            return { router: newRouter, waypointNodeIds: [] }
          }

          const newSegments = recalculateRoute(
            newRouter,
            nodeIds,
            addSegment,
            clearRouteStore,
            waypointsToPreserve
          )

          if (newSegments.length === 0) {
            clearRoute()
            setLoading(false)
            return { router: newRouter, waypointNodeIds: [] }
          }

          setLoading(false)

          // Call success callback if provided
          if (onSuccess) {
            onSuccess(newRouter, false)
          }

          return { router: newRouter, waypointNodeIds: nodeIds }
        }

        setLoading(false)

        // Call success callback
        // Treat pending click as first waypoint only when we didn't preserve waypoints
        if (onSuccess) {
          onSuccess(newRouter, true)
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
        setLoading(false)
      }
    },
    [map, route, clearRoute, addSegment, clearRouteStore, setLoading, setError]
  )

  return {
    router,
    isDataLoaded,
    loadedBbox,
    loadData,
  }
}
