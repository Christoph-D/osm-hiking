import { OSMData, OSMNode, OSMWay } from '../types'

/**
 * Generate mock OSM data for testing
 */
export function createMockOSMData(options?: {
  nodeCount?: number
  wayCount?: number
}): OSMData {
  const nodeCount = options?.nodeCount ?? 10
  const wayCount = options?.wayCount ?? 3

  const nodes = new Map<string, OSMNode>()

  // Create nodes in a grid pattern
  for (let i = 0; i < nodeCount; i++) {
    const id = `node_${i}`
    const lat = 50.0 + i * 0.001
    const lon = 10.0 + (i % 3) * 0.001
    nodes.set(id, { id, lat, lon })
  }

  // Create ways connecting nodes
  const ways: OSMWay[] = []
  for (let i = 0; i < wayCount; i++) {
    const startIdx = i * Math.floor(nodeCount / wayCount)
    const endIdx = Math.min(startIdx + 3, nodeCount)
    const nodeIds: string[] = []
    for (let j = startIdx; j < endIdx; j++) {
      nodeIds.push(`node_${j}`)
    }
    ways.push({
      id: `way_${i}`,
      nodes: nodeIds,
      tags: { highway: 'path' },
    })
  }

  return { nodes, ways }
}

/**
 * Create mock elevation data
 */
export function createMockElevations(
  count: number,
  pattern: 'flat' | 'uphill' | 'downhill' | 'mountain' = 'flat'
): number[] {
  const elevations: number[] = []

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1)
    let elevation: number

    switch (pattern) {
      case 'uphill':
        elevation = 100 + progress * 400 // 100m to 500m
        break
      case 'downhill':
        elevation = 500 - progress * 400 // 500m to 100m
        break
      case 'mountain':
        // Up then down: 100m -> 800m -> 200m
        if (progress < 0.5) {
          elevation = 100 + progress * 2 * 700
        } else {
          elevation = 800 - (progress - 0.5) * 2 * 600
        }
        break
      case 'flat':
      default:
        elevation = 100
        break
    }

    elevations.push(elevation)
  }

  return elevations
}

/**
 * Create mock coordinates for testing
 */
export function createMockCoordinates(count: number): Array<[number, number]> {
  const coordinates: Array<[number, number]> = []

  for (let i = 0; i < count; i++) {
    const lon = 10.0 + i * 0.001
    const lat = 50.0 + i * 0.001
    coordinates.push([lon, lat])
  }

  return coordinates
}
