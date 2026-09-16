import type { EdgeProps } from '@xyflow/react'

/** A right-angle connector with an exact, fully explicit path — horizontal from the
 * source to `data.centerX`, vertical to the target's row, horizontal into the target —
 * rather than react-flow's own smoothstep routing, which adds a small automatic offset
 * near each end. That offset is invisible most of the time, but breaks the one thing
 * this edge exists for: several edges pinned to the *same* centerX need to render as
 * pixel-identical, truly overlapping lines (one shared trunk), and several edges pinned
 * to *different* centerX values need to never share a coordinate at all. A hand-built
 * path guarantees both exactly, with no hidden rounding. */
export function ElbowEdge({ sourceX, sourceY, targetX, targetY, data, style }: EdgeProps) {
  const centerX = (data as Record<string, unknown> | undefined)?.centerX as number | undefined
  const bendX = centerX ?? (sourceX + targetX) / 2
  const path = `M ${sourceX} ${sourceY} L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`
  return <path fill="none" style={style} d={path} />
}
