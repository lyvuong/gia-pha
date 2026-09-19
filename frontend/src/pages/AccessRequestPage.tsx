import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '../components/common/Logo'
import { useAuth } from '../context/AuthProvider'
import { requestAccess, requestAccessAgain, useMyJoinRequest } from '../hooks/useJoinRequests'

interface AccessRequestPageProps {
  giaPhaId: string
}

/**
 * Shown to a signed-in person who isn't in the family tree yet. Files a join request for
 * them (once) and waits: as soon as a member approves, the tree's `editors` gains their uid
 * and the parent page (which watches membership) moves them into the tree on its own.
 */
export function AccessRequestPage({ giaPhaId }: AccessRequestPageProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const { request, loading } = useMyJoinRequest(giaPhaId, user?.uid)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // Guards the automatic first request, so re-renders (or the request doc briefly
  // disappearing while an approval lands) don't file it twice.
  const filed = useRef(false)

  useEffect(() => {
    if (!user || loading || request || filed.current) return
    filed.current = true
    setBusy(true)
    requestAccess(giaPhaId, user)
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }, [giaPhaId, user, loading, request])

  async function retry() {
    if (!user) return
    setFailed(false)
    setBusy(true)
    try {
      if (request?.status === 'declined') await requestAccessAgain(giaPhaId, user.uid)
      else await requestAccess(giaPhaId, user)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const declined = request?.status === 'declined'

  return (
    <div className="create-tree-page access-request-page">
      <Logo size={56} />
      {failed ? (
        <>
          <h1>{t('access.failedTitle')}</h1>
          <p>{t('access.failedBody')}</p>
          <button type="button" onClick={retry} disabled={busy}>{t('access.retry')}</button>
        </>
      ) : declined ? (
        <>
          <h1>{t('access.declinedTitle')}</h1>
          <p>{t('access.declinedBody')}</p>
          <button type="button" onClick={retry} disabled={busy}>{t('access.askAgain')}</button>
        </>
      ) : (
        <>
          <h1>{t('access.pendingTitle')}</h1>
          <p>{loading || busy ? t('access.sending') : t('access.pendingBody')}</p>
        </>
      )}
      <button type="button" className="link-button" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </button>
    </div>
  )
}
