import { GROUP_DIVIDER_HEIGHT } from '../../lib/treeLayout'

/** A thin vertical rule marking the boundary between two unrelated family blocks in
 * the same generation row (e.g. children of two different parent-couples). */
export function GroupDivider() {
  return <div className="group-divider" style={{ height: GROUP_DIVIDER_HEIGHT }} />
}
