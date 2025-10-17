import {
  RouteSegment,
  RouteWaypoint,
  ElevationPoint,
  ElevationStats,
  NodeWaypoint,
} from '../types'
import { Router } from './router'

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
          Route.#createSegmentWithFallbackStatic(
            fromWaypoint,
            toWaypoint,
            router
          )
        )
      }
    }

    return new Route(newSegments, waypoints, elevationProfile, elevationStats)
  }

  /**
   * Static helper for creating segments with fallback logic
   * Tries routing first for node-to-node connections, falls back to straight line if routing fails
   */
  static #createSegmentWithFallbackStatic(
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
   * Creates a route segment with fallback logic
   * Tries routing first for node-to-node connections, falls back to straight line if routing fails
   */
  #createSegmentWithFallback(
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
          this.#createSegmentWithFallback(fromWaypoint, toWaypoint, router)
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
