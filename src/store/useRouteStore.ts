import { create } from 'zustand'
import { Route, RouteSegment } from '../types'

interface RouteState {
  route: Route | null
  isLoading: boolean
  error: string | null

  addSegment: (segment: RouteSegment, waypoint: [number, number]) => void
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

  clearRoute: () => set({ route: null, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
