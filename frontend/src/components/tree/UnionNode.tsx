import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CSSProperties } from 'react'
import type { TreeNode } from '../../lib/treeLayout'

/** Small colored dot anchored between a couple — the color matches their spouse line
 * and every edge to their children, so which children belong to which parents reads
 * at a glance even when several couples share a row. */
export function UnionNode({ data }: NodeProps<TreeNode>) {
  return (
    <div className="union-node" style={{ '--union-color': data.color } as CSSProperties}>
      <Handle type="target" id="in" position={Position.Left} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
