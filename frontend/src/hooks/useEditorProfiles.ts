import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'

/**
 * Maps editor uid -> display name for a gia phả, so "last edited by" /
 * "told by" attributions can show a name instead of a raw uid. Firebase
 * Auth only exposes the *current* user's profile, so each member's own
 * display name is denormalized into `giaPha/{id}/editorProfiles/{uid}`
 * whenever they create or join a tree.
 */
export function useEditorProfiles(giaPhaId: string | undefined): Record<string, string> {
  const [profiles, setProfiles] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!giaPhaId) {
      setProfiles({})
      return
    }
    const unsubscribe = onSnapshot(collection(db, 'giaPha', giaPhaId, 'editorProfiles'), (snap) => {
      const next: Record<string, string> = {}
      for (const d of snap.docs) {
        next[d.id] = (d.data().displayName as string) ?? d.id
      }
      setProfiles(next)
    })
    return unsubscribe
  }, [giaPhaId])

  return profiles
}

export async function setEditorProfile(giaPhaId: string, uid: string, displayName: string): Promise<void> {
  await setDoc(doc(db, 'giaPha', giaPhaId, 'editorProfiles', uid), { displayName }, { merge: true })
}

/** How someone signs in. A person may have one account of each kind, and both may be the same family member. */
export type SignInKind = 'phone' | 'google'

export function signInKindOf(user: { phoneNumber: string | null }): SignInKind {
  return user.phoneNumber ? 'phone' : 'google'
}

/** `provider` is null on links made before it was recorded; those don't block anyone. */
export interface ProfileLink {
  memberId: string
  provider: SignInKind | null
}

/**
 * Which family-tree member each signed-in editor says they are, stored as `memberId` (and the
 * kind of sign-in) on their `editorProfiles/{uid}` doc. `loaded` is false until the first
 * snapshot, so callers don't ask someone who has already answered.
 */
export function useProfileLinks(giaPhaId: string | undefined): { links: Record<string, ProfileLink>; loaded: boolean } {
  const [state, setState] = useState<{ links: Record<string, ProfileLink>; loaded: boolean }>({ links: {}, loaded: false })

  useEffect(() => {
    if (!giaPhaId) {
      setState({ links: {}, loaded: false })
      return
    }
    const unsubscribe = onSnapshot(
      collection(db, 'giaPha', giaPhaId, 'editorProfiles'),
      (snap) => {
        const links: Record<string, ProfileLink> = {}
        for (const d of snap.docs) {
          const { memberId, provider } = d.data()
          if (typeof memberId === 'string' && memberId) {
            links[d.id] = { memberId, provider: provider === 'phone' || provider === 'google' ? provider : null }
          }
        }
        setState({ links, loaded: true })
      },
      () => setState({ links: {}, loaded: true }),
    )
    return unsubscribe
  }, [giaPhaId])

  return state
}

export async function linkProfileToMember(giaPhaId: string, uid: string, memberId: string, provider: SignInKind): Promise<void> {
  await setDoc(doc(db, 'giaPha', giaPhaId, 'editorProfiles', uid), { memberId, provider }, { merge: true })
}
