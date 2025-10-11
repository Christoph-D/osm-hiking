import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from './App'

// Mock the MapContainer component since it has complex Leaflet dependencies
vi.mock('./components/MapContainer', () => ({
  MapContainer: () => <div data-testid="map-container">MapContainer</div>,
}))

describe('App', () => {
  it('should render without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeInTheDocument()
  })

  it('should render the MapContainer component', () => {
    const { getByTestId } = render(<App />)
    expect(getByTestId('map-container')).toBeInTheDocument()
  })

  it('should have full width and height container', () => {
    const { container } = render(<App />)
    const appDiv = container.firstChild as HTMLElement
    expect(appDiv).toHaveClass('w-full')
    expect(appDiv).toHaveClass('h-full')
    expect(appDiv).toHaveClass('relative')
  })
})
