/**
 * Elevation Data Hook
 *
 * Custom React hook that orchestrates the elevation data workflow for a route.
 * This hook coordinates with the elevation service to:
 * - Collect route coordinates
 * - Subdivide the route into equally spaced points
 * - Fetch elevation data from an external API
 * - Build elevation profile with distance information
 * - Calculate elevation statistics (gain, loss, min, max)
 * - Update the route store with the results
 *
 * Automatically triggers when a route is added or modified.
 * Complex operations are delegated to the elevation service.
 */

import { useEffect } from 'react'
import {
  fetchElevations,
  subdividePathEqually,
  calculateElevationStats,
  calculateSubdividedDistances,
  buildElevationProfile,
} from '../services/elevation'
import { calculateDistances } from '../utils/geoCalculations'
import { ElevationPoint } from '../types'
import { Route } from '../services/route'

interface UseElevationDataParams {
  route: Route | null
  setElevationData: (
    profile: ElevationPoint[],
    stats: ReturnType<typeof calculateElevationStats>
  ) => void
}

/**
 * Hook to fetch and calculate elevation data for a route
 */
export function useElevationLoader({
  route,
  setElevationData,
}: UseElevationDataParams) {
  useEffect(() => {
    if (!route || route.waypoints.length < 2) {
      return
    }

    // Don't refetch if we already have elevation data
    if (route.elevationProfile) {
      return
    }

    const fetchElevationData = async () => {
      try {
        // Collect all coordinates from all segments in order
        const allCoordinates = route.collectRouteCoordinates()

        // Subdivide the path into equally spaced points
        const numPoints = 70
        const equallySpacedCoords = subdividePathEqually(
          allCoordinates,
          numPoints
        )

        // Fetch elevations for all equally spaced points
        const elevations = await fetchElevations(equallySpacedCoords)

        // Calculate cumulative distances along the original path
        // We need this to properly map each subdivided point to its distance
        const originalDistances = calculateDistances(allCoordinates)

        // Calculate theoretical distances for subdivided points
        const distances = calculateSubdividedDistances(
          originalDistances,
          numPoints
        )

        // Build elevation profile
        const elevationProfile = buildElevationProfile(
          equallySpacedCoords,
          elevations,
          distances
        )

        // Calculate stats
        const elevationStats = calculateElevationStats(elevations)

        // Update store
        setElevationData(elevationProfile, elevationStats)
      } catch (error) {
        console.error('Failed to fetch elevation data:', error)
      }
    }

    fetchElevationData()
  }, [route, setElevationData])
}
