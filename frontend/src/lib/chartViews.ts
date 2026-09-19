import type { Member } from '../types/models'

export type ChartType = 'full' | 'descendant' | 'pedigree' | 'familyGroup' | 'fan' | 'hourglass'

/** Chart types that can currently be chosen. The rest are listed in the selector as "coming soon". */
export const AVAILABLE_CHART_TYPES: ChartType[] = ['descendant']

export const CHART_TYPE_OPTIONS: ChartType[] = ['descendant', 'pedigree', 'familyGroup', 'fan', 'hourglass']

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

export function selectMembersForChart(members: Member[], chartType: ChartType, rootId: string | null): Member[] {
  if (!rootId) return members
  switch (chartType) {
    case 'descendant':
      return selectDescendantMembers(members, rootId)
    default:
      return members
  }
}
