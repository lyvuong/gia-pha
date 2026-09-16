import { getSmoothStepPath, type EdgeProps } from '@xyflow/react'

/** A right-angle connector whose bend point is pinned to an exact x (`data.centerX`)
 * instead of react-flow's automatic midpoint heuristic. Needed wherever several edges
 * must share one visual line (e.g. every line from a remarried person to their wives —
 * pin them all to the same x and they render as one shared trunk) or, the opposite,
 * must never run over each other (e.g. two different wives' lines down to their own
 * children — pin each to its own x so neither line ever overlaps the other). */
export function ElbowEdge({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, data, style }: EdgeProps) {
  const centerX = (data as Record<string, unknown> | undefined)?.centerX as number | undefined
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, centerX, borderRadius: 0 })
  return <path fill="none" style={style} d={path} />
}
