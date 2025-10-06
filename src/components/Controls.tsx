import { useRouteStore } from '../store/useRouteStore'
import { exportRouteAsGPX } from '../services/gpxExport'

interface ControlsProps {
  onLoadData: () => void
  onClearRoute: () => void
  isDataLoaded: boolean
  zoom: number
}

export function Controls({ onLoadData, onClearRoute, isDataLoaded, zoom }: ControlsProps) {
  const { route, isLoading, error } = useRouteStore()

  const handleExport = () => {
    if (route) {
      exportRouteAsGPX(route)
    }
  }

  const handleClear = () => {
    onClearRoute()
  }

  const handleLoadData = () => {
    onLoadData()
  }

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
        <h3 className="font-bold text-lg mb-2">Route Planner</h3>

        {isLoading && (
          <div className="text-sm text-gray-600 mb-2">
            Loading map data...
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
              <strong>Distance:</strong> {(route.totalDistance / 1000).toFixed(2)} km
            </p>
            <p className="text-sm text-gray-700">
              <strong>Waypoints:</strong> {route.waypoints.length}
            </p>
          </div>
        )}

        <div className="mb-3">
          <p className="text-xs text-gray-600">
            <strong>Zoom:</strong> {zoom.toFixed(1)} {zoom < 13 && '(zoom in to 13+)'}
          </p>
          {isDataLoaded && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Data loaded for this area
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleLoadData}
            disabled={isLoading || zoom < 13}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            Reload Data
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
            Zoom to level 13+, click "Reload Data", then click on the map to create waypoints.
          </p>
        </div>
      </div>
    </div>
  )
}
