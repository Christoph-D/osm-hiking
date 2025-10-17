import { create } from 'zustand'
import {
  RouteSegment,
  ElevationPoint,
  ElevationStats,
  RouteWaypoint,
} from '../types'
import { Route } from '../services/route'
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
      const currentRoute = state.route || new Route([], [], 0)

      const newSegments = [...currentRoute.segments, segment]
      const totalDistance = calculateTotalDistance(newSegments)

      return {
        route: new Route(
          newSegments,
          [...currentRoute.waypoints, routeWaypoint],
          totalDistance,
          // Clear elevation data when route changes
          undefined,
          undefined
        ),
      }
    }),

  setRoute: (route) =>
    set({
      route: new Route(
        route.segments,
        route.waypoints,
        route.totalDistance,
        // Clear elevation data when route changes
        undefined,
        undefined
      ),
    }),

  clearRoute: () => set({ route: null, error: null }),
  setError: (error) => set({ error }),

  setElevationData: (profile, stats) =>
    set((state) => {
      if (!state.route) return state
      return {
        route: new Route(
          state.route.segments,
          state.route.waypoints,
          state.route.totalDistance,
          profile,
          stats
        ),
      }
    }),

  setHoveredElevationPoint: (point) => set({ hoveredElevationPoint: point }),
}))
