import { aStar } from 'ngraph.path'
import { RoutingGraph } from './graphBuilder'
import { distance } from '@turf/turf'
import { RouteSegment, Waypoint } from '../types'

export class Router {
  private graph: RoutingGraph

  constructor(graph: RoutingGraph) {
    this.graph = graph
  }

  // Get a node by ID
  getNode(nodeId: string) {
    return this.graph.nodes.get(nodeId)
  }

  // Find the nearest node to a clicked point
  findNearestNode(
    lat: number,
    lon: number,
    maxDistance: number
  ): string | null {
    const result = this.findNearestNodeWithDistance(lat, lon, maxDistance)
    return result?.nodeId || null
  }

  // Find the nearest node and return both node ID and distance
  findNearestNodeWithDistance(
    lat: number,
    lon: number,
    maxDistance: number
  ): { nodeId: string; distance: number } | null {
    let nearestId: string | null = null
    let minDist = Infinity

    console.log(
      `Searching for nearest node among ${this.graph.nodes.size} nodes`
    )
    console.log(`Click coords: lat=${lat}, lon=${lon}`)

    let sampleCount = 0
    this.graph.nodes.forEach((node, id) => {
      // Log first node to verify coordinate format
      if (sampleCount === 0) {
        console.log(`Sample node: id=${id}, lat=${node.lat}, lon=${node.lon}`)
        sampleCount++
      }

      const dist = distance([lon, lat], [node.lon, node.lat], {
        units: 'meters',
      })

      if (dist < minDist) {
        minDist = dist
        nearestId = id
      }
    })

    if (nearestId) {
      const nearestNode = this.graph.nodes.get(nearestId)
      console.log(
        `Nearest node: ${nearestId} at ${minDist.toFixed(2)}m (max: ${maxDistance}m)`
      )
      console.log(
        `Nearest node coords: lat=${nearestNode?.lat}, lon=${nearestNode?.lon}`
      )
    }

    // Return null if the nearest node is too far away
    if (minDist > maxDistance) {
      return null
    }

    return { nodeId: nearestId!, distance: minDist }
  }

  // Route between two nodes
  route(fromId: string, toId: string): RouteSegment | null {
    const graph = this.graph
    const pathFinder = aStar(this.graph.graph, {
      distance(_fromNode, _toNode, link) {
        return link.data || 0
      },
      heuristic(fromNode, toNode) {
        const from = fromNode.id as string
        const to = toNode.id as string
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
    const firstNodeId = path[0].id as string
    const lastNodeId = path[path.length - 1].id as string
    const needsReverse = firstNodeId === toId && lastNodeId === fromId

    const orderedPath = needsReverse ? [...path].reverse() : path

    const coordinates: Waypoint[] = []
    let totalDistance = 0

    for (let i = 0; i < orderedPath.length; i++) {
      const nodeId = orderedPath[i].id as string
      const node = this.graph.nodes.get(nodeId)

      if (node) {
        coordinates.push({ lat: node.lat, lon: node.lon })

        if (i > 0) {
          const prevNode = this.graph.nodes.get(orderedPath[i - 1].id as string)
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
      coordinates,
      distance: totalDistance,
    }
  }
}
