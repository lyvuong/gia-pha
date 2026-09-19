import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthProvider'
import { Avatar } from './Avatar'

export function UserMenu() {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  const name = user.displayName ?? user.phoneNumber ?? user.email ?? ''

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={name} photoUrl={user.photoURL} size={28} />
        <span className="user-menu-name">{name}</span>
      </button>
      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-account">
            <strong>{name}</strong>
            {user.email && user.email !== name && <span>{user.email}</span>}
          </div>
          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
