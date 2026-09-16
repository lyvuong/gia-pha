import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthProvider'
import { Avatar } from './Avatar'

export function UserMenu() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  if (!user) return null

  const name = user.displayName ?? user.phoneNumber ?? user.email ?? ''

  return (
    <div className="user-menu">
      <Avatar name={name} photoUrl={user.photoURL} size={28} />
      <span className="user-menu-name">{name}</span>
      <button type="button" className="user-menu-signout" onClick={signOut}>
        {t('auth.signOut')}
      </button>
    </div>
  )
}
