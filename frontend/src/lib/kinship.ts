import type { Member } from '../types/models'

/** How `b` is related to `a`, found through their closest common ancestor(s). */
export interface BloodKinship {
  /** The closest common ancestors: usually one, or a couple when both parents are shared. */
  commonAncestorIds: string[]
  /** Generations from `a` up to the common ancestor. 0 when `a` is themself the ancestor. */
  stepsA: number
  /** Generations from `b` up to the common ancestor. 0 when `b` is the ancestor. */
  stepsB: number
  /** `a` up to the common ancestor (both ends included), then `b` up to it, following the shortest line. */
  pathA: string[]
  pathB: string[]
  /** Siblings that share only one parent. */
  half: boolean
}

export type Kinship =
  | { kind: 'self'; memberIds: string[] }
  | { kind: 'spouse'; memberIds: string[] }
  | { kind: 'blood'; memberIds: string[]; blood: BloodKinship }
  /** `b` is related to `a` only through a marriage: `via` is the spouse who is the blood relative. */
  | { kind: 'marriage'; memberIds: string[]; blood: BloodKinship; via: string; viaSide: 'b' | 'a' }
  | { kind: 'none'; memberIds: string[] }

interface Ancestry {
  depth: Map<string, number>
  /** For each ancestor, the person one step below them on the shortest line back to the start. */
  below: Map<string, string>
}

function ancestry(startId: string, byId: Map<string, Member>): Ancestry {
  const depth = new Map<string, number>([[startId, 0]])
  const below = new Map<string, string>()
  let frontier = [startId]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const id of frontier) {
      for (const p of byId.get(id)?.parentIds ?? []) {
        if (byId.has(p) && !depth.has(p)) {
          depth.set(p, depth.get(id)! + 1)
          below.set(p, id)
          next.push(p)
        }
      }
    }
    frontier = next
  }
  return { depth, below }
}

/** The line from `startId` up to `ancestorId`, both ends included. */
function lineUp(ancestorId: string, startId: string, below: Map<string, string>): string[] {
  const line = [ancestorId]
  let cur = ancestorId
  while (cur !== startId) {
    cur = below.get(cur)!
    line.push(cur)
  }
  return line.reverse()
}

function bloodKinship(aId: string, bId: string, byId: Map<string, Member>): BloodKinship | null {
  const a = ancestry(aId, byId)
  const b = ancestry(bId, byId)
  let best = Infinity
  let closest: string[] = []
  for (const [id, dA] of a.depth) {
    const dB = b.depth.get(id)
    if (dB === undefined) continue
    const total = dA + dB
    if (total < best) {
      best = total
      closest = [id]
    } else if (total === best) {
      closest.push(id)
    }
  }
  if (closest.length === 0) return null

  // Prefer the father's line when both parents are equally close, for a stable choice.
  closest.sort((x, y) => (byId.get(x)?.gender === 'male' ? 0 : 1) - (byId.get(y)?.gender === 'male' ? 0 : 1))
  const main = closest[0]
  return {
    commonAncestorIds: closest,
    stepsA: a.depth.get(main)!,
    stepsB: b.depth.get(main)!,
    pathA: lineUp(main, aId, a.below),
    pathB: lineUp(main, bId, b.below),
    half: a.depth.get(main) === 1 && b.depth.get(main) === 1 && closest.length === 1,
  }
}

function bloodMemberIds(aId: string, bId: string, blood: BloodKinship, byId: Map<string, Member>): string[] {
  const ids = new Set<string>([aId, bId, ...blood.pathA, ...blood.pathB])
  // When both parents are equally close (full siblings, for one), draw the whole couple.
  const a = ancestry(aId, byId)
  const b = ancestry(bId, byId)
  for (const c of blood.commonAncestorIds) {
    for (const id of lineUp(c, aId, a.below)) ids.add(id)
    for (const id of lineUp(c, bId, b.below)) ids.add(id)
  }
  return [...ids]
}

/** Every spouse of `id`, recorded on either side of the couple. */
function spousesOf(id: string, members: Member[]): string[] {
  const self = members.find((m) => m.id === id)
  const out = new Set<string>(self?.spouseIds ?? [])
  for (const m of members) if (m.spouseIds.includes(id)) out.add(m.id)
  return [...out]
}

/**
 * How `bId` is related to `aId`: the same person, spouses, blood relatives (via their
 * closest common ancestor), or, failing that, related through a marriage (one of the two is
 * married to a blood relative of the other). `memberIds` is the set of people worth drawing
 * to show the connection.
 */
export function findKinship(members: Member[], aId: string, bId: string): Kinship {
  const byId = new Map(members.map((m) => [m.id, m]))
  if (!byId.has(aId) || !byId.has(bId)) return { kind: 'none', memberIds: [aId, bId].filter((id) => byId.has(id)) }
  if (aId === bId) return { kind: 'self', memberIds: [aId] }
  if (spousesOf(aId, members).includes(bId)) return { kind: 'spouse', memberIds: [aId, bId] }

  const blood = bloodKinship(aId, bId, byId)
  if (blood) return { kind: 'blood', blood, memberIds: bloodMemberIds(aId, bId, blood, byId) }

  // Through a marriage: closest blood relation between one side and the other's spouse.
  let best: Extract<Kinship, { kind: 'marriage' }> | null = null
  let bestTotal = Infinity
  const consider = (via: string, viaSide: 'b' | 'a') => {
    const relB = viaSide === 'b' ? bloodKinship(aId, via, byId) : bloodKinship(via, bId, byId)
    if (!relB) return
    const total = relB.stepsA + relB.stepsB
    if (total >= bestTotal) return
    bestTotal = total
    const [x, y] = viaSide === 'b' ? [aId, via] : [via, bId]
    best = {
      kind: 'marriage',
      blood: relB,
      via,
      viaSide,
      memberIds: [...new Set([aId, bId, ...bloodMemberIds(x, y, relB, byId)])],
    }
  }
  for (const s of spousesOf(bId, members)) consider(s, 'b')
  for (const s of spousesOf(aId, members)) consider(s, 'a')
  if (best) return best

  return { kind: 'none', memberIds: [aId, bId] }
}

// ---------------------------------------------------------------------------
// Relationship names
// ---------------------------------------------------------------------------

type Lang = 'en' | 'vi'

function olderThan(x: Member | undefined, y: Member | undefined): boolean | null {
  if (!x?.birthDate || !y?.birthDate) return null
  if (x.birthDate === y.birthDate) return null
  return x.birthDate < y.birthDate
}

const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth']

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`
}

/** "great-", "great-great-", ... for `n` extra generations (`n` >= 1). */
function greats(n: number): string {
  return n <= 2 ? 'great-'.repeat(n) : `${n}× great-`
}

function pick<T>(gender: Member['gender'], male: T, female: T, neutral: T): T {
  return gender === 'male' ? male : gender === 'female' ? female : neutral
}

function englishRelation(k: BloodKinship, b: Member | undefined): string {
  const { stepsA: up, stepsB: down } = k
  const g = b?.gender ?? null
  if (up === 0 && down === 0) return 'same person'
  if (up === 0) {
    const noun = pick(g, 'son', 'daughter', 'child')
    if (down === 1) return noun
    const grand = pick(g, 'grandson', 'granddaughter', 'grandchild')
    return down === 2 ? grand : greats(down - 2) + grand
  }
  if (down === 0) {
    const noun = pick(g, 'father', 'mother', 'parent')
    if (up === 1) return noun
    const grand = pick(g, 'grandfather', 'grandmother', 'grandparent')
    return up === 2 ? grand : greats(up - 2) + grand
  }
  if (up === 1 && down === 1) {
    const noun = pick(g, 'brother', 'sister', 'sibling')
    return k.half ? `half-${noun}` : noun
  }
  if (up === 1) {
    const noun = pick(g, 'nephew', 'niece', 'nibling')
    return down === 2 ? noun : `${down === 3 ? 'grand' : greats(down - 3) + 'grand'}${noun}`
  }
  if (down === 1) {
    const noun = pick(g, 'uncle', 'aunt', 'parent’s sibling')
    return up === 2 ? noun : greats(up - 2) + noun
  }
  const degree = Math.min(up, down) - 1
  const removed = Math.abs(up - down)
  const ordinal = ORDINALS[degree] ?? `${degree}th`
  return `${ordinal} cousin${removed ? `, ${times(removed)} removed` : ''}`
}

function vietnameseRelation(k: BloodKinship, byId: Map<string, Member>, a: Member | undefined, b: Member | undefined): string {
  const { stepsA: up, stepsB: down } = k
  const g = b?.gender ?? null
  if (up === 0 && down === 0) return 'cùng một người'
  if (up === 0) {
    if (down === 1) return pick(g, 'con trai', 'con gái', 'con')
    // Through a son = nội, through a daughter = ngoại: the person one step below `a` on `b`'s line.
    const child = byId.get(k.pathB[k.pathB.length - 2])
    const side = child?.gender === 'female' ? 'ngoại' : child?.gender === 'male' ? 'nội' : ''
    const word = ['', '', 'cháu', 'chắt', 'chút', 'chít'][down]
    if (!word) return `hậu duệ đời thứ ${down}`
    return side && down <= 3 ? `${word} ${side}` : word
  }
  if (down === 0) {
    if (up === 1) return pick(g, 'cha', 'mẹ', 'cha/mẹ')
    // The person one step above `a` decides which side: father = nội, mother = ngoại.
    const parent = byId.get(k.pathA[1])
    const side = parent?.gender === 'female' ? 'ngoại' : parent?.gender === 'male' ? 'nội' : ''
    if (up === 2) return `${pick(g, 'ông', 'bà', 'ông/bà')}${side ? ` ${side}` : ''}`
    if (up === 3) return pick(g, 'cụ ông', 'cụ bà', 'cụ')
    if (up === 4) return pick(g, 'kỵ ông', 'kỵ bà', 'kỵ')
    return `tổ tiên (${up} đời trên)`
  }
  if (up === 1 && down === 1) {
    const older = olderThan(b, a)
    const half = k.half
      ? byId.get(k.commonAncestorIds[0])?.gender === 'female'
        ? ' cùng mẹ khác cha'
        : byId.get(k.commonAncestorIds[0])?.gender === 'male'
          ? ' cùng cha khác mẹ'
          : ' cùng cha hoặc mẹ'
      : ''
    if (older === null) return `${pick(g, 'anh/em trai', 'chị/em gái', 'anh chị em')}${half}`
    return `${older ? pick(g, 'anh', 'chị', 'anh/chị') : pick(g, 'em trai', 'em gái', 'em')}${half}`
  }
  if (up === 1) {
    if (down === 2) return pick(g, 'cháu trai', 'cháu gái', 'cháu')
    return `cháu (${down - 1} đời)`
  }
  if (down === 1) {
    if (up === 2) {
      // A parent's older brother or sister is "bác" on either side; a younger one is chú (father's
      // brother), cô (father's sister), cậu (mother's brother) or dì (mother's sister).
      const parent = byId.get(k.pathA[1])
      const maternal = parent?.gender === 'female'
      const younger = maternal ? pick(g, 'cậu', 'dì', 'cậu/dì') : pick(g, 'chú', 'cô', 'chú/cô')
      const older = olderThan(b, parent)
      if (older === null) return `bác/${younger}`
      return older ? 'bác' : younger
    }
    return `anh chị em của tổ tiên (${up - 1} đời trên)`
  }
  if (up === 2 && down === 2) {
    const older = olderThan(b, a)
    if (older === null) return 'anh chị em họ'
    return older ? pick(g, 'anh họ', 'chị họ', 'anh/chị họ') : 'em họ'
  }
  return `họ hàng chung tổ tiên (cách ${up} đời / ${down} đời)`
}

/**
 * A noun phrase for how `bId` is related to `aId`, in the app language: "great-grandson",
 * "second cousin, once removed", "chú", "cháu nội", ... For a marriage-only connection, call
 * it with the blood relative (`via`) in place of the person who is only related by marriage.
 */
export function describeBlood(
  blood: BloodKinship,
  members: Member[],
  aId: string,
  bId: string,
  language: string,
): string {
  const byId = new Map(members.map((m) => [m.id, m]))
  const lang: Lang = language.startsWith('vi') ? 'vi' : 'en'
  return lang === 'vi'
    ? vietnameseRelation(blood, byId, byId.get(aId), byId.get(bId))
    : englishRelation(blood, byId.get(bId))
}
