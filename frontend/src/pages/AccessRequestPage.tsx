import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '../components/common/Logo'
import { useAuth } from '../context/AuthProvider'
import { joinWithAllowedPhone } from '../hooks/useAllowedPhones'
import {
  requestAccess,
  requestAccessAgain,
  useMyJoinRequest,
  type JoinRequestDetails,
} from '../hooks/useJoinRequests'

interface AccessRequestPageProps {
  giaPhaId: string
}

/**
 * Shown to a signed-in person who isn't in the family tree yet. They say who they are (name,
 * country, and how they're related) so a member can recognise and approve them; the request
 * then waits. As soon as a member approves, the tree's `editors` gains their uid and the
 * parent page (which watches membership) moves them into the tree on its own.
 */
export function AccessRequestPage({ giaPhaId }: AccessRequestPageProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { request, loading } = useMyJoinRequest(giaPhaId, user?.uid)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // What's typed so far; falls back to what was submitted before (when asking again).
  const [draft, setDraft] = useState<Partial<JoinRequestDetails>>({})

  // A relative whose phone number a member has listed joins straight away; anyone else falls
  // through to the request form below.
  const [autoJoin, setAutoJoin] = useState<'checking' | 'no'>(user?.phoneNumber ? 'checking' : 'no')
  const uid = user?.uid
  const phone = user?.phoneNumber ?? null
  useEffect(() => {
    if (!uid || !phone) {
      setAutoJoin('no')
      return
    }
    let cancelled = false
    void joinWithAllowedPhone(giaPhaId, uid, phone).then((joined) => {
      // On success the parent sees the new membership and navigates into the tree.
      if (!cancelled && !joined) setAutoJoin('no')
    })
    return () => {
      cancelled = true
    }
  }, [giaPhaId, uid, phone])

  if (loading || autoJoin === 'checking') return <p className="page-status">{t('common.loading')}</p>

  const declined = request?.status === 'declined'
  const values: JoinRequestDetails = {
    displayName: draft.displayName ?? request?.displayName ?? user?.displayName ?? '',
    country: draft.country ?? request?.country ?? '',
    notes: draft.notes ?? request?.notes ?? '',
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const details: JoinRequestDetails = {
      displayName: values.displayName.trim(),
      country: values.country.trim(),
      notes: values.notes.trim(),
    }
    setFailed(false)
    setBusy(true)
    try {
      if (declined) await requestAccessAgain(giaPhaId, user.uid, details)
      else await requestAccess(giaPhaId, user, details)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const signOutButton = (
    <button type="button" className="link-button" onClick={() => void signOut()}>
      {t('auth.signOut')}
    </button>
  )

  // Asked already and waiting for a member to decide.
  if (request && !declined) {
    return (
      <div className="create-tree-page access-request-page">
        <Logo size={56} />
        <h1>{t('access.pendingTitle')}</h1>
        <p>{t('access.pendingBody')}</p>
        <dl className="access-summary">
          <dt>{t('access.nameLabel')}</dt>
          <dd>{request.displayName}</dd>
          <dt>{t('access.countryLabel')}</dt>
          <dd>{request.country || '—'}</dd>
          <dt>{t('access.notesLabel')}</dt>
          <dd>{request.notes || '—'}</dd>
        </dl>
        {signOutButton}
      </div>
    )
  }

  return (
    <div className="create-tree-page access-request-page">
      <Logo size={56} />
      <h1>{declined ? t('access.declinedTitle') : t('access.formTitle')}</h1>
      <p>{declined ? t('access.declinedBody') : t('access.formIntro')}</p>
      <form onSubmit={submit}>
        <label>
          {t('access.nameLabel')}
          <input
            value={values.displayName}
            onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
            maxLength={100}
            autoComplete="name"
            required
          />
        </label>
        <label>
          {t('access.countryLabel')}
          <input
            value={values.country}
            onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
            placeholder={t('access.countryPlaceholder')}
            maxLength={60}
            autoComplete="country-name"
            required
          />
        </label>
        <label>
          {t('access.notesLabel')}
          <textarea
            value={values.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder={t('access.notesPlaceholder')}
            maxLength={1000}
            rows={4}
            required
          />
        </label>
        <button type="submit" disabled={busy}>{declined ? t('access.askAgain') : t('access.submit')}</button>
      </form>
      {failed && <p className="error-text">{t('access.failedBody')}</p>}
      {signOutButton}
    </div>
  )
}
