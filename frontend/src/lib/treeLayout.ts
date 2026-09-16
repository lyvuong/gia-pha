import type { Edge, Node } from '@xyflow/react'
import type { Member } from '../types/models'

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 96
const HORIZONTAL_GAP = 40
const ROW_HEIGHT = 180
/** Extra horizontal breathing room, on top of the normal gap, between two unrelated
 * family blocks sharing a row (different parent-couples' children, or two unrelated
 * root ancestors). A thin divider line (see `GROUP_DIVIDER_HEIGHT`) is centered in it. */
const GROUP_GAP = HORIZONTAL_GAP + 40
export const GROUP_DIVIDER_HEIGHT = NODE_HEIGHT + 48
/** How far above a remarried person's row their marriage hub sits (see `MarriageHub`). */
const HUB_OFFSET = 40

/** Colorblind-safe (Okabe–Ito) palette assigned one-per-couple, cycling if there are
 * more couples than colors — so a union's spouse line, its own dot, and every line to
 * its children share one color, making "which children belong to which parents"
 * readable at a glance. */
const UNION_COLORS = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#B8860B']

export interface TreeNodeData extends Record<string, unknown> {
  member?: Member
  displayGeneration?: number
  /** Union-node only: the color shared with its spouse line and its children's edges. */
  color?: string
}

/** Stored `generation` values are relative (can be negative, e.g. an ancestor added
 * above generation 0) and used directly in relationship math, so they're never
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

function compareBirthOrder(a: Member, b: Member): number {
  if (a.birthDate && b.birthDate) return a.birthDate.localeCompare(b.birthDate)
  return 0
}

/** One couple (or a single recorded parent) plus their children. */
interface FamilyUnit {
  key: string
  anchor: Member
  spouse: Member | null
  children: Member[]
}

/**
 * Lays out the family tree with every generation as its own strict horizontal band
 * (`member.generation` is authoritative for row/Y position, same as a simple family-tree
 * chart) — but with every connecting line kept orthogonal (horizontal/vertical segments
 * only, never diagonal), solid (never dashed), and routed so it never crosses another
 * line or cuts across an unrelated person's box:
 *
 * - Each row is ordered into contiguous "family blocks" (a sibling set, plus any spouses
 *   they married in) so two different parent-couples' children never interleave.
 * - A child-generation row's blocks are ordered to match their parents' left-to-right
 *   order in the row above, so parent→child lines never cross each other.
 * - A person with more than one spouse (remarriage) doesn't get a direct line to a
 *   non-adjacent spouse — instead their line goes straight up to a small "marriage hub"
 *   above the row, which drops a straight line back down to each spouse (see
 *   `MarriageHub`). This is the only way to connect a person to several others without
 *   either a diagonal line or one that passes through whoever sits between them.
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

  const spousesOf = new Map<string, string[]>()
  for (const [a, b] of spousePairs.values()) {
    spousesOf.set(a, [...(spousesOf.get(a) ?? []), b])
    spousesOf.set(b, [...(spousesOf.get(b) ?? []), a])
  }

  // Whoever has the most recorded marriages is the one whose line goes through the
  // marriage hub for all of them, regardless of gender (which may not be recorded) or
  // which side of a pair happened to be visited first above — otherwise one person's
  // marriages could end up inconsistently anchored depending on iteration order.
  const spouseCountOf = new Map<string, number>()
  for (const [a, b] of spousePairs.values()) {
    spouseCountOf.set(a, (spouseCountOf.get(a) ?? 0) + 1)
    spouseCountOf.set(b, (spouseCountOf.get(b) ?? 0) + 1)
  }
  function pickAnchor(a: Member, b: Member): [Member, Member] {
    const countA = spouseCountOf.get(a.id) ?? 0
    const countB = spouseCountOf.get(b.id) ?? 0
    if (countA !== countB) return countA > countB ? [a, b] : [b, a]
    if (a.gender === 'female' && b.gender === 'male') return [b, a]
    return a.id < b.id ? [a, b] : [b, a]
  }

  // Every member with 1 or 2 valid recorded parents belongs to exactly one "unit" (their
  // parents' union, or a single recorded parent). Group them by that unit key up front so
  // each unit's children list is just a lookup away.
  const childrenByUnitKey = new Map<string, Member[]>()
  for (const m of members) {
    const validParents = m.parentIds.filter((p) => byId.has(p))
    let key: string | null = null
    if (validParents.length === 2) key = pairKey(validParents[0], validParents[1])
    else if (validParents.length === 1) key = `solo-${validParents[0]}`
    if (!key) continue
    childrenByUnitKey.set(key, [...(childrenByUnitKey.get(key) ?? []), m])
  }
  for (const list of childrenByUnitKey.values()) list.sort(compareBirthOrder)

  const unitsByKey = new Map<string, FamilyUnit>()
  for (const [key, [a, b]] of spousePairs.entries()) {
    const [anchor, spouse] = pickAnchor(byId.get(a)!, byId.get(b)!)
    unitsByKey.set(key, { key, anchor, spouse, children: childrenByUnitKey.get(key) ?? [] })
  }
  // Defensive fallback: a child whose 2 recorded parents aren't linked as spouses of each
  // other (a data inconsistency the app's own flows shouldn't produce) still gets a solo
  // unit off their first recorded parent, so they always render somewhere.
  for (const [key, children] of childrenByUnitKey.entries()) {
    if (!key.startsWith('solo-') && unitsByKey.has(key)) continue
    const anchorId = key.startsWith('solo-') ? key.slice('solo-'.length) : children[0]?.parentIds.find((p) => byId.has(p))
    const anchor = anchorId ? byId.get(anchorId) : undefined
    if (!anchor) continue
    const soloKey = `solo-${anchor.id}`
    if (!unitsByKey.has(soloKey)) unitsByKey.set(soloKey, { key: soloKey, anchor, spouse: null, children: [] })
    unitsByKey.get(soloKey)!.children.push(...children.filter((c) => !unitsByKey.get(soloKey)!.children.includes(c)))
  }

  /** Key shared by full siblings (same parent pair, order-independent), or '' for
   * members with no recorded parents in this tree. */
  function siblingKey(m: Member): string {
    return [...m.parentIds].sort().join('|')
  }

  // --- Group each generation into contiguous "family blocks" ---
  const minGeneration = Math.min(...members.map((m) => m.generation))
  const byGeneration = new Map<number, Member[]>()
  for (const m of members) {
    byGeneration.set(m.generation, [...(byGeneration.get(m.generation) ?? []), m])
  }

  interface Block {
    members: Member[]
    /** Sort key for this block's left-to-right position among its row's other blocks. */
    anchorX: number
  }

  function blockOf(clusterMembers: Member[]): Member[] {
    // Full siblings (if any) sorted oldest-to-left; each sibling immediately followed by
    // their own spouse(s) in this cluster, in a stable order. A cluster with nobody
    // recorded as anyone's child (a root-level marriage with no parents of their own) is
    // instead anchored on whoever has the most spouses, followed by each spouse in order.
    const clusterIds = new Set(clusterMembers.map((m) => m.id))
    const withParents = clusterMembers.filter((m) => siblingKey(m) !== '')
    const placed = new Set<string>()
    const result: Member[] = []

    function appendWithSpouses(person: Member) {
      if (placed.has(person.id)) return
      result.push(person)
      placed.add(person.id)
      const spouseIds = (spousesOf.get(person.id) ?? []).filter((id) => clusterIds.has(id) && !placed.has(id))
      const spouses = spouseIds
        .map((id) => byId.get(id)!)
        .sort((a, b) => compareBirthOrder(a, b) || a.id.localeCompare(b.id))
      for (const spouse of spouses) {
        result.push(spouse)
        placed.add(spouse.id)
      }
    }

    if (withParents.length > 0) {
      const siblingsSorted = [...withParents].sort(compareBirthOrder)
      for (const sibling of siblingsSorted) appendWithSpouses(sibling)
    } else {
      const anchor = clusterMembers.reduce((best, m) =>
        (spouseCountOf.get(m.id) ?? 0) > (spouseCountOf.get(best.id) ?? 0) ? m : best,
      )
      appendWithSpouses(anchor)
    }
    for (const m of clusterMembers) if (!placed.has(m.id)) appendWithSpouses(m)
    return result
  }

  /** Clusters a generation's members into family blocks via union-find over sibling and
   * spouse links, so a boundary between two unrelated blocks can get extra spacing and a
   * divider line. */
  function clusterInto(rowMembers: Member[]): Member[][] {
    const parent = new Map<string, string>(rowMembers.map((m) => [m.id, m.id]))
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
    for (const m of rowMembers) {
      const key = siblingKey(m)
      if (!key) continue
      byKey.set(key, [...(byKey.get(key) ?? []), m.id])
    }
    for (const ids of byKey.values()) for (let i = 1; i < ids.length; i++) union(ids[0], ids[i])
    const idsInRow = new Set(rowMembers.map((m) => m.id))
    for (const m of rowMembers) {
      for (const s of spousesOf.get(m.id) ?? []) if (idsInRow.has(s)) union(m.id, s)
    }
    const groups = new Map<string, Member[]>()
    for (const m of rowMembers) {
      const root = find(m.id)
      groups.set(root, [...(groups.get(root) ?? []), m])
    }
    return [...groups.values()]
  }

  const positions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()
  const dividerPositions: { x: number; y: number }[] = []

  const generations = [...byGeneration.keys()].sort((a, b) => a - b)
  for (const generation of generations) {
    const y = (generation - minGeneration) * ROW_HEIGHT
    const clusters = clusterInto(byGeneration.get(generation)!)

    const blocks: Block[] = clusters.map((clusterMembers) => {
      const ordered = blockOf(clusterMembers)
      // Anchor this block's left-to-right position on its parents' already-placed
      // position (generations are processed top-down), so parent→child lines never
      // cross. A block with no parents in this tree (a root ancestor, or an anchor
      // whose own marriages have no recorded parents) falls back to birth order.
      const withParents = ordered.find((m) => m.parentIds.some((p) => byId.has(p)))
      let anchorX: number
      if (withParents) {
        const validParents = withParents.parentIds.filter((p) => byId.has(p))
        const parentXs = validParents.map((p) => positions.get(p)?.x ?? 0)
        anchorX = parentXs.reduce((a, b) => a + b, 0) / parentXs.length
      } else {
        anchorX = ordered[0].birthDate ? Date.parse(ordered[0].birthDate) : 0
      }
      return { members: ordered, anchorX }
    })
    blocks.sort((a, b) => a.anchorX - b.anchorX || a.members[0].id.localeCompare(b.members[0].id))

    let cursorX = 0
    blocks.forEach((block, i) => {
      if (i > 0) {
        dividerPositions.push({ x: cursorX - GROUP_GAP / 2, y })
        cursorX += GROUP_GAP - HORIZONTAL_GAP
      }
      for (const m of block.members) {
        positions.set(m.id, { x: cursorX, y })
        visited.add(m.id)
        cursorX += NODE_WIDTH + HORIZONTAL_GAP
      }
    })
  }

  // Safety net: nothing should ever silently disappear from the tree because of a gap in
  // the logic above — any member left unvisited still gets rendered, off to the side,
  // rather than vanishing.
  members.filter((m) => !visited.has(m.id)).forEach((m, i) => positions.set(m.id, { x: i * (NODE_WIDTH + HORIZONTAL_GAP), y: 0 }))

  let colorIndex = 0
  const unionColors = new Map<string, string>()
  for (const unit of unitsByKey.values()) {
    if (!unit.spouse) continue
    unionColors.set(unit.key, UNION_COLORS[colorIndex % UNION_COLORS.length])
    colorIndex++
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
  const hubIdOf = new Map<string, string>() // anchor member id -> hub node id, created lazily

  for (const unit of unitsByKey.values()) {
    const anchorPos = positions.get(unit.anchor.id)
    if (!anchorPos || !unit.spouse) continue
    const spousePos = positions.get(unit.spouse.id)!
    const color = unionColors.get(unit.key)
    const adjacent = Math.abs(anchorPos.x - spousePos.x) <= NODE_WIDTH + HORIZONTAL_GAP + 1

    let unionAnchorPos: { x: number; y: number }

    if (adjacent) {
      // An ordinary, adjacent couple: a plain straight marriage line, and their shared
      // union point sits at the true midpoint between them.
      const [leftId, rightId] = anchorPos.x <= spousePos.x ? [unit.anchor.id, unit.spouse.id] : [unit.spouse.id, unit.anchor.id]
      edges.push({
        id: `spouse-${unit.anchor.id}-${unit.spouse.id}`,
        source: leftId,
        sourceHandle: 'right',
        target: rightId,
        targetHandle: 'left',
        type: 'spouseEdge',
        style: { stroke: color },
      })
      unionAnchorPos = { x: (anchorPos.x + spousePos.x) / 2 + NODE_WIDTH / 2, y: (anchorPos.y + spousePos.y) / 2 + NODE_HEIGHT / 2 }
    } else {
      // A remarriage to a spouse who isn't sitting right next to the anchor: route
      // through a shared marriage hub above the row instead of a direct line, which
      // would otherwise have to run diagonally or straight through whoever sits between
      // them. The union point for this specific couple's children sits directly under
      // the spouse (their row is already ordered to match, so this can't cross anyone).
      let hubId = hubIdOf.get(unit.anchor.id)
      if (!hubId) {
        hubId = `hub-${unit.anchor.id}`
        hubIdOf.set(unit.anchor.id, hubId)
        nodes.push({
          id: hubId,
          type: 'marriageHub',
          position: { x: anchorPos.x, y: anchorPos.y - HUB_OFFSET },
          data: {},
          draggable: false,
          selectable: false,
        })
        edges.push({
          id: `hub-in-${unit.anchor.id}`,
          source: unit.anchor.id,
          sourceHandle: 'top',
          target: hubId,
          targetHandle: 'in',
          type: 'smoothstep',
          style: { stroke: 'var(--color-gold-dark)' },
        })
      }
      edges.push({
        id: `hub-out-${unit.anchor.id}-${unit.spouse.id}`,
        source: hubId,
        sourceHandle: 'out',
        target: unit.spouse.id,
        targetHandle: undefined,
        type: 'smoothstep',
        style: { stroke: color },
      })
      unionAnchorPos = { x: spousePos.x + NODE_WIDTH / 2, y: spousePos.y + NODE_HEIGHT }
    }

    const unionId = `union-${unit.key}`
    nodes.push({ id: unionId, type: 'unionNode', position: unionAnchorPos, data: { color }, draggable: false, selectable: false })
    for (const child of unit.children) {
      edges.push({ id: `child-${unionId}-${child.id}`, source: unionId, target: child.id, type: 'smoothstep', style: { stroke: color } })
    }
  }

  for (const unit of unitsByKey.values()) {
    if (unit.spouse) continue
    for (const child of unit.children) {
      edges.push({ id: `child-${unit.anchor.id}-${child.id}`, source: unit.anchor.id, target: child.id, type: 'smoothstep' })
    }
  }

  return { nodes, edges }
}
