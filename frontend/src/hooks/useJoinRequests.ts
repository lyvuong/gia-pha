import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'

/**
 * A signed-in person asking to be let into the family tree, stored at
 * `giaPha/{id}/joinRequests/{uid}`. Existing members approve (which adds the uid to the
 * tree's `editors` and removes the request) or decline it; see `firestore.rules`.
 */
export interface JoinRequest {
  uid: string
  displayName: string
  /** Phone number or email, so members can tell who is asking. */
  contact: string
  status: 'pending' | 'declined'
  requestedAt: number
}

function fromDoc(id: string, data: Record<string, unknown>): JoinRequest {
  const requestedAt = data.requestedAt as Timestamp | null | undefined
  return {
    uid: id,
    displayName: (data.displayName as string) ?? '',
    contact: (data.contact as string) ?? '',
    status: data.status === 'declined' ? 'declined' : 'pending',
    // `requestedAt` is briefly null on the writer's own device until the server timestamp resolves.
    requestedAt: requestedAt?.toMillis() ?? Date.now(),
  }
}

function requestRef(giaPhaId: string, uid: string) {
  return doc(db, 'giaPha', giaPhaId, 'joinRequests', uid)
}

/** The signed-in user's own request for this tree, or null if they haven't made one. */
export function useMyJoinRequest(giaPhaId: string | undefined, uid: string | undefined) {
  const [request, setRequest] = useState<JoinRequest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!giaPhaId || !uid) {
      setRequest(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = onSnapshot(
      requestRef(giaPhaId, uid),
      (snap) => {
        setRequest(snap.exists() ? fromDoc(snap.id, snap.data()) : null)
        setLoading(false)
      },
      () => {
        setRequest(null)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [giaPhaId, uid])

  return { request, loading }
}

/** Requests waiting for a decision. Only members can read the whole collection. */
export function usePendingJoinRequests(giaPhaId: string | undefined): JoinRequest[] {
  const [requests, setRequests] = useState<JoinRequest[]>([])

  useEffect(() => {
    if (!giaPhaId) {
      setRequests([])
      return
    }
    const unsubscribe = onSnapshot(
      collection(db, 'giaPha', giaPhaId, 'joinRequests'),
      (snap) => {
        setRequests(
          snap.docs
            .map((d) => fromDoc(d.id, d.data()))
            .filter((r) => r.status === 'pending')
            .sort((a, b) => a.requestedAt - b.requestedAt),
        )
      },
      () => setRequests([]),
    )
    return unsubscribe
  }, [giaPhaId])

  return requests
}

interface Requester {
  uid: string
  displayName: string | null
  phoneNumber: string | null
  email: string | null
}

export async function requestAccess(giaPhaId: string, user: Requester): Promise<void> {
  await setDoc(requestRef(giaPhaId, user.uid), {
    uid: user.uid,
    displayName: user.displayName ?? user.phoneNumber ?? user.email ?? user.uid,
    contact: user.phoneNumber ?? user.email ?? '',
    status: 'pending',
    requestedAt: serverTimestamp(),
  })
}

/** After a decline, the requester may ask again. */
export async function requestAccessAgain(giaPhaId: string, uid: string): Promise<void> {
  await updateDoc(requestRef(giaPhaId, uid), { status: 'pending', requestedAt: serverTimestamp() })
}

/** Adds the requester to the tree's editors and clears their request, in one atomic write. */
export async function approveJoinRequest(giaPhaId: string, uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'giaPha', giaPhaId), { editors: arrayUnion(uid) })
  batch.delete(requestRef(giaPhaId, uid))
  await batch.commit()
}

export async function declineJoinRequest(giaPhaId: string, uid: string): Promise<void> {
  await updateDoc(requestRef(giaPhaId, uid), { status: 'declined' })
}

/** Removes a request outright (e.g. tidying up a declined one). */
export async function deleteJoinRequest(giaPhaId: string, uid: string): Promise<void> {
  await deleteDoc(requestRef(giaPhaId, uid))
}
