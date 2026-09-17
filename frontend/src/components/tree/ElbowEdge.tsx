import type { EdgeProps } from '@xyflow/react'

interface Point {
  x: number
  y: number
}

/** A right-angle connector with an exact, fully explicit path — rather than react-flow's
 * own smoothstep routing, which adds a small automatic offset near each end. That offset
 * is invisible most of the time, but breaks the one thing this edge exists for: several
 * edges pinned to the *same* centerX need to render as pixel-identical, truly overlapping
 * lines (one shared trunk), and several edges pinned to *different* centerX values need
 * to never share a coordinate at all. A hand-built path guarantees both exactly, with no
 * hidden rounding.
 *
 * `data.points`, when given, is an ordered list of corner points between source and
 * target — each consecutive pair (including the source/target endpoints) must already
 * share an x or a y, since this component just joins them with straight segments rather
 * than inferring any bends itself. That lets the layout route around an obstacle that a
 * single mid-x bend can't dodge (see `pickClearRoute`) by adding a second corner, without
 * this component needing to know anything about why. `data.centerX` remains a shorthand
 * for the common single-bend case. */
export function ElbowEdge({ sourceX, sourceY, targetX, targetY, data, style }: EdgeProps) {
  const info = data as { points?: Point[]; centerX?: number } | undefined
  const bendX = info?.centerX ?? (sourceX + targetX) / 2
  const corners: Point[] = info?.points ?? [
    { x: bendX, y: sourceY },
    { x: bendX, y: targetY },
  ]
  const points = [{ x: sourceX, y: sourceY }, ...corners, { x: targetX, y: targetY }]
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return <path fill="none" style={style} d={path} />
}
