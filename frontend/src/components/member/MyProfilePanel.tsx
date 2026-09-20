import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchBar } from '../common/SearchBar'
import { linkProfileToMember, type SignInKind } from '../../hooks/useEditorProfiles'
import { normalizeVietnamese } from '../../lib/normalizeVietnamese'
import { addMember } from '../../hooks/useMembers'
import type { Member, NewMember } from '../../types/models'

interface MyProfilePanelProps {
  giaPhaId: string
  currentUid: string
  signInKind: SignInKind
  members: Member[]
  /** People already claimed by another account of the same sign-in kind, who can't be picked again. */
  takenMemberIds: Set<string>
  /** Pre-fills the name box, e.g. the display name from sign-in. */
  defaultName: string
  onLinked: (memberId: string) => void
  onClose: () => void
}

function blankMember(fullName: string): NewMember {
  return {
    fullName,
    names: [],
    photoUrl: null,
    gender: null,
    generation: 1,
    birthDate: null,
    deathDate: null,
    placeOfBirth: '',
    queQuan: '',
    parentIds: [],
    spouseIds: [],
    siblingOrder: null,
    notes: '',
    education: [],
    occupation: null,
    achievements: [],
    stories: [],
    bioOverride: null,
  }
}

/**
 * "Who are you in the family?" — the signed-in person either picks themselves from the people
 * already in the tree, or types their full name to be added as a new person. Either way their
 * account is linked to that profile, which they can then edit.
 */
export function MyProfilePanel({ giaPhaId, currentUid, signInKind, members, takenMemberIds, defaultName, onLinked, onClose }: MyProfilePanelProps) {
  const { t } = useTranslation()
  const available = useMemo(() => members.filter((m) => !takenMemberIds.has(m.id)), [members, takenMemberIds])
  // A sign-in name (e.g. from Google) that matches exactly one unclaimed person is offered as the answer.
  const suggestion = useMemo(() => {
    const key = normalizeVietnamese(defaultName.trim())
    if (!key) return null
    const matches = available.filter((m) => normalizeVietnamese(m.fullName.trim()) === key)
    return matches.length === 1 ? matches[0] : null
  }, [available, defaultName])
  const [picked, setPicked] = useState<Member | null>(suggestion)
  const [fullName, setFullName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function run(getMemberId: () => Promise<string>) {
    setFailed(false)
    setBusy(true)
    try {
      const memberId = await getMemberId()
      await linkProfileToMember(giaPhaId, currentUid, memberId, signInKind)
      onLinked(memberId)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="member-detail-panel">
      <button type="button" className="panel-close" onClick={onClose}>×</button>
      <h2>{t('profile.title')}</h2>
      <p>{t('profile.intro')}</p>

      {available.length > 0 && (
        <section>
          <h3>{t('profile.pickHeading')}</h3>
          {picked && picked.id === suggestion?.id && <p>{t('profile.suggested')}</p>}
          {picked ? (
            <p>
              <strong>{picked.fullName}</strong>{' '}
              <button type="button" className="link-button" onClick={() => setPicked(null)}>{t('profile.change')}</button>
            </p>
          ) : (
            <SearchBar members={available} placeholder={t('profile.searchPlaceholder')} onSelectMember={setPicked} />
          )}
          <button type="button" disabled={!picked || busy} onClick={() => picked && run(async () => picked.id)}>
            {t('profile.thisIsMe')}
          </button>
        </section>
      )}

      <section>
        <h3>{t('profile.newHeading')}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = fullName.trim()
            if (name) void run(() => addMember(giaPhaId, blankMember(name), currentUid))
          }}
        >
          <label>
            {t('member.fullName')}
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
          </label>
          <button type="submit" disabled={busy || !fullName.trim()}>{t('profile.addMe')}</button>
        </form>
      </section>

      {failed && <p className="error-text">{t('tree.requestActionFailed')}</p>}
    </div>
  )
}
