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

import { useState, RefObject } from 'react'
import { useMapEvents as useLeafletMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Router } from '../services/router'
import { Route, RouteWaypoint } from '../types'
import { isPointInBbox } from '../utils/mapHelpers'
import { useMapDataStore } from '../store/mapDataStore'

interface UseMapEventsParams {
  map: L.Map
  router: Router | null
  route: Route | null
  isDataLoaded: boolean
  loadedBbox: {
    south: number
    west: number
    north: number
    east: number
  } | null
  isDraggingMarkerRef: RefObject<boolean>
  processMapClick: (
    router: Router,
    lat: number,
    lng: number,
    route: Route | null
  ) => void
  loadData: (
    onSuccess?: (router: Router, currentRoute: Route | null) => void,
    skipConfirmation?: boolean
  ) => Promise<{ router: Router; waypointNodeIds: RouteWaypoint[] } | undefined>
}

export function useMapEvents({
  map,
  router,
  route,
  isDataLoaded,
  loadedBbox,
  isDraggingMarkerRef,
  processMapClick,
  loadData,
}: UseMapEventsParams) {
  const [currentZoom, setCurrentZoom] = useState(map.getZoom())
  const { setIsCurrentViewLoaded } = useMapDataStore()

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
          processMapClick(loadedRouter, lat, lng, currentRoute)
        })
        return
      }

      // Process the click normally
      if (router) {
        processMapClick(router, lat, lng, route)
      }
    },

    moveend() {
      // Update zoom level state and validate
      const zoom = map.getZoom()
      setCurrentZoom(zoom)

      // Mark that the view has changed, so button can be re-enabled
      setIsCurrentViewLoaded(false)
    },
  })

  return {
    currentZoom,
  }
}
