import { describe, it, expect } from 'vitest'
import { buildRoutingGraph } from './graphBuilder'
import { OSMData } from '../types'

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
    })
    expect(result.nodes.get('node2')).toEqual({
      id: 'node2',
      lat: 50.1,
      lon: 10.1,
    })
  })

  it('should create bidirectional edges from ways', () => {
    const osmData: OSMData = {
      nodes: new Map([
        ['node1', { id: 'node1', lat: 50.0, lon: 10.0 }],
        ['node2', { id: 'node2', lat: 50.001, lon: 10.001 }],
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
        ['node2', { id: 'node2', lat: 50.001, lon: 10.001 }],
        ['node3', { id: 'node3', lat: 50.002, lon: 10.002 }],
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
        ['node2', { id: 'node2', lat: 50.001, lon: 10.001 }],
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
        ['node2', { id: 'node2', lat: 50.001, lon: 10.001 }],
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
        ['node2', { id: 'node2', lat: 50.001, lon: 10.001 }],
        ['node3', { id: 'node3', lat: 50.002, lon: 10.002 }],
        ['node4', { id: 'node4', lat: 50.003, lon: 10.003 }],
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
    })
  })
})
