import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateDistances,
  subdividePathEqually,
  calculateElevationStats,
  fetchElevations,
} from './elevation'

describe('calculateDistances', () => {
  it('should return [0] for single point', () => {
    const coordinates: [number, number][] = [[10.0, 50.0]]
    const result = calculateDistances(coordinates)
    expect(result).toEqual([0])
  })

  it('should calculate cumulative distances for multiple points', () => {
    // Points roughly 111km apart in latitude (1 degree ≈ 111km)
    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.0, 51.0],
      [10.0, 52.0],
    ]
    const result = calculateDistances(coordinates)

    expect(result[0]).toBe(0)
    expect(result[1]).toBeGreaterThan(110000) // ~111km
    expect(result[1]).toBeLessThan(112000)
    expect(result[2]).toBeGreaterThan(220000) // ~222km cumulative
    expect(result[2]).toBeLessThan(224000)
  })

  it('should handle empty array', () => {
    const coordinates: [number, number][] = []
    const result = calculateDistances(coordinates)
    expect(result).toEqual([0])
  })

  it('should return correct distances for close points', () => {
    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.001, 50.001],
    ]
    const result = calculateDistances(coordinates)

    expect(result[0]).toBe(0)
    expect(result[1]).toBeGreaterThan(0)
    expect(result[1]).toBeLessThan(200) // Should be ~157m
  })
})

describe('subdividePathEqually', () => {
  it('should return original coordinates for < 2 points', () => {
    const singlePoint: [number, number][] = [[10.0, 50.0]]
    const result = subdividePathEqually(singlePoint, 10)
    expect(result).toEqual(singlePoint)

    const empty: [number, number][] = []
    const result2 = subdividePathEqually(empty, 10)
    expect(result2).toEqual(empty)
  })

  it('should generate requested number of points', () => {
    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.1, 50.1],
    ]
    const numPoints = 10
    const result = subdividePathEqually(coordinates, numPoints)

    expect(result).toHaveLength(numPoints)
  })

  it('should start and end at original coordinates', () => {
    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.1, 50.1],
      [10.2, 50.2],
    ]
    const result = subdividePathEqually(coordinates, 20)

    expect(result[0]).toEqual(coordinates[0])
    expect(result[result.length - 1]).toEqual(
      coordinates[coordinates.length - 1]
    )
  })

  it('should create evenly spaced points along straight line', () => {
    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [11.0, 50.0],
    ]
    const numPoints = 5
    const result = subdividePathEqually(coordinates, numPoints)

    expect(result).toHaveLength(5)
    // Check that longitude increases evenly (latitude stays 50.0)
    expect(result[0][0]).toBeCloseTo(10.0, 5)
    expect(result[1][0]).toBeGreaterThan(10.0)
    expect(result[1][0]).toBeLessThan(10.5)
    expect(result[4][0]).toBeCloseTo(11.0, 5)
  })

  it('should handle path with zero total distance', () => {
    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.0, 50.0],
      [10.0, 50.0],
    ]
    const result = subdividePathEqually(coordinates, 10)

    expect(result).toEqual([[10.0, 50.0]])
  })

  it('should handle curved paths', () => {
    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.05, 50.05],
      [10.1, 50.0],
    ]
    const result = subdividePathEqually(coordinates, 10)

    expect(result).toHaveLength(10)
    expect(result[0]).toEqual(coordinates[0])
    expect(result[result.length - 1]).toEqual(
      coordinates[coordinates.length - 1]
    )
  })
})

describe('calculateElevationStats', () => {
  it('should calculate stats for flat terrain', () => {
    const elevations = [100, 100, 100, 100]
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(100)
    expect(stats.max).toBe(100)
    expect(stats.gain).toBe(0)
    expect(stats.loss).toBe(0)
  })

  it('should calculate stats for uphill route', () => {
    const elevations = [100, 200, 300, 400, 500]
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(100)
    expect(stats.max).toBe(500)
    expect(stats.gain).toBe(400)
    expect(stats.loss).toBe(0)
  })

  it('should calculate stats for downhill route', () => {
    const elevations = [500, 400, 300, 200, 100]
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(100)
    expect(stats.max).toBe(500)
    expect(stats.gain).toBe(0)
    expect(stats.loss).toBe(400)
  })

  it('should calculate stats for mountain pass (up then down)', () => {
    const elevations = [100, 300, 500, 300, 100]
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(100)
    expect(stats.max).toBe(500)
    expect(stats.gain).toBe(400) // 100->300->500
    expect(stats.loss).toBe(400) // 500->300->100
  })

  it('should calculate stats for mixed terrain', () => {
    const elevations = [100, 150, 120, 180, 160]
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(100)
    expect(stats.max).toBe(180)
    expect(stats.gain).toBe(110) // 100->150 (50) + 120->180 (60)
    expect(stats.loss).toBe(50) // 150->120 (30) + 180->160 (20)
  })

  it('should handle single elevation point', () => {
    const elevations = [250]
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(250)
    expect(stats.max).toBe(250)
    expect(stats.gain).toBe(0)
    expect(stats.loss).toBe(0)
  })

  it('should handle empty array', () => {
    const elevations: number[] = []
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(Infinity)
    expect(stats.max).toBe(-Infinity)
    expect(stats.gain).toBe(0)
    expect(stats.loss).toBe(0)
  })

  it('should handle negative elevations', () => {
    const elevations = [-10, 0, 20, -5]
    const stats = calculateElevationStats(elevations)

    expect(stats.min).toBe(-10)
    expect(stats.max).toBe(20)
    expect(stats.gain).toBe(30) // -10->0 (10) + 0->20 (20)
    expect(stats.loss).toBe(25) // 20->-5 (25)
  })
})

describe('fetchElevations', () => {
  beforeEach(() => {
    // Mock fetch globally
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch elevations for coordinates', async () => {
    const mockResponse = {
      results: [
        { latitude: 50.0, longitude: 10.0, elevation: 100 },
        { latitude: 50.1, longitude: 10.1, elevation: 200 },
      ],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.1, 50.1],
    ]
    const result = await fetchElevations(coordinates)

    expect(result).toEqual([100, 200])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should batch requests for > 100 points', async () => {
    // Mock fetch to return correct number of results based on request
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockImplementation(
      async (_url: string, options: { body?: string }) => {
        const body = JSON.parse(options.body as string)
        const locations = body.locations
        const results = locations.map(
          (loc: { latitude: number; longitude: number }) => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            elevation: 100,
          })
        )
        return {
          ok: true,
          json: async () => ({ results }),
        } as Response
      }
    )

    const coordinates: [number, number][] = Array(250)
      .fill(null)
      .map((_, i) => [10.0 + i * 0.01, 50.0 + i * 0.01])

    const result = await fetchElevations(coordinates)

    // Should make 3 requests (100 + 100 + 50)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(250)
  })

  it('should return zeros on API error', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    } as Response)

    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.1, 50.1],
    ]
    const result = await fetchElevations(coordinates)

    expect(result).toEqual([0, 0])
  })

  it('should return zeros on network error', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const coordinates: [number, number][] = [
      [10.0, 50.0],
      [10.1, 50.1],
    ]
    const result = await fetchElevations(coordinates)

    expect(result).toEqual([0, 0])
  })

  it('should convert [lon, lat] to API format {latitude, longitude}', async () => {
    const mockResponse = {
      results: [{ latitude: 50.0, longitude: 10.0, elevation: 150 }],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const coordinates: [number, number][] = [[10.0, 50.0]]
    await fetchElevations(coordinates)

    const fetchCall = mockFetch.mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body as string)

    expect(requestBody.locations).toEqual([{ latitude: 50.0, longitude: 10.0 }])
  })
})
