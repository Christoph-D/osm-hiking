import Dexie, { Table } from 'dexie'
import { OSMData } from '../types'

interface CachedRegion {
  id: string
  bbox: string
  data: OSMData
  timestamp: number
}

class CacheDB extends Dexie {
  regions!: Table<CachedRegion>

  constructor() {
    super('OSMHikingCache')
    this.version(1).stores({
      regions: 'id, bbox, timestamp',
    })
  }
}

const db = new CacheDB()

function bboxToKey(bbox: { south: number; west: number; north: number; east: number }): string {
  return `${bbox.south.toFixed(3)},${bbox.west.toFixed(3)},${bbox.north.toFixed(3)},${bbox.east.toFixed(3)}`
}

export async function getCachedRegion(
  bbox: { south: number; west: number; north: number; east: number }
): Promise<OSMData | null> {
  const key = bboxToKey(bbox)
  const cached = await db.regions.get(key)

  if (!cached) return null

  // Cache for 7 days
  const maxAge = 7 * 24 * 60 * 60 * 1000
  if (Date.now() - cached.timestamp > maxAge) {
    await db.regions.delete(key)
    return null
  }

  return cached.data
}

export async function setCachedRegion(
  bbox: { south: number; west: number; north: number; east: number },
  data: OSMData
): Promise<void> {
  const key = bboxToKey(bbox)
  await db.regions.put({
    id: key,
    bbox: key,
    data,
    timestamp: Date.now(),
  })
}

export async function clearCache(): Promise<void> {
  await db.regions.clear()
}
