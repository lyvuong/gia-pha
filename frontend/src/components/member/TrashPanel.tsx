import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/formatDate'
import { permanentlyDeleteMember, restoreMember } from '../../hooks/useMembers'
import type { Member } from '../../types/models'

interface TrashPanelProps {
  giaPhaId: string
  deletedMembers: Member[]
  currentUid: string
  onClose: () => void
}

export function TrashPanel({ giaPhaId, deletedMembers, currentUid, onClose }: TrashPanelProps) {
  const { t, i18n } = useTranslation()

  async function handleRestore(member: Member) {
    await restoreMember(giaPhaId, member.id, currentUid)
  }

  async function handlePermanentDelete(member: Member) {
    if (!confirm(t('member.deleteForeverConfirm', { name: member.fullName }))) return
    await permanentlyDeleteMember(giaPhaId, member.id)
  }

  return (
    <div className="member-detail-panel trash-panel">
      <button type="button" className="panel-close" onClick={onClose}>×</button>
      <h2>{t('tree.trash')}</h2>
      {deletedMembers.length === 0 ? (
        <p className="trash-empty">{t('tree.trashEmpty')}</p>
      ) : (
        <ul className="trash-list">
          {deletedMembers.map((m) => (
            <li key={m.id} className="trash-row">
              <span className="trash-row-name">
                {m.fullName}
                {m.deletedAt && <span className="trash-row-date"> · {formatDate(m.deletedAt, i18n.language)}</span>}
              </span>
              <div className="trash-row-actions">
                <button type="button" onClick={() => handleRestore(m)}>{t('member.restore')}</button>
                <button type="button" onClick={() => handlePermanentDelete(m)}>{t('member.deleteForever')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
