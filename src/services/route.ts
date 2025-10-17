import {
  RouteSegment,
  RouteWaypoint,
  ElevationPoint,
  ElevationStats,
} from '../types'
import { calculateTotalDistance } from '../utils/mapHelpers'

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
    this.#totalDistance = calculateTotalDistance(segments)
    this.#elevationProfile = elevationProfile
    this.#elevationStats = elevationStats
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
}
