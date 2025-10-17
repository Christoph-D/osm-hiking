import {
  RouteSegment,
  RouteWaypoint,
  ElevationPoint,
  ElevationStats,
} from '../types'
import { calculateTotalDistance } from '../utils/mapHelpers'

export class Route {
  public segments: RouteSegment[]
  public waypoints: RouteWaypoint[]
  private _totalDistance: number
  private _elevationProfile?: ElevationPoint[]
  private _elevationStats?: ElevationStats

  constructor(
    segments: RouteSegment[],
    waypoints: RouteWaypoint[],
    elevationProfile?: ElevationPoint[],
    elevationStats?: ElevationStats
  ) {
    this.segments = segments
    this.waypoints = waypoints
    this._totalDistance = calculateTotalDistance(segments)
    this._elevationProfile = elevationProfile
    this._elevationStats = elevationStats
  }

  get totalDistance(): number {
    return this._totalDistance
  }

  get elevationProfile(): ElevationPoint[] | undefined {
    return this._elevationProfile
  }

  get elevationStats(): ElevationStats | undefined {
    return this._elevationStats
  }
}
