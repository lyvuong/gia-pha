import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../common/Avatar'
import type { TreeNode } from '../../lib/treeLayout'

export function MemberNode({ data, selected }: NodeProps<TreeNode>) {
  const { t } = useTranslation()
  const member = data.member
  if (!member) return null

  const birthYear = member.birthDate?.slice(0, 4)
  const deathYear = member.deathDate?.slice(0, 4)
  const years = deathYear ? `${birthYear ?? '?'}–${deathYear}` : birthYear ? `${birthYear}–` : ''
  const birthName = member.names.find((n) => n.label === 'birthName' && n.value)?.value

  return (
    <div className={`member-node${selected ? ' member-node-selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" id="top" position={Position.Top} />
      <Handle type="target" id="left" position={Position.Left} />
      <Handle type="source" id="left" position={Position.Left} />
      <Avatar name={birthName ?? member.fullName} photoUrl={member.photoUrl} size={44} />
      <div className="member-node-info">
        <div className="member-node-name">{birthName ?? member.fullName}</div>
        {birthName && <div className="member-node-fullname">({member.fullName})</div>}
        {years && <div className="member-node-years">{years}</div>}
        <div className="member-node-generation">{t('tree.generation', { n: data.displayGeneration ?? member.generation })}</div>
      </div>
      <Handle type="target" id="right" position={Position.Right} />
      <Handle type="source" id="right" position={Position.Right} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
