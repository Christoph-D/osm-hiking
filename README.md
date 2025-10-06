# OSM Hiking Route Planner

A fully client-side web application for planning hiking routes using
OpenStreetMap data. Create custom hiking routes that automatically snap to
trails and footpaths, view elevation profiles, and export routes as GPX files.

## Features

- **Client-side routing**: All route calculation happens in your browser - no
  external routing API needed
- **Path snapping**: Routes automatically follow hiking trails and footpaths
  from OpenStreetMap
- **Interactive waypoints**: Click to add, drag to adjust, double-click to
  remove waypoints
- **Elevation profiles**: View detailed elevation data with gain/loss statistics
  and interactive hover
- **GPX export**: Download your route for use with GPS devices and hiking apps
- **Real-time stats**: See distance, waypoint count, and elevation data as you
  plan

## How It Works

1. **Load map data**: Zoom in to your hiking area (zoom level 13+) and click
   "Reload Data" to download hiking paths from Overpass API
2. **Build routing graph**: Path data is converted into a network of nodes and
   edges for efficient routing
3. **Click to route**: Each click finds the nearest path and routes from your
   last waypoint using A\* pathfinding
4. **Fetch elevations**: Route elevation data is fetched from Open-Elevation API
   and displayed as an interactive profile

## Tech Stack

- **React 18** + TypeScript for UI
- **Vite** for fast development and optimized builds
- **Leaflet** + React-Leaflet for interactive mapping
- **Overpass API** for downloading OpenStreetMap hiking path data
- **ngraph.path** for A\* pathfinding algorithm
- **Turf.js** for geospatial calculations
- **Open-Elevation API** for elevation data
- **Zustand** for state management
- **Tailwind CSS** for styling

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
git clone $REPO
cd osm-hiking
npm install
```

### Development

```bash
# Start development server with hot module replacement
npm run dev

# The app will be available at http://localhost:5173
```

### Production Build

```bash
# Build for production (TypeScript compilation + Vite build)
npm run build

# The optimized files will be in the dist/ directory
```

### Preview Production Build

```bash
# Build and preview the production build locally
npm run build
npm run preview
```

## Usage

1. **Pan and zoom** the map to your desired hiking area
2. **Zoom in** to at least zoom level 13 (required for data loading)
3. **Click "Load Hiking Paths"** to download hiking path data for the current
   view
   - A green dashed border shows the loaded region
   - Gray overlay indicates areas where data isn't loaded
4. **Click on the map** to place your first waypoint (will snap to nearest
   trail)
5. **Continue clicking** to extend your route along hiking paths
6. **Drag waypoints** to adjust the route
7. **Double-click waypoints** to remove them
8. **View elevation profile** below the map (appears after route is created)
   - Hover over the profile to see elevation at specific points
   - View total elevation gain/loss and min/max elevation
9. **Export as GPX** when done for use with GPS devices

## Supported Path Types

The router prioritizes hiking-friendly paths from OpenStreetMap. Routes avoid
roads and prioritize natural trails when available.

## Project Structure

```text
src/
├── components/          # React components
│   ├── MapContainer.tsx    # Main map and routing logic
│   ├── Controls.tsx        # Map controls UI
│   └── ElevationProfile.tsx # Elevation chart component
├── services/            # Core routing and data services
│   ├── overpass.ts         # Fetch OSM data from Overpass API
│   ├── graphBuilder.ts     # Build routing graph from OSM data
│   ├── router.ts           # A* pathfinding implementation
│   ├── elevation.ts        # Elevation data fetching and processing
│   └── gpxExport.ts        # GPX file generation
├── store/              # Zustand state management
│   └── useRouteStore.ts    # Route state (waypoints, segments, elevation)
├── types/              # TypeScript type definitions
└── utils/              # Utility functions and configuration
```

## Key Algorithms

- **A\* Pathfinding**: Efficient routing between waypoints using `ngraph.path`
- **Haversine Distance**: Calculate distances along paths for accurate metrics
- **Path Subdivision**: Equally space points along routes for consistent
  elevation sampling
- **Nearest Node Search**: Snap user clicks to nearby trail nodes within search
  radius

## API Dependencies

- **Overpass API**: Downloads OpenStreetMap hiking path data for specified
  bounding boxes
- **Open-Elevation API**: Provides elevation data for route coordinates (batch
  processing up to 100 points per request)

Both APIs are free and require no authentication.

## Limitations

- Requires zoom level 13+ to load data (prevents excessive data downloads)
- Routing works best in areas with well-mapped hiking trails in OpenStreetMap
- Loading a new area requires downloading OSM data (~5-10 seconds depending on
  area size)
- Elevation data depends on Open-Elevation API availability and may be
  inaccurate

## Tips

- If no path is found, try clicking closer to a visible trail line on the map
- Drag waypoints to fine-tune your route
- Use the green dashed border to see which area has loaded data
- Reload data if you pan to a new area outside the loaded region

## License

AGPL-3.0

## Acknowledgments

- Map data from [OpenStreetMap](https://www.openstreetmap.org/) contributors
- Elevation data from [Open-Elevation](https://open-elevation.com/)
