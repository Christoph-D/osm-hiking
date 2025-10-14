import { create } from 'zustand'
import {
  Route,
  RouteSegment,
  ElevationPoint,
  ElevationStats,
  RouteWaypoint,
} from '../types'

interface RouteState {
  route: Route | null
  error: string | null
  hoveredElevationPoint: ElevationPoint | null

  addSegment: (segment: RouteSegment, routeWaypoint: RouteWaypoint) => void
  setRoute: (route: Route) => void
  insertWaypoint: (
    index: number,
    routeWaypoint: RouteWaypoint,
    segments: RouteSegment[],
    totalDistance: number
  ) => void
  updateWaypoint: (
    index: number,
    routeWaypoint: RouteWaypoint,
    segments: RouteSegment[],
    totalDistance: number
  ) => void
  deleteWaypoint: (
    index: number,
    segments: RouteSegment[],
    totalDistance: number
  ) => void
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

      return {
        route: {
          segments: [...currentRoute.segments, segment],
          waypoints: [...currentRoute.waypoints, routeWaypoint],
          totalDistance: currentRoute.totalDistance + segment.distance,
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

  insertWaypoint: (index, routeWaypoint, segments, totalDistance) =>
    set((state) => {
      if (!state.route) return state
      const newRouteWaypoints = [...state.route.waypoints]

      newRouteWaypoints.splice(index, 0, routeWaypoint)

      return {
        route: {
          segments,
          waypoints: newRouteWaypoints,
          totalDistance,
          // Clear elevation data when route changes
          elevationProfile: undefined,
          elevationStats: undefined,
        },
      }
    }),

  updateWaypoint: (index, routeWaypoint, segments, totalDistance) =>
    set((state) => {
      if (!state.route) return state
      const newRouteWaypoints = [...state.route.waypoints]

      newRouteWaypoints[index] = routeWaypoint

      return {
        route: {
          segments,
          waypoints: newRouteWaypoints,
          totalDistance,
          // Clear elevation data when route changes
          elevationProfile: undefined,
          elevationStats: undefined,
        },
      }
    }),

  deleteWaypoint: (index, segments, totalDistance) =>
    set((state) => {
      if (!state.route) return state
      const newRouteWaypoints = [...state.route.waypoints]

      newRouteWaypoints.splice(index, 1)

      // If no waypoints left, clear the route
      if (newRouteWaypoints.length === 0) {
        return { route: null, error: null }
      }

      return {
        route: {
          segments,
          waypoints: newRouteWaypoints,
          totalDistance,
          // Clear elevation data when route changes
          elevationProfile: undefined,
          elevationStats: undefined,
        },
      }
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
