/**
 * Map Events Hook
 *
 * Custom React hook that handles Leaflet map events and user interactions.
 * This hook manages:
 * - Map click events (adding waypoints or triggering data load)
 * - Map movement events (updating zoom level and bounds)
 * - Automatic data loading when clicking outside loaded areas
 * - Tracking current view state for UI button states
 *
 * Coordinates between user clicks, data loading, and waypoint processing.
 */

import { useState, RefObject, useCallback } from 'react'
import { useMapEvents as useLeafletMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Router } from '../services/router'
import { Route } from '../services/route'
import {
  determineWaypointType,
  addWaypointToRoute,
  isPointInBbox,
} from '../utils/mapHelpers'
import { useMapDataStore } from '../store/mapDataStore'
import { useRouterStore } from '../store/routerStore'
import { useRouteStore } from '../store/useRouteStore'

interface MapCenter {
  lat: number
  lng: number
}

interface UseMapEventsParams {
  map: L.Map
  isDataLoaded: boolean
  loadedBbox: {
    south: number
    west: number
    north: number
    east: number
  } | null
  isDraggingMarkerRef: RefObject<boolean>
  loadData: (
    onSuccess?: (router: Router, currentRoute: Route | null) => void,
    skipConfirmation?: boolean
  ) => Promise<void>
}

export function useMapEvents({
  map,
  isDataLoaded,
  loadedBbox,
  isDraggingMarkerRef,
  loadData,
}: UseMapEventsParams) {
  const [currentZoom, setCurrentZoom] = useState(map.getZoom())
  const [mapCenter, setMapCenter] = useState<MapCenter>(() => {
    const center = map.getCenter()
    return { lat: center.lat, lng: center.lng }
  })
  const { setIsCurrentViewLoaded } = useMapDataStore()
  const { router } = useRouterStore()
  const { route, setRoute, setError } = useRouteStore()

  const processMapClick = useCallback(
    (
      router: Router,
      lat: number,
      lng: number,
      route: Route | null,
      mapCenter: { lat: number; lng: number },
      currentZoom: number
    ) => {
      // Determine waypoint type based on distance to nearest node
      const routeWaypoint = determineWaypointType(
        lat,
        lng,
        router,
        mapCenter,
        currentZoom
      )

      if (!routeWaypoint) {
        setError('Invalid location selected.')
        return
      }

      setError(null)

      // First waypoint - just mark it
      if (!route || route.waypoints.length === 0) {
        const newRoute = new Route(
          [
            {
              coordinates: [{ lat: routeWaypoint.lat, lon: routeWaypoint.lon }],
              distance: 0,
            },
          ],
          [routeWaypoint]
        )
        setRoute(newRoute)
        return
      }

      // For subsequent waypoints, add waypoint to route with optimized recalculation
      const newRoute = addWaypointToRoute(route, routeWaypoint, router)
      setRoute(newRoute)
    },
    [setRoute, setError]
  )

  useLeafletMapEvents({
    click(e) {
      // Ignore clicks during marker drag to prevent duplicate markers
      if (isDraggingMarkerRef.current) {
        return
      }

      const { lat, lng } = e.latlng

      // Check if data needs to be loaded
      const needsDataLoad =
        !router ||
        !isDataLoaded ||
        (loadedBbox && !isPointInBbox(lat, lng, loadedBbox))

      if (needsDataLoad) {
        // Store pending click and load data
        // loadData will handle zoom validation and route clearing confirmation
        loadData((loadedRouter, currentRoute) => {
          // Process the pending click after data loads
          // Process with the loaded router and current route
          processMapClick(
            loadedRouter,
            lat,
            lng,
            currentRoute,
            mapCenter,
            currentZoom
          )
        })
        return
      }

      // Process the click normally
      if (router) {
        processMapClick(router, lat, lng, route, mapCenter, currentZoom)
      }
    },

    moveend() {
      // Update zoom level state and validate
      const zoom = map.getZoom()
      setCurrentZoom(zoom)

      const center = map.getCenter()
      setMapCenter({ lat: center.lat, lng: center.lng })

      // Mark that the view has changed, so button can be re-enabled
      setIsCurrentViewLoaded(false)
    },
  })

  return {
    currentZoom,
    mapCenter,
  }
}
