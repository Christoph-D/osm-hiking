import createGraph, { Graph } from 'ngraph.graph'
import { OSMData, GraphNode, OSMNode } from '../types'
import { distance, bearing, destination } from '@turf/turf'

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

// Maximum distance in meters between connected nodes
const MAX_SEGMENT_LENGTH = 25

/**
 * Generate intermediate nodes between two points if the distance exceeds MAX_SEGMENT_LENGTH
 */
function generateIntermediateNodes(
  fromNode: OSMNode,
  toNode: OSMNode,
  wayId: string,
  segmentIndex: number
): {
  nodes: GraphNode[]
  edges: Array<{ from: string; to: string; distance: number }>
} {
  const dist = distance(
    [fromNode.lon, fromNode.lat],
    [toNode.lon, toNode.lat],
    { units: 'meters' }
  )

  // If distance is within limit, return empty arrays (no subdivision needed)
  if (dist <= MAX_SEGMENT_LENGTH) {
    return { nodes: [], edges: [] }
  }

  // Calculate number of intermediate nodes needed
  const numSegments = Math.ceil(dist / MAX_SEGMENT_LENGTH)
  const numIntermediateNodes = numSegments - 1

  // Get bearing for consistent interpolation
  const bearingAngle = bearing(
    [fromNode.lon, fromNode.lat],
    [toNode.lon, toNode.lat]
  )

  // Generate intermediate nodes
  const nodes: GraphNode[] = []
  for (let i = 1; i <= numIntermediateNodes; i++) {
    const fraction = i / numSegments
    const intermediateDist = dist * fraction

    // Calculate position at this distance along the bearing
    const destinationPoint = destination(
      [fromNode.lon, fromNode.lat],
      intermediateDist,
      bearingAngle,
      { units: 'meters' }
    )

    const nodeId = `${wayId}_seg${segmentIndex}_int${i}`
    const node: GraphNode = {
      id: nodeId,
      lat: destinationPoint.geometry.coordinates[1],
      lon: destinationPoint.geometry.coordinates[0],
      originalWayId: wayId,
      isIntermediate: true,
    }
    nodes.push(node)
  }

  // Calculate all edge distances
  const allPoints = [
    fromNode,
    ...nodes.map((n) => ({ lat: n.lat, lon: n.lon })),
    toNode,
  ]

  const edges: Array<{ from: string; to: string; distance: number }> = []
  for (let i = 0; i < allPoints.length - 1; i++) {
    const from = allPoints[i]
    const to = allPoints[i + 1]
    const edgeDistance = distance([from.lon, from.lat], [to.lon, to.lat], {
      units: 'meters',
    })

    let fromId: string
    let toId: string

    if (i === 0) {
      fromId = fromNode.id
    } else {
      fromId = nodes[i - 1].id
    }

    if (i === allPoints.length - 2) {
      toId = toNode.id
    } else {
      toId = nodes[i].id
    }

    edges.push({ from: fromId, to: toId, distance: edgeDistance })
  }

  return { nodes, edges }
}

export function buildRoutingGraph(osmData: OSMData): RoutingGraph {
  const graph = createGraph()
  const nodes = new Map<string, GraphNode>()

  // Add all original OSM nodes to our lookup
  osmData.nodes.forEach((node, id) => {
    nodes.set(id, {
      id,
      lat: node.lat,
      lon: node.lon,
      isIntermediate: false,
    })
  })

  // Add edges from ways with subdivision
  for (const way of osmData.ways) {
    const highway = way.tags.highway || 'path'
    const weight = HIGHWAY_WEIGHTS[highway] || 1.5

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromId = way.nodes[i]
      const toId = way.nodes[i + 1]

      const fromNode = osmData.nodes.get(fromId)
      const toNode = osmData.nodes.get(toId)

      if (!fromNode || !toNode) continue

      // Generate intermediate nodes if needed
      const { nodes: intermediateNodes, edges } = generateIntermediateNodes(
        fromNode,
        toNode,
        way.id,
        i
      )

      // Add intermediate nodes to the global nodes map
      intermediateNodes.forEach((node) => {
        nodes.set(node.id, node)
      })

      // Add edges with subdivision
      if (edges.length > 0) {
        // Use subdivided edges
        edges.forEach((edge) => {
          const edgeWeight = edge.distance * weight
          graph.addLink(edge.from, edge.to, edgeWeight)
          graph.addLink(edge.to, edge.from, edgeWeight)
        })
      } else {
        // No subdivision needed - create direct edge
        const dist = distance(
          [fromNode.lon, fromNode.lat],
          [toNode.lon, toNode.lat],
          { units: 'meters' }
        )
        const edgeWeight = dist * weight
        graph.addLink(fromId, toId, edgeWeight)
        graph.addLink(toId, fromId, edgeWeight)
      }
    }
  }

  return { graph, nodes }
}
