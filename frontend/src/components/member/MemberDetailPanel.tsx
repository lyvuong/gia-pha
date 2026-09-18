import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../common/Avatar'
import { PlaceLink } from '../common/PlaceLink'
import { generateBio } from '../../lib/generateBio'
import { formatDate } from '../../lib/formatDate'
import { compareBirthOrder, siblingKey } from '../../lib/treeLayout'
import { trashMember, updateMember } from '../../hooks/useMembers'
import type { GiaPha, Member } from '../../types/models'
import { AddRelativeFlow } from './AddRelativeFlow'
import { MemberEditForm } from './MemberEditForm'
import { StoriesList } from './StoriesList'

interface MemberDetailPanelProps {
  giaPha: GiaPha
  member: Member
  members: Member[]
  currentUid: string
  editorNames: Record<string, string>
  onClose: () => void
  onDeleted: () => void
}

export function MemberDetailPanel({ giaPha, member, members, currentUid, editorNames, onClose, onDeleted }: MemberDetailPanelProps) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [addingRelative, setAddingRelative] = useState(false)

  if (editing) {
    return (
      <div className="member-detail-panel">
        <MemberEditForm
          giaPhaId={giaPha.id}
          member={member}
          members={members}
          currentUid={currentUid}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  if (addingRelative) {
    return (
      <div className="member-detail-panel">
        <AddRelativeFlow
          giaPhaId={giaPha.id}
          anchor={member}
          members={members}
          currentUid={currentUid}
          onDone={() => setAddingRelative(false)}
        />
      </div>
    )
  }

  const bio = member.bioOverride || generateBio(member, t)
  const lastEditorName = editorNames[member.lastEditedBy] ?? member.lastEditedBy

  // Full siblings (same recorded parent pair), in the same left-to-right order the tree
  // itself renders them in — so "move up/down" here always matches what moves on the
  // tree, and is only offered at all when there's more than one sibling to reorder.
  const ownSiblingKey = siblingKey(member)
  const fullSiblings = ownSiblingKey ? members.filter((m) => siblingKey(m) === ownSiblingKey).sort(compareBirthOrder) : []
  const siblingIndex = fullSiblings.findIndex((m) => m.id === member.id)

  async function handleDelete() {
    if (!confirm(t('member.trashConfirm', { name: member.fullName }))) return
    await trashMember(giaPha.id, member.id, currentUid)
    onDeleted()
  }

  // Swaps `member` with the sibling immediately before/after it, then writes an explicit
  // `siblingOrder` (0, 1, 2, ...) onto *every* sibling in the group at once — not just the
  // two that moved. Once any sibling has a manual order, `compareBirthOrder` prefers it
  // over `birthDate` for the whole group, so leaving the others unset would let a random
  // birth date reshuffle them right back around the two that were just deliberately
  // placed.
  async function moveSibling(direction: -1 | 1) {
    const targetIndex = siblingIndex + direction
    if (targetIndex < 0 || targetIndex >= fullSiblings.length) return
    const reordered = [...fullSiblings]
    ;[reordered[siblingIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[siblingIndex]]
    await Promise.all(reordered.map((sibling, i) => updateMember(giaPha.id, sibling.id, { siblingOrder: i }, currentUid)))
  }

  return (
    <div className="member-detail-panel">
      <button type="button" className="panel-close" onClick={onClose}>×</button>
      <div className="member-detail-header">
        <Avatar name={member.fullName} photoUrl={member.photoUrl} size={80} />
        <h2>{member.fullName}</h2>
      </div>

      {bio && <p className="member-bio">{bio}</p>}

      <dl>
        {member.gender && (
          <>
            <dt>{t('member.gender')}</dt>
            <dd>{t(`member.${member.gender}`)}</dd>
          </>
        )}
        {member.names.filter((n) => n.value).map((n, i) => (
          <Fragment key={i}>
            <dt>{t(`member.${n.label}`)}</dt>
            <dd>{n.value}</dd>
          </Fragment>
        ))}
        {member.placeOfBirth && (
          <>
            <dt>{t('member.placeOfBirth')}</dt>
            <dd><PlaceLink text={member.placeOfBirth} /></dd>
          </>
        )}
        {member.queQuan && (
          <>
            <dt>{t('member.queQuan')}</dt>
            <dd><PlaceLink text={member.queQuan} /></dd>
          </>
        )}
        {member.notes && (
          <>
            <dt>{t('member.notes')}</dt>
            <dd>{member.notes}</dd>
          </>
        )}
      </dl>

      {member.lastEditedBy && (
        <p className="last-edited">
          {t('member.lastEditedBy', { name: lastEditorName, date: formatDate(member.lastEditedAt, i18n.language) })}
        </p>
      )}

      <div className="member-detail-actions">
        <button type="button" onClick={() => setEditing(true)}>{t('member.edit')}</button>
        <button type="button" onClick={() => setAddingRelative(true)}>{t('member.addRelativeShort')}</button>
        <button type="button" onClick={handleDelete}>{t('member.moveToTrash')}</button>
      </div>
      {fullSiblings.length > 1 && (
        <div className="sibling-order-actions">
          <span>{t('member.siblingOrder')}</span>
          <button
            type="button"
            onClick={() => moveSibling(-1)}
            disabled={siblingIndex <= 0}
            aria-label={t('member.moveSiblingUp')}
            title={t('member.moveSiblingUp')}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => moveSibling(1)}
            disabled={siblingIndex >= fullSiblings.length - 1}
            aria-label={t('member.moveSiblingDown')}
            title={t('member.moveSiblingDown')}
          >
            ↓
          </button>
        </div>
      )}
      <StoriesList
        giaPhaId={giaPha.id}
        member={member}
        currentUid={currentUid}
        ownerUid={giaPha.ownerUid}
        editorNames={editorNames}
      />
    </div>
  )
}
