export interface OSMNode {
  id: string
  lat: number
  lon: number
}

export interface OSMWay {
  id: string
  nodes: string[]
  tags: Record<string, string>
}

export interface OSMData {
  nodes: Map<string, OSMNode>
  ways: OSMWay[]
}

export interface GraphNode {
  id: string
  lat: number
  lon: number
}

export interface GraphEdge {
  from: string
  to: string
  weight: number
  geometry: [number, number][]
}

export interface RouteSegment {
  coordinates: [number, number][]
  distance: number
}

export interface Route {
  segments: RouteSegment[]
  waypoints: [number, number][]
  totalDistance: number
}
