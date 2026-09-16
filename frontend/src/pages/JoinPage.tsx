import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { findGiaPhaIdByInviteCode, joinGiaPha } from '../hooks/useGiaPha'
import { setEditorProfile } from '../hooks/useEditorProfiles'
import { LoginPage } from './LoginPage'

export function JoinPage() {
  const { t } = useTranslation()
  const { code } = useParams<{ code: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [invite, setInvite] = useState<{ giaPhaId: string; name: string } | null | undefined>(undefined)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!code) return
    findGiaPhaIdByInviteCode(code).then(setInvite)
  }, [code])

  async function handleJoin() {
    if (!user || !invite) return
    setJoining(true)
    try {
      await joinGiaPha(invite.giaPhaId, user.uid)
      await setEditorProfile(invite.giaPhaId, user.uid, user.displayName ?? user.phoneNumber ?? user.uid)
      navigate(`/tree/${invite.giaPhaId}`)
    } finally {
      setJoining(false)
    }
  }

  if (invite === undefined) return <p className="page-status">{t('join.loading')}</p>
  if (invite === null) return <p className="page-status">{t('join.notFound')}</p>

  if (authLoading) return <p className="page-status">{t('common.loading')}</p>
  if (!user) return <LoginPage />

  return (
    <div className="join-page">
      <h1>{t('join.title', { name: invite.name })}</h1>
      <button type="button" onClick={handleJoin} disabled={joining}>
        {t('join.confirm')}
      </button>
    </div>
  )
}
