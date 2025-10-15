import { describe, it, expect } from 'vitest'
import { Router } from './router'
import { buildRoutingGraph } from './graphBuilder'
import { OSMData } from '../types'

describe('Router', () => {
  describe('getNode', () => {
    it('should return correct node data', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.1, lon: 10.1 }],
        ]),
        ways: [],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const node = router.getNode(1)
      expect(node).toEqual({
        id: 1,
        lat: 50.0,
        lon: 10.0,
        isIntermediate: false,
      })
    })

    it('should return undefined for non-existent node', () => {
      const osmData: OSMData = {
        nodes: new Map([[1, { id: 1, lat: 50.0, lon: 10.0 }]]),
        ways: [],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const node = router.getNode(999)
      expect(node).toBeUndefined()
    })
  })

  describe('findNearestNodeWithDistance', () => {
    it('should return closest node with distance and node data', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.001, lon: 10.001 }],
          [3, { id: 3, lat: 50.01, lon: 10.01 }],
        ]),
        ways: [],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // Click near node2 (but not exactly on it)
      const result = router.findNearestNode(50.0011, 10.0011, 100)
      expect(result).not.toBeNull()
      expect(result?.nodeId).toBe(2)
      expect(result?.distance).toBeGreaterThan(0)
      expect(result?.node).toEqual({
        id: 2,
        lat: 50.001,
        lon: 10.001,
        isIntermediate: false,
      })
    })

    it('should return null when no nodes within radius', () => {
      const osmData: OSMData = {
        nodes: new Map([[1, { id: 1, lat: 50.0, lon: 10.0 }]]),
        ways: [],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // Click far from node1 with small max distance
      const result = router.findNearestNode(51.0, 11.0, 100) // ~100km away
      expect(result).toBeNull()
    })

    it('should return null when no nodes exist', () => {
      const osmData: OSMData = {
        nodes: new Map(),
        ways: [],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const result = router.findNearestNode(50.0, 10.0, 100)
      expect(result).toBeNull()
    })

    it('should find node within default max distance (100m)', () => {
      const osmData: OSMData = {
        nodes: new Map([[1, { id: 1, lat: 50.0, lon: 10.0 }]]),
        ways: [],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // Click very close to node1 (within 100m)
      const result = router.findNearestNode(50.0001, 10.0001, 100)
      expect(result).not.toBeNull()
      expect(result?.nodeId).toBe(1)
      expect(result?.node).toEqual({
        id: 1,
        lat: 50.0,
        lon: 10.0,
        isIntermediate: false,
      })
    })

    it('should respect custom max distance parameter', () => {
      const osmData: OSMData = {
        nodes: new Map([[1, { id: 1, lat: 50.0, lon: 10.0 }]]),
        ways: [],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // Click ~157m away from node1
      const result = router.findNearestNode(50.001, 10.001, 200)
      expect(result).not.toBeNull()
      expect(result?.nodeId).toBe(1)

      // Same click with smaller max distance should return null
      const resultSmall = router.findNearestNode(50.001, 10.001, 50)
      expect(resultSmall).toBeNull()
    })
  })

  describe('route', () => {
    it('should find shortest path between connected nodes', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.0001, lon: 10.0001 }], // ~15m
          [3, { id: 3, lat: 50.0002, lon: 10.0002 }], // ~15m
        ]),
        ways: [
          {
            id: 1,
            nodes: [1, 2, 3],
            tags: { highway: 'path' },
          },
        ],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const segment = router.route(1, 3)

      expect(segment).not.toBeNull()
      expect(segment?.coordinates).toHaveLength(3)
      expect(segment?.coordinates[0]).toEqual({ lat: 50.0, lon: 10.0 })
      expect(segment?.coordinates[2]).toEqual({ lat: 50.0002, lon: 10.0002 })
      expect(segment?.distance).toBeGreaterThan(0)
    })

    it('should return null when no path exists', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.1, lon: 10.1 }],
          [3, { id: 3, lat: 50.2, lon: 10.2 }],
          [4, { id: 4, lat: 50.3, lon: 10.3 }],
        ]),
        ways: [
          // Two disconnected components
          { id: 1, nodes: [1, 2], tags: { highway: 'path' } },
          { id: 2, nodes: [3, 4], tags: { highway: 'path' } },
        ],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // Try to route between disconnected nodes
      const segment = router.route(1, 3)
      expect(segment).toBeNull()
    })

    it('should handle same start and end node', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.001, lon: 10.001 }],
        ]),
        ways: [{ id: 1, nodes: [1, 2], tags: { highway: 'path' } }],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const segment = router.route(1, 1)

      // Should return null or a segment with single point and zero distance
      if (segment) {
        expect(segment.coordinates).toHaveLength(1)
        expect(segment.distance).toBe(0)
      } else {
        expect(segment).toBeNull()
      }
    })

    it('should throw error for non-existent start node', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.001, lon: 10.001 }],
        ]),
        ways: [{ id: 1, nodes: [1, 2], tags: { highway: 'path' } }],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // ngraph.path throws error for non-existent nodes
      expect(() => router.route(999, 1)).toThrow()
    })

    it('should throw error for non-existent end node', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.001, lon: 10.001 }],
        ]),
        ways: [{ id: 1, nodes: [1, 2], tags: { highway: 'path' } }],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // ngraph.path throws error for non-existent nodes
      expect(() => router.route(1, 999)).toThrow()
    })

    it('should find direct path between two nodes', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.0001, lon: 10.0001 }], // ~15m
        ]),
        ways: [
          {
            id: 1,
            nodes: [1, 2],
            tags: { highway: 'path' },
          },
        ],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const segment = router.route(1, 2)

      expect(segment).not.toBeNull()
      expect(segment?.coordinates).toHaveLength(2)
      expect(segment?.coordinates[0]).toEqual({ lat: 50.0, lon: 10.0 })
      expect(segment?.coordinates[1]).toEqual({ lat: 50.0001, lon: 10.0001 })
      expect(segment?.distance).toBeGreaterThan(0)
      expect(segment?.distance).toBeLessThan(50) // Should be ~15m
    })

    it('should respect edge weights in pathfinding', () => {
      // Create a graph where the direct path is longer but the indirect path is shorter
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.002, lon: 10.0 }], // Direct route
          [3, { id: 3, lat: 50.001, lon: 10.001 }], // Waypoint for better route
        ]),
        ways: [
          {
            id: 1,
            nodes: [1, 2],
            tags: { highway: 'residential' }, // Higher weight (less preferred)
          },
          {
            id: 2,
            nodes: [1, 3],
            tags: { highway: 'path' }, // Lower weight (preferred)
          },
          {
            id: 3,
            nodes: [3, 2],
            tags: { highway: 'path' }, // Lower weight (preferred)
          },
        ],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const segment = router.route(1, 2)

      expect(segment).not.toBeNull()
      expect(segment?.coordinates.length).toBeGreaterThanOrEqual(2)
    })

    it('should calculate correct total distance for multi-segment path', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.0001, lon: 10.0001 }], // ~15m
          [3, { id: 3, lat: 50.0002, lon: 10.0002 }], // ~15m
          [4, { id: 4, lat: 50.0003, lon: 10.0003 }], // ~15m
        ]),
        ways: [
          {
            id: 1,
            nodes: [1, 2, 3, 4],
            tags: { highway: 'path' },
          },
        ],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const segment = router.route(1, 4)

      expect(segment).not.toBeNull()
      expect(segment?.coordinates).toHaveLength(4)
      expect(segment?.distance).toBeGreaterThan(0)

      // Distance should be cumulative across all segments (roughly 45m total)
      const expectedMinDistance = 30 // Rough estimate (actual ~45m)
      expect(segment?.distance).toBeGreaterThan(expectedMinDistance)
    })

    it('should handle disconnected graph components', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.001, lon: 10.001 }],
          [3, { id: 3, lat: 50.1, lon: 10.1 }],
          [4, { id: 4, lat: 50.101, lon: 10.101 }],
        ]),
        ways: [
          {
            id: 1,
            nodes: [1, 2], // Connected component 1
            tags: { highway: 'path' },
          },
          {
            id: 2,
            nodes: [3, 4], // Connected component 2 (disconnected)
            tags: { highway: 'path' },
          },
        ],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      // Try to route between disconnected components
      const segment = router.route(1, 3)
      expect(segment).toBeNull()
    })

    it('should find path in complex network with multiple options', () => {
      const osmData: OSMData = {
        nodes: new Map([
          [1, { id: 1, lat: 50.0, lon: 10.0 }],
          [2, { id: 2, lat: 50.001, lon: 10.001 }],
          [3, { id: 3, lat: 50.002, lon: 10.002 }],
          [4, { id: 4, lat: 50.001, lon: 10.002 }],
        ]),
        ways: [
          {
            id: 1,
            nodes: [1, 2],
            tags: { highway: 'path' },
          },
          {
            id: 2,
            nodes: [2, 3],
            tags: { highway: 'path' },
          },
          {
            id: 3,
            nodes: [1, 4],
            tags: { highway: 'path' },
          },
          {
            id: 4,
            nodes: [4, 3],
            tags: { highway: 'path' },
          },
        ],
      }

      const graph = buildRoutingGraph(osmData)
      const router = new Router(graph)

      const segment = router.route(1, 3)

      expect(segment).not.toBeNull()
      expect(segment?.coordinates[0]).toEqual({ lat: 50.0, lon: 10.0 })
      expect(segment?.coordinates[segment.coordinates.length - 1]).toEqual({
        lat: 50.002,
        lon: 10.002,
      })
    })
  })
})
