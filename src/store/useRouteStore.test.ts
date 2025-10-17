import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRouteStore } from './useRouteStore'
import {
  RouteSegment,
  ElevationPoint,
  ElevationStats,
  Waypoint,
  CustomWaypoint,
} from '../types'

// Helper function to create a custom waypoint for tests
function createTestWaypoint(lat: number, lon: number): CustomWaypoint {
  return {
    type: 'custom',
    lat,
    lon,
  }
}

// Mock the Route module
vi.mock('../services/route', () => ({
  Route: vi.fn((segments, waypoints, elevationProfile, elevationStats) => {
    // Enforce the new segment structure: segments.length === waypoints.length - 1
    const expectedSegmentsLength = Math.max(0, waypoints.length - 1)
    if (segments.length !== expectedSegmentsLength) {
      throw new Error(
        `Segments length must be waypoints.length - 1. Got ${segments.length} segments and ${waypoints.length} waypoints (expected ${expectedSegmentsLength} segments).`
      )
    }

    // Create a mock Route object that has the same interface as the real Route
    const totalDistance = segments.reduce(
      (sum: number, segment: { distance: number }) => sum + segment.distance,
      0
    )
    return {
      segments,
      waypoints,
      totalDistance,
      elevationProfile,
      elevationStats,
    }
  }),
}))

describe('useRouteStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useRouteStore.setState({
      route: null,
      error: null,
      hoveredElevationPoint: null,
    })
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useRouteStore.getState()

      expect(state.route).toBeNull()
      expect(state.error).toBeNull()
      expect(state.hoveredElevationPoint).toBeNull()
    })
  })

  describe('addSegment', () => {
    it('should add first segment and waypoint to empty route', () => {
      const segment: RouteSegment = {
        coordinates: [
          { lat: 50.0, lon: 10.0 },
          { lat: 50.1, lon: 10.1 },
        ],
        distance: 1000,
      }
      const routeWaypoint = createTestWaypoint(50.0, 10.0)

      useRouteStore.getState().addSegment(segment, routeWaypoint)

      const state = useRouteStore.getState()
      expect(state.route).not.toBeNull()
      expect(state.route?.segments).toHaveLength(0) // First waypoint creates 0 segments
      expect(state.route?.waypoints).toHaveLength(1)
      expect(state.route?.waypoints[0]).toEqual(routeWaypoint)
      expect(state.route?.totalDistance).toBe(0) // No segments = no distance
    })

    it('should add segment to existing route', () => {
      const segment1: RouteSegment = {
        coordinates: [
          { lat: 50.0, lon: 10.0 },
          { lat: 50.1, lon: 10.1 },
        ],
        distance: 1000,
      }
      const segment2: RouteSegment = {
        coordinates: [
          { lat: 50.1, lon: 10.1 },
          { lat: 50.2, lon: 10.2 },
        ],
        distance: 1500,
      }

      const routeWaypoint1 = createTestWaypoint(50.0, 10.0)
      const routeWaypoint2 = createTestWaypoint(50.1, 10.1)

      useRouteStore.getState().addSegment(segment1, routeWaypoint1)
      useRouteStore.getState().addSegment(segment2, routeWaypoint2)

      const state = useRouteStore.getState()
      expect(state.route?.segments).toHaveLength(1) // 2 waypoints = 1 segment
      expect(state.route?.waypoints).toHaveLength(2)
      expect(state.route?.totalDistance).toBe(1500) // Only the second segment is created
    })

    it('should calculate total distance correctly', () => {
      const segments = [
        {
          coordinates: [
            { lat: 50.0, lon: 10.0 },
            { lat: 50.1, lon: 10.1 },
          ],
          distance: 500,
        },
        {
          coordinates: [
            { lat: 50.1, lon: 10.1 },
            { lat: 50.2, lon: 10.2 },
          ],
          distance: 700,
        },
        {
          coordinates: [
            { lat: 50.2, lon: 10.2 },
            { lat: 50.3, lon: 10.3 },
          ],
          distance: 300,
        },
      ] as RouteSegment[]

      segments.forEach((seg) => {
        const waypoint = {
          lat: seg.coordinates[0].lat,
          lon: seg.coordinates[0].lon,
        }
        const routeWaypoint = createTestWaypoint(waypoint.lat, waypoint.lon)
        useRouteStore.getState().addSegment(seg, routeWaypoint)
      })

      const state = useRouteStore.getState()
      // With 4 waypoints (first creates no segment, then 3 more segments), we get 3 segments
      // The first segment is not added (first waypoint), so total is 700 + 300 = 1000
      expect(state.route?.totalDistance).toBe(1000)
    })

    it('should clear elevation data when adding segment', () => {
      // Add initial waypoint with elevation data
      const segment1: RouteSegment = {
        coordinates: [
          { lat: 50.0, lon: 10.0 },
          { lat: 50.1, lon: 10.1 },
        ],
        distance: 1000,
      }
      const routeWaypoint = createTestWaypoint(50.0, 10.0)
      useRouteStore.getState().addSegment(segment1, routeWaypoint)

      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }
      useRouteStore.getState().setElevationData(profile, stats)

      // Add another waypoint (this will create first segment)
      const segment2: RouteSegment = {
        coordinates: [
          { lat: 50.1, lon: 10.1 },
          { lat: 50.2, lon: 10.2 },
        ],
        distance: 1000,
      }
      const routeWaypoint2 = createTestWaypoint(50.1, 10.1)
      useRouteStore.getState().addSegment(segment2, routeWaypoint2)

      const state = useRouteStore.getState()
      expect(state.route?.elevationProfile).toBeUndefined()
      expect(state.route?.elevationStats).toBeUndefined()
    })
  })

  describe('clearRoute', () => {
    it('should reset route to null', () => {
      const segment: RouteSegment = {
        coordinates: [
          { lat: 50.0, lon: 10.0 },
          { lat: 50.1, lon: 10.1 },
        ],
        distance: 1000,
      }
      const routeWaypoint = createTestWaypoint(50.0, 10.0)
      useRouteStore.getState().addSegment(segment, routeWaypoint)

      useRouteStore.getState().clearRoute()

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
    })

    it('should clear error when clearing route', () => {
      useRouteStore.setState({ error: 'Some error' })

      useRouteStore.getState().clearRoute()

      const state = useRouteStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      useRouteStore.getState().setError('Test error')

      const state = useRouteStore.getState()
      expect(state.error).toBe('Test error')
    })

    it('should clear error message', () => {
      useRouteStore.setState({ error: 'Some error' })
      useRouteStore.getState().setError(null)

      const state = useRouteStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setElevationData', () => {
    beforeEach(() => {
      // Set up a route with one waypoint first
      const segment: RouteSegment = {
        coordinates: [
          { lat: 50.0, lon: 10.0 },
          { lat: 50.1, lon: 10.1 },
        ],
        distance: 1000,
      }
      const routeWaypoint = createTestWaypoint(50.0, 10.0)
      useRouteStore.getState().addSegment(segment, routeWaypoint)
    })

    it('should store elevation profile and stats', () => {
      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
        { distance: 500, elevation: 150, lat: 50.05, lon: 10.05 },
        { distance: 1000, elevation: 200, lat: 50.1, lon: 10.1 },
      ]
      const stats: ElevationStats = {
        gain: 100,
        loss: 0,
        min: 100,
        max: 200,
      }

      useRouteStore.getState().setElevationData(profile, stats)

      const state = useRouteStore.getState()
      expect(state.route?.elevationProfile).toEqual(profile)
      expect(state.route?.elevationStats).toEqual(stats)
    })

    it('should return unchanged state if no route exists', () => {
      useRouteStore.setState({ route: null })

      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }

      useRouteStore.getState().setElevationData(profile, stats)

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
    })

    it('should preserve other route properties when setting elevation data', () => {
      const originalRoute = useRouteStore.getState().route

      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }

      useRouteStore.getState().setElevationData(profile, stats)

      const state = useRouteStore.getState()
      expect(state.route?.segments).toEqual(originalRoute?.segments)
      expect(state.route?.waypoints).toEqual(originalRoute?.waypoints)
      expect(state.route?.totalDistance).toEqual(originalRoute?.totalDistance)
    })
  })

  describe('setHoveredElevationPoint', () => {
    it('should set hovered elevation point', () => {
      const point: ElevationPoint = {
        distance: 500,
        elevation: 150,
        lat: 50.05,
        lon: 10.05,
      }

      useRouteStore.getState().setHoveredElevationPoint(point)

      const state = useRouteStore.getState()
      expect(state.hoveredElevationPoint).toEqual(point)
    })

    it('should clear hovered elevation point', () => {
      const point: ElevationPoint = {
        distance: 500,
        elevation: 150,
        lat: 50.05,
        lon: 10.05,
      }
      useRouteStore.setState({ hoveredElevationPoint: point })

      useRouteStore.getState().setHoveredElevationPoint(null)

      const state = useRouteStore.getState()
      expect(state.hoveredElevationPoint).toBeNull()
    })
  })

  describe('complex scenarios', () => {
    it('should maintain waypoint order through multiple operations', () => {
      const waypoints: Waypoint[] = [
        { lat: 50.0, lon: 10.0 },
        { lat: 50.1, lon: 10.1 },
        { lat: 50.2, lon: 10.2 },
        { lat: 50.3, lon: 10.3 },
      ]

      waypoints.forEach((wp) => {
        const segment: RouteSegment = {
          coordinates: [
            { lat: wp.lat, lon: wp.lon },
            { lat: wp.lat + 0.01, lon: wp.lon + 0.01 },
          ],
          distance: 100,
        }
        const routeWaypoint = createTestWaypoint(wp.lat, wp.lon)
        useRouteStore.getState().addSegment(segment, routeWaypoint)
      })

      const state = useRouteStore.getState()
      expect(
        state.route?.waypoints.map((ewp) => ({ lat: ewp.lat, lon: ewp.lon }))
      ).toEqual(waypoints)
    })

    it('should handle complete route lifecycle', () => {
      // Add waypoints
      const segment1: RouteSegment = {
        coordinates: [
          { lat: 50.0, lon: 10.0 },
          { lat: 50.1, lon: 10.1 },
        ],
        distance: 1000,
      }
      const routeWaypoint1 = createTestWaypoint(50.0, 10.0)
      const routeWaypoint2 = createTestWaypoint(50.1, 10.1)
      useRouteStore.getState().addSegment(segment1, routeWaypoint1)
      useRouteStore.getState().addSegment(segment1, routeWaypoint2)

      // Set elevation data
      const profile: ElevationPoint[] = [
        { distance: 0, elevation: 100, lat: 50.0, lon: 10.0 },
      ]
      const stats: ElevationStats = { gain: 0, loss: 0, min: 100, max: 100 }
      useRouteStore.getState().setElevationData(profile, stats)

      // Clear route
      useRouteStore.getState().clearRoute()

      const state = useRouteStore.getState()
      expect(state.route).toBeNull()
      expect(state.error).toBeNull()
    })

    it('should handle error state with route data', () => {
      const segment: RouteSegment = {
        coordinates: [
          { lat: 50.0, lon: 10.0 },
          { lat: 50.1, lon: 10.1 },
        ],
        distance: 1000,
      }
      const routeWaypoint = createTestWaypoint(50.0, 10.0)
      useRouteStore.getState().addSegment(segment, routeWaypoint)
      useRouteStore.getState().setError('Failed to fetch elevation')

      const state = useRouteStore.getState()
      expect(state.route).not.toBeNull()
      expect(state.error).toBe('Failed to fetch elevation')
    })
  })
})
