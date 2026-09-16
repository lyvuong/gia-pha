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
