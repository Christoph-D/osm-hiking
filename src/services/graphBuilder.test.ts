import { describe, it, expect } from 'vitest'
import { buildRoutingGraph } from './graphBuilder'
import { OSMData } from '../types'
import { distance } from '@turf/turf'

describe('buildRoutingGraph', () => {
  it('should create graph with nodes from OSM data', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.1, lon: 10.1 }],
      ]),
      ways: [],
    }

    const result = buildRoutingGraph(osmData)

    expect(result.nodes.size).toBe(2)
    expect(result.nodes.get('node1')).toEqual({
      id: 'node1',
      lat: 50.0,
      lon: 10.0,
      isIntermediate: false,
    })
    expect(result.nodes.get('node2')).toEqual({
      id: 'node2',
      lat: 50.1,
      lon: 10.1,
      isIntermediate: false,
    })
  })

  it('should create bidirectional edges from ways', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.0001, lon: 10.0001 }], // ~15m - no subdivision
      ]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1', 'node2'],
          tags: { highway: 'path' },
        },
      ],
    }

    const result = buildRoutingGraph(osmData)

    // Check that links exist in both directions
    const link1to2 = result.graph.getLink('node1', 'node2')
    const link2to1 = result.graph.getLink('node2', 'node1')

    expect(link1to2).toBeDefined()
    expect(link2to1).toBeDefined()
    expect(link1to2?.data).toBeGreaterThan(0) // Should have positive weight
    expect(link2to1?.data).toBeGreaterThan(0)
  })

  it('should handle ways with missing nodes', () => {
    const osmData: OSMData = {
      nodes: new Map([['node1', { id: 'node1', lat: 50.0, lon: 10.0 }]]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1', 'nonexistent'],
          tags: { highway: 'path' },
        },
      ],
    }

    // Should not throw error
    expect(() => buildRoutingGraph(osmData)).not.toThrow()

    const result = buildRoutingGraph(osmData)
    expect(result.nodes.size).toBe(1)
  })

  it('should apply different weights based on highway type', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.0001, lon: 10.0001 }], // ~15m
        ['node3', { id: 'node3', lat: 50.0002, lon: 10.0002 }], // ~15m
      ]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1', 'node2'],
          tags: { highway: 'path' }, // weight 1.0
        },
        {
          id: 'way2',
          nodes: ['node2', 'node3'],
          tags: { highway: 'residential' }, // weight 1.6
        },
      ],
    }

    const result = buildRoutingGraph(osmData)

    const pathLink = result.graph.getLink('node1', 'node2')
    const residentialLink = result.graph.getLink('node2', 'node3')

    expect(pathLink).toBeDefined()
    expect(residentialLink).toBeDefined()

    // Residential road should have higher weight (less preferred)
    if (pathLink && residentialLink) {
      expect(residentialLink.data).toBeGreaterThan(pathLink.data)
    }
  })

  it('should use default weight for unknown highway types', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.0001, lon: 10.0001 }], // ~15m
      ]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1', 'node2'],
          tags: { highway: 'unknown_type' },
        },
      ],
    }

    const result = buildRoutingGraph(osmData)

    const link = result.graph.getLink('node1', 'node2')
    expect(link).toBeDefined()
    expect(link?.data).toBeGreaterThan(0)
  })

  it('should handle ways without highway tag', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.0001, lon: 10.0001 }], // ~15m
      ]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1', 'node2'],
          tags: {}, // No highway tag
        },
      ],
    }

    const result = buildRoutingGraph(osmData)

    // Should still create edges with default path weight
    const link = result.graph.getLink('node1', 'node2')
    expect(link).toBeDefined()
  })

  it('should handle empty OSM data', () => {
    const osmData: OSMData = {
      nodes: new Map(),
      ways: [],
    }

    const result = buildRoutingGraph(osmData)

    expect(result.nodes.size).toBe(0)
    expect(result.graph.getNodesCount()).toBe(0)
  })

  it('should create connected graph for multiple ways', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.0001, lon: 10.0001 }], // ~15m
        ['node3', { id: 'node3', lat: 50.0002, lon: 10.0002 }], // ~15m
        ['node4', { id: 'node4', lat: 50.0003, lon: 10.0003 }], // ~15m
      ]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1', 'node2', 'node3'],
          tags: { highway: 'path' },
        },
        {
          id: 'way2',
          nodes: ['node3', 'node4'],
          tags: { highway: 'footway' },
        },
      ],
    }

    const result = buildRoutingGraph(osmData)

    // Check that all connections exist
    expect(result.graph.getLink('node1', 'node2')).toBeDefined()
    expect(result.graph.getLink('node2', 'node3')).toBeDefined()
    expect(result.graph.getLink('node3', 'node4')).toBeDefined()

    // Verify it's connected (node1 can reach node4 through node2 and node3)
    expect(result.graph.getNodesCount()).toBe(4)
    expect(result.graph.getLinksCount()).toBe(6) // 3 edges x 2 directions
  })

  it('should handle single-node ways', () => {
    const osmData: OSMData = {
      nodes: new Map([['node1', { id: 'node1', lat: 50.0, lon: 10.0 }]]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1'], // Single node - can't create edge
          tags: { highway: 'path' },
        },
      ],
    }

    const result = buildRoutingGraph(osmData)

    expect(result.nodes.size).toBe(1)
    expect(result.graph.getLinksCount()).toBe(0) // No edges created
  })

  it('should calculate edge weights based on distance', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.001, lon: 10.001 }], // Close
        ['node3', { id: 'node3', lat: 50.0, lon: 10.0 }],
        ['node4', { id: 'node4', lat: 50.01, lon: 10.01 }], // Far
      ]),
      ways: [
        {
          id: 'way1',
          nodes: ['node1', 'node2'],
          tags: { highway: 'path' },
        },
        {
          id: 'way2',
          nodes: ['node3', 'node4'],
          tags: { highway: 'path' },
        },
      ],
    }

    const result = buildRoutingGraph(osmData)

    const shortLink = result.graph.getLink('node1', 'node2')
    const longLink = result.graph.getLink('node3', 'node4')

    // Longer distance should have higher weight
    if (shortLink && longLink) {
      expect(longLink.data).toBeGreaterThan(shortLink.data)
    }
  })

  it('should preserve node coordinates in graph', () => {
    const osmData: OSMData = {
      nodes: new Map([['node1', { id: 'node1', lat: 50.12345, lon: 10.6789 }]]),
      ways: [],
    }

    const result = buildRoutingGraph(osmData)

    const node = result.nodes.get('node1')
    expect(node).toEqual({
      id: 'node1',
      lat: 50.12345,
      lon: 10.6789,
      isIntermediate: false,
    })
  })

  describe('way subdivision', () => {
    it('should not subdivide short segments (<= 25m)', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.0001, lon: 10.0001 }], // ~15m
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // Should have original nodes only
      expect(result.nodes.size).toBe(2)
      expect(result.nodes.has('node1')).toBe(true)
      expect(result.nodes.has('node2')).toBe(true)

      // Should have direct bidirectional edges
      expect(result.graph.getLink('node1', 'node2')).toBeDefined()
      expect(result.graph.getLink('node2', 'node1')).toBeDefined()

      // Should have exactly 2 links (1 edge × 2 directions)
      expect(result.graph.getLinksCount()).toBe(2)
    })

    it('should subdivide long segments (> 25m)', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.001, lon: 10.0 }], // ~111m north
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // Should have original nodes + intermediate nodes
      expect(result.nodes.size).toBeGreaterThan(2)
      expect(result.nodes.has('node1')).toBe(true)
      expect(result.nodes.has('node2')).toBe(true)

      // Check that intermediate nodes have correct properties
      const intermediateNodes = Array.from(result.nodes.values()).filter(
        (node) => node.isIntermediate === true
      )
      expect(intermediateNodes.length).toBeGreaterThan(0)

      intermediateNodes.forEach((node) => {
        expect(node.originalWayId).toBe('way1')
        expect(node.id).toMatch(/^way1_seg0_int\d+$/)
      })

      // Should have more links than just the direct connection
      expect(result.graph.getLinksCount()).toBeGreaterThan(2)
    })

    it('should create intermediate nodes at regular intervals', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.002, lon: 10.0 }], // ~222m north
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // 222m / 25m = 8.9, so should need 8 intermediate nodes (9 segments)
      const intermediateNodes = Array.from(result.nodes.values()).filter(
        (node) => node.isIntermediate === true
      )
      expect(intermediateNodes.length).toBe(8)

      // Check that distances between consecutive nodes are <= 25m
      const allNodeIds = [
        'node1',
        ...intermediateNodes.map((n) => n.id),
        'node2',
      ]
      for (let i = 0; i < allNodeIds.length - 1; i++) {
        const fromNode = result.nodes.get(allNodeIds[i])!
        const toNode = result.nodes.get(allNodeIds[i + 1])!

        const dist = distance(
          [fromNode.lon, fromNode.lat],
          [toNode.lon, toNode.lat],
          { units: 'meters' }
        )

        expect(dist).toBeLessThanOrEqual(25)
      }
    })

    it('should handle multiple segments in one way', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.002, lon: 10.0 }], // ~222m
          ['node3', { id: 'node3', lat: 50.004, lon: 10.0 }], // ~222m
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2', 'node3'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // Should have intermediate nodes for both long segments
      const intermediateNodes = Array.from(result.nodes.values()).filter(
        (node) => node.isIntermediate === true
      )
      expect(intermediateNodes.length).toBe(16) // 8 for each segment

      // Should have nodes from both segments
      const segment0Nodes = intermediateNodes.filter((n) =>
        n.id.includes('seg0_int')
      )
      const segment1Nodes = intermediateNodes.filter((n) =>
        n.id.includes('seg1_int')
      )
      expect(segment0Nodes.length).toBe(8)
      expect(segment1Nodes.length).toBe(8)
    })

    it('should apply highway weights correctly to subdivided edges', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.002, lon: 10.0 }], // ~222m
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2'],
            tags: { highway: 'residential' }, // weight 1.6
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // Get the first edge (should be from node1 to first intermediate node)
      const intermediateNodes = Array.from(result.nodes.values()).filter(
        (node) => node.isIntermediate === true
      )
      const firstIntermediateNode = intermediateNodes[0]

      const link = result.graph.getLink('node1', firstIntermediateNode.id)
      expect(link).toBeDefined()

      // The weight should be distance × 1.6
      const expectedDistance = distance(
        [10.0, 50.0],
        [firstIntermediateNode.lon, firstIntermediateNode.lat],
        { units: 'meters' }
      )
      expect(link?.data).toBeCloseTo(expectedDistance * 1.6, 5)
    })

    it('should handle mixed short and long segments in same way', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.0001, lon: 10.0001 }], // ~15m - short
          ['node3', { id: 'node3', lat: 50.002, lon: 10.0001 }], // ~222m - long
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2', 'node3'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // Should have intermediate nodes only for the long segment
      const intermediateNodes = Array.from(result.nodes.values()).filter(
        (node) => node.isIntermediate === true
      )
      expect(intermediateNodes.length).toBe(8) // Only for segment 1 (node2 to node3)

      // All intermediate nodes should belong to segment 1
      intermediateNodes.forEach((node) => {
        expect(node.id).toMatch(/^way1_seg1_int\d+$/)
      })
    })

    it('should preserve connectivity with multiple ways', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.002, lon: 10.0 }],
          ['node3', { id: 'node3', lat: 50.004, lon: 10.0 }],
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2'],
            tags: { highway: 'path' },
          },
          {
            id: 'way2',
            nodes: ['node2', 'node3'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // Should have intermediate nodes for both ways
      const intermediateNodes = Array.from(result.nodes.values()).filter(
        (node) => node.isIntermediate === true
      )
      expect(intermediateNodes.length).toBe(16) // 8 for each way

      // Should have nodes from both ways
      const way1Nodes = intermediateNodes.filter(
        (n) => n.originalWayId === 'way1'
      )
      const way2Nodes = intermediateNodes.filter(
        (n) => n.originalWayId === 'way2'
      )
      expect(way1Nodes.length).toBe(8)
      expect(way2Nodes.length).toBe(8)
    })

    it('should mark original nodes as non-intermediate', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.002, lon: 10.0 }],
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      const node1 = result.nodes.get('node1')
      const node2 = result.nodes.get('node2')

      expect(node1?.isIntermediate).toBe(false)
      expect(node2?.isIntermediate).toBe(false)
      expect(node1?.originalWayId).toBeUndefined()
      expect(node2?.originalWayId).toBeUndefined()
    })

    it('should handle very long segments', () => {
      const osmData: OSMData = {
        nodes: new Map([
          ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
          ['node2', { id: 'node2', lat: 50.01, lon: 10.0 }], // ~1111m
        ]),
        ways: [
          {
            id: 'way1',
            nodes: ['node1', 'node2'],
            tags: { highway: 'path' },
          },
        ],
      }

      const result = buildRoutingGraph(osmData)

      // 1111m / 25m = 44.4, so should need 44 intermediate nodes (45 segments)
      const intermediateNodes = Array.from(result.nodes.values()).filter(
        (node) => node.isIntermediate === true
      )
      expect(intermediateNodes.length).toBe(44)

      // All segments should be <= 25m
      // Sort intermediate nodes by their numeric suffix to get correct order
      const sortedIntermediateNodes = [...intermediateNodes].sort((a, b) => {
        const aNum = parseInt(a.id.match(/int(\d+)$/)?.[1] || '0')
        const bNum = parseInt(b.id.match(/int(\d+)$/)?.[1] || '0')
        return aNum - bNum
      })

      const allNodeIds = [
        'node1',
        ...sortedIntermediateNodes.map((n) => n.id),
        'node2',
      ]
      for (let i = 0; i < allNodeIds.length - 1; i++) {
        const fromNode = result.nodes.get(allNodeIds[i])!
        const toNode = result.nodes.get(allNodeIds[i + 1])!

        const dist = distance(
          [fromNode.lon, fromNode.lat],
          [toNode.lon, toNode.lat],
          { units: 'meters' }
        )

        expect(dist).toBeLessThanOrEqual(25)
      }
    })
  })
})
