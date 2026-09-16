import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { Member } from '../types/models'

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 96
const HORIZONTAL_GAP = 40
const ROW_HEIGHT = 180
/** Extra horizontal breathing room, on top of the normal sibling gap, wherever a row
 * crosses from one parent-couple's family block into an unrelated one — makes it
 * visually unambiguous which children belong to which parents. A thin divider line
 * (see `GROUP_DIVIDER_HEIGHT`) is centered in this gap. */
const GROUP_GAP = HORIZONTAL_GAP + 40
export const GROUP_DIVIDER_HEIGHT = NODE_HEIGHT + 48

export interface TreeNodeData extends Record<string, unknown> {
  member?: Member
  displayGeneration?: number
}

/** Stored `generation` values are relative (can be negative, e.g. an ancestor added
 * above generation 0) and used directly in layout/relationship math, so they're never
 * renumbered in place. This is the offset to add only when *displaying* a generation
 * number to a user, so the oldest generation always reads as 1. */
export function generationOffset(members: Member[]): number {
  if (members.length === 0) return 0
  return 1 - Math.min(...members.map((m) => m.generation))
}

export type TreeNode = Node<TreeNodeData>
export type TreeEdge = Edge

interface LayoutResult {
  nodes: TreeNode[]
  edges: TreeEdge[]
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

/**
 * Lays out the family tree with react-flow + dagre.
 *
 * Row (y) position is authoritative from `member.generation`, not from
 * dagre's computed rank, so rows stay correct even if some parent/child
 * links are missing or inconsistent. Dagre's crossing-minimized x-ordering
 * is kept, then re-packed with fixed spacing per generation to avoid
 * overlaps.
 *
 * Every spouse pair (including a member's second, third, ... marriage) gets its
 * own union anchor and adjacency slot in the row — see `withSpousesAdjacent` —
 * so remarriages each render with exactly one line to their own spouse instead
 * of sharing or drifting toward an unrelated spouse's position.
 */
export function computeTreeLayout(members: Member[]): LayoutResult {
  if (members.length === 0) return { nodes: [], edges: [] }

  const byId = new Map(members.map((m) => [m.id, m]))

  const spousePairs = new Map<string, [string, string]>()
  for (const m of members) {
    for (const s of m.spouseIds) {
      if (byId.has(s)) {
        const key = pairKey(m.id, s)
        if (!spousePairs.has(key)) spousePairs.set(key, [m.id, s])
      }
    }
  }

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: HORIZONTAL_GAP, ranksep: ROW_HEIGHT - NODE_HEIGHT })
  g.setDefaultEdgeLabel(() => ({}))

  for (const m of members) {
    g.setNode(m.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const m of members) {
    for (const parentId of m.parentIds) {
      if (byId.has(parentId)) {
        g.setEdge(parentId, m.id, { minlen: 1, weight: 1 })
      }
    }
  }
  // Note: dagre's own same-rank trick (`minlen: 0` edges) crashes in @dagrejs/dagre when a
  // rank has no other incoming structure, so spouse-adjacency is instead enforced below as a
  // post-processing reorder pass, after dagre's crossing-minimized x-order is computed from
  // parent-child edges alone.

  dagre.layout(g)

  const spousesOf = new Map<string, string[]>()
  for (const [a, b] of spousePairs.values()) {
    spousesOf.set(a, [...(spousesOf.get(a) ?? []), b])
    spousesOf.set(b, [...(spousesOf.get(b) ?? []), a])
  }

  /** Husband to the left, wife to the right when both genders are known; otherwise
   * keep whichever order the two already had. */
  function orderCouple(a: Member, b: Member): [Member, Member] {
    if (a.gender === 'female' && b.gender === 'male') return [b, a]
    return [a, b]
  }

  /** Re-threads a dagre-x-sorted row so every spouse pair ends up adjacent — not just
   * a member's first marriage — ordered husband-left/wife-right where gender is known.
   * A member with multiple spouses (remarriage) keeps them all flanking on alternating
   * sides, so each pair's union anchor lands between the correct two nodes instead of
   * drifting toward an unrelated spouse placed in between. With 3+ spouses for one
   * member, only the two immediately flanking are guaranteed adjacent — an accepted
   * v1 simplification for a rare case. */
  function withSpousesAdjacent(sorted: Member[]): Member[] {
    const result: Member[] = []
    const placed = new Set<string>()
    for (const member of sorted) {
      if (placed.has(member.id)) continue
      const partners = (spousesOf.get(member.id) ?? [])
        .filter((id) => !placed.has(id))
        .map((id) => sorted.find((x) => x.id === id))
        .filter((x): x is Member => x !== undefined)
        .sort((a, b) => (a.birthDate ?? '').localeCompare(b.birthDate ?? '') || a.id.localeCompare(b.id))

      if (partners.length === 0) {
        result.push(member)
        placed.add(member.id)
        continue
      }
      if (partners.length === 1) {
        const [left, right] = orderCouple(member, partners[0])
        result.push(left, right)
        placed.add(left.id)
        placed.add(right.id)
        continue
      }

      const left: Member[] = []
      const right: Member[] = []
      partners.forEach((partner, i) => {
        if (i % 2 === 0) right.push(partner)
        else left.unshift(partner)
      })
      result.push(...left, member, ...right)
      placed.add(member.id)
      for (const partner of partners) placed.add(partner.id)
    }
    return result
  }

  /** Key shared by full siblings (same parent pair, order-independent), or '' for
   * members with no recorded parents in this tree (not a sibling group). */
  function siblingKey(m: Member): string {
    return [...m.parentIds].sort().join('|')
  }

  function compareBirthOrder(a: Member, b: Member): number {
    if (a.birthDate && b.birthDate) return a.birthDate.localeCompare(b.birthDate)
    return 0
  }

  /** Orders each maximal run of consecutive full siblings oldest-to-left, leaving
   * everything else (family-group order from dagre, married-in spouses, members
   * with unknown birth dates) untouched. */
  function orderSiblingsByBirth(sorted: Member[]): Member[] {
    const result: Member[] = []
    let i = 0
    while (i < sorted.length) {
      const key = siblingKey(sorted[i])
      let j = i + 1
      while (j < sorted.length && siblingKey(sorted[j]) === key) j++
      const run = sorted.slice(i, j)
      if (key) run.sort(compareBirthOrder)
      result.push(...run)
      i = j
    }
    return result
  }

  /** Groups a row into visual "family blocks" — a sibling set plus any spouses they
   * married in — via union-find over sibling and spouse links, so a boundary between
   * two unrelated blocks (e.g. children of two different parent-couples sitting side
   * by side) can be given extra spacing and a divider line. A childless couple with no
   * recorded parents of their own (e.g. the tree's root pair) is just one block, not
   * split from itself. */
  function clusterKeysFor(row: Member[]): Map<string, string> {
    const parent = new Map<string, string>(row.map((m) => [m.id, m.id]))
    const find = (id: string): string => {
      const p = parent.get(id) ?? id
      if (p === id) return id
      const root = find(p)
      parent.set(id, root)
      return root
    }
    const union = (a: string, b: string) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent.set(ra, rb)
    }

    const byKey = new Map<string, string[]>()
    for (const m of row) {
      const key = siblingKey(m)
      if (!key) continue
      byKey.set(key, [...(byKey.get(key) ?? []), m.id])
    }
    for (const ids of byKey.values()) {
      for (let i = 1; i < ids.length; i++) union(ids[0], ids[i])
    }

    const idsInRow = new Set(row.map((m) => m.id))
    for (const m of row) {
      for (const s of spousesOf.get(m.id) ?? []) {
        if (idsInRow.has(s)) union(m.id, s)
      }
    }

    return new Map(row.map((m) => [m.id, find(m.id)]))
  }

  /** Regroups a dagre-x-sorted row so every family block (see `clusterKeysFor`) sits
   * together as one contiguous run, ordered left-to-right by where dagre placed its
   * earliest member. Without this, a block with only one member (e.g. a single child
   * from a second marriage) can land wedged inside an unrelated, larger sibling group
   * purely because that's where dagre's crossing-minimization happened to put it —
   * which no amount of extra spacing or divider lines can make unambiguous, since the
   * member would still visually sit *between* two unrelated siblings. */
  function orderRowByCluster(sortedByDagreX: Member[]): Member[] {
    const clusterOf = clusterKeysFor(sortedByDagreX)
    const dagreIndex = new Map(sortedByDagreX.map((m, i) => [m.id, i]))

    const clusters = new Map<string, Member[]>()
    for (const m of sortedByDagreX) {
      const key = clusterOf.get(m.id)!
      clusters.set(key, [...(clusters.get(key) ?? []), m])
    }

    const orderedClusters = [...clusters.values()].sort(
      (a, b) => Math.min(...a.map((m) => dagreIndex.get(m.id)!)) - Math.min(...b.map((m) => dagreIndex.get(m.id)!)),
    )

    return orderedClusters.flatMap((cluster) => withSpousesAdjacent(orderSiblingsByBirth(cluster)))
  }

  const minGeneration = Math.min(...members.map((m) => m.generation))
  const byGeneration = new Map<number, Member[]>()
  for (const m of members) {
    const list = byGeneration.get(m.generation) ?? []
    list.push(m)
    byGeneration.set(m.generation, list)
  }

  // Pack each generation row left-to-right first (still needed to know each row's total
  // width), then center every row on the widest one — otherwise a short row (e.g. an only
  // child) stays left-aligned under a wider row of parents instead of centered under them,
  // which is what made the tree look lopsided rather than balanced.
  const rowMembers = new Map<number, Member[]>()
  const rowGaps = new Map<number, number[]>()
  const rowWidths = new Map<number, number>()
  for (const [generation, list] of byGeneration.entries()) {
    const sortedByDagreX = [...list].sort((a, b) => {
      const ax = g.node(a.id)?.x ?? 0
      const bx = g.node(b.id)?.x ?? 0
      return ax - bx
    })
    const sorted = orderRowByCluster(sortedByDagreX)
    const clusterOf = clusterKeysFor(sorted)
    const gaps = sorted.slice(1).map((m, i) => (clusterOf.get(sorted[i].id) === clusterOf.get(m.id) ? HORIZONTAL_GAP : GROUP_GAP))
    rowMembers.set(generation, sorted)
    rowGaps.set(generation, gaps)
    rowWidths.set(generation, sorted.length * NODE_WIDTH + gaps.reduce((sum, gap) => sum + gap, 0))
  }
  const maxRowWidth = Math.max(...rowWidths.values())

  const positions = new Map<string, { x: number; y: number }>()
  const dividerPositions: { x: number; y: number }[] = []
  for (const [generation, sorted] of rowMembers.entries()) {
    const y = (generation - minGeneration) * ROW_HEIGHT
    const rowOffset = (maxRowWidth - rowWidths.get(generation)!) / 2
    const gaps = rowGaps.get(generation)!
    let cursorX = rowOffset
    sorted.forEach((m, i) => {
      positions.set(m.id, { x: cursorX, y })
      const gap = gaps[i]
      if (gap !== undefined) {
        if (gap === GROUP_GAP) dividerPositions.push({ x: cursorX + NODE_WIDTH + gap / 2, y })
        cursorX += NODE_WIDTH + gap
      }
    })
  }

  const genOffset = generationOffset(members)
  const nodes: TreeNode[] = members.map((m) => ({
    id: m.id,
    type: 'memberNode',
    position: positions.get(m.id) ?? { x: 0, y: 0 },
    data: { member: m, displayGeneration: m.generation + genOffset },
  }))

  dividerPositions.forEach((pos, i) => {
    nodes.push({
      id: `divider-${i}`,
      type: 'groupDivider',
      position: { x: pos.x, y: pos.y - (GROUP_DIVIDER_HEIGHT - NODE_HEIGHT) / 2 },
      data: {},
      draggable: false,
      selectable: false,
    })
  })

  const edges: TreeEdge[] = []
  const unionNodeIds = new Map<string, string>()

  for (const [key, [a, b]] of spousePairs.entries()) {
    const posA = positions.get(a)
    const posB = positions.get(b)
    if (!posA || !posB) continue
    const unionId = `union-${key}`
    unionNodeIds.set(key, unionId)
    nodes.push({
      id: unionId,
      type: 'unionNode',
      position: {
        x: (posA.x + posB.x) / 2 + NODE_WIDTH / 2,
        y: (posA.y + posB.y) / 2 + NODE_HEIGHT / 2,
      },
      data: {},
      draggable: false,
      selectable: false,
    })
  }

  for (const [, [a, b]] of spousePairs.entries()) {
    const posA = positions.get(a)
    const posB = positions.get(b)
    const [leftId, rightId] = posA && posB && posA.x <= posB.x ? [a, b] : [b, a]
    edges.push({
      id: `spouse-${a}-${b}`,
      source: leftId,
      sourceHandle: 'right',
      target: rightId,
      targetHandle: 'left',
      type: 'spouseEdge',
    })
  }

  for (const m of members) {
    const validParents = m.parentIds.filter((p) => byId.has(p))
    if (validParents.length === 2) {
      const key = pairKey(validParents[0], validParents[1])
      const unionId = unionNodeIds.get(key)
      if (unionId) {
        edges.push({ id: `child-${unionId}-${m.id}`, source: unionId, target: m.id, type: 'smoothstep' })
        continue
      }
    }
    for (const p of validParents) {
      edges.push({ id: `child-${p}-${m.id}`, source: p, target: m.id, type: 'smoothstep' })
    }
  }

  return { nodes, edges }
}
