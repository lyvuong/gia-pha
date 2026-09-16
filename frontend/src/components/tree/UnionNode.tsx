import { Handle, Position } from '@xyflow/react'

/** Invisible anchor positioned between a couple, used only as the edge source for their shared children. */
export function UnionNode() {
  return (
    <div className="union-node">
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
