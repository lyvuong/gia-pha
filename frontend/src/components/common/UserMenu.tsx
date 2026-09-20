import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthProvider'
import { Avatar } from './Avatar'
import { RecycleBinIcon } from './icons'

interface UserMenuProps {
  /** When given, the menu offers to copy this invitation link for sharing with relatives. */
  inviteLink?: string
  /** When given, the menu offers the recycle bin of deleted family members. */
  onOpenTrash?: () => void
  /** When given, the menu offers the signed-in person's own profile (or asks who they are). */
  onOpenProfile?: () => void
  /** The name to show instead of the sign-in name (e.g. the tree profile the person linked to). */
  displayName?: string
  trashCount?: number
}

export function UserMenu({ inviteLink, onOpenTrash, onOpenProfile, displayName, trashCount = 0 }: UserMenuProps) {
  const { t } = useTranslation()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
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

  async function copyInviteLink() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions); let them copy by hand.
      window.prompt(t('auth.copyInvitePrompt'), inviteLink)
    }
  }

  const name = displayName || (user.displayName ?? user.phoneNumber ?? user.email ?? '')

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
          {inviteLink && (
            <button type="button" role="menuitem" className="user-menu-item" onClick={copyInviteLink}>
              {copied ? t('auth.inviteLinkCopied') : t('auth.copyInviteLink')}
            </button>
          )}
          {onOpenProfile && (
            <button
              type="button"
              role="menuitem"
              className="user-menu-item"
              onClick={() => {
                setOpen(false)
                onOpenProfile()
              }}
            >
              {t('profile.menu')}
            </button>
          )}
          {onOpenTrash && (
            <button
              type="button"
              role="menuitem"
              className="user-menu-item user-menu-item-icon"
              onClick={() => {
                setOpen(false)
                onOpenTrash()
              }}
            >
              <RecycleBinIcon size={15} />
              <span>
                {t('tree.trash')}
                {trashCount > 0 && ` (${trashCount})`}
              </span>
            </button>
          )}
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
