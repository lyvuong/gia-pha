import { arrayUnion, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'

/**
 * Phone numbers (E.164, used as the doc id) of known relatives who may join the tree without
 * approval, at `giaPha/{id}/allowedPhones/{e164}`. See `firestore.rules`.
 */
export interface AllowedPhone {
  phone: string
  label: string
}

export function useAllowedPhones(giaPhaId: string | undefined): AllowedPhone[] {
  const [phones, setPhones] = useState<AllowedPhone[]>([])

  useEffect(() => {
    if (!giaPhaId) {
      setPhones([])
      return
    }
    const unsubscribe = onSnapshot(
      collection(db, 'giaPha', giaPhaId, 'allowedPhones'),
      (snap) => setPhones(snap.docs.map((d) => ({ phone: d.id, label: (d.data().label as string) ?? '' }))),
      () => setPhones([]),
    )
    return unsubscribe
  }, [giaPhaId])

  return phones
}

export async function addAllowedPhone(giaPhaId: string, phone: string, label: string, addedBy: string): Promise<void> {
  await setDoc(doc(db, 'giaPha', giaPhaId, 'allowedPhones', phone), {
    label,
    addedBy,
    addedAt: serverTimestamp(),
  })
}

export async function removeAllowedPhone(giaPhaId: string, phone: string): Promise<void> {
  await deleteDoc(doc(db, 'giaPha', giaPhaId, 'allowedPhones', phone))
}

/**
 * Adds the signed-in user to the tree's editors if their verified phone number is on the
 * allowlist. Returns false when it isn't (the rules reject the write), so the caller can fall
 * back to asking for approval.
 */
export async function joinWithAllowedPhone(giaPhaId: string, uid: string, phone: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'giaPha', giaPhaId), { editors: arrayUnion(uid) })
  } catch {
    return false
  }
  // The invitation has been used: now a member, they may clear their own entry from the list.
  // A failure here is harmless (the entry just lingers), so it doesn't undo the join.
  try {
    await removeAllowedPhone(giaPhaId, phone)
  } catch {
    // ignore
  }
  return true
}

/** Adds many numbers at once (batches stay under Firestore's 500-write limit). */
export async function addAllowedPhones(
  giaPhaId: string,
  entries: { phone: string; label: string }[],
  addedBy: string,
): Promise<void> {
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db)
    for (const { phone, label } of entries.slice(i, i + 400)) {
      batch.set(doc(db, 'giaPha', giaPhaId, 'allowedPhones', phone), { label, addedBy, addedAt: serverTimestamp() })
    }
    await batch.commit()
  }
}
