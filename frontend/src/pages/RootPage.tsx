import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { useMyGiaPha } from '../hooks/useGiaPha'
import { DEFAULT_GIA_PHA_ID } from '../lib/config'
import { AccessRequestPage } from './AccessRequestPage'
import { CreateTreePage } from './CreateTreePage'
import { LoginPage } from './LoginPage'

export function RootPage() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { giaPha, loading: giaPhaLoading } = useMyGiaPha(user?.uid)

  if (authLoading) return <p className="page-status">{t('common.loading')}</p>
  if (!user) return <LoginPage />
  if (giaPhaLoading) return <p className="page-status">{t('common.loading')}</p>
  if (giaPha) return <Navigate to={`/tree/${giaPha.id}`} replace />

  // Everyone shares the one family tree: someone new asks to be let in rather than starting a new one.
  if (DEFAULT_GIA_PHA_ID) return <AccessRequestPage giaPhaId={DEFAULT_GIA_PHA_ID} />

  return <CreateTreePage />
}
