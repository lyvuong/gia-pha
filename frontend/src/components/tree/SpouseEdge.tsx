import { getStraightPath, type EdgeProps } from '@xyflow/react'

/** Plain horizontal marriage-line connector, no arrowhead. */
export function SpouseEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  return <path className="spouse-edge" d={path} fill="none" />
}
