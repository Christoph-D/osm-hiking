import {
  RouteSegment,
  RouteWaypoint,
  ElevationPoint,
  ElevationStats,
  NodeWaypoint,
} from '../types'
import { Router } from './router'

/**
 * Creates a route segment with fallback logic
 * Tries routing first for node-to-node connections, falls back to straight line if routing fails
 */
function createSegmentWithFallback(
  fromWaypoint: RouteWaypoint,
  toWaypoint: RouteWaypoint,
  router: Router
): RouteSegment {
  if (fromWaypoint.type === 'node' && toWaypoint.type === 'node') {
    // Both are node waypoints - try routing first
    const segment = router.route(
      (fromWaypoint as NodeWaypoint).nodeId,
      (toWaypoint as NodeWaypoint).nodeId
    )
    if (segment) {
      return segment
    }
    // Fallback to straight line if routing fails
  }

  // Default to straight line for mixed waypoint types or routing fallback
  return router.createStraightSegment(fromWaypoint, toWaypoint)
}

export class Route {
  readonly #segments: RouteSegment[]
  readonly #waypoints: RouteWaypoint[]
  readonly #totalDistance: number
  readonly #elevationProfile?: ElevationPoint[]
  readonly #elevationStats?: ElevationStats

  constructor(
    segments: RouteSegment[],
    waypoints: RouteWaypoint[],
    elevationProfile?: ElevationPoint[],
    elevationStats?: ElevationStats
  ) {
    // For 0 or 1 waypoints, there should be 0 segments
    // For 2+ waypoints, segments should be waypoints.length - 1
    const expectedSegmentsLength = Math.max(0, waypoints.length - 1)
    if (segments.length !== expectedSegmentsLength) {
      throw new Error(
        `Segments length must be waypoints.length - 1. Got ${segments.length} segments and ${waypoints.length} waypoints (expected ${expectedSegmentsLength} segments).`
      )
    }

    this.#segments = segments
    this.#waypoints = waypoints
    this.#totalDistance = segments.reduce(
      (sum, segment) => sum + segment.distance,
      0
    )
    this.#elevationProfile = elevationProfile
    this.#elevationStats = elevationStats
  }

  /**
   * Creates a Route from waypoints and calculates all segments
   */
  static fromWaypoints(
    waypoints: RouteWaypoint[],
    router: Router,
    elevationProfile?: ElevationPoint[],
    elevationStats?: ElevationStats
  ): Route {
    const newSegments: RouteSegment[] = []

    // Create segments between consecutive waypoints
    for (let i = 1; i < waypoints.length; i++) {
      const fromWaypoint = waypoints[i - 1]
      const toWaypoint = waypoints[i]
      newSegments.push(
        createSegmentWithFallback(fromWaypoint, toWaypoint, router)
      )
    }

    return new Route(newSegments, waypoints, elevationProfile, elevationStats)
  }

  get segments(): RouteSegment[] {
    return this.#segments
  }

  get waypoints(): RouteWaypoint[] {
    return this.#waypoints
  }

  get totalDistance(): number {
    return this.#totalDistance
  }

  get elevationProfile(): ElevationPoint[] | undefined {
    return this.#elevationProfile
  }

  get elevationStats(): ElevationStats | undefined {
    return this.#elevationStats
  }

  /**
   * Deletes a waypoint and recalculates only affected segments
   */
  deleteWaypoint(index: number, router: Router): Route {
    if (!this.#waypoints || index < 0 || index >= this.#waypoints.length) {
      return this
    }

    // Create new waypoints array without the deleted waypoint
    const newWaypoints = [...this.#waypoints]
    newWaypoints.splice(index, 1)

    const newSegments: RouteSegment[] = []

    for (let i = 1; i < newWaypoints.length; i++) {
      if (i < index) {
        // Segments before deleted waypoint can be preserved
        newSegments.push(this.#segments[i - 1])
      } else if (i === index) {
        // This is the segment that needs recalculation (connects waypoints around deleted waypoint)
        const fromWaypoint = newWaypoints[i - 1]
        const toWaypoint = newWaypoints[i]
        newSegments.push(
          createSegmentWithFallback(fromWaypoint, toWaypoint, router)
        )
      } else {
        // Segments after deleted waypoint can be preserved (shifted by 1)
        newSegments.push(this.#segments[i])
      }
    }

    return new Route(newSegments, newWaypoints)
  }

  /**
   * Adds a waypoint to the route with optimized segment recalculation
   */
  addWaypoint(newWaypoint: RouteWaypoint, router: Router): Route {
    if (!this.#waypoints || this.#waypoints.length === 0) {
      return this
    }

    const insertIndex = this.#findInsertionIndex(newWaypoint, router)

    if (insertIndex !== null) {
      // Insert waypoint at the correct position - only recalculate affected segments
      const newRouteWaypoints = [...this.#waypoints]
      newRouteWaypoints.splice(insertIndex, 0, newWaypoint)

      // Create temporary route with dummy segments
      const tempSegments: RouteSegment[] = [
        ...this.#segments.slice(0, insertIndex),
        { coordinates: [], distance: 0 }, // Dummy segment for the inserted waypoint
        ...this.#segments.slice(insertIndex),
      ]

      const tempRoute = new Route(tempSegments, newRouteWaypoints)
      return tempRoute.recalculateAffectedSegments(insertIndex, router)
    } else {
      // Append to end - add new segment connecting last waypoint to new waypoint
      const newSegments = [...this.#segments]
      if (this.#waypoints.length > 0) {
        // Add segment connecting last waypoint to new waypoint
        newSegments.push(
          createSegmentWithFallback(
            this.#waypoints[this.#waypoints.length - 1],
            newWaypoint,
            router
          )
        )
      }

      return new Route(newSegments, [...this.#waypoints, newWaypoint])
    }
  }

  /**
   * Recalculates only the segment at the given index
   */
  recalculateSegment(index: number, router: Router): Route {
    if (index < 0 || index >= this.#segments.length) {
      console.warn(
        `recalculateSegment: Invalid index ${index} for route with ${this.#segments.length} segments`
      )
      return this
    }

    const newSegments = [...this.#segments]

    const fromWaypoint = this.#waypoints[index]
    const toWaypoint = this.#waypoints[index + 1]
    newSegments[index] = createSegmentWithFallback(
      fromWaypoint,
      toWaypoint,
      router
    )

    return new Route(
      newSegments,
      this.#waypoints,
      this.#elevationProfile,
      this.#elevationStats
    )
  }

  /**
   * Recalculates only the segments affected by dragging a waypoint
   * Optimized version that only recalculates segments before and after the dragged waypoint
   */
  recalculateAffectedSegments(affectedIndex: number, router: Router): Route {
    // Recalculate segment before the dragged waypoint (if it exists)
    if (affectedIndex > 0) {
      let newRoute = this.recalculateSegment(affectedIndex - 1, router)

      // Recalculate segment after the dragged waypoint (if it exists)
      if (affectedIndex < this.#waypoints.length - 1) {
        newRoute = newRoute.recalculateSegment(affectedIndex, router)
      }

      return newRoute
    } else {
      // Only recalculate segment after the dragged waypoint (if it exists)
      if (affectedIndex < this.#waypoints.length - 1) {
        return this.recalculateSegment(affectedIndex, router)
      }

      // No segments to recalculate
      return this
    }
  }

  /**
   * Finds the index where a waypoint should be inserted
   * Returns the index where the waypoint should be inserted, or null if it should be appended
   */
  #findInsertionIndex(
    routeWaypoint: RouteWaypoint,
    router: Router
  ): number | null {
    if (this.#segments.length === 0) {
      return null
    }
    // Only node waypoints can be inserted - custom waypoints are always appended
    if (routeWaypoint.type !== 'node') {
      return null
    }

    const nodeId = (routeWaypoint as NodeWaypoint).nodeId
    const node = router.getNode(nodeId)
    if (!node) return null

    // Check each segment
    for (let segmentIdx = 0; segmentIdx < this.#segments.length; segmentIdx++) {
      const segment = this.#segments[segmentIdx]

      // Check if this node's coordinates match any coordinate in this segment
      for (const coordinate of segment.coordinates) {
        if (coordinate.lon === node.lon && coordinate.lat === node.lat) {
          // Node is on this segment, so it should be inserted after waypoint at segmentIdx
          // and before waypoint at segmentIdx+1
          return segmentIdx + 1
        }
      }
    }

    return null
  }

  /**
   * Recalculates all route segments using the current waypoints
   */
  recalculateAllSegments(router: Router): Route {
    const newSegments: RouteSegment[] = []

    // If there are 0 or 1 waypoints, return a route with no segments
    if (this.#waypoints.length <= 1) {
      return new Route(
        [],
        this.#waypoints,
        this.#elevationProfile,
        this.#elevationStats
      )
    }

    for (let i = 1; i < this.#waypoints.length; i++) {
      const fromWaypoint = this.#waypoints[i - 1]
      const toWaypoint = this.#waypoints[i]
      newSegments.push(
        createSegmentWithFallback(fromWaypoint, toWaypoint, router)
      )
    }

    return new Route(
      newSegments,
      this.#waypoints,
      this.#elevationProfile,
      this.#elevationStats
    )
  }
}
