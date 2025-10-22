export interface OSMNode {
  id: number
  lat: number
  lon: number
}

export interface OSMWay {
  id: number
  nodes: number[]
  tags: Record<string, string>
}

export interface OSMData {
  nodes: Map<number, OSMNode>
  ways: OSMWay[]
}

export interface GraphNode {
  id: number
  lat: number
  lon: number
}

export interface RouteSegment {
  id: string
  coordinates: Waypoint[]
  distance: number
}

export interface ElevationPoint {
  distance: number // Cumulative distance in meters
  elevation: number // Elevation in meters
  lat: number
  lon: number
}

export interface ElevationStats {
  gain: number // Total elevation gain in meters
  loss: number // Total elevation loss in meters
  min: number // Minimum elevation in meters
  max: number // Maximum elevation in meters
}

export interface Waypoint {
  lat: number
  lon: number
}

export interface CustomWaypoint extends Waypoint {
  type: 'custom'
}

export interface NodeWaypoint extends Waypoint {
  type: 'node'
  nodeId: number
}

export type RouteWaypoint = CustomWaypoint | NodeWaypoint
