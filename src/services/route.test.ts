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

  describe('deleteWaypoint', () => {
    let router: Router
    let route: Route

    beforeEach(() => {
      router = createMockRouter()
      const routeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 1),
        createCustomWaypoint(51.0, 11.0),
        createNodeWaypoint(52.0, 12.0, 3),
      ]

      const mockSegment = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 1000,
      }
      const mockSegment2 = {
        coordinates: [routeWaypoints[1], routeWaypoints[2]],
        distance: 1500,
      }

      router.createStraightSegment = vi
        .fn()
        .mockReturnValueOnce(mockSegment)
        .mockReturnValueOnce(mockSegment2)

      route = Route.fromWaypoints(routeWaypoints, router)

      // Reset mocks after creating the route to avoid call count issues in tests
      vi.clearAllMocks()
    })

    it('should delete the first waypoint and recalculate all segments', () => {
      const newSegment = {
        coordinates: [route.waypoints[1], route.waypoints[2]],
        distance: 1200,
      }
      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = route.deleteWaypoint(0, router)

      expect(result.waypoints).toHaveLength(2)
      expect(result.waypoints).toEqual([
        createCustomWaypoint(51.0, 11.0),
        createNodeWaypoint(52.0, 12.0, 3),
      ])
      expect(result.segments).toHaveLength(2)
      expect(router.createStraightSegment).toHaveBeenCalledWith(
        createCustomWaypoint(51.0, 11.0),
        createNodeWaypoint(52.0, 12.0, 3)
      )
    })

    it('should delete the middle waypoint and recalculate affected segment', () => {
      const newSegment = {
        coordinates: [route.waypoints[0], route.waypoints[2]],
        distance: 2500,
      }
      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = route.deleteWaypoint(1, router)

      expect(result.waypoints).toHaveLength(2)
      expect(result.waypoints).toEqual([
        createNodeWaypoint(50.0, 10.0, 1),
        createNodeWaypoint(52.0, 12.0, 3),
      ])
      expect(result.segments).toHaveLength(2)
      expect(router.createStraightSegment).toHaveBeenCalledWith(
        createNodeWaypoint(50.0, 10.0, 1),
        createNodeWaypoint(52.0, 12.0, 3)
      )
    })

    it('should delete the last waypoint', () => {
      const result = route.deleteWaypoint(2, router)

      expect(result.waypoints).toHaveLength(2)
      expect(result.waypoints).toEqual([
        createNodeWaypoint(50.0, 10.0, 1),
        createCustomWaypoint(51.0, 11.0),
      ])
      expect(result.segments).toHaveLength(2)
      // No new routing calls needed since we're just removing the last segment
    })

    it('should return empty route when deleting last waypoint', () => {
      const singleWaypointRoute = Route.fromWaypoints(
        [createCustomWaypoint(50.0, 10.0)],
        router
      )
      const result = singleWaypointRoute.deleteWaypoint(0, router)

      expect(result.waypoints).toHaveLength(0)
      expect(result.segments).toHaveLength(0)
      expect(result.totalDistance).toBe(0)
    })

    it('should preserve elevation data after deletion', () => {
      const elevationProfile = [
        { distance: 0, lat: 50.0, lon: 10.0, elevation: 100 },
        { distance: 1000, lat: 51.0, lon: 11.0, elevation: 150 },
        { distance: 2500, lat: 52.0, lon: 12.0, elevation: 200 },
      ]
      const elevationStats = {
        gain: 100,
        loss: 0,
        max: 200,
        min: 100,
      }

      const newSegment = {
        coordinates: [route.waypoints[0], route.waypoints[2]],
        distance: 2500,
      }
      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const routeWithElevation = new Route(
        route.segments,
        route.waypoints,
        elevationProfile,
        elevationStats
      )
      const result = routeWithElevation.deleteWaypoint(1, router)

      expect(result.elevationProfile).toEqual(elevationProfile)
      expect(result.elevationStats).toEqual(elevationStats)
    })
  })

  describe('addWaypoint', () => {
    let router: Router
    let route: Route

    beforeEach(() => {
      router = createMockRouter()
      const routeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 1),
        createCustomWaypoint(51.0, 11.0),
      ]

      const mockSegment = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 1000,
      }

      router.createStraightSegment = vi.fn().mockReturnValue(mockSegment)
      route = Route.fromWaypoints(routeWaypoints, router)

      // Reset mocks after creating the route to avoid call count issues in tests
      vi.clearAllMocks()
    })

    it('should append custom waypoint to the end of route', () => {
      const newWaypoint = createCustomWaypoint(52.0, 12.0)
      const mockNewSegment = {
        coordinates: [route.waypoints[1], newWaypoint],
        distance: 1500,
      }

      router.createStraightSegment = vi.fn().mockReturnValue(mockNewSegment)

      const result = route.addWaypoint(newWaypoint, router)

      expect(result.waypoints).toHaveLength(3)
      expect(result.waypoints).toEqual([
        createNodeWaypoint(50.0, 10.0, 1),
        createCustomWaypoint(51.0, 11.0),
        newWaypoint,
      ])
      expect(result.segments).toHaveLength(3)
      expect(router.createStraightSegment).toHaveBeenCalledWith(
        route.waypoints[1],
        newWaypoint
      )
    })

    it('should insert node waypoint in the middle of route', () => {
      const newWaypoint = createNodeWaypoint(50.5, 10.5, 99)
      const mockSegment1 = {
        coordinates: [route.waypoints[0], newWaypoint],
        distance: 500,
      }
      const mockSegment2 = {
        coordinates: [newWaypoint, route.waypoints[1]],
        distance: 600,
      }

      // Mock findInsertionIndex by making the waypoint match segment coordinates
      router.createStraightSegment = vi
        .fn()
        .mockReturnValueOnce(mockSegment1)
        .mockReturnValueOnce(mockSegment2)

      const result = route.addWaypoint(newWaypoint, router)

      expect(result.waypoints).toHaveLength(3)
      expect(result.waypoints).toContain(newWaypoint)
      expect(result.segments).toHaveLength(3)
    })

    it('should return same route if route is empty', () => {
      const emptyRoute = new Route([], [])
      const newWaypoint = createCustomWaypoint(52.0, 12.0)

      const result = emptyRoute.addWaypoint(newWaypoint, router)

      expect(result).toBe(emptyRoute)
    })

    it('should preserve elevation data after adding waypoint', () => {
      const elevationProfile = [
        { distance: 0, lat: 50.0, lon: 10.0, elevation: 100 },
        { distance: 1000, lat: 51.0, lon: 11.0, elevation: 150 },
      ]
      const elevationStats = {
        gain: 50,
        loss: 0,
        max: 150,
        min: 100,
      }

      const routeWithElevation = new Route(
        route.segments,
        route.waypoints,
        elevationProfile,
        elevationStats
      )
      const newWaypoint = createCustomWaypoint(52.0, 12.0)

      const result = routeWithElevation.addWaypoint(newWaypoint, router)

      expect(result.elevationProfile).toEqual(elevationProfile)
      expect(result.elevationStats).toEqual(elevationStats)
    })
  })

  describe('recalculateSegment', () => {
    let router: Router
    let route: Route

    beforeEach(() => {
      router = createMockRouter()
      const routeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 1),
        createCustomWaypoint(51.0, 11.0),
        createNodeWaypoint(52.0, 12.0, 3),
      ]

      const mockSegment1 = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 1000,
      }
      const mockSegment2 = {
        coordinates: [routeWaypoints[1], routeWaypoints[2]],
        distance: 1500,
      }

      router.createStraightSegment = vi
        .fn()
        .mockReturnValueOnce(mockSegment1)
        .mockReturnValueOnce(mockSegment2)

      route = Route.fromWaypoints(routeWaypoints, router)

      // Reset mocks after creating the route to avoid call count issues in tests
      vi.clearAllMocks()
    })

    it('should recalculate segment at valid index', () => {
      const newSegment = {
        coordinates: [route.waypoints[1], route.waypoints[2]],
        distance: 2000, // Different distance to show recalculation
      }

      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = route.recalculateSegment(2, router)

      expect(result.segments).toHaveLength(3)
      expect(result.segments[2]).toEqual(newSegment)
      expect(result.segments[0]).toEqual(route.segments[0]) // First segment unchanged
      expect(result.segments[1]).toEqual(route.segments[1]) // Second segment unchanged
      expect(router.createStraightSegment).toHaveBeenCalledWith(
        route.waypoints[1],
        route.waypoints[2]
      )
    })

    it('should return same route for index 0 (marker segment)', () => {
      const result = route.recalculateSegment(0, router)
      expect(result).toBe(route)
      expect(router.createStraightSegment).not.toHaveBeenCalled()
    })

    it('should use node routing when both waypoints are nodes', () => {
      const nodeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 1),
        createNodeWaypoint(51.0, 11.0, 2),
        createNodeWaypoint(52.0, 12.0, 3),
      ]

      const mockNodeSegment = {
        coordinates: [nodeWaypoints[0], nodeWaypoints[1]],
        distance: 5000,
      }

      router.route = vi.fn().mockReturnValue(mockNodeSegment)
      const nodeRoute = Route.fromWaypoints(nodeWaypoints, router)

      const newSegment = {
        coordinates: [nodeWaypoints[1], nodeWaypoints[2]],
        distance: 6000,
      }

      router.route = vi.fn().mockReturnValue(newSegment)

      const result = nodeRoute.recalculateSegment(2, router)

      expect(result.segments[2]).toEqual(newSegment)
      expect(router.route).toHaveBeenCalledWith(2, 3)
    })

    it('should preserve elevation data after segment recalculation', () => {
      const elevationProfile = [
        { distance: 0, lat: 50.0, lon: 10.0, elevation: 100 },
        { distance: 1000, lat: 51.0, lon: 11.0, elevation: 150 },
        { distance: 2500, lat: 52.0, lon: 12.0, elevation: 200 },
      ]
      const elevationStats = {
        gain: 100,
        loss: 0,
        max: 200,
        min: 100,
      }

      const routeWithElevation = new Route(
        route.segments,
        route.waypoints,
        elevationProfile,
        elevationStats
      )
      const newSegment = {
        coordinates: [route.waypoints[1], route.waypoints[2]],
        distance: 3000,
      }

      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = routeWithElevation.recalculateSegment(2, router)

      expect(result.elevationProfile).toEqual(elevationProfile)
      expect(result.elevationStats).toEqual(elevationStats)
    })
  })

  describe('recalculateAffectedSegments', () => {
    let router: Router
    let route: Route

    beforeEach(() => {
      router = createMockRouter()
      const routeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 1),
        createCustomWaypoint(51.0, 11.0),
        createNodeWaypoint(52.0, 12.0, 3),
        createCustomWaypoint(53.0, 13.0),
      ]

      const mockSegments = [
        { coordinates: [routeWaypoints[0]], distance: 0 }, // marker
        { coordinates: [routeWaypoints[0], routeWaypoints[1]], distance: 1000 },
        { coordinates: [routeWaypoints[1], routeWaypoints[2]], distance: 1500 },
        { coordinates: [routeWaypoints[2], routeWaypoints[3]], distance: 2000 },
      ]

      router.createStraightSegment = vi
        .fn()
        .mockReturnValueOnce(mockSegments[1])
        .mockReturnValueOnce(mockSegments[2])
        .mockReturnValueOnce(mockSegments[3])

      route = Route.fromWaypoints(routeWaypoints, router)

      // Reset mocks after creating the route to avoid call count issues in tests
      vi.clearAllMocks()
    })

    it('should recalculate segments before and after middle waypoint', () => {
      const newSegment1 = {
        coordinates: [route.waypoints[0], route.waypoints[1]],
        distance: 1100, // Different from original
      }
      const newSegment2 = {
        coordinates: [route.waypoints[1], route.waypoints[2]],
        distance: 1600, // Different from original
      }

      router.createStraightSegment = vi
        .fn()
        .mockReturnValueOnce(newSegment1)
        .mockReturnValueOnce(newSegment2)

      const result = route.recalculateAffectedSegments(1, router)

      expect(result.segments).toHaveLength(4)
      expect(result.segments[0]).toEqual(route.segments[0]) // Marker unchanged
      expect(result.segments[1]).toEqual(newSegment1) // Recalculated
      expect(result.segments[2]).toEqual(newSegment2) // Recalculated
      expect(result.segments[3]).toEqual(route.segments[3]) // Last segment unchanged
    })

    it('should only recalculate segment after first waypoint', () => {
      const newSegment = {
        coordinates: [route.waypoints[1], route.waypoints[2]],
        distance: 2500, // Different from original
      }

      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = route.recalculateAffectedSegments(0, router)

      expect(result.segments).toHaveLength(4)
      expect(result.segments[0]).toEqual(route.segments[0]) // Marker unchanged
      expect(result.segments[1]).toEqual(newSegment) // Recalculated
      expect(result.segments[2]).toEqual(route.segments[2]) // Unchanged
      expect(result.segments[3]).toEqual(route.segments[3]) // Unchanged
    })

    it('should only recalculate segment before last waypoint', () => {
      const newSegment = {
        coordinates: [route.waypoints[2], route.waypoints[3]],
        distance: 3000, // Different from original
      }

      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = route.recalculateAffectedSegments(3, router)

      expect(result.segments).toHaveLength(4)
      expect(result.segments[0]).toEqual(route.segments[0]) // Marker unchanged
      expect(result.segments[1]).toEqual(route.segments[1]) // Unchanged
      expect(router.createStraightSegment).toHaveBeenCalledWith(
        route.waypoints[2],
        route.waypoints[3]
      )
      expect(result.segments[3]).toEqual(newSegment) // Should be the recalcuated segment
    })

    it('should recalculate only segment before waypoint when no segment after', () => {
      const testRouter = createMockRouter()
      const mockSegment = {
        coordinates: [
          createNodeWaypoint(50.0, 10.0, 1),
          createCustomWaypoint(51.0, 11.0),
        ],
        distance: 1000,
      }
      testRouter.createStraightSegment = vi.fn().mockReturnValue(mockSegment)

      const twoWaypointRoute = Route.fromWaypoints(
        [createNodeWaypoint(50.0, 10.0, 1), createCustomWaypoint(51.0, 11.0)],
        testRouter
      )

      vi.clearAllMocks()

      const newSegment = {
        coordinates: [
          twoWaypointRoute.waypoints[0],
          twoWaypointRoute.waypoints[1],
        ],
        distance: 1200,
      }

      testRouter.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = twoWaypointRoute.recalculateAffectedSegments(1, testRouter)

      expect(result.segments).toHaveLength(2)
      expect(result.segments[0]).toEqual(twoWaypointRoute.segments[0]) // Marker unchanged
      expect(result.segments[1]).toEqual(newSegment) // Recalculated
    })

    it('should preserve elevation data after recalculation', () => {
      const elevationProfile = [
        { distance: 0, lat: 50.0, lon: 10.0, elevation: 100 },
        { distance: 1000, lat: 51.0, lon: 11.0, elevation: 150 },
        { distance: 2500, lat: 52.0, lon: 12.0, elevation: 200 },
        { distance: 4500, lat: 53.0, lon: 13.0, elevation: 250 },
      ]
      const elevationStats = {
        gain: 150,
        loss: 0,
        max: 250,
        min: 100,
      }

      const routeWithElevation = new Route(
        route.segments,
        route.waypoints,
        elevationProfile,
        elevationStats
      )
      const newSegment = {
        coordinates: [route.waypoints[1], route.waypoints[2]],
        distance: 1800,
      }

      router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

      const result = routeWithElevation.recalculateAffectedSegments(1, router)

      expect(result.elevationProfile).toEqual(elevationProfile)
      expect(result.elevationStats).toEqual(elevationStats)
    })
  })
})
