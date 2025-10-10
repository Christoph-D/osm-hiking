import { OSMData, OSMNode, OSMWay } from '../types'

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

export async function fetchOSMData(bbox: {
  south: number
  west: number
  north: number
  east: number
}): Promise<OSMData> {
  const query = `
    [out:json][timeout:25];
    (
      way["highway"~"^(path|footway|track|bridleway|cycleway|steps|residential|unclassified|tertiary|tertiary_link|secondary|secondary_link|service|pedestrian|living_street|road)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out body;
    >;
    out skel qt;
  `

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.statusText}`)
  }

  const data = await response.json()
  return parseOSMData(data)
}

interface OSMResponse {
  elements: Array<{
    type: string
    id: number
    lat?: number
    lon?: number
    nodes?: number[]
    tags?: Record<string, string>
  }>
}

function parseOSMData(osmResponse: OSMResponse): OSMData {
  const nodes = new Map<string, OSMNode>()
  const ways: OSMWay[] = []

  for (const element of osmResponse.elements) {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      nodes.set(element.id.toString(), {
        id: element.id.toString(),
        lat: element.lat,
        lon: element.lon,
      })
    } else if (element.type === 'way' && element.nodes) {
      ways.push({
        id: element.id.toString(),
        nodes: element.nodes.map((n: number) => n.toString()),
        tags: element.tags || {},
      })
    }
  }

  return { nodes, ways }
}
