import { getStraightPath, type EdgeProps } from '@xyflow/react'

/** Plain horizontal marriage-line connector, no arrowhead. Colored per-couple (see
 * `UNION_COLORS`) to match that couple's union dot and their children's edges. */
export function SpouseEdge({ sourceX, sourceY, targetX, targetY, style }: EdgeProps) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  return <path className="spouse-edge" d={path} fill="none" style={style} />
}
