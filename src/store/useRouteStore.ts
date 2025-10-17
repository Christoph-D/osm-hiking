import { create } from 'zustand'
import { ElevationPoint, ElevationStats } from '../types'
import { Route } from '../services/route'

interface RouteState {
  route: Route | null
  error: string | null
  hoveredElevationPoint: ElevationPoint | null

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

  setRoute: (route) =>
    set({
      route: new Route(
        route.segments,
        route.waypoints,
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
          profile,
          stats
        ),
      }
    }),

  setHoveredElevationPoint: (point) => set({ hoveredElevationPoint: point }),
}))
