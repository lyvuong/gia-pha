import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateMember } from '../../hooks/useMembers'
import { buildRelativeDraft, relativeBackLinks, RELATIONSHIP_TYPES, type RelationshipType } from '../../lib/relationships'
import type { Member } from '../../types/models'
import { MemberEditForm } from './MemberEditForm'

interface AddRelativeFlowProps {
  giaPhaId: string
  anchor: Member
  members: Member[]
  currentUid: string
  onDone: () => void
}

export function AddRelativeFlow({ giaPhaId, anchor, members, currentUid, onDone }: AddRelativeFlowProps) {
  const { t } = useTranslation()
  const [relationship, setRelationship] = useState<RelationshipType | ''>('')

  if (!relationship) {
    return (
      <div className="add-relative-picker">
        <h3>{t('member.addRelative', { name: anchor.fullName })}</h3>
        <label>
          {t('member.chooseRelationship')}
          <select value={relationship} onChange={(e) => setRelationship(e.target.value as RelationshipType)}>
            <option value="" disabled>
              {t('member.chooseRelationship')}
            </option>
            {RELATIONSHIP_TYPES.map((r) => (
              <option key={r} value={r}>
                {t(`relationship.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="button" onClick={onDone}>
            {t('member.cancel')}
          </button>
        </div>
      </div>
    )
  }

  async function handleSaved(newMemberId: string) {
    const patches = relativeBackLinks(relationship as RelationshipType, anchor, newMemberId, members)
    await Promise.all(patches.map((p) => updateMember(giaPhaId, p.memberId, p.patch, currentUid)))
    onDone()
  }

  return (
    <MemberEditForm
      giaPhaId={giaPhaId}
      member={null}
      members={members}
      currentUid={currentUid}
      initialDraft={buildRelativeDraft(relationship, anchor)}
      onSaved={handleSaved}
      onCancel={onDone}
    />
  )
}
