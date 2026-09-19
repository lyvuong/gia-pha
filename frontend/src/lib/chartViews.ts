import type { Member } from '../types/models'

export type ChartType = 'full' | 'descendant' | 'pedigree' | 'familyGroup' | 'fan' | 'hourglass' | 'extended'

/** Chart types that can currently be chosen. The rest are listed in the selector as "coming soon". */
export const AVAILABLE_CHART_TYPES: ChartType[] = ['descendant', 'pedigree', 'familyGroup', 'fan', 'hourglass', 'extended']

export const CHART_TYPE_OPTIONS: ChartType[] = ['pedigree', 'descendant', 'familyGroup', 'fan', 'hourglass', 'extended']

/**
 * The root, all of their descendants, and every spouse of those people. Spouses' own
 * ancestors are left out, so links to members outside the subset are stripped from
 * copies of the members (the originals are not mutated) to keep the layout self-contained.
 */
export function selectDescendantMembers(members: Member[], rootId: string): Member[] {
  const byId = new Map(members.map((m) => [m.id, m]))
  if (!byId.has(rootId)) return members

  const childrenOf = new Map<string, string[]>()
  for (const m of members) {
    for (const p of m.parentIds) {
      const list = childrenOf.get(p)
      if (list) list.push(m.id)
      else childrenOf.set(p, [m.id])
    }
  }

  // Spouse links may be recorded on either side of the couple.
  const spousesOf = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    const set = spousesOf.get(a)
    if (set) set.add(b)
    else spousesOf.set(a, new Set([b]))
  }
  for (const m of members) {
    for (const s of m.spouseIds) {
      link(m.id, s)
      link(s, m.id)
    }
  }

  const bloodline = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.pop()!
    for (const child of childrenOf.get(id) ?? []) {
      if (!bloodline.has(child)) {
        bloodline.add(child)
        queue.push(child)
      }
    }
  }

  const included = new Set(bloodline)
  for (const id of bloodline) {
    for (const s of spousesOf.get(id) ?? []) if (byId.has(s)) included.add(s)
  }

  return members
    .filter((m) => included.has(m.id))
    .map((m) => ({
      ...m,
      // The root's own parents are outside the subset, as are spouses' parents.
      parentIds: m.parentIds.filter((p) => included.has(p)),
      spouseIds: m.spouseIds.filter((s) => included.has(s)),
    }))
}

/**
 * The root and all of their ancestors (parents, grandparents, ...). Siblings, aunts and
 * uncles, and step-parents who aren't a recorded parent are left out; links to them are
 * stripped from copies of the members so the layout stays self-contained.
 */
export function selectPedigreeMembers(members: Member[], rootId: string): Member[] {
  const byId = new Map(members.map((m) => [m.id, m]))
  if (!byId.has(rootId)) return members

  const included = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length > 0) {
    const m = byId.get(stack.pop()!)
    for (const p of m?.parentIds ?? []) {
      if (byId.has(p) && !included.has(p)) {
        included.add(p)
        stack.push(p)
      }
    }
  }

  return members
    .filter((m) => included.has(m.id))
    .map((m) => ({
      ...m,
      parentIds: m.parentIds.filter((p) => included.has(p)),
      spouseIds: m.spouseIds.filter((s) => included.has(s)),
    }))
}

/**
 * A family group: the root, every spouse of theirs, and the root's children (plus each
 * child's other recorded parent, so a child of a former partner still lays out as a couple's
 * child). Nobody's own parents or children's spouses/descendants are included. Links to
 * members outside the subset are stripped from copies, as for the other charts.
 */
export function selectFamilyGroupMembers(members: Member[], rootId: string): Member[] {
  const byId = new Map(members.map((m) => [m.id, m]))
  const root = byId.get(rootId)
  if (!root) return members

  const included = new Set<string>([rootId])
  for (const m of members) {
    // Spouse links may be recorded on either side of the couple.
    if (root.spouseIds.includes(m.id) || m.spouseIds.includes(rootId)) included.add(m.id)
  }
  const children = members.filter((m) => m.parentIds.includes(rootId))
  for (const child of children) {
    included.add(child.id)
    for (const p of child.parentIds) if (byId.has(p)) included.add(p)
  }

  // Only the family's own parent-child and marriage links are kept: the root's and their
  // spouses' parents are outside the subset, and children's spouses aren't drawn.
  const childIds = new Set(children.map((c) => c.id))
  return members
    .filter((m) => included.has(m.id))
    .map((m) => ({
      ...m,
      parentIds: childIds.has(m.id) ? m.parentIds.filter((p) => included.has(p)) : [],
      spouseIds: childIds.has(m.id) ? [] : m.spouseIds.filter((s) => included.has(s) && !childIds.has(s)),
    }))
}

/**
 * An hourglass: the root's ancestors above them and their descendants (with spouses) below,
 * i.e. the union of the pedigree and descendant selections. The root's spouse is included
 * through the descendant side; siblings and other relatives stay out.
 */
export function selectHourglassMembers(members: Member[], rootId: string): Member[] {
  if (!members.some((m) => m.id === rootId)) return members
  const included = new Set([
    ...selectPedigreeMembers(members, rootId).map((m) => m.id),
    ...selectDescendantMembers(members, rootId).map((m) => m.id),
  ])
  return members
    .filter((m) => included.has(m.id))
    .map((m) => ({
      ...m,
      parentIds: m.parentIds.filter((p) => included.has(p)),
      spouseIds: m.spouseIds.filter((s) => included.has(s)),
    }))
}

export const DEFAULT_EXTENDED_REACH = 2
export const MAX_EXTENDED_REACH = 6

/**
 * An extended family: go up `reach` generations from the root (1 = parents, 2 = grandparents,
 * ...) and take everyone descended from any of those ancestors and the root, with their
 * spouses. Reach 2 is grandparents and all their descendants: siblings, aunts and uncles,
 * first cousins and their children. Spouses' own parents stay out.
 */
export function selectExtendedFamilyMembers(members: Member[], rootId: string, reach: number): Member[] {
  const byId = new Map(members.map((m) => [m.id, m]))
  if (!byId.has(rootId)) return members

  // Breadth-first up the parent links, so each ancestor is found at its shallowest depth.
  const anchors = new Set<string>([rootId])
  let frontier = [rootId]
  for (let depth = 0; depth < reach && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const p of byId.get(id)?.parentIds ?? []) {
        if (byId.has(p) && !anchors.has(p)) {
          anchors.add(p)
          next.push(p)
        }
      }
    }
    frontier = next
  }

  const included = new Set<string>()
  for (const anchor of anchors) {
    for (const m of selectDescendantMembers(members, anchor)) included.add(m.id)
  }

  return members
    .filter((m) => included.has(m.id))
    .map((m) => ({
      ...m,
      parentIds: m.parentIds.filter((p) => included.has(p)),
      spouseIds: m.spouseIds.filter((s) => included.has(s)),
    }))
}

export function selectMembersForChart(
  members: Member[],
  chartType: ChartType,
  rootId: string | null,
  extendedReach = DEFAULT_EXTENDED_REACH,
): Member[] {
  if (!rootId) return members
  switch (chartType) {
    case 'descendant':
      return selectDescendantMembers(members, rootId)
    case 'familyGroup':
      return selectFamilyGroupMembers(members, rootId)
    case 'pedigree':
      return selectPedigreeMembers(members, rootId)
    case 'fan':
      // The fan draws the same people as the pedigree, just radially (see `computeFanLayout`).
      return selectPedigreeMembers(members, rootId)
    case 'hourglass':
      return selectHourglassMembers(members, rootId)
    case 'extended':
      return selectExtendedFamilyMembers(members, rootId, extendedReach)
    default:
      return members
  }
}
