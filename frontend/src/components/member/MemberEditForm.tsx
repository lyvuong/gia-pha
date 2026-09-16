import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addMember, updateMember } from '../../hooks/useMembers'
import { NAME_LABELS, type Education, type Member, type NameEntry, type NewMember } from '../../types/models'
import { TrashIcon } from '../common/icons'
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
    names: [],
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


export function MemberEditForm({ giaPhaId, member, members, currentUid, initialDraft, onSaved, onCancel }: MemberEditFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<NewMember>(
    member
      ? {
          fullName: member.fullName,
          names: member.names,
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
  // A parent, spouse, and child are mutually exclusive relationships — cross out
  // whichever's already picked in the other field so the two lists (often near-identical
  // for a small tree) can't be confused for one another, and so a parent can't
  // accidentally be selected as a spouse or vice versa.
  const childIds = new Set(member ? members.filter((m) => m.parentIds.includes(member.id)).map((m) => m.id) : [])
  const parentCandidates = otherMembers.filter((m) => !draft.spouseIds.includes(m.id) && !childIds.has(m.id))
  const spouseCandidates = otherMembers.filter((m) => !draft.parentIds.includes(m.id) && !childIds.has(m.id))

  function updateField<K extends keyof NewMember>(key: K, value: NewMember[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function addRelation(field: 'parentIds' | 'spouseIds', id: string) {
    setDraft((d) => (d[field].includes(id) ? d : { ...d, [field]: [...d[field], id] }))
  }

  function removeRelation(field: 'parentIds' | 'spouseIds', id: string) {
    setDraft((d) => ({ ...d, [field]: d[field].filter((existingId) => existingId !== id) }))
  }

  function updateNameRow(index: number, patch: Partial<NameEntry>) {
    setDraft((d) => ({
      ...d,
      names: d.names.map((n, i) => (i === index ? { ...n, ...patch } : n)),
    }))
  }

  function addNameRow() {
    setDraft((d) => ({ ...d, names: [...d.names, { label: NAME_LABELS[0], value: '' }] }))
  }

  function removeNameRow(index: number) {
    setDraft((d) => ({ ...d, names: d.names.filter((_, i) => i !== index) }))
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

      <fieldset>
        <legend>{t('member.otherNames')}</legend>
        {draft.names.map((entry, i) => (
          <div key={i} className="name-row">
            <select
              value={entry.label}
              onChange={(e) => updateNameRow(i, { label: e.target.value as NameEntry['label'] })}
            >
              {NAME_LABELS.map((label) => (
                <option key={label} value={label}>{t(`member.${label}`)}</option>
              ))}
            </select>
            <input
              value={entry.value}
              onChange={(e) => updateNameRow(i, { value: e.target.value })}
            />
            <button
              type="button"
              className="icon-button row-delete"
              onClick={() => removeNameRow(i)}
              title={t('member.delete')}
              aria-label={t('member.delete')}
            >
              <TrashIcon size={15} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addNameRow}>+ {t('member.otherNames')}</button>
      </fieldset>

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
            <button
              type="button"
              className="icon-button row-delete"
              onClick={() => removeEducationRow(i)}
              title={t('member.delete')}
              aria-label={t('member.delete')}
            >
              <TrashIcon size={15} />
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

      <div className="relation-field">
        <span className="relation-field-label">{t('member.parents')}</span>
        <div className="relation-chips">
          {draft.parentIds.map((id) => {
            const m = members.find((mm) => mm.id === id)
            if (!m) return null
            return (
              <span key={id} className="relation-chip">
                {m.fullName}
                <button type="button" onClick={() => removeRelation('parentIds', id)} aria-label={t('member.delete')}>
                  ×
                </button>
              </span>
            )
          })}
        </div>
        {parentCandidates.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addRelation('parentIds', e.target.value)
            }}
          >
            <option value="">{t('member.addParent')}</option>
            {parentCandidates.map((m) => (
              <option key={m.id} value={m.id}>{m.fullName}</option>
            ))}
          </select>
        )}
      </div>

      <div className="relation-field">
        <span className="relation-field-label">{t('member.spouses')}</span>
        <div className="relation-chips">
          {draft.spouseIds.map((id) => {
            const m = members.find((mm) => mm.id === id)
            if (!m) return null
            return (
              <span key={id} className="relation-chip">
                {m.fullName}
                <button type="button" onClick={() => removeRelation('spouseIds', id)} aria-label={t('member.delete')}>
                  ×
                </button>
              </span>
            )
          })}
        </div>
        {spouseCandidates.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) addRelation('spouseIds', e.target.value)
            }}
          >
            <option value="">{t('member.addSpouse')}</option>
            {spouseCandidates.map((m) => (
              <option key={m.id} value={m.id}>{m.fullName}</option>
            ))}
          </select>
        )}
      </div>

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
