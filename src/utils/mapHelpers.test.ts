/**
 * Map Helpers Tests
 *
 * Tests for custom waypoint functionality including:
 * - Waypoint creation utilities
 * - Distance-based waypoint type determination
 * - Mixed routing segment calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createCustomWaypoint,
  createNodeWaypoint,
  determineWaypointType,
  recalculateMixedSegments,
} from './mapHelpers'
import { Router } from '../services/router'
import { NodeWaypoint } from '../types'

// Mock router for testing
const createMockRouter = () => {
  const router = {
    findNearestNodeWithDistance: vi.fn(),
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
      expect(waypoint.id).toMatch(/^custom-\d+-[a-z0-9]+$/)
    })

    it('should create unique IDs for different waypoints', () => {
      const waypoint1 = createCustomWaypoint(50.0, 10.0)
      const waypoint2 = createCustomWaypoint(51.0, 11.0)

      expect(waypoint1.id).not.toBe(waypoint2.id)
    })
  })

  describe('createNodeWaypoint', () => {
    it('should create a node waypoint with correct properties', () => {
      const lat = 50.0
      const lon = 10.0
      const nodeId = 'node123'

      const waypoint = createNodeWaypoint(lat, lon, nodeId)

      expect(waypoint.type).toBe('node')
      expect(waypoint.lat).toBe(lat)
      expect(waypoint.lon).toBe(lon)
      expect(waypoint.nodeId).toBe(nodeId)
      expect(waypoint.id).toMatch(/^node-node123-\d+$/)
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
      const nodeId = 'node123'
      const node = { id: nodeId, lat: 50.001, lon: 10.001 }

      router.findNearestNode = vi.fn().mockReturnValue({
        nodeId,
        distance: 50, // Within threshold
        node,
      })

      const result = determineWaypointType(lat, lon, router)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('node')
      expect((result! as NodeWaypoint).nodeId).toBe(nodeId)
    })

    it('should create custom waypoint when far from any node', () => {
      const lat = 50.0
      const lon = 10.0

      router.findNearestNode = vi.fn().mockReturnValue({
        nodeId: 'node123',
        distance: 150, // Beyond threshold
      })

      const result = determineWaypointType(lat, lon, router)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('custom')
    })

    it('should create custom waypoint when no nodes found', () => {
      const lat = 50.0
      const lon = 10.0

      router.findNearestNode = vi.fn().mockReturnValue(null)

      const result = determineWaypointType(lat, lon, router)

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
        createNodeWaypoint(50.0, 10.0, 'node1'),
        createNodeWaypoint(51.0, 11.0, 'node2'),
      ]

      const mockSegment = {
        coordinates: [routeWaypoints[0], routeWaypoints[1]],
        distance: 1000,
      }

      router.route = vi.fn().mockReturnValue(mockSegment)

      const result = recalculateMixedSegments(routeWaypoints, router)

      expect(router.route).toHaveBeenCalledWith('node1', 'node2')
      expect(result.segments).toHaveLength(2) // First waypoint marker + route segment
      expect(result.totalDistance).toBe(1000)
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

      const result = recalculateMixedSegments(routeWaypoints, router)

      expect(router.createStraightSegment).toHaveBeenCalledWith(
        routeWaypoints[0],
        routeWaypoints[1]
      )
      expect(result.segments).toHaveLength(2) // First waypoint marker + straight segment
      expect(result.totalDistance).toBe(150000)
    })

    it('should handle mixed node and custom waypoints', () => {
      const routeWaypoints = [
        createNodeWaypoint(50.0, 10.0, 'node1'),
        createCustomWaypoint(51.0, 11.0),
        createNodeWaypoint(52.0, 12.0, 'node3'),
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

      const result = recalculateMixedSegments(routeWaypoints, router)

      expect(router.createStraightSegment).toHaveBeenCalledTimes(2)
      expect(router.route).not.toHaveBeenCalled() // No consecutive node waypoints
      expect(result.segments).toHaveLength(3) // First waypoint + 2 segments
      expect(result.totalDistance).toBe(300000) // Sum of straight segments
    })
  })
})
