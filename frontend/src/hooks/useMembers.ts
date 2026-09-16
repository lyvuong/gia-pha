import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { normalizeVietnamese } from '../lib/normalizeVietnamese'
import type { Member, NewMember, Story } from '../types/models'

function fromDoc(id: string, data: Record<string, unknown>): Member {
  const lastEditedAt = data.lastEditedAt as Timestamp | undefined
  return {
    id,
    fullName: (data.fullName as string) ?? '',
    searchKey: (data.searchKey as string) ?? '',
    photoUrl: (data.photoUrl as string | null) ?? null,
    generation: (data.generation as number) ?? 0,
    birthDate: (data.birthDate as string | null) ?? null,
    deathDate: (data.deathDate as string | null) ?? null,
    placeOfBirth: (data.placeOfBirth as string) ?? '',
    queQuan: (data.queQuan as string) ?? '',
    parentIds: (data.parentIds as string[]) ?? [],
    spouseIds: (data.spouseIds as string[]) ?? [],
    notes: (data.notes as string) ?? '',
    education: (data.education as Member['education']) ?? [],
    occupation: (data.occupation as string | null) ?? null,
    achievements: (data.achievements as string[]) ?? [],
    stories: (data.stories as Story[]) ?? [],
    bioOverride: (data.bioOverride as string | null) ?? null,
    lastEditedBy: (data.lastEditedBy as string) ?? '',
    lastEditedAt: lastEditedAt?.toMillis() ?? Date.now(),
  }
}

export function useMembers(giaPhaId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!giaPhaId) {
      setMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = onSnapshot(collection(db, 'giaPha', giaPhaId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => fromDoc(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [giaPhaId])

  return { members, loading }
}

export async function addMember(giaPhaId: string, member: NewMember, uid: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'giaPha', giaPhaId, 'members'), {
    ...member,
    searchKey: normalizeVietnamese(member.fullName),
    lastEditedBy: uid,
    lastEditedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateMember(
  giaPhaId: string,
  memberId: string,
  patch: Partial<NewMember>,
  uid: string,
): Promise<void> {
  const searchKeyPatch = patch.fullName !== undefined ? { searchKey: normalizeVietnamese(patch.fullName) } : {}
  await updateDoc(doc(db, 'giaPha', giaPhaId, 'members', memberId), {
    ...patch,
    ...searchKeyPatch,
    lastEditedBy: uid,
    lastEditedAt: serverTimestamp(),
  })
}

export async function deleteMember(giaPhaId: string, memberId: string): Promise<void> {
  await deleteDoc(doc(db, 'giaPha', giaPhaId, 'members', memberId))
}

/**
 * Story timestamps use a client-side epoch ms, not serverTimestamp() —
 * Firestore doesn't support server timestamp sentinels inside array values
 * used with arrayUnion.
 */
export async function addStory(giaPhaId: string, memberId: string, text: string, uid: string): Promise<void> {
  const story: Story = { text, contributedBy: uid, contributedAt: Date.now() }
  await updateDoc(doc(db, 'giaPha', giaPhaId, 'members', memberId), {
    stories: arrayUnion(story),
  })
}

export async function deleteStory(giaPhaId: string, memberId: string, story: Story): Promise<void> {
  await updateDoc(doc(db, 'giaPha', giaPhaId, 'members', memberId), {
    stories: arrayRemove(story),
  })
}
