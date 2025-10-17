import {
  RouteSegment,
  RouteWaypoint,
  ElevationPoint,
  ElevationStats,
} from '../types'

export class Route {
  public segments: RouteSegment[]
  public waypoints: RouteWaypoint[]
  public totalDistance: number
  private _elevationProfile?: ElevationPoint[]
  private _elevationStats?: ElevationStats

  constructor(
    segments: RouteSegment[],
    waypoints: RouteWaypoint[],
    totalDistance: number,
    elevationProfile?: ElevationPoint[],
    elevationStats?: ElevationStats
  ) {
    this.segments = segments
    this.waypoints = waypoints
    this.totalDistance = totalDistance
    this._elevationProfile = elevationProfile
    this._elevationStats = elevationStats
  }

  get elevationProfile(): ElevationPoint[] | undefined {
    return this._elevationProfile
  }

  get elevationStats(): ElevationStats | undefined {
    return this._elevationStats
  }
}
