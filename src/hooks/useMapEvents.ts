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

import { useState, useEffect, useRef, RefObject } from 'react'
import { useMapEvents as useLeafletMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Router } from '../services/router'
import { isPointInBbox, getCurrentBbox } from '../utils/mapHelpers'

interface UseMapEventsParams {
  map: L.Map
  router: Router | null
  isDataLoaded: boolean
  loadedBbox: {
    south: number
    west: number
    north: number
    east: number
  } | null
  isProcessingMarkerClickRef: RefObject<boolean>
  processMapClick: (
    router: Router,
    lat: number,
    lng: number,
    treatAsFirstWaypoint?: boolean
  ) => void
  loadData: (
    onSuccess?: (router: Router, treatAsFirstWaypoint: boolean) => void,
    skipConfirmation?: boolean
  ) => Promise<{ router: Router; waypointNodeIds: string[] } | undefined>
}

interface MapBounds {
  south: number
  west: number
  north: number
  east: number
}

export function useMapEvents({
  map,
  router,
  isDataLoaded,
  loadedBbox,
  isProcessingMarkerClickRef,
  processMapClick,
  loadData,
}: UseMapEventsParams) {
  const [currentZoom, setCurrentZoom] = useState(map.getZoom())
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null)
  const [isCurrentViewLoaded, setIsCurrentViewLoaded] = useState(false)
  const pendingClick = useRef<{ lat: number; lng: number } | null>(null)

  // Initialize current bounds on mount
  useEffect(() => {
    const bounds = map.getBounds()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentBounds({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    })
  }, [map])

  // Update isCurrentViewLoaded when data is loaded
  useEffect(() => {
    if (isDataLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCurrentViewLoaded(true)
    }
  }, [isDataLoaded])

  useLeafletMapEvents({
    click(e) {
      // Ignore clicks that are from marker interactions
      if (isProcessingMarkerClickRef.current) {
        isProcessingMarkerClickRef.current = false
        return
      }

      const { lat, lng } = e.latlng

      // Check if data needs to be loaded
      const needsDataLoad =
        !router ||
        !isDataLoaded ||
        (loadedBbox && !isPointInBbox(lng, lat, loadedBbox))

      if (needsDataLoad) {
        // Store pending click and load data
        // loadData will handle zoom validation and route clearing confirmation
        pendingClick.current = { lat, lng }
        loadData((loadedRouter, treatAsFirstWaypoint) => {
          // Process the pending click after data loads
          if (pendingClick.current) {
            const pendingLat = pendingClick.current.lat
            const pendingLng = pendingClick.current.lng
            pendingClick.current = null
            // Process with the loaded router
            processMapClick(
              loadedRouter,
              pendingLat,
              pendingLng,
              treatAsFirstWaypoint
            )
          }
        })
        return
      }

      // Process the click normally
      if (router) {
        processMapClick(router, lat, lng)
      }
    },

    moveend() {
      // Update zoom level state and validate
      const zoom = map.getZoom()
      setCurrentZoom(zoom)

      // Update current bounds
      const bounds = getCurrentBbox(map)
      setCurrentBounds(bounds)

      // Mark that the view has changed, so button can be re-enabled
      setIsCurrentViewLoaded(false)
    },
  })

  return {
    currentZoom,
    currentBounds,
    isCurrentViewLoaded,
  }
}
