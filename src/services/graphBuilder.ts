import createGraph, { Graph } from 'ngraph.graph'
import { OSMData, GraphNode } from '../types'
import { distance } from '@turf/turf'

export interface RoutingGraph {
  graph: Graph
  nodes: Map<string, GraphNode>
}

const HIGHWAY_WEIGHTS: Record<string, number> = {
  path: 1.0,
  footway: 1.0,
  pedestrian: 1.0,
  bridleway: 1.2,
  cycleway: 1.3,
  track: 1.5,
  steps: 1.5,
  living_street: 1.4,
  service: 1.5,
  residential: 1.6,
  unclassified: 1.7,
  road: 1.7,
  tertiary: 1.8,
  tertiary_link: 1.8,
  secondary: 2.0,
  secondary_link: 2.0,
}

export function buildRoutingGraph(osmData: OSMData): RoutingGraph {
  const graph = createGraph()
  const nodes = new Map<string, GraphNode>()

  // Add all nodes to our lookup
  osmData.nodes.forEach((node, id) => {
    nodes.set(id, {
      id,
      lat: node.lat,
      lon: node.lon,
    })
  })

  // Add edges from ways
  for (const way of osmData.ways) {
    const highway = way.tags.highway || 'path'
    const weight = HIGHWAY_WEIGHTS[highway] || 1.5

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromId = way.nodes[i]
      const toId = way.nodes[i + 1]

      const fromNode = osmData.nodes.get(fromId)
      const toNode = osmData.nodes.get(toId)

      if (!fromNode || !toNode) continue

      // Calculate distance in meters
      const dist = distance(
        [fromNode.lon, fromNode.lat],
        [toNode.lon, toNode.lat],
        { units: 'meters' }
      )

      // Weight the edge
      const edgeWeight = dist * weight

      // Add bidirectional edges
      graph.addLink(fromId, toId, edgeWeight)
      graph.addLink(toId, fromId, edgeWeight)
    }
  }

  return { graph, nodes }
}
