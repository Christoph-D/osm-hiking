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
  #segments: RouteSegment[]
  #waypoints: RouteWaypoint[]
  #totalDistance: number
  #elevationProfile?: ElevationPoint[]
  #elevationStats?: ElevationStats

  constructor(
    segments: RouteSegment[],
    waypoints: RouteWaypoint[],
    elevationProfile?: ElevationPoint[],
    elevationStats?: ElevationStats
  ) {
    if (segments.length !== waypoints.length) {
      throw new Error(
        `Segments and waypoints must have the same length. Got ${segments.length} segments and ${waypoints.length} waypoints.`
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

    for (let i = 0; i < waypoints.length; i++) {
      if (i === 0) {
        // First waypoint - just a marker
        newSegments.push({
          coordinates: [{ lat: waypoints[i].lat, lon: waypoints[i].lon }],
          distance: 0,
        })
      } else {
        const fromWaypoint = waypoints[i - 1]
        const toWaypoint = waypoints[i]
        newSegments.push(
          createSegmentWithFallback(fromWaypoint, toWaypoint, router)
        )
      }
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

    // If no waypoints left, return empty route
    if (newWaypoints.length === 0) {
      return new Route([], [])
    }

    // Create new segments array that matches the new waypoints structure
    const newSegments: RouteSegment[] = []

    for (let i = 0; i < newWaypoints.length; i++) {
      if (i === 0) {
        // First waypoint - just a marker
        newSegments.push({
          coordinates: [{ lat: newWaypoints[i].lat, lon: newWaypoints[i].lon }],
          distance: 0,
        })
      } else {
        // Determine which original segment to preserve or recalculate
        if (index === 0) {
          // Deleted first waypoint, all segments need recalculation
          const fromWaypoint = newWaypoints[i - 1]
          const toWaypoint = newWaypoints[i]
          newSegments.push(
            createSegmentWithFallback(fromWaypoint, toWaypoint, router)
          )
        } else if (i < index) {
          // Segments before deleted waypoint can be preserved
          newSegments.push(this.#segments[i])
        } else if (i === index) {
          // This is the segment that needs recalculation (connects waypoints around deleted waypoint)
          const fromWaypoint = newWaypoints[i - 1]
          const toWaypoint = newWaypoints[i]
          newSegments.push(
            createSegmentWithFallback(fromWaypoint, toWaypoint, router)
          )
        } else {
          // Segments after deleted waypoint can be preserved (shifted by 1)
          newSegments.push(this.#segments[i + 1])
        }
      }
    }

    return new Route(
      newSegments,
      newWaypoints,
      this.#elevationProfile,
      this.#elevationStats
    )
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
      const tempRoute = new Route(
        [
          ...this.#segments.slice(0, insertIndex),
          { coordinates: [], distance: 0 }, // dummy segment for inserted waypoint
          ...this.#segments.slice(insertIndex),
        ],
        newRouteWaypoints,
        this.#elevationProfile,
        this.#elevationStats
      )
      return tempRoute.recalculateAffectedSegments(insertIndex, router)
    } else {
      // Append to end - recalculate only the last segment
      const tempRoute = new Route(
        [...this.#segments, { coordinates: [], distance: 0 }], // dummy segment
        [...this.#waypoints, newWaypoint],
        this.#elevationProfile,
        this.#elevationStats
      )
      return tempRoute.recalculateAffectedSegments(
        this.#waypoints.length,
        router
      )
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

    // For the first segment (index 0), it's just a marker and shouldn't be recalculated
    if (index === 0) {
      return this
    }

    const newSegments = [...this.#segments]

    const fromWaypoint = this.#waypoints[index - 1]
    const toWaypoint = this.#waypoints[index]
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
      let newRoute = this.recalculateSegment(affectedIndex, router)

      // Recalculate segment after the dragged waypoint (if it exists)
      if (affectedIndex < this.#waypoints.length - 1) {
        newRoute = newRoute.recalculateSegment(affectedIndex + 1, router)
      }

      return newRoute
    } else {
      // Only recalculate segment after the dragged waypoint (if it exists)
      if (affectedIndex < this.#waypoints.length - 1) {
        return this.recalculateSegment(affectedIndex + 1, router)
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
    if (this.#segments.length < 2) {
      return null
    }
    // Only node waypoints can be inserted - custom waypoints are always appended
    if (routeWaypoint.type !== 'node') {
      return null
    }

    const nodeId = (routeWaypoint as NodeWaypoint).nodeId
    const node = router.getNode(nodeId)
    if (!node) return null

    // Check each segment (skip first segment which is just the starting waypoint marker)
    for (let segmentIdx = 1; segmentIdx < this.#segments.length; segmentIdx++) {
      const segment = this.#segments[segmentIdx]

      // Check if this node's coordinates match any coordinate in this segment
      for (const coordinate of segment.coordinates) {
        if (coordinate.lon === node.lon && coordinate.lat === node.lat) {
          // Node is on this segment, so it should be inserted after waypoint at segmentIdx-1
          // and before waypoint at segmentIdx
          return segmentIdx
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

    for (let i = 0; i < this.#waypoints.length; i++) {
      if (i === 0) {
        // First waypoint - just a marker
        newSegments.push({
          coordinates: [
            { lat: this.#waypoints[i].lat, lon: this.#waypoints[i].lon },
          ],
          distance: 0,
        })
      } else {
        const fromWaypoint = this.#waypoints[i - 1]
        const toWaypoint = this.#waypoints[i]
        newSegments.push(
          createSegmentWithFallback(fromWaypoint, toWaypoint, router)
        )
      }
    }

    return new Route(
      newSegments,
      this.#waypoints,
      this.#elevationProfile,
      this.#elevationStats
    )
  }
}
