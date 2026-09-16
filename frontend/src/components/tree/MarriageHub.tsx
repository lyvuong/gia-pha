import { Handle, Position } from '@xyflow/react'

/** Small anchor above a remarried person's row: their own line goes straight up into it,
 * and a line drops straight back down to each additional spouse — a horizontal "spine"
 * made entirely of orthogonal segments, so a marriage to a spouse who isn't sitting right
 * next to them never needs a diagonal line or one that cuts across someone else's box. */
export function MarriageHub() {
  return (
    <div className="marriage-hub">
      <Handle type="target" id="in" position={Position.Bottom} />
      <Handle type="source" id="out" position={Position.Bottom} />
    </div>
  )
}
