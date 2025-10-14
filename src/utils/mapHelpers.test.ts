/**
 * Map Helpers Tests
 *
 * Tests for custom waypoint functionality including:
 * - Waypoint creation utilities
 * - Distance-based waypoint type determination
 * - Mixed routing segment calculation
 * - Waypoint type conversion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createCustomWaypoint,
  createNodeWaypoint,
  determineWaypointType,
  recalculateMixedSegments,
  isNearNode,
  convertWaypointType,
} from './mapHelpers'
import { Router } from '../services/router'
import { WAYPOINT_CONSTANTS } from '../constants/waypoints'
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

      router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
        nodeId,
        distance: 50, // Within threshold
      })
      router.getNode = vi.fn().mockReturnValue(node)

      const result = determineWaypointType(lat, lon, router)

      expect(result).not.toBeNull()
      expect(result!.type).toBe('node')
      expect((result! as NodeWaypoint).nodeId).toBe(nodeId)
    })

    it('should create custom waypoint when far from any node', () => {
      const lat = 50.0
      const lon = 10.0

      router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
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

      router.findNearestNodeWithDistance = vi.fn().mockReturnValue(null)

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

  describe('Waypoint Snapping and Conversion', () => {
    let router: Router

    beforeEach(() => {
      router = createMockRouter()
    })

    describe('isNearNode', () => {
      it('should return node info when waypoint is near a node', () => {
        const waypoint = { lat: 50.0, lon: 10.0 }
        const nodeId = 'node123'

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: 30, // Within snapping threshold
        })

        const result = isNearNode(waypoint, router)

        expect(result).toEqual({
          nodeId,
          distance: 30,
        })
      })

      it('should return null when waypoint is far from any node', () => {
        const waypoint = { lat: 50.0, lon: 10.0 }

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue(null)

        const result = isNearNode(waypoint, router)

        expect(result).toBeNull()
      })
    })

    describe('convertWaypointType', () => {
      it('should convert custom waypoint to node waypoint when near a node', () => {
        const customWaypoint = createCustomWaypoint(50.0, 10.0)
        const nodeId = 'node123'
        const node = { id: nodeId, lat: 50.001, lon: 10.001 }

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: 30,
        })
        router.getNode = vi.fn().mockReturnValue(node)

        const result = convertWaypointType(customWaypoint, router)

        expect(result.type).toBe('node')
        expect((result as NodeWaypoint).nodeId).toBe(nodeId)
      })

      it('should convert node waypoint to custom waypoint when far from nodes', () => {
        const nodeWaypoint = createNodeWaypoint(50.0, 10.0, 'node123')

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue(null)

        const result = convertWaypointType(nodeWaypoint, router)

        expect(result.type).toBe('custom')
        expect('nodeId' in result).toBe(false)
      })

      it('should keep waypoint type when no conversion needed', () => {
        const customWaypoint = createCustomWaypoint(50.0, 10.0)

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue(null)

        const result = convertWaypointType(customWaypoint, router)

        expect(result.type).toBe('custom')
      })
    })

    describe('Threshold Consistency Between Clicking and Dragging', () => {
      let router: Router

      beforeEach(() => {
        router = createMockRouter()
      })

      it('should use same threshold for creating custom waypoint (clicking) and unsnapping node waypoint (dragging)', () => {
        const lat = 50.0
        const lon = 10.0
        const nodeId = 'node123'

        // Test clicking behavior - should create custom waypoint when beyond threshold
        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD + 1, // Just beyond threshold
        })

        const clickResult = determineWaypointType(lat, lon, router)
        expect(clickResult!.type).toBe('custom')

        // Test dragging behavior - should convert node to custom when no nodes found within threshold
        const nodeWaypoint = createNodeWaypoint(lat, lon, nodeId)

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue(null) // No nodes within threshold

        const dragResult = convertWaypointType(nodeWaypoint, router)
        expect(dragResult.type).toBe('custom')
      })

      it('should use same threshold for creating node waypoint (clicking) and snapping custom waypoint (dragging)', () => {
        const lat = 50.0
        const lon = 10.0
        const nodeId = 'node123'
        const node = { id: nodeId, lat: 50.001, lon: 10.001 }

        // Test clicking behavior - should create node waypoint when within threshold
        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD - 1, // Just within threshold
        })
        router.getNode = vi.fn().mockReturnValue(node)

        const clickResult = determineWaypointType(lat, lon, router)
        expect(clickResult!.type).toBe('node')

        // Test dragging behavior - should snap custom to node when within different threshold
        const customWaypoint = createCustomWaypoint(lat, lon)

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: WAYPOINT_CONSTANTS.SNAP_TO_NODE_THRESHOLD - 1, // Just within snap threshold
        })
        router.getNode = vi.fn().mockReturnValue(node)

        const dragResult = convertWaypointType(customWaypoint, router)
        expect(dragResult.type).toBe('node')
      })

      it('should have consistent creation and un-snapping thresholds', () => {
        // This test verifies that the threshold for creating a custom waypoint
        // is the same as the threshold for converting a node waypoint to custom

        expect(WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD).toBe(
          WAYPOINT_CONSTANTS.UNSNAP_FROM_NODE_THRESHOLD
        )

        const lat = 50.0
        const lon = 10.0
        const nodeId = 'node123'
        const node = { id: nodeId, lat: 50.001, lon: 10.001 }
        const testDistance = WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD

        // At exactly the threshold distance, clicking should create a node waypoint
        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: testDistance,
        })
        router.getNode = vi.fn().mockReturnValue(node)

        const clickResult = determineWaypointType(lat, lon, router)
        expect(clickResult!.type).toBe('node')

        // At exactly the same threshold distance, dragging should keep as node waypoint
        const nodeWaypoint = createNodeWaypoint(lat, lon, nodeId)

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: testDistance,
        })
        router.getNode = vi.fn().mockReturnValue(node)

        const dragResult = convertWaypointType(nodeWaypoint, router)
        expect(dragResult.type).toBe('node')
      })

      it('should handle edge cases at threshold boundaries consistently', () => {
        const lat = 50.0
        const lon = 10.0
        const nodeId = 'node123'
        const node = { id: nodeId, lat: 50.001, lon: 10.001 }

        // Test just 1 meter beyond creation threshold
        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD + 1,
        })

        const clickResultBeyond = determineWaypointType(lat, lon, router)
        expect(clickResultBeyond!.type).toBe('custom')

        // Test just 1 meter beyond un-snapping threshold (should be same behavior)
        const nodeWaypoint = createNodeWaypoint(lat, lon, nodeId)

        router.findNearestNodeWithDistance = vi.fn().mockReturnValue(null) // No nodes within threshold

        const dragResultBeyond = convertWaypointType(nodeWaypoint, router)
        expect(dragResultBeyond.type).toBe('custom')

        // Test just 1 meter within creation threshold
        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: WAYPOINT_CONSTANTS.CUSTOM_WAYPOINT_THRESHOLD - 1,
        })
        router.getNode = vi.fn().mockReturnValue(node)

        const clickResultWithin = determineWaypointType(lat, lon, router)
        expect(clickResultWithin!.type).toBe('node')

        // Test just 1 meter within un-snapping threshold
        router.findNearestNodeWithDistance = vi.fn().mockReturnValue({
          nodeId,
          distance: WAYPOINT_CONSTANTS.UNSNAP_FROM_NODE_THRESHOLD - 1,
        })
        router.getNode = vi.fn().mockReturnValue(node)

        const dragResultWithin = convertWaypointType(nodeWaypoint, router)
        expect(dragResultWithin.type).toBe('node')
      })
    })
  })
})
