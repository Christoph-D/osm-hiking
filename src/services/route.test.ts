/**
 * Route Tests
 *
 * Tests for Route class functionality including:
 * - Route segment recalculation
 * - Mixed routing with node and custom waypoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './route'
import { Router } from './router'
import { createCustomWaypoint, createNodeWaypoint } from '../utils/mapHelpers'

// Mock router for testing
const createMockRouter = () => {
  const router = {
    findNearestNode: vi.fn(),
    getNode: vi.fn(),
    route: vi.fn(),
    createStraightSegment: vi.fn(),
  } as unknown as Router

  return router
}

describe('Route', () => {
  describe('recalculateAllSegments', () => {
    let router: Router

    beforeEach(() => {
      router = createMockRouter()
    })

    it('should calculate route with only node waypoints', () => {
      const routeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 1),
        createNodeWaypoint(51.0, 11.0, 2),
      ]

      const mockSegment = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 1000,
      }

      router.route = vi.fn().mockReturnValue(mockSegment)

      const result = Route.fromWaypoints(routeWaypoints, router)

      expect(router.route).toHaveBeenCalledWith(1, 2)
      expect(result.segments).toHaveLength(2) // First waypoint marker + route segment
      expect(result.totalDistance).toBe(1000)
      expect(result.waypoints).toEqual(routeWaypoints)
    })

    it('should calculate route with custom waypoints using straight lines', () => {
      const routeWaypoints = [
        createCustomWaypoint(50.0, 10.0),
        createCustomWaypoint(51.0, 11.0),
      ]

      const mockSegment = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 150000,
      }

      router.createStraightSegment = vi.fn().mockReturnValue(mockSegment)

      const result = Route.fromWaypoints(routeWaypoints, router)

      expect(router.createStraightSegment).toHaveBeenCalledWith(
        routeWaypoints[0],
        routeWaypoints[1]
      )
      expect(result.segments).toHaveLength(2) // First waypoint marker + straight segment
      expect(result.totalDistance).toBe(150000)
      expect(result.waypoints).toEqual(routeWaypoints)
    })

    it('should handle mixed node and custom waypoints', () => {
      const routeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 1),
        createCustomWaypoint(51.0, 11.0),
        createNodeWaypoint(52.0, 12.0, 3),
      ]

      const mockRouteSegment = {
        coordinates: [routeWaypoints[0], routeWaypoints[2]],
        distance: 2000,
      }
      const mockStraightSegment1 = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 150000,
      }
      const mockStraightSegment2 = {
        coordinates: [routeWaypoints[1], routeWaypoints[2]],
        distance: 150000,
      }

      router.route = vi.fn().mockReturnValue(mockRouteSegment)
      router.createStraightSegment = vi
        .fn()
        .mockReturnValueOnce(mockStraightSegment1)
        .mockReturnValueOnce(mockStraightSegment2)

      const result = Route.fromWaypoints(routeWaypoints, router)

      expect(router.createStraightSegment).toHaveBeenCalledTimes(2)
      expect(router.route).not.toHaveBeenCalled() // No consecutive node waypoints
      expect(result.segments).toHaveLength(3) // First waypoint + 2 segments
      expect(result.totalDistance).toBe(300000) // Sum of straight segments
      expect(result.waypoints).toEqual(routeWaypoints)
    })

    it('should preserve elevation profile and stats during recalculation', () => {
      const routeWaypoints = [
        createCustomWaypoint(50.0, 10.0),
        createCustomWaypoint(51.0, 11.0),
      ]

      const mockSegment = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 150000,
      }

      router.createStraightSegment = vi.fn().mockReturnValue(mockSegment)

      const elevationProfile = [
        { distance: 0, lat: 50.0, lon: 10.0, elevation: 100 },
        { distance: 150000, lat: 51.0, lon: 11.0, elevation: 150 },
      ]
      const elevationStats = {
        gain: 50,
        loss: 0,
        max: 150,
        min: 100,
      }

      const result = Route.fromWaypoints(
        routeWaypoints,
        router,
        elevationProfile,
        elevationStats
      )

      expect(result.elevationProfile).toEqual(elevationProfile)
      expect(result.elevationStats).toEqual(elevationStats)
    })

    it('should handle empty route gracefully', () => {
      const route = new Route([], [])
      const result = route.recalculateAllSegments(router)

      expect(result.segments).toHaveLength(0)
      expect(result.waypoints).toHaveLength(0)
      expect(result.totalDistance).toBe(0)
    })

    it('should handle single waypoint route', () => {
      const routeWaypoints = [createCustomWaypoint(50.0, 10.0)]
      const result = Route.fromWaypoints(routeWaypoints, router)

      expect(result.segments).toHaveLength(1) // Just the marker
      expect(result.segments[0].coordinates).toEqual([{ lat: 50.0, lon: 10.0 }])
      expect(result.segments[0].distance).toBe(0)
      expect(result.waypoints).toEqual(routeWaypoints)
    })
  })
})
