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
import { NAME_LABELS, type Member, type NameEntry, type NewMember, type PartialDate, type Story } from '../types/models'

/** Reads members written before `names` became a single array — each name category
 * used to be its own flat string field. */
function legacyNames(data: Record<string, unknown>): NameEntry[] {
  const entries: NameEntry[] = []
  for (const label of NAME_LABELS) {
    const value = data[label]
    if (typeof value === 'string' && value) entries.push({ label, value })
  }
  return entries
}

/** Reads a death date written before it became a `PartialDate` (day/month always known,
 * year optional, plus a lunar-calendar flag) — it used to be a plain `YYYY-MM-DD` string,
 * same as `birthDate` still is. */
function toPartialDate(value: unknown): PartialDate | null {
  if (!value) return null
  if (typeof value === 'string') {
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return null
    return { day: d, month: m, year: y, isLunar: false }
  }
  const obj = value as Partial<PartialDate>
  if (typeof obj.day !== 'number' || typeof obj.month !== 'number') return null
  return { day: obj.day, month: obj.month, year: typeof obj.year === 'number' ? obj.year : null, isLunar: obj.isLunar === true }
}

function fromDoc(id: string, data: Record<string, unknown>): Member {
  const lastEditedAt = data.lastEditedAt as Timestamp | undefined
  return {
    id,
    fullName: (data.fullName as string) ?? '',
    names: (data.names as NameEntry[] | undefined) ?? legacyNames(data),
    searchKey: (data.searchKey as string) ?? '',
    photoUrl: (data.photoUrl as string | null) ?? null,
    gender: (data.gender as Member['gender']) ?? null,
    generation: (data.generation as number) ?? 0,
    birthDate: (data.birthDate as string | null) ?? null,
    deathDate: toPartialDate(data.deathDate),
    placeOfBirth: (data.placeOfBirth as string) ?? '',
    queQuan: (data.queQuan as string) ?? '',
    parentIds: (data.parentIds as string[]) ?? [],
    spouseIds: (data.spouseIds as string[]) ?? [],
    siblingOrder: (data.siblingOrder as number | null) ?? null,
    notes: (data.notes as string) ?? '',
    education: (data.education as Member['education']) ?? [],
    occupation: (data.occupation as string | null) ?? null,
    achievements: (data.achievements as string[]) ?? [],
    stories: (data.stories as Story[]) ?? [],
    bioOverride: (data.bioOverride as string | null) ?? null,
    lastEditedBy: (data.lastEditedBy as string) ?? '',
    lastEditedAt: lastEditedAt?.toMillis() ?? Date.now(),
    deletedAt: (data.deletedAt as Timestamp | undefined)?.toMillis() ?? null,
  }
}

export function useMembers(giaPhaId: string | undefined) {
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!giaPhaId) {
      setAllMembers([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = onSnapshot(collection(db, 'giaPha', giaPhaId, 'members'), (snap) => {
      setAllMembers(snap.docs.map((d) => fromDoc(d.id, d.data())))
      setLoading(false)
    })
    return unsubscribe
  }, [giaPhaId])

  const members = allMembers.filter((m) => !m.deletedAt)
  const deletedMembers = allMembers.filter((m) => m.deletedAt)

  return { members, deletedMembers, loading }
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

/** Moves a member to Trash instead of deleting it outright, so an accidental or
 * mistaken delete can be undone with `restoreMember`. */
export async function trashMember(giaPhaId: string, memberId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'giaPha', giaPhaId, 'members', memberId), {
    deletedAt: serverTimestamp(),
    lastEditedBy: uid,
    lastEditedAt: serverTimestamp(),
  })
}

export async function restoreMember(giaPhaId: string, memberId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'giaPha', giaPhaId, 'members', memberId), {
    deletedAt: null,
    lastEditedBy: uid,
    lastEditedAt: serverTimestamp(),
  })
}

/** Permanently deletes a member — only reachable from the Trash view, after it's
 * already been soft-deleted once via `trashMember`. */
export async function permanentlyDeleteMember(giaPhaId: string, memberId: string): Promise<void> {
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
