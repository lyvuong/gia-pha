import type { EdgeProps } from '@xyflow/react'

/** A right-angle connector with an exact, fully explicit path — rather than react-flow's
 * own smoothstep routing, which adds a small automatic offset near each end. That offset
 * is invisible most of the time, but breaks the one thing this edge exists for: several
 * edges pinned to the *same* centerX need to render as pixel-identical, truly overlapping
 * lines (one shared trunk), and several edges pinned to *different* centerX values need
 * to never share a coordinate at all. A hand-built path guarantees both exactly, with no
 * hidden rounding.
 *
 * Deliberately never bakes an estimated source/target coordinate into the path — only
 * `sourceX`/`sourceY`/`targetX`/`targetY` (react-flow's own measured handle positions) are
 * used for the legs touching the endpoints. `data.centerX` and `data.viaY` are the only
 * "free" values the layout supplies, and both are independent routing choices (a bend x,
 * an extra detour row) rather than an estimate of where the endpoint's handle actually
 * is — an earlier version passed a whole list of corner points including a guessed
 * source/target y, which was *usually* right but occasionally a few pixels off from the
 * real measured handle (box height isn't perfectly fixed), turning what should be a
 * horizontal or vertical leg into a barely-visible diagonal. */
export function ElbowEdge({ sourceX, sourceY, targetX, targetY, data, style }: EdgeProps) {
  const info = data as { centerX?: number; viaY?: number } | undefined
  const bendX = info?.centerX ?? (sourceX + targetX) / 2
  const path =
    info?.viaY !== undefined
      ? `M ${sourceX} ${sourceY} L ${sourceX} ${info.viaY} L ${bendX} ${info.viaY} L ${bendX} ${targetY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`
  return <path fill="none" style={style} d={path} />
}
