/**
 * Map Helpers Tests
 *
 * Tests for custom waypoint functionality including:
 * - Waypoint creation utilities
 * - Distance-based waypoint type determination
 * - Mixed routing segment calculation
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import {
  createCustomWaypoint,
  createNodeWaypoint,
  determineWaypointType,
  recalculateAllSegments,
  recalculateAffectedSegments,
  addWaypointToRoute,
} from './mapHelpers'
import { Router } from '../services/router'
import { NodeWaypoint, Route } from '../types'

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

describe('Custom Waypoint Utilities', () => {
  describe('createCustomWaypoint', () => {
    it('should create a custom waypoint with correct properties', () => {
      const lat = 50.0
      const lon = 10.0

      const waypoint = createCustomWaypoint(lat, lon)

      expect(waypoint.type).toBe('custom')
      expect(waypoint.lat).toBe(lat)
      expect(waypoint.lon).toBe(lon)
    })

    it('should create distinct waypoints', () => {
      const waypoint1 = createCustomWaypoint(50.0, 10.0)
      const waypoint2 = createCustomWaypoint(51.0, 11.0)

      expect(waypoint1).not.toBe(waypoint2)
      expect(waypoint1.lat).toBe(50.0)
      expect(waypoint2.lat).toBe(51.0)
    })
  })

  describe('createNodeWaypoint', () => {
    it('should create a node waypoint with correct properties', () => {
      const lat = 50.0
      const lon = 10.0
      const nodeId = 123

      const waypoint = createNodeWaypoint(lat, lon, nodeId)

      expect(waypoint.type).toBe('node')
      expect(waypoint.lat).toBe(lat)
      expect(waypoint.lon).toBe(lon)
      expect(waypoint.nodeId).toBe(nodeId)
    })
  })

  describe('Waypoint Type Determination', () => {
    let router: Router

    beforeEach(() => {
      router = createMockRouter()
    })

    it('should create node waypoint when close to a node', () => {
      const lat = 50.0
      const lon = 10.0
      const nodeId = 123
      const node = { id: nodeId, lat: 50.001, lon: 10.001 }

      router.findNearestNode = vi.fn().mockReturnValue({
        nodeId,
        distance: 50, // Within threshold
        node,
      })

      const result = determineWaypointType(
        lat,
        lon,
        router,
        { lat: 45.0, lng: 9.0 },
        10
      )

      expect(result).not.toBeNull()
      expect(result!.type).toBe('node')
      expect((result! as NodeWaypoint).nodeId).toBe(nodeId)
    })

    it('should create custom waypoint when far from any node', () => {
      const lat = 50.0
      const lon = 10.0

      router.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 123,
        node: { lat: 50.1, lon: 10.1, id: 123 },
        distance: 15000, // Beyond custom waypoint threshold (100 pixels = ~10810m at zoom 10, lat 45)
      })

      const result = determineWaypointType(
        lat,
        lon,
        router,
        { lat: 45.0, lng: 9.0 },
        10
      )

      expect(result).not.toBeNull()
      expect(result!.type).toBe('custom')
    })

    it('should create custom waypoint when no nodes found', () => {
      const lat = 50.0
      const lon = 10.0

      router.findNearestNode = vi.fn().mockReturnValue(null)

      const result = determineWaypointType(
        lat,
        lon,
        router,
        { lat: 45.0, lng: 9.0 },
        10
      )

      expect(result).not.toBeNull()
      expect(result!.type).toBe('custom')
    })
  })

  describe('Mixed Routing', () => {
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

      const result = recalculateAllSegments(routeWaypoints, router)

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

      const result = recalculateAllSegments(routeWaypoints, router)

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

      const result = recalculateAllSegments(routeWaypoints, router)

      expect(router.createStraightSegment).toHaveBeenCalledTimes(2)
      expect(router.route).not.toHaveBeenCalled() // No consecutive node waypoints
      expect(result.segments).toHaveLength(3) // First waypoint + 2 segments
      expect(result.totalDistance).toBe(300000) // Sum of straight segments
      expect(result.waypoints).toEqual(routeWaypoints)
    })
  })

  describe('Optimized Route Recalculation', () => {
    let router: Router

    beforeEach(() => {
      router = createMockRouter()
    })

    // Helper function to create a mock route with multiple waypoints
    const createMockRoute = (waypointCount: number): Route => {
      const waypoints = []
      const segments = []

      for (let i = 0; i < waypointCount; i++) {
        if (i % 2 === 0) {
          waypoints.push(
            createNodeWaypoint(50 + i * 0.1, 10 + i * 0.1, 100 + i)
          )
        } else {
          waypoints.push(createCustomWaypoint(50 + i * 0.1, 10 + i * 0.1))
        }

        if (i === 0) {
          // First waypoint - just a marker
          segments.push({
            coordinates: [{ lat: waypoints[i].lat, lon: waypoints[i].lon }],
            distance: 0,
          })
        } else {
          // Create a segment
          segments.push({
            coordinates: [
              { lat: waypoints[i - 1].lat, lon: waypoints[i - 1].lon },
              { lat: waypoints[i].lat, lon: waypoints[i].lon },
            ],
            distance: 1000 + i * 100,
          })
        }
      }

      return {
        waypoints,
        segments,
        totalDistance: segments.reduce((sum, seg) => sum + seg.distance, 0),
      }
    }

    describe('recalculateAffectedSegments', () => {
      it('should recalculate only segments before and after affected waypoint', () => {
        // Create a simple test route with explicit structure
        const route = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createCustomWaypoint(50.1, 10.1),
            createNodeWaypoint(50.2, 10.2, 3),
            createCustomWaypoint(50.3, 10.3),
            createNodeWaypoint(50.4, 10.4, 5),
          ],
          segments: [
            { coordinates: [{ lat: 50, lon: 10 }], distance: 0 },
            {
              coordinates: [
                { lat: 50, lon: 10 },
                { lat: 50.1, lon: 10.1 },
              ],
              distance: 1100,
            },
            {
              coordinates: [
                { lat: 50.1, lon: 10.1 },
                { lat: 50.2, lon: 10.2 },
              ],
              distance: 1200,
            },
            {
              coordinates: [
                { lat: 50.2, lon: 10.2 },
                { lat: 50.3, lon: 10.3 },
              ],
              distance: 1300,
            },
            {
              coordinates: [
                { lat: 50.3, lon: 10.3 },
                { lat: 50.4, lon: 10.4 },
              ],
              distance: 1400,
            },
          ],
          totalDistance: 5000,
        }

        const newSegment1 = {
          coordinates: [
            { lat: route.waypoints[0].lat, lon: route.waypoints[0].lon },
            { lat: route.waypoints[1].lat, lon: route.waypoints[1].lon },
          ],
          distance: 2000,
        }
        const newSegment2 = {
          coordinates: [
            { lat: route.waypoints[1].lat, lon: route.waypoints[1].lon },
            { lat: route.waypoints[2].lat, lon: route.waypoints[2].lon },
          ],
          distance: 2500,
        }

        router.createStraightSegment = vi
          .fn()
          .mockReturnValueOnce(newSegment1)
          .mockReturnValueOnce(newSegment2)

        const result = recalculateAffectedSegments(route, 1, router)

        // Should only modify segments at index 1 and 2
        expect(result.segments[0]).toBe(route.segments[0]) // Unchanged
        expect(result.segments[1]).toEqual(newSegment1) // Recalculated
        expect(result.segments[2]).toEqual(newSegment2) // Recalculated
        expect(result.segments[3]).toBe(route.segments[3]) // Unchanged
        expect(result.segments[4]).toBe(route.segments[4]) // Unchanged
      })

      it('should only recalculate segment after dragging first waypoint', () => {
        const route = createMockRoute(4)
        const newSegment = {
          coordinates: [
            { lat: route.waypoints[0].lat, lon: route.waypoints[0].lon },
            { lat: route.waypoints[1].lat, lon: route.waypoints[1].lon },
          ],
          distance: 3000,
        }

        router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

        const result = recalculateAffectedSegments(route, 0, router)

        // Should only modify segment at index 1 (after first waypoint)
        expect(result.segments[0]).toBe(route.segments[0]) // Unchanged
        expect(result.segments[1]).toEqual(newSegment) // Recalculated
        expect(result.segments[2]).toBe(route.segments[2]) // Unchanged
        expect(result.segments[3]).toBe(route.segments[3]) // Unchanged
      })

      it('should only recalculate segment before dragging last waypoint', () => {
        // Create a simple test route with explicit structure
        const route = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createCustomWaypoint(50.1, 10.1),
            createNodeWaypoint(50.2, 10.2, 3),
            createCustomWaypoint(50.3, 10.3),
          ],
          segments: [
            { coordinates: [{ lat: 50, lon: 10 }], distance: 0 },
            {
              coordinates: [
                { lat: 50, lon: 10 },
                { lat: 50.1, lon: 10.1 },
              ],
              distance: 1100,
            },
            {
              coordinates: [
                { lat: 50.1, lon: 10.1 },
                { lat: 50.2, lon: 10.2 },
              ],
              distance: 1200,
            },
            {
              coordinates: [
                { lat: 50.2, lon: 10.2 },
                { lat: 50.3, lon: 10.3 },
              ],
              distance: 1300,
            },
          ],
          totalDistance: 3600,
        }

        const newSegment = {
          coordinates: [
            { lat: route.waypoints[2].lat, lon: route.waypoints[2].lon },
            { lat: route.waypoints[3].lat, lon: route.waypoints[3].lon },
          ],
          distance: 3500,
        }

        router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

        const result = recalculateAffectedSegments(route, 3, router)

        // Should only modify segment at index 3 (before last waypoint)
        expect(result.segments[0]).toBe(route.segments[0]) // Unchanged
        expect(result.segments[1]).toBe(route.segments[1]) // Unchanged
        expect(result.segments[2]).toBe(route.segments[2]) // Unchanged
        expect(result.segments[3]).toEqual(newSegment) // Recalculated
      })

      it('should handle single waypoint route', () => {
        const route = createMockRoute(1)

        const result = recalculateAffectedSegments(route, 0, router)

        // Should return route unchanged
        expect(result).toEqual(route)
        expect(router.route).not.toHaveBeenCalled()
        expect(router.createStraightSegment).not.toHaveBeenCalled()
      })

      it('should handle two waypoint route', () => {
        // Create a simple test route with explicit structure
        const route = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createCustomWaypoint(50.1, 10.1),
          ],
          segments: [
            { coordinates: [{ lat: 50, lon: 10 }], distance: 0 },
            {
              coordinates: [
                { lat: 50, lon: 10 },
                { lat: 50.1, lon: 10.1 },
              ],
              distance: 1100,
            },
          ],
          totalDistance: 1100,
        }

        const newSegment = {
          coordinates: [
            { lat: route.waypoints[0].lat, lon: route.waypoints[0].lon },
            { lat: route.waypoints[1].lat, lon: route.waypoints[1].lon },
          ],
          distance: 4000,
        }

        router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

        const result = recalculateAffectedSegments(route, 0, router)

        // Should only recalculate segment at index 1
        expect(result.segments[0]).toBe(route.segments[0]) // Unchanged
        expect(result.segments[1]).toEqual(newSegment) // Recalculated
      })

      it('should use routing for node-to-node segments', () => {
        const route = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createNodeWaypoint(51.0, 11.0, 2),
            createNodeWaypoint(52.0, 12.0, 3),
          ],
          segments: [
            { coordinates: [{ lat: 50, lon: 10 }], distance: 0 },
            {
              coordinates: [
                { lat: 50, lon: 10 },
                { lat: 51, lon: 11 },
              ],
              distance: 1000,
            },
            {
              coordinates: [
                { lat: 51, lon: 11 },
                { lat: 52, lon: 12 },
              ],
              distance: 1000,
            },
          ],
          totalDistance: 2000,
        }

        const newSegment = {
          coordinates: [
            { lat: 51, lon: 11 },
            { lat: 52, lon: 12 },
          ],
          distance: 1500,
        }
        router.route = vi.fn().mockReturnValue(newSegment)

        const result = recalculateAffectedSegments(route, 2, router)

        expect(router.route).toHaveBeenCalledWith(2, 3)
        expect(result.segments[2]).toBe(newSegment)
      })

      it('should use straight segments for mixed waypoint types', () => {
        const route = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createCustomWaypoint(51.0, 11.0),
            createNodeWaypoint(52.0, 12.0, 3),
          ],
          segments: [
            { coordinates: [{ lat: 50, lon: 10 }], distance: 0 },
            {
              coordinates: [
                { lat: 50, lon: 10 },
                { lat: 51, lon: 11 },
              ],
              distance: 1000,
            },
            {
              coordinates: [
                { lat: 51, lon: 11 },
                { lat: 52, lon: 12 },
              ],
              distance: 1000,
            },
          ],
          totalDistance: 2000,
        }

        const newSegment = {
          coordinates: [
            { lat: 51, lon: 11 },
            { lat: 52, lon: 12 },
          ],
          distance: 150000,
        }
        router.createStraightSegment = vi.fn().mockReturnValue(newSegment)

        const result = recalculateAffectedSegments(route, 2, router)

        expect(router.createStraightSegment).toHaveBeenCalledWith(
          route.waypoints[1],
          route.waypoints[2]
        )
        expect(result.segments[2]).toBe(newSegment)
      })

      it('should fallback to straight segment if routing fails', () => {
        const route = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createNodeWaypoint(51.0, 11.0, 2),
            createNodeWaypoint(52.0, 12.0, 3),
          ],
          segments: [
            { coordinates: [{ lat: 50, lon: 10 }], distance: 0 },
            {
              coordinates: [
                { lat: 50, lon: 10 },
                { lat: 51, lon: 11 },
              ],
              distance: 1000,
            },
            {
              coordinates: [
                { lat: 51, lon: 11 },
                { lat: 52, lon: 12 },
              ],
              distance: 1000,
            },
          ],
          totalDistance: 2000,
        }

        const fallbackSegment = {
          coordinates: [
            { lat: 51, lon: 11 },
            { lat: 52, lon: 12 },
          ],
          distance: 150000,
        }
        router.route = vi.fn().mockReturnValue(null) // Routing fails
        router.createStraightSegment = vi.fn().mockReturnValue(fallbackSegment)

        const result = recalculateAffectedSegments(route, 2, router)

        expect(router.route).toHaveBeenCalledWith(2, 3)
        expect(router.createStraightSegment).toHaveBeenCalledWith(
          route.waypoints[1],
          route.waypoints[2]
        )
        expect(result.segments[2]).toBe(fallbackSegment)
      })

      it('should preserve waypoints and recalculate total distance', () => {
        const route = createMockRoute(4)
        const newSegment1 = {
          coordinates: [route.waypoints[0], route.waypoints[1]],
          distance: 2000,
        }
        const newSegment2 = {
          coordinates: [route.waypoints[1], route.waypoints[2]],
          distance: 2500,
        }

        router.createStraightSegment = vi
          .fn()
          .mockReturnValueOnce(newSegment1)
          .mockReturnValueOnce(newSegment2)

        const result = recalculateAffectedSegments(route, 1, router)

        // Waypoints should be unchanged
        expect(result.waypoints).toBe(route.waypoints)

        // Total distance should be recalculated
        const expectedDistance =
          route.segments[0].distance +
          newSegment1.distance +
          newSegment2.distance +
          route.segments[3].distance
        expect(result.totalDistance).toBe(expectedDistance)
      })

      it('should handle invalid index gracefully', () => {
        const route = createMockRoute(3)

        const result1 = recalculateAffectedSegments(route, -1, router)
        const result2 = recalculateAffectedSegments(route, 5, router) // Beyond array bounds

        expect(result1).toBe(route)
        expect(result2).toBe(route)
      })

      it('should handle very long routes efficiently', () => {
        const veryLongRoute = createMockRoute(100)
        const affectedIndex = 50

        router.route = vi
          .fn()
          .mockReturnValue({ coordinates: [], distance: 1500 })
        router.createStraightSegment = vi
          .fn()
          .mockReturnValue({ coordinates: [], distance: 1500 })

        const result = recalculateAffectedSegments(
          veryLongRoute,
          affectedIndex,
          router
        )

        // Should only call routing methods twice regardless of route length
        const totalRoutingCalls =
          (router.route as Mock).mock.calls.length +
          (router.createStraightSegment as Mock).mock.calls.length
        expect(totalRoutingCalls).toBeLessThanOrEqual(2)

        // Should preserve all other segments
        expect(result.segments.length).toBe(100)
        expect(result.segments[0]).toBe(veryLongRoute.segments[0])
        expect(result.segments[99]).toBe(veryLongRoute.segments[99])
      })
    })

    describe('addWaypointToRoute', () => {
      it('should append waypoint to end of route when insertIndex is null', () => {
        const route = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createNodeWaypoint(51.0, 11.0, 2),
          ],
          segments: [
            { coordinates: [{ lat: 50.0, lon: 10.0 }], distance: 0 },
            { coordinates: [{ lat: 51.0, lon: 11.0 }], distance: 1000 },
          ],
          totalDistance: 1000,
        }

        const newWaypoint = createCustomWaypoint(52.0, 12.0)

        // Mock the router functions
        router.createStraightSegment = vi.fn().mockReturnValue({
          coordinates: [
            { lat: 51.0, lon: 11.0 },
            { lat: 52.0, lon: 12.0 },
          ],
          distance: 1000,
        })

        const result = addWaypointToRoute(route, newWaypoint, router)

        // Should append custom waypoint to the end
        expect(router.createStraightSegment).toHaveBeenCalled()
        expect(result.waypoints).toEqual([...route.waypoints, newWaypoint])
        expect(result.segments).toHaveLength(3)
        expect(result.totalDistance).toBeGreaterThan(route.totalDistance)
      })

      it('should insert waypoint at correct position when insertIndex is provided', () => {
        // Create a route where the middle waypoint would be on the existing segment
        const routeWithMiddleSegment = {
          waypoints: [
            createNodeWaypoint(50.0, 10.0, 1),
            createNodeWaypoint(52.0, 12.0, 3),
          ],
          segments: [
            { coordinates: [{ lat: 50.0, lon: 10.0 }], distance: 0 },
            {
              coordinates: [
                { lat: 50.0, lon: 10.0 },
                { lat: 51.0, lon: 11.0 }, // This is where our new waypoint should match
                { lat: 52.0, lon: 12.0 },
              ],
              distance: 2000,
            },
          ],
          totalDistance: 2000,
        }

        const newWaypoint = createNodeWaypoint(51.0, 11.0, 2)

        // Mock the router functions to simulate finding the node on an existing segment
        router.getNode = vi.fn().mockReturnValue({
          lat: 51.0,
          lon: 11.0,
        })
        router.route = vi.fn().mockReturnValue({
          coordinates: [
            { lat: 50.0, lon: 10.0 },
            { lat: 51.0, lon: 11.0 },
          ],
          distance: 800,
        })
        router.createStraightSegment = vi.fn().mockReturnValue({
          coordinates: [
            { lat: 51.0, lon: 11.0 },
            { lat: 52.0, lon: 12.0 },
          ],
          distance: 1200,
        })

        const result = addWaypointToRoute(
          routeWithMiddleSegment,
          newWaypoint,
          router
        )

        // Should insert node waypoint in the middle
        expect(router.getNode).toHaveBeenCalled()
        expect(result.waypoints).toHaveLength(3)
        expect(result.waypoints).toContainEqual(newWaypoint)
        expect(result.segments).toHaveLength(3)
        // Total distance should be 800 + 1200 = 2000, but the routing calculation
        // gives us 800 + 800 = 1600, which is different from original 2000
        expect(result.totalDistance).toBe(1600)
      })

      it('should return original route if route has no waypoints', () => {
        const testWaypoint = createNodeWaypoint(50.0, 10.0, 1)
        const emptyRoute = { waypoints: [], segments: [], totalDistance: 0 }

        const result = addWaypointToRoute(emptyRoute, testWaypoint, router)

        expect(result).toBe(emptyRoute)
      })
    })
  })
})
