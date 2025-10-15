/**
 * Waypoint Constants
 *
 * Configuration values for custom waypoint behavior including
 * distance thresholds for creation, snapping, and conversion.
 */

export const WAYPOINT_CONSTANTS = {
  CUSTOM_WAYPOINT_THRESHOLD: 100, // meters - create custom if no node within this distance
  SNAP_TO_NODE_THRESHOLD: 50, // meters - auto-snap custom waypoint to node
} as const
