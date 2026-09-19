import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { findGiaPhaIdByInviteCode, useMyGiaPha } from '../hooks/useGiaPha'
import { AccessRequestPage } from './AccessRequestPage'
import { LoginPage } from './LoginPage'

/**
 * An invite link takes someone to the family tree's sign-in and then asks to join it. It no
 * longer adds them directly: a member still approves, so a link that ends up in the wrong
 * hands can't open the tree by itself.
 */
export function JoinPage() {
  const { t } = useTranslation()
  const { code } = useParams<{ code: string }>()
  const { user, loading: authLoading } = useAuth()
  const { giaPha: myGiaPha, loading: myGiaPhaLoading } = useMyGiaPha(user?.uid)

  const [invite, setInvite] = useState<{ giaPhaId: string; name: string } | null | undefined>(undefined)

  useEffect(() => {
    if (!code) return
    findGiaPhaIdByInviteCode(code).then(setInvite)
  }, [code])

  if (invite === undefined) return <p className="page-status">{t('join.loading')}</p>
  if (invite === null) return <p className="page-status">{t('join.notFound')}</p>

  if (authLoading) return <p className="page-status">{t('common.loading')}</p>
  if (!user) return <LoginPage />
  if (myGiaPhaLoading) return <p className="page-status">{t('common.loading')}</p>
  if (myGiaPha?.id === invite.giaPhaId) return <Navigate to={`/tree/${invite.giaPhaId}`} replace />

  return <AccessRequestPage giaPhaId={invite.giaPhaId} />
}
