/**
 * Waypoint Constants
 *
 * Configuration values for custom waypoint behavior including
 * distance thresholds for creation, snapping, and conversion.
 */

export const WAYPOINT_CONSTANTS = {
  CUSTOM_WAYPOINT_THRESHOLD: 100, // meters - create custom if no node within this distance
  SNAP_TO_NODE_THRESHOLD: 50, // meters - auto-snap custom waypoint to node
  UNSNAP_FROM_NODE_THRESHOLD: 100, // meters - convert node to custom when dragged beyond this
} as const
