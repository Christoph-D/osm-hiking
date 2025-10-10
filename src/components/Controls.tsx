import { useRef, useEffect } from 'react'
import { DomEvent } from 'leaflet'
import { useRouteStore } from '../store/useRouteStore'
import { exportRouteAsGPX } from '../services/gpxExport'

interface ControlsProps {
  onLoadData: () => void
  onClearRoute: () => void
  isDataLoaded: boolean
  zoom: number
  mapBounds: { south: number; west: number; north: number; east: number } | null
}

export function Controls({
  onLoadData,
  onClearRoute,
  isDataLoaded,
  zoom,
  mapBounds,
}: ControlsProps) {
  const { route, isLoading, error } = useRouteStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      // Disable all map interactions on this element
      DomEvent.disableClickPropagation(container)
      DomEvent.disableScrollPropagation(container)
    }
  }, [])

  const handleExport = async () => {
    if (route) {
      try {
        await exportRouteAsGPX(route)
      } catch (error) {
        console.error('Failed to export GPX:', error)
      }
    }
  }

  const handleClear = () => {
    onClearRoute()
  }

  const handleLoadData = () => {
    // Check if there's an active route and if it would be cleared
    if (route && route.waypoints.length > 0 && mapBounds) {
      // Check if all waypoints fit in the new bounds
      const allWaypointsFit = route.waypoints.every(
        ([lon, lat]) =>
          lat >= mapBounds.south &&
          lat <= mapBounds.north &&
          lon >= mapBounds.west &&
          lon <= mapBounds.east
      )

      // Only show confirmation if route would be cleared
      if (!allWaypointsFit) {
        const confirmed = window.confirm(
          'Reloading hiking paths will clear your current route because some waypoints are outside the visible area. Continue?'
        )
        if (!confirmed) {
          return
        }
      }
    }
    onLoadData()
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-4 right-4 z-[1000] flex flex-col gap-2"
    >
      <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
        <h3 className="font-bold text-lg mb-2">Route Planner</h3>

        {isLoading && (
          <div className="text-sm text-gray-600 mb-2">
            Loading hiking paths...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 mb-2 p-2 bg-red-50 rounded">
            {error}
          </div>
        )}

        {route && (
          <div className="mb-3">
            <p className="text-sm text-gray-700">
              <strong>Distance:</strong>{' '}
              {(route.totalDistance / 1000).toFixed(2)} km
            </p>
            <p className="text-sm text-gray-700">
              <strong>Waypoints:</strong> {route.waypoints.length}
            </p>
          </div>
        )}

        <div className="mb-3">
          {zoom < 13 && (
            <p className="text-xs text-gray-600">
              Please zoom in more to load hiking paths
            </p>
          )}
          {isDataLoaded && (
            <p className="text-xs text-green-600 mt-1">✓ Hiking paths loaded</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleLoadData}
            disabled={isLoading || zoom < 13}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            Load Hiking Paths
          </button>
          <button
            onClick={handleExport}
            disabled={!route || route.waypoints.length < 2}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            Export GPX
          </button>
          <button
            onClick={handleClear}
            disabled={!route}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            Clear Route
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            Zoom in enough, click "Load Hiking Paths", then click on the map to
            create waypoints.
          </p>
        </div>
      </div>
    </div>
  )
}
