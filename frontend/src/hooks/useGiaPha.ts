import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { generateInviteCode } from '../lib/inviteCode'
import type { GiaPha } from '../types/models'

function fromDoc(id: string, data: Record<string, unknown>): GiaPha {
  const createdAt = data.createdAt as Timestamp | undefined
  return {
    id,
    name: (data.name as string) ?? '',
    ownerUid: (data.ownerUid as string) ?? '',
    inviteCode: (data.inviteCode as string) ?? '',
    editors: (data.editors as string[]) ?? [],
    createdAt: createdAt?.toMillis() ?? Date.now(),
  }
}

export function useGiaPha(giaPhaId: string | undefined) {
  const [giaPha, setGiaPha] = useState<GiaPha | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!giaPhaId) {
      setGiaPha(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = onSnapshot(doc(db, 'giaPha', giaPhaId), (snap) => {
      setGiaPha(snap.exists() ? fromDoc(snap.id, snap.data()) : null)
      setLoading(false)
    })
    return unsubscribe
  }, [giaPhaId])

  return { giaPha, loading }
}

/** The first gia phả where the given uid is an editor (v1 assumes one tree per user). */
export function useMyGiaPha(uid: string | undefined) {
  const [giaPha, setGiaPha] = useState<GiaPha | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setGiaPha(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'giaPha'), where('editors', 'array-contains', uid))
    const unsubscribe = onSnapshot(q, (snap) => {
      const first = snap.docs[0]
      setGiaPha(first ? fromDoc(first.id, first.data()) : null)
      setLoading(false)
    })
    return unsubscribe
  }, [uid])

  return { giaPha, loading }
}

export async function createGiaPha(name: string, ownerUid: string): Promise<string> {
  const giaPhaRef = doc(collection(db, 'giaPha'))
  const inviteCode = generateInviteCode()

  await setDoc(giaPhaRef, {
    name,
    ownerUid,
    inviteCode,
    editors: [ownerUid],
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'inviteCodes', inviteCode), {
    giaPhaId: giaPhaRef.id,
    name,
  })

  return giaPhaRef.id
}

export async function findGiaPhaIdByInviteCode(inviteCode: string): Promise<{ giaPhaId: string; name: string } | null> {
  const snap = await getDoc(doc(db, 'inviteCodes', inviteCode))
  if (!snap.exists()) return null
  const data = snap.data()
  return { giaPhaId: data.giaPhaId as string, name: data.name as string }
}

export async function joinGiaPha(giaPhaId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'giaPha', giaPhaId), {
    editors: arrayUnion(uid),
  })
}

/** Renames the tree, keeping the denormalized `inviteCodes/{code}` doc (used for the
 * public join-link preview) in sync so it doesn't show a stale name. */
export async function updateGiaPhaName(giaPha: GiaPha, name: string): Promise<void> {
  await updateDoc(doc(db, 'giaPha', giaPha.id), { name })
  await updateDoc(doc(db, 'inviteCodes', giaPha.inviteCode), { name })
}
