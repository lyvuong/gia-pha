import { arrayUnion, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'

/**
 * Google email addresses (lower-case, used as the doc id) of known relatives who may join the
 * tree without approval, at `giaPha/{id}/allowedEmails/{email}`. See `firestore.rules`.
 */
export interface AllowedEmail {
  email: string
  label: string
}

export function useAllowedEmails(giaPhaId: string | undefined): AllowedEmail[] {
  const [emails, setEmails] = useState<AllowedEmail[]>([])

  useEffect(() => {
    if (!giaPhaId) {
      setEmails([])
      return
    }
    const unsubscribe = onSnapshot(
      collection(db, 'giaPha', giaPhaId, 'allowedEmails'),
      (snap) => setEmails(snap.docs.map((d) => ({ email: d.id, label: (d.data().label as string) ?? '' }))),
      () => setEmails([]),
    )
    return unsubscribe
  }, [giaPhaId])

  return emails
}

/** Adds addresses (batches stay under Firestore's 500-write limit). */
export async function addAllowedEmails(
  giaPhaId: string,
  entries: { email: string; label: string }[],
  addedBy: string,
): Promise<void> {
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db)
    for (const { email, label } of entries.slice(i, i + 400)) {
      batch.set(doc(db, 'giaPha', giaPhaId, 'allowedEmails', email), { label, addedBy, addedAt: serverTimestamp() })
    }
    await batch.commit()
  }
}

export async function removeAllowedEmail(giaPhaId: string, email: string): Promise<void> {
  await deleteDoc(doc(db, 'giaPha', giaPhaId, 'allowedEmails', email))
}

/**
 * Adds the signed-in user to the tree's editors if their verified email is on the allowlist.
 * Returns false when it isn't (the rules reject the write), so the caller can fall back to
 * asking for approval.
 */
export async function joinWithAllowedEmail(giaPhaId: string, uid: string, email: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'giaPha', giaPhaId), { editors: arrayUnion(uid) })
  } catch {
    return false
  }
  // The invitation has been used; a failure clearing it is harmless.
  try {
    await removeAllowedEmail(giaPhaId, email.toLowerCase())
  } catch {
    // ignore
  }
  return true
}
