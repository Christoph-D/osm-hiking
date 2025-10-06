# OSM Hiking Route Planner

A fully client-side web application for planning hiking routes using OpenStreetMap data.

## Features

- **Client-side routing**: All route calculation happens in your browser
- **Path snapping**: Routes automatically follow hiking trails and footpaths
- **Interactive map**: Click or tap to add waypoints
- **GPX export**: Download your route for use with GPS devices
- **Offline caching**: Downloaded map data is cached for faster re-use
- **Real-time stats**: See distance and waypoint count as you plan

## How It Works

1. **Load map data**: When you first view an area, the app downloads hiking path data from Overpass API
2. **Build routing graph**: Path data is converted into a network of nodes and edges
3. **Click to route**: Each click finds the nearest path and routes from your last waypoint
4. **A* pathfinding**: Uses efficient A* algorithm for routing between points
5. **Cache**: Downloaded data is stored in IndexedDB for offline re-use

## Tech Stack

- **React 18** + TypeScript + Vite
- **Leaflet** + React-Leaflet for mapping
- **Overpass API** for OSM data download
- **ngraph.path** for A* pathfinding
- **Turf.js** for geospatial calculations
- **Dexie.js** for IndexedDB caching
- **togpx** for GPX export
- **Zustand** for state management
- **Tailwind CSS** for styling

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. Pan the map to your desired hiking area
2. Wait for "Loading map data..." to complete
3. Click on the map to place your first waypoint
4. Continue clicking to extend your route (it will snap to paths)
5. View distance and waypoint count in the control panel
6. Export your route as GPX when done

## Path Types

The app prioritizes hiking-friendly paths:
- Footpaths and trails (preferred)
- Bridleways
- Cycleways
- Tracks
- Steps (weighted higher due to difficulty)

## Notes

- Routes are calculated entirely client-side - no external routing API needed
- First load in a new area requires downloading OSM data (~5-10 seconds)
- Data is cached for 7 days for offline re-use
- Routing works best in areas with well-mapped hiking trails
- If no path is found, try clicking closer to a visible trail

## License

MIT
