import { create } from 'zustand'
import {
  Route,
  RouteSegment,
  ElevationPoint,
  ElevationStats,
  RouteWaypoint,
} from '../types'
import { calculateTotalDistance } from '../utils/mapHelpers'

interface RouteState {
  route: Route | null
  error: string | null
  hoveredElevationPoint: ElevationPoint | null

  addSegment: (segment: RouteSegment, routeWaypoint: RouteWaypoint) => void
  setRoute: (route: Route) => void
  clearRoute: () => void
  setError: (error: string | null) => void
  setElevationData: (profile: ElevationPoint[], stats: ElevationStats) => void
  setHoveredElevationPoint: (point: ElevationPoint | null) => void
}

export const useRouteStore = create<RouteState>((set) => ({
  route: null,
  error: null,
  hoveredElevationPoint: null,

  addSegment: (segment, routeWaypoint) =>
    set((state) => {
      const currentRoute = state.route || {
        segments: [],
        waypoints: [],
        totalDistance: 0,
      }

      const newSegments = [...currentRoute.segments, segment]
      const totalDistance = calculateTotalDistance(newSegments)

      return {
        route: {
          segments: newSegments,
          waypoints: [...currentRoute.waypoints, routeWaypoint],
          totalDistance,
          // Clear elevation data when route changes
          elevationProfile: undefined,
          elevationStats: undefined,
        },
      }
    }),

  setRoute: (route) =>
    set({
      route: {
        ...route,
        // Clear elevation data when route changes
        elevationProfile: undefined,
        elevationStats: undefined,
      },
    }),

  clearRoute: () => set({ route: null, error: null }),
  setError: (error) => set({ error }),

  setElevationData: (profile, stats) =>
    set((state) => {
      if (!state.route) return state
      return {
        route: {
          ...state.route,
          elevationProfile: profile,
          elevationStats: stats,
        },
      }
    }),

  setHoveredElevationPoint: (point) => set({ hoveredElevationPoint: point }),
}))
