import type { CSSProperties } from 'react'
import { Handle, Position, useStore, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../common/Avatar'
import type { TreeNode } from '../../lib/treeLayout'

/** Below this zoom, node details are hidden and the name enlarged so a huge tree stays legible. */
const COMPACT_ZOOM = 0.45

export function MemberNode({ data, selected }: NodeProps<TreeNode>) {
  const { t } = useTranslation()
  const compact = useStore((s) => s.transform[2] < COMPACT_ZOOM)
  const member = data.member
  if (!member) return null

  const birthYear = member.birthDate?.slice(0, 4)
  // A death date's day/month are always known once it's recorded at all, but the year
  // may not be — show "?" for the year rather than silently dropping the fact that the
  // person has died.
  const deathYear = member.deathDate ? (member.deathDate.year != null ? String(member.deathDate.year) : '?') : undefined
  const years = deathYear ? `${birthYear ?? '?'}–${deathYear}` : birthYear ? `${birthYear}–` : ''
  const birthName = member.names.find((n) => n.label === 'birthName' && n.value)?.value
  const maidenName = member.names.find((n) => n.label === 'maidenName' && n.value)?.value

  // Blended with the theme's own panel background (never used at full strength) so the
  // card's usual text colors — already tuned for contrast against that panel background in
  // both light and dark theme — stay readable without needing a per-family text color of
  // their own.
  const style = data.avatarColor
    ? ({ '--member-node-bg': `color-mix(in srgb, ${data.avatarColor} 24%, var(--color-panel-bg))` } as CSSProperties)
    : undefined

  return (
    <div className={`member-node${selected ? ' member-node-selected' : ''}${compact ? ' member-node-compact' : ''}`} style={style}>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" id="left" position={Position.Left} />
      <Handle type="source" id="left" position={Position.Left} />
      {member.gender && (
        <span className={`member-node-gender member-node-gender-${member.gender}`} title={t(`member.${member.gender}`)}>
          {member.gender === 'male' ? '♂' : '♀'}
        </span>
      )}
      <Avatar name={member.fullName} photoUrl={member.photoUrl} size={44} colorOverride={data.avatarColor} />
      <div className="member-node-info">
        <div className="member-node-name">{member.fullName}</div>
        {birthName && <div className="member-node-altname">({birthName})</div>}
        {maidenName && <div className="member-node-altname">({maidenName})</div>}
        {years && <div className="member-node-years">{years}</div>}
        <div className="member-node-generation">{t('tree.generation', { n: data.displayGeneration ?? member.generation })}</div>
      </div>
      <Handle type="target" id="right" position={Position.Right} />
      <Handle type="source" id="right" position={Position.Right} />
      <Handle type="source" id="bottom" position={Position.Bottom} />
    </div>
  )
}
