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
/** Horizontal distance between adjacent wives' own "children channel" lines (see
 * `computeTreeLayout`) — just enough to keep them visually distinct as separate lines. */
const CHANNEL_SPACING = 20

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

/** One slot in a row: either a single person, or a remarried person's whole set of
 * wives, stacked vertically in one shared column instead of spread out horizontally
 * (see `computeTreeLayout`). */
type BlockItem = { kind: 'single'; member: Member } | { kind: 'stack'; anchor: Member; wives: Member[] }

/**
 * Lays out the family tree with every generation as its own strict horizontal band
 * (`member.generation` is authoritative for row position, same as a simple family-tree
 * chart) — but with every connecting line kept orthogonal (horizontal/vertical segments
 * only, never diagonal), solid (never dashed), and routed so it never crosses another
 * line or cuts across an unrelated person's box:
 *
 * - Each row is ordered into contiguous "family blocks" (a sibling set, plus any spouses
 *   they married in) so two different parent-couples' children never interleave.
 * - A child-generation row's blocks are ordered to match their parents' left-to-right
 *   order in the row above, so parent→child lines never cross each other.
 * - A person with more than one spouse (remarriage) doesn't get spread across the row —
 *   all of their wives stack vertically in one column to their right instead, making the
 *   generation's band taller rather than wider. Their line to each wife, and each wife's
 *   line down to her own children, only ever runs horizontally-then-vertically: a wife's
 *   children exit from her *right* edge into the gap beside the stack, then turn down —
 *   never straight down through whichever other wife is stacked below her.
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

  // Whoever has the most recorded marriages is the one whose wives stack under them,
  // regardless of gender (which may not be recorded) or which side of a pair happened to
  // be visited first above — otherwise one person's marriages could end up inconsistently
  // anchored depending on iteration order.
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

  function sortedSpousesIn(person: Member, allowedIds: Set<string>, excluded: Set<string>): Member[] {
    return (spousesOf.get(person.id) ?? [])
      .filter((id) => allowedIds.has(id) && !excluded.has(id))
      .map((id) => byId.get(id)!)
      .sort((a, b) => compareBirthOrder(a, b) || a.id.localeCompare(b.id))
  }

  /** Orders a cluster into blocks: full siblings (if any) sorted oldest-to-left, each
   * immediately followed by their own spouse(s) — a remarried sibling's spouses become
   * one 'stack' item instead of being listed side by side. A cluster with nobody recorded
   * as anyone's child (a root-level marriage with no parents of their own) is instead
   * anchored on whoever has the most spouses, followed by their spouse(s). */
  function blockOf(clusterMembers: Member[]): BlockItem[] {
    const clusterIds = new Set(clusterMembers.map((m) => m.id))
    const withParents = clusterMembers.filter((m) => siblingKey(m) !== '')
    const placed = new Set<string>()
    const result: BlockItem[] = []

    function appendPerson(person: Member) {
      if (placed.has(person.id)) return
      placed.add(person.id)
      const spouses = sortedSpousesIn(person, clusterIds, placed)
      if (spouses.length === 0) {
        result.push({ kind: 'single', member: person })
        return
      }
      for (const spouse of spouses) placed.add(spouse.id)
      if ((spouseCountOf.get(person.id) ?? 0) >= 2) {
        result.push({ kind: 'stack', anchor: person, wives: spouses })
      } else {
        result.push({ kind: 'single', member: person })
        for (const spouse of spouses) result.push({ kind: 'single', member: spouse })
      }
    }

    if (withParents.length > 0) {
      for (const sibling of [...withParents].sort(compareBirthOrder)) appendPerson(sibling)
    } else {
      const anchor = clusterMembers.reduce((best, m) =>
        (spouseCountOf.get(m.id) ?? 0) > (spouseCountOf.get(best.id) ?? 0) ? m : best,
      )
      appendPerson(anchor)
    }
    for (const m of clusterMembers) if (!placed.has(m.id)) appendPerson(m)
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

  const byGeneration = new Map<number, Member[]>()
  for (const m of members) {
    byGeneration.set(m.generation, [...(byGeneration.get(m.generation) ?? []), m])
  }
  const generations = [...byGeneration.keys()].sort((a, b) => a - b)

  // A generation's band is normally one row tall, but grows taller (never wider) to fit
  // whichever of its members has the most wives stacked under them.
  const bandHeightOf = new Map<number, number>()
  for (const generation of generations) {
    const maxWives = Math.max(1, ...byGeneration.get(generation)!.map((m) => spouseCountOf.get(m.id) ?? 1))
    bandHeightOf.set(generation, maxWives * ROW_HEIGHT)
  }
  const bandTopOf = new Map<number, number>()
  let cumulativeY = 0
  for (const generation of generations) {
    bandTopOf.set(generation, cumulativeY)
    cumulativeY += bandHeightOf.get(generation)!
  }

  interface Block {
    items: BlockItem[]
    /** Sort key for this block's left-to-right position among its row's other blocks. */
    anchorX: number
  }

  const positions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()
  const dividerPositions: { x: number; y: number }[] = []

  for (const generation of generations) {
    const bandTop = bandTopOf.get(generation)!
    const clusters = clusterInto(byGeneration.get(generation)!)

    const blocks: Block[] = clusters.map((clusterMembers) => {
      const items = blockOf(clusterMembers)
      const flat = items.flatMap((item) => (item.kind === 'single' ? [item.member] : [item.anchor, ...item.wives]))
      // Anchor this block's left-to-right position on its parents' already-placed
      // position (generations are processed top-down), so parent→child lines never
      // cross. A block with no parents in this tree (a root ancestor, or an anchor
      // whose own marriages have no recorded parents) falls back to birth order.
      const withParents = flat.find((m) => m.parentIds.some((p) => byId.has(p)))
      let anchorX: number
      if (withParents) {
        const validParents = withParents.parentIds.filter((p) => byId.has(p))
        const parentXs = validParents.map((p) => positions.get(p)?.x ?? 0)
        anchorX = parentXs.reduce((a, b) => a + b, 0) / parentXs.length
      } else {
        anchorX = flat[0].birthDate ? Date.parse(flat[0].birthDate) : 0
      }
      return { items, anchorX }
    })
    blocks.sort((a, b) => a.anchorX - b.anchorX)

    let cursorX = 0
    blocks.forEach((block, i) => {
      if (i > 0) {
        dividerPositions.push({ x: cursorX - GROUP_GAP / 2, y: bandTop })
        cursorX += GROUP_GAP - HORIZONTAL_GAP
      }
      for (const item of block.items) {
        if (item.kind === 'single') {
          positions.set(item.member.id, { x: cursorX, y: bandTop })
          visited.add(item.member.id)
          cursorX += NODE_WIDTH + HORIZONTAL_GAP
        } else {
          positions.set(item.anchor.id, { x: cursorX, y: bandTop })
          visited.add(item.anchor.id)
          cursorX += NODE_WIDTH + HORIZONTAL_GAP
          const stackX = cursorX
          item.wives.forEach((wife, wi) => {
            positions.set(wife.id, { x: stackX, y: bandTop + wi * ROW_HEIGHT })
            visited.add(wife.id)
          })
          // Reserve one extra channel-width per wife beyond the stack's own column, so
          // each wife's line down to her children (see the edge-building pass below) has
          // its own clear lane before the next family block starts.
          cursorX += NODE_WIDTH + HORIZONTAL_GAP + item.wives.length * CHANNEL_SPACING
        }
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

  for (const unit of unitsByKey.values()) {
    const anchorPos = positions.get(unit.anchor.id)
    if (!anchorPos || !unit.spouse) continue
    const spousePos = positions.get(unit.spouse.id)!
    const color = unionColors.get(unit.key)
    const stacked = (spouseCountOf.get(unit.anchor.id) ?? 0) >= 2

    let unionAnchorPos: { x: number; y: number }

    if (!stacked) {
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
      // A remarried anchor's wives are stacked in one column to their right (see
      // `blockOf`). Every line from the anchor to a wife is pinned (via `centerX`) to
      // the exact same x — the midpoint of the gap between the anchor and the stack —
      // so all of them render as one shared vertical line with a short stub into each
      // wife, rather than several independently-routed lines that only approximately
      // coincide.
      const bandTop = bandTopOf.get(unit.anchor.generation)!
      const spineX = anchorPos.x + NODE_WIDTH + HORIZONTAL_GAP / 2
      edges.push({
        id: `spouse-${unit.anchor.id}-${unit.spouse.id}`,
        source: unit.anchor.id,
        sourceHandle: 'right',
        target: unit.spouse.id,
        targetHandle: 'left',
        type: 'elbowEdge',
        data: { centerX: spineX },
        style: { stroke: 'var(--color-gold-dark)' },
      })
      // This wife's own children exit her *right* edge (never straight down, which
      // would run through whichever other wife is stacked below her) into a channel
      // beside the stack, then turn down into the generation band below. Each wife gets
      // her *own* channel x — the wife closest to the band's bottom gets the nearest
      // one, each wife above her a bit further out — so a wife whose channel line must
      // travel past another wife's row never overlaps that wife's own channel line: the
      // wives it passes are always further down the stack, whose channel doesn't start
      // until below the row it's passing through.
      const wivesCount = spouseCountOf.get(unit.anchor.id)!
      const wifeIndex = Math.round((spousePos.y - bandTop) / ROW_HEIGHT)
      const reversedIndex = wivesCount - 1 - wifeIndex
      const channelX = spousePos.x + NODE_WIDTH + HORIZONTAL_GAP / 2 + reversedIndex * CHANNEL_SPACING
      unionAnchorPos = { x: channelX, y: bandTop + bandHeightOf.get(unit.anchor.generation)! }
      edges.push({
        id: `spouse-to-union-${unit.key}`,
        source: unit.spouse.id,
        sourceHandle: 'right',
        target: `union-${unit.key}`,
        targetHandle: 'in',
        type: 'elbowEdge',
        data: { centerX: channelX },
        style: { stroke: color },
      })
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
