import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addMember, updateMember } from '../../hooks/useMembers'
import type { Education, Member, NewMember } from '../../types/models'
import { PhotoUploader } from './PhotoUploader'

interface MemberEditFormProps {
  giaPhaId: string
  member: Member | null
  members: Member[]
  currentUid: string
  /** Pre-fills fields (e.g. generation/parentIds/spouseIds) when adding via a relationship picker. Ignored if `member` is set. */
  initialDraft?: Partial<NewMember>
  onSaved: (memberId: string) => void
  onCancel: () => void
}

function emptyDraft(overrides?: Partial<NewMember>): NewMember {
  return {
    fullName: '',
    phapDanh: '',
    photoUrl: null,
    generation: 1,
    birthDate: null,
    deathDate: null,
    placeOfBirth: '',
    queQuan: '',
    parentIds: [],
    spouseIds: [],
    notes: '',
    education: [],
    occupation: null,
    achievements: [],
    stories: [],
    bioOverride: null,
    ...overrides,
  }
}

function selectedOptions(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((o) => o.value)
}

export function MemberEditForm({ giaPhaId, member, members, currentUid, initialDraft, onSaved, onCancel }: MemberEditFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<NewMember>(
    member
      ? {
          fullName: member.fullName,
          phapDanh: member.phapDanh,
          photoUrl: member.photoUrl,
          generation: member.generation,
          birthDate: member.birthDate,
          deathDate: member.deathDate,
          placeOfBirth: member.placeOfBirth,
          queQuan: member.queQuan,
          parentIds: member.parentIds,
          spouseIds: member.spouseIds,
          notes: member.notes,
          education: member.education,
          occupation: member.occupation,
          achievements: member.achievements,
          stories: member.stories,
          bioOverride: member.bioOverride,
        }
      : emptyDraft(initialDraft),
  )
  const [saving, setSaving] = useState(false)

  const otherMembers = members.filter((m) => m.id !== member?.id)

  function updateField<K extends keyof NewMember>(key: K, value: NewMember[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function updateEducationRow(index: number, patch: Partial<Education>) {
    setDraft((d) => ({
      ...d,
      education: d.education.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }))
  }

  function addEducationRow() {
    setDraft((d) => ({ ...d, education: [...d.education, { school: '', degree: '' }] }))
  }

  function removeEducationRow(index: number) {
    setDraft((d) => ({ ...d, education: d.education.filter((_, i) => i !== index) }))
  }

  function updateAchievements(text: string) {
    updateField(
      'achievements',
      text.split('\n').map((s) => s.trim()).filter(Boolean),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.fullName.trim()) return
    setSaving(true)
    try {
      if (member) {
        await updateMember(giaPhaId, member.id, draft, currentUid)
        onSaved(member.id)
      } else {
        const id = await addMember(giaPhaId, draft, currentUid)
        onSaved(id)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="member-edit-form" onSubmit={handleSubmit}>
      <label>
        {t('member.fullName')}
        <input
          value={draft.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          required
        />
      </label>

      <label>
        {t('member.phapDanh')}
        <input
          value={draft.phapDanh}
          onChange={(e) => updateField('phapDanh', e.target.value)}
        />
      </label>

      {member && (
        <PhotoUploader
          giaPhaId={giaPhaId}
          memberId={member.id}
          memberName={draft.fullName}
          photoUrl={draft.photoUrl}
          onUploaded={(url) => updateField('photoUrl', url)}
        />
      )}

      <label>
        Thế hệ / Generation
        <input
          type="number"
          value={draft.generation}
          onChange={(e) => updateField('generation', Number(e.target.value))}
        />
      </label>

      <label>
        {t('member.birthDate')}
        <input
          type="date"
          value={draft.birthDate ?? ''}
          onChange={(e) => updateField('birthDate', e.target.value || null)}
        />
      </label>

      <label>
        {t('member.deathDate')}
        <input
          type="date"
          value={draft.deathDate ?? ''}
          onChange={(e) => updateField('deathDate', e.target.value || null)}
        />
      </label>

      <label>
        {t('member.placeOfBirth')}
        <input value={draft.placeOfBirth} onChange={(e) => updateField('placeOfBirth', e.target.value)} />
      </label>

      <label>
        {t('member.queQuan')}
        <input value={draft.queQuan} onChange={(e) => updateField('queQuan', e.target.value)} />
      </label>

      <label>
        {t('member.occupation')}
        <input
          value={draft.occupation ?? ''}
          onChange={(e) => updateField('occupation', e.target.value || null)}
        />
      </label>

      <fieldset>
        <legend>{t('member.education')}</legend>
        {draft.education.map((edu, i) => (
          <div key={i} className="education-row">
            <input
              placeholder="Degree"
              value={edu.degree ?? ''}
              onChange={(e) => updateEducationRow(i, { degree: e.target.value })}
            />
            <input
              placeholder="School"
              value={edu.school ?? ''}
              onChange={(e) => updateEducationRow(i, { school: e.target.value })}
            />
            <button type="button" onClick={() => removeEducationRow(i)}>
              {t('member.delete')}
            </button>
          </div>
        ))}
        <button type="button" onClick={addEducationRow}>+ {t('member.education')}</button>
      </fieldset>

      <label>
        {t('member.achievements')}
        <textarea
          value={draft.achievements.join('\n')}
          onChange={(e) => updateAchievements(e.target.value)}
          rows={3}
          placeholder="One per line"
        />
      </label>

      <label>
        {t('member.notes')}
        <textarea value={draft.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2} />
      </label>

      <label>
        {t('member.parents')}
        <select
          multiple
          value={draft.parentIds}
          onChange={(e) => updateField('parentIds', selectedOptions(e.target))}
        >
          {otherMembers.map((m) => (
            <option key={m.id} value={m.id}>{m.fullName}</option>
          ))}
        </select>
      </label>

      <label>
        {t('member.spouses')}
        <select
          multiple
          value={draft.spouseIds}
          onChange={(e) => updateField('spouseIds', selectedOptions(e.target))}
        >
          {otherMembers.map((m) => (
            <option key={m.id} value={m.id}>{m.fullName}</option>
          ))}
        </select>
      </label>

      <label>
        {t('member.bio')}
        <textarea
          value={draft.bioOverride ?? ''}
          onChange={(e) => updateField('bioOverride', e.target.value || null)}
          rows={3}
          placeholder={t('member.bioOverridePlaceholder')}
        />
        {draft.bioOverride && (
          <button type="button" onClick={() => updateField('bioOverride', null)}>
            {t('member.resetBio')}
          </button>
        )}
      </label>

      <div className="form-actions">
        <button type="submit" disabled={saving}>{t('member.save')}</button>
        <button type="button" onClick={onCancel}>{t('member.cancel')}</button>
      </div>
    </form>
  )
}
