import { useAuth } from '../../context/AuthProvider'
import { Avatar } from './Avatar'

export function UserMenu() {
  const { user } = useAuth()
  if (!user) return null

  const name = user.displayName ?? user.phoneNumber ?? user.email ?? ''

  return (
    <div className="user-menu">
      <Avatar name={name} photoUrl={user.photoURL} size={28} />
      <span className="user-menu-name">{name}</span>
    </div>
  )
}
