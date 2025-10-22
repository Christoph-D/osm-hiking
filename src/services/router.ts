import { aStar } from 'ngraph.path'
import { RoutingGraph } from './graphBuilder'
import { distance } from '@turf/turf'
import { RouteSegment, Waypoint, GraphNode } from '../types'
import { generateSegmentId } from '../utils/mapHelpers'

export class Router {
  private graph: RoutingGraph

  constructor(graph: RoutingGraph) {
    this.graph = graph
  }

  // Get a node by ID
  getNode(nodeId: number) {
    return this.graph.nodes.get(nodeId)
  }

  // Find the nearest node and return node ID, distance, and node data
  findNearestNode(
    lat: number,
    lon: number,
    maxDistance: number
  ): { nodeId: number; distance: number; node: GraphNode } | null {
    let nearestId: number | null = null
    let minDist = Infinity
    let nearestNode: GraphNode | null = null

    this.graph.nodes.forEach((node, id) => {
      const dist = distance([lon, lat], [node.lon, node.lat], {
        units: 'meters',
      })

      if (dist < minDist) {
        minDist = dist
        nearestId = id
        nearestNode = node
      }
    })

    // Return null if the nearest node is too far away
    if (minDist > maxDistance) {
      return null
    }

    return { nodeId: nearestId!, distance: minDist, node: nearestNode! }
  }

  // Route between two nodes
  route(fromId: number, toId: number): RouteSegment | null {
    const graph = this.graph
    const pathFinder = aStar(this.graph.graph, {
      distance(_fromNode, _toNode, link) {
        return link.data || 0
      },
      heuristic(fromNode, toNode) {
        const from = fromNode.id as number
        const to = toNode.id as number
        const fromData = graph.nodes.get(from)
        const toData = graph.nodes.get(to)

        if (!fromData || !toData) return 0

        return distance(
          [fromData.lon, fromData.lat],
          [toData.lon, toData.lat],
          { units: 'meters' }
        )
      },
    })

    const path = pathFinder.find(fromId, toId)

    if (!path || path.length === 0) {
      return null
    }

    // The ngraph.path library returns the path from toId to fromId (reversed)
    // We need to reverse it to get fromId to toId
    const firstNodeId = path[0].id as number
    const lastNodeId = path[path.length - 1].id as number
    const needsReverse = firstNodeId === toId && lastNodeId === fromId

    const orderedPath = needsReverse ? [...path].reverse() : path

    const coordinates: Waypoint[] = []
    let totalDistance = 0

    for (let i = 0; i < orderedPath.length; i++) {
      const nodeId = orderedPath[i].id as number
      const node = this.graph.nodes.get(nodeId)

      if (node) {
        coordinates.push({ lat: node.lat, lon: node.lon })

        if (i > 0) {
          const prevNode = this.graph.nodes.get(orderedPath[i - 1].id as number)
          if (prevNode) {
            totalDistance += distance(
              [prevNode.lon, prevNode.lat],
              [node.lon, node.lat],
              { units: 'meters' }
            )
          }
        }
      }
    }

    return {
      id: generateSegmentId(),
      coordinates,
      distance: totalDistance,
    }
  }

  // Create a straight-line segment between two waypoints (for custom waypoints)
  createStraightSegment(
    fromWaypoint: Waypoint,
    toWaypoint: Waypoint
  ): RouteSegment {
    const coordinates = [fromWaypoint, toWaypoint]
    const totalDistance = distance(
      [fromWaypoint.lon, fromWaypoint.lat],
      [toWaypoint.lon, toWaypoint.lat],
      { units: 'meters' }
    )

    return {
      id: generateSegmentId(),
      coordinates,
      distance: totalDistance,
    }
  }
}
