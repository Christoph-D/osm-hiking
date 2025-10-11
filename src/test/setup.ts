import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Leaflet to avoid issues in tests
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: vi.fn(() => ({})),
    },
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({})),
    map: vi.fn(() => ({
      setView: vi.fn(),
      addLayer: vi.fn(),
    })),
  },
  DomEvent: {
    disableClickPropagation: vi.fn(),
    disableScrollPropagation: vi.fn(),
  },
}))

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: vi.fn(({ children }) => children),
  TileLayer: vi.fn(() => null),
  Polyline: vi.fn(() => null),
  Marker: vi.fn(() => null),
  Rectangle: vi.fn(() => null),
  Polygon: vi.fn(() => null),
  CircleMarker: vi.fn(() => null),
  useMap: vi.fn(() => ({
    getZoom: vi.fn(() => 13),
    getMaxZoom: vi.fn(() => 19),
    getBounds: vi.fn(() => ({
      getSouth: vi.fn(() => 50.0),
      getWest: vi.fn(() => 10.0),
      getNorth: vi.fn(() => 50.1),
      getEast: vi.fn(() => 10.1),
    })),
    getCenter: vi.fn(() => ({ lat: 50.05, lng: 10.05 })),
  })),
  useMapEvents: vi.fn(() => null),
}))
