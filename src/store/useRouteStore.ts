import { create } from 'zustand'
import { Route, RouteSegment, ElevationPoint, ElevationStats } from '../types'

interface RouteState {
  route: Route | null
  isLoading: boolean
  isLoadingElevation: boolean
  error: string | null
  hoveredElevationPoint: ElevationPoint | null

  addSegment: (segment: RouteSegment, waypoint: [number, number]) => void
  updateWaypoint: (index: number, waypoint: [number, number], segments: RouteSegment[], totalDistance: number) => void
  deleteWaypoint: (index: number, segments: RouteSegment[], totalDistance: number) => void
  clearRoute: () => void
  setLoading: (loading: boolean) => void
  setLoadingElevation: (loading: boolean) => void
  setError: (error: string | null) => void
  setElevationData: (profile: ElevationPoint[], stats: ElevationStats) => void
  setHoveredElevationPoint: (point: ElevationPoint | null) => void
}

export const useRouteStore = create<RouteState>((set) => ({
  route: null,
  isLoading: false,
  isLoadingElevation: false,
  error: null,
  hoveredElevationPoint: null,

  addSegment: (segment, waypoint) => set((state) => {
    const currentRoute = state.route || { segments: [], waypoints: [], totalDistance: 0 }
    return {
      route: {
        segments: [...currentRoute.segments, segment],
        waypoints: [...currentRoute.waypoints, waypoint],
        totalDistance: currentRoute.totalDistance + segment.distance,
        // Clear elevation data when route changes
        elevationProfile: undefined,
        elevationStats: undefined,
      },
    }
  }),

  updateWaypoint: (index, waypoint, segments, totalDistance) => set((state) => {
    if (!state.route) return state
    const newWaypoints = [...state.route.waypoints]
    newWaypoints[index] = waypoint
    return {
      route: {
        segments,
        waypoints: newWaypoints,
        totalDistance,
        // Clear elevation data when route changes
        elevationProfile: undefined,
        elevationStats: undefined,
      },
    }
  }),

  deleteWaypoint: (index, segments, totalDistance) => set((state) => {
    if (!state.route) return state
    const newWaypoints = [...state.route.waypoints]
    newWaypoints.splice(index, 1)

    // If no waypoints left, clear the route
    if (newWaypoints.length === 0) {
      return { route: null, error: null }
    }

    return {
      route: {
        segments,
        waypoints: newWaypoints,
        totalDistance,
        // Clear elevation data when route changes
        elevationProfile: undefined,
        elevationStats: undefined,
      },
    }
  }),

  clearRoute: () => set({ route: null, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingElevation: (loading) => set({ isLoadingElevation: loading }),
  setError: (error) => set({ error }),

  setElevationData: (profile, stats) => set((state) => {
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
