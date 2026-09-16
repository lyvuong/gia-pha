import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { useMyGiaPha } from '../hooks/useGiaPha'
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

  return <CreateTreePage />
}
