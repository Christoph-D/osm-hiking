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
  public elevationProfile?: ElevationPoint[]
  public elevationStats?: ElevationStats

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
    this.elevationProfile = elevationProfile
    this.elevationStats = elevationStats
  }
}
