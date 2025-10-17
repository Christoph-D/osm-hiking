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
import { Route, RouteWaypoint } from '../types'
import { getCurrentBbox, wouldClearRoute } from '../utils/mapHelpers'
import { MIN_ZOOM } from '../constants/map'
import { recalculateAllSegments } from '../utils/mapHelpers'
import { useMapDataStore } from '../store/mapDataStore'
import { useRouterStore } from '../store/routerStore'
import { useRouteStore } from '../store/useRouteStore'

/**
 * Map waypoint coordinates to nearest nodes in the routing graph
 * @param router The router instance
 * @param waypoints Array of waypoint coordinates
 * @returns Array of RouteWaypoint objects (NodeWaypoint for mapped waypoints, CustomWaypoint for unmapped ones)
 */
function mapWaypointsToNodes(
  router: Router,
  waypoints: RouteWaypoint[]
): RouteWaypoint[] {
  const routeWaypoints: RouteWaypoint[] = []

  for (let i = 0; i < waypoints.length; i++) {
    const waypoint = waypoints[i]
    if (waypoint.type == 'custom') {
      // Don't remap custom waypoints
      routeWaypoints.push(waypoint)
      continue
    }

    const nearestNode = router.findNearestNode(waypoint.lat, waypoint.lon, 500)

    if (nearestNode) {
      // Successfully mapped to node - create NodeWaypoint
      routeWaypoints.push({
        type: 'node' as const,
        lat: nearestNode.node.lat,
        lon: nearestNode.node.lon,
        nodeId: nearestNode.nodeId,
      })
    } else {
      // Couldn't map to node - create CustomWaypoint
      routeWaypoints.push({
        type: 'custom' as const,
        lat: waypoint.lat,
        lon: waypoint.lon,
      })
    }
  }

  return routeWaypoints
}

interface UseDataLoaderParams {
  map: L.Map
  route: Route | null
}

interface LoadedBbox {
  south: number
  west: number
  north: number
  east: number
}

export function useDataLoader({ map, route }: UseDataLoaderParams) {
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [loadedBbox, setLoadedBbox] = useState<LoadedBbox | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { setIsCurrentViewLoaded } = useMapDataStore()
  const { setRouter } = useRouterStore()
  const { clearRoute, setError, setRoute } = useRouteStore()

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
        }

        const osmData = await fetchOSMData(bbox)
        setIsLoading(false)

        const graph = buildRoutingGraph(osmData)

        const newRouter = new Router(graph)
        setRouter(newRouter)
        // Clear the old route because it is incompatible with the new router (different or missing node ids)
        clearRoute()
        setLoadedBbox(bbox)
        setIsDataLoaded(true)
        setIsCurrentViewLoaded(true)

        // Recalculate route if we have preserved waypoints
        let newRoute = null
        if (waypointsToPreserve.length > 0) {
          const routeWaypoints = mapWaypointsToNodes(
            newRouter,
            waypointsToPreserve
          )
          newRoute = recalculateAllSegments(routeWaypoints, newRouter)
          setRoute(newRoute)
        }
        if (onSuccess) {
          onSuccess(newRouter, newRoute)
        }
      } catch (error) {
        console.error('Failed to load OSM data:', error)
        const currentZoom = map.getZoom()
        const maxZoom = map.getMaxZoom()
        const errorMessage =
          currentZoom < maxZoom
            ? 'Failed to load map data. Try zooming in more and try again.'
            : 'Failed to load map data. Please try again.'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [
      map,
      route,
      clearRoute,
      setRoute,
      setError,
      setIsCurrentViewLoaded,
      setRouter,
    ]
  )

  return {
    isDataLoaded,
    loadedBbox,
    loadData,
    isLoading,
  }
}
