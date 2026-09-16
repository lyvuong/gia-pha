import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../common/Avatar'
import { PlaceLink } from '../common/PlaceLink'
import { generateBio } from '../../lib/generateBio'
import { formatDate } from '../../lib/formatDate'
import { deleteMember } from '../../hooks/useMembers'
import type { GiaPha, Member } from '../../types/models'
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

  const bio = member.bioOverride || generateBio(member)
  const lastEditorName = editorNames[member.lastEditedBy] ?? member.lastEditedBy

  async function handleDelete() {
    if (!confirm(`${t('member.delete')} ${member.fullName}?`)) return
    await deleteMember(giaPha.id, member.id)
    onDeleted()
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
        <button type="button" onClick={handleDelete}>{t('member.delete')}</button>
      </div>

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
