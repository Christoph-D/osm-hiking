import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchOSMData } from './overpass'

describe('fetchOSMData', () => {
  beforeEach(() => {
    // Mock fetch globally
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should construct correct Overpass query with bbox', async () => {
    const mockResponse = {
      elements: [],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    await fetchOSMData(bbox)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    const requestBody = callArgs[1]?.body as string

    // Decode the URL-encoded body to check for bbox coordinates
    const decodedBody = decodeURIComponent(requestBody)
    expect(decodedBody).toContain('50')
    expect(decodedBody).toContain('10')
    expect(decodedBody).toContain('50.1')
    expect(decodedBody).toContain('10.1')
  })

  it('should fetch and parse OSM data successfully', async () => {
    const mockResponse = {
      elements: [
        {
          type: 'node',
          id: 123,
          lat: 50.0,
          lon: 10.0,
        },
        {
          type: 'node',
          id: 456,
          lat: 50.1,
          lon: 10.1,
        },
        {
          type: 'way',
          id: 789,
          nodes: [123, 456],
          tags: { highway: 'path' },
        },
      ],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    const result = await fetchOSMData(bbox)

    expect(result.nodes.size).toBe(2)
    expect(result.nodes.get('123')).toEqual({
      id: '123',
      lat: 50.0,
      lon: 10.0,
    })
    expect(result.nodes.get('456')).toEqual({
      id: '456',
      lat: 50.1,
      lon: 10.1,
    })

    expect(result.ways).toHaveLength(1)
    expect(result.ways[0]).toEqual({
      id: '789',
      nodes: ['123', '456'],
      tags: { highway: 'path' },
    })
  })

  it('should handle API errors with error message', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    await expect(fetchOSMData(bbox)).rejects.toThrow(
      'Overpass API error: Internal Server Error'
    )
  })

  it('should handle network timeout errors', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    await expect(fetchOSMData(bbox)).rejects.toThrow('Network timeout')
  })

  it('should handle invalid JSON response', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON')
      },
    } as unknown as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    await expect(fetchOSMData(bbox)).rejects.toThrow('Invalid JSON')
  })

  it('should convert OSM node IDs to strings', async () => {
    const mockResponse = {
      elements: [
        {
          type: 'node',
          id: 123456789,
          lat: 50.0,
          lon: 10.0,
        },
      ],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    const result = await fetchOSMData(bbox)

    expect(result.nodes.has('123456789')).toBe(true)
    expect(result.nodes.get('123456789')?.id).toBe('123456789')
  })

  it('should handle ways without tags', async () => {
    const mockResponse = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 50.0,
          lon: 10.0,
        },
        {
          type: 'node',
          id: 2,
          lat: 50.1,
          lon: 10.1,
        },
        {
          type: 'way',
          id: 10,
          nodes: [1, 2],
          // No tags property
        },
      ],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    const result = await fetchOSMData(bbox)

    expect(result.ways).toHaveLength(1)
    expect(result.ways[0].tags).toEqual({})
  })

  it('should filter out elements without required fields', async () => {
    const mockResponse = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 50.0,
          lon: 10.0,
        },
        {
          type: 'node',
          id: 2,
          // Missing lat/lon
        },
        {
          type: 'way',
          id: 10,
          nodes: [1],
          tags: { highway: 'path' },
        },
        {
          type: 'way',
          id: 11,
          // Missing nodes array
          tags: { highway: 'path' },
        },
      ],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    const result = await fetchOSMData(bbox)

    // Only valid node should be parsed
    expect(result.nodes.size).toBe(1)
    expect(result.nodes.has('1')).toBe(true)
    expect(result.nodes.has('2')).toBe(false)

    // Only valid way should be parsed
    expect(result.ways).toHaveLength(1)
    expect(result.ways[0].id).toBe('10')
  })

  it('should handle empty OSM response', async () => {
    const mockResponse = {
      elements: [],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    const result = await fetchOSMData(bbox)

    expect(result.nodes.size).toBe(0)
    expect(result.ways).toHaveLength(0)
  })

  it('should use POST method with form-encoded body', async () => {
    const mockResponse = {
      elements: [],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    await fetchOSMData(bbox)

    const callArgs = mockFetch.mock.calls[0]
    const options = callArgs[1]

    expect(options?.method).toBe('POST')
    expect(options?.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    expect(options?.body).toMatch(/^data=/)
  })

  it('should include highway filter in query', async () => {
    const mockResponse = {
      elements: [],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    await fetchOSMData(bbox)

    const callArgs = mockFetch.mock.calls[0]
    const requestBody = callArgs[1]?.body as string

    // Decode the URL-encoded body to check for highway filter
    const decodedBody = decodeURIComponent(requestBody)
    expect(decodedBody).toContain('highway')
    expect(decodedBody).toContain('path')
    expect(decodedBody).toContain('footway')
  })

  it('should handle large OSM datasets', async () => {
    // Create a large mock dataset
    const elements: unknown[] = []
    for (let i = 0; i < 1000; i++) {
      elements.push({
        type: 'node',
        id: i,
        lat: 50.0 + i * 0.0001,
        lon: 10.0 + i * 0.0001,
      })
    }

    const mockResponse = {
      elements,
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    const result = await fetchOSMData(bbox)

    expect(result.nodes.size).toBe(1000)
  })

  it('should preserve way node order', async () => {
    const mockResponse = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 50.0,
          lon: 10.0,
        },
        {
          type: 'node',
          id: 2,
          lat: 50.1,
          lon: 10.1,
        },
        {
          type: 'node',
          id: 3,
          lat: 50.2,
          lon: 10.2,
        },
        {
          type: 'way',
          id: 100,
          nodes: [3, 1, 2], // Specific order
          tags: { highway: 'path' },
        },
      ],
    }

    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const bbox = {
      south: 50.0,
      west: 10.0,
      north: 50.1,
      east: 10.1,
    }

    const result = await fetchOSMData(bbox)

    expect(result.ways[0].nodes).toEqual(['3', '1', '2'])
  })
})
