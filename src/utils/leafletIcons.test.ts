import { describe, it, expect, vi, beforeAll } from 'vitest'
import L from 'leaflet'

// Mock Leaflet before importing leafletIcons
vi.mock('leaflet', async () => {
  const actual = await vi.importActual<typeof import('leaflet')>('leaflet')
  return {
    ...actual,
    default: {
      ...actual.default,
      Icon: {
        ...actual.default.Icon,
        Default: {
          ...actual.default.Icon.Default,
          prototype: {},
          mergeOptions: vi.fn(),
        },
      },
      divIcon: actual.default.divIcon,
      DivIcon: actual.default.DivIcon,
    },
  }
})

// Mock image imports
vi.mock('leaflet/dist/images/marker-icon-2x.png', () => ({
  default: 'marker-icon-2x.png',
}))
vi.mock('leaflet/dist/images/marker-icon.png', () => ({
  default: 'marker-icon.png',
}))
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({
  default: 'marker-shadow.png',
}))

describe('leafletIcons', () => {
  let createFlagIcon: () => L.DivIcon

  beforeAll(async () => {
    const module = await import('./leafletIcons')
    createFlagIcon = module.createFlagIcon
  })

  describe('createFlagIcon', () => {
    it('should create a divIcon', () => {
      const icon = createFlagIcon()
      expect(icon).toBeInstanceOf(L.DivIcon)
    })

    it('should have correct className', () => {
      const icon = createFlagIcon()
      expect(icon.options.className).toBe('custom-flag-icon')
    })

    it('should have flag emoji in HTML', () => {
      const icon = createFlagIcon()
      expect(icon.options.html).toContain('🏁')
    })

    it('should have correct icon size', () => {
      const icon = createFlagIcon()
      expect(icon.options.iconSize).toEqual([32, 32])
    })

    it('should have correct icon anchor', () => {
      const icon = createFlagIcon()
      expect(icon.options.iconAnchor).toEqual([16, 32])
    })
  })
})
