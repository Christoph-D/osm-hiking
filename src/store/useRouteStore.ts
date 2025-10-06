import { create } from 'zustand'
import { Route, RouteSegment } from '../types'

interface RouteState {
  route: Route | null
  isLoading: boolean
  error: string | null

  addSegment: (segment: RouteSegment, waypoint: [number, number]) => void
  updateWaypoint: (index: number, waypoint: [number, number], segments: RouteSegment[], totalDistance: number) => void
  deleteWaypoint: (index: number, segments: RouteSegment[], totalDistance: number) => void
  clearRoute: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useRouteStore = create<RouteState>((set) => ({
  route: null,
  isLoading: false,
  error: null,

  addSegment: (segment, waypoint) => set((state) => {
    const currentRoute = state.route || { segments: [], waypoints: [], totalDistance: 0 }
    return {
      route: {
        segments: [...currentRoute.segments, segment],
        waypoints: [...currentRoute.waypoints, waypoint],
        totalDistance: currentRoute.totalDistance + segment.distance,
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
      },
    }
  }),

  clearRoute: () => set({ route: null, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
