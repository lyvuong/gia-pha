import type { Edge, Node } from '@xyflow/react'
import type { Member } from '../types/models'

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 96
const HORIZONTAL_GAP = 40
const ROW_HEIGHT = 180
const SLOT = NODE_WIDTH + HORIZONTAL_GAP
/** Extra horizontal breathing room, on top of the normal gap, between two unrelated
 * root-level family trees sharing this gia phả. A thin divider line (see
 * `GROUP_DIVIDER_HEIGHT`) is centered in this gap. */
const GROUP_GAP = HORIZONTAL_GAP + 40
export const GROUP_DIVIDER_HEIGHT = NODE_HEIGHT + 48

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
 * number to a user, so the oldest generation always reads as 1. Purely a label — it
 * plays no part in the tree's visual layout (see `computeTreeLayout`). */
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

/** Husband to the left, wife to the right when both genders are known; otherwise keep
 * whichever order the two already had. */
function orderCouple(a: Member, b: Member): [Member, Member] {
  if (a.gender === 'female' && b.gender === 'male') return [b, a]
  return [a, b]
}

/** One couple (or a single recorded parent) plus their children. A person who remarries
 * is the shared `anchor` of several units — one per spouse — which get stacked as
 * separate rows under them (see `computeTreeLayout`), rather than every spouse and every
 * child sharing one row regardless of which marriage they belong to. */
interface FamilyUnit {
  key: string
  anchor: Member
  spouse: Member | null
  children: Member[]
}

/**
 * Lays out the family tree as a recursive tree of family units, not a flat row per
 * generation. Each unit (a couple, or a single recorded parent) is drawn as its own
 * row with its children directly beneath it; a person with multiple spouses gets one
 * such row per marriage, stacked vertically, each with only its own children beneath
 * it — so which children belong to which parents is structural, not just a matter of
 * spacing or color (both of which are also applied, as a second layer of clarity).
 *
 * `member.generation` is not used for vertical position at all here — it remains only
 * a data field (used elsewhere for relationship math) and a display label.
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

  // Whoever has the most recorded marriages is the one who needs the primary-stays-put,
  // remarriages-stack-below treatment, so they're always the "anchor" for every one of
  // their unions — regardless of gender (which may be unrecorded) or which side of the
  // pair happened to be visited first while building `spousePairs` above. Without this,
  // a remarried person's marriages can end up anchored inconsistently (split across
  // different "anchors" depending on iteration order), which breaks the stacking.
  const spouseCountOf = new Map<string, number>()
  for (const [a, b] of spousePairs.values()) {
    spouseCountOf.set(a, (spouseCountOf.get(a) ?? 0) + 1)
    spouseCountOf.set(b, (spouseCountOf.get(b) ?? 0) + 1)
  }
  function pickAnchor(a: Member, b: Member): [Member, Member] {
    const countA = spouseCountOf.get(a.id) ?? 0
    const countB = spouseCountOf.get(b.id) ?? 0
    if (countA !== countB) return countA > countB ? [a, b] : [b, a]
    return orderCouple(a, b)
  }

  const unitsByKey = new Map<string, FamilyUnit>()
  for (const [key, [a, b]] of spousePairs.entries()) {
    const [anchor, spouse] = pickAnchor(byId.get(a)!, byId.get(b)!)
    unitsByKey.set(key, { key, anchor, spouse, children: childrenByUnitKey.get(key) ?? [] })
  }
  // Defensive fallback: a child whose 2 recorded parents aren't linked as spouses of each
  // other (a data inconsistency the app's own flows shouldn't produce, but nothing here
  // should silently drop a member from the tree over it) still gets a solo unit off their
  // first recorded parent, so they always render somewhere.
  for (const [key, children] of childrenByUnitKey.entries()) {
    if (!key.startsWith('solo-') && unitsByKey.has(key)) continue
    const anchorId = key.startsWith('solo-') ? key.slice('solo-'.length) : children[0]?.parentIds.find((p) => byId.has(p))
    const anchor = anchorId ? byId.get(anchorId) : undefined
    if (!anchor) continue
    const soloKey = `solo-${anchor.id}`
    if (!unitsByKey.has(soloKey)) unitsByKey.set(soloKey, { key: soloKey, anchor, spouse: null, children: [] })
    unitsByKey.get(soloKey)!.children.push(...children.filter((c) => !unitsByKey.get(soloKey)!.children.includes(c)))
  }

  const unitsByAnchor = new Map<string, FamilyUnit[]>()
  for (const unit of unitsByKey.values()) {
    unitsByAnchor.set(unit.anchor.id, [...(unitsByAnchor.get(unit.anchor.id) ?? []), unit])
  }
  // Order each anchor's own marriages by their earliest child's birth date (oldest
  // marriage first), falling back to spouse id for a stable order when birth dates are
  // unknown — determines top-to-bottom stacking order for a remarried anchor.
  for (const list of unitsByAnchor.values()) {
    list.sort((u1, u2) => {
      const b1 = u1.children[0]?.birthDate ?? ''
      const b2 = u2.children[0]?.birthDate ?? ''
      return b1.localeCompare(b2) || (u1.spouse?.id ?? '').localeCompare(u2.spouse?.id ?? '')
    })
  }

  const claimedAsSpouse = new Set<string>()
  for (const unit of unitsByKey.values()) if (unit.spouse) claimedAsSpouse.add(unit.spouse.id)

  // Each entry is one root-level (no recorded parents) anchor's own ordered marriage list —
  // grouped by anchor, not flattened, so a remarried root ancestor (e.g. the tree's own
  // founding patriarch with several wives) gets the same primary-marriage-stays-put,
  // remarriages-stack-below treatment as any other remarried person, instead of each of
  // his marriages claiming its own independent top-level column.
  const rootAnchorUnits: FamilyUnit[][] = []
  const seenRootAnchor = new Set<string>()
  for (const m of members) {
    if (m.parentIds.some((p) => byId.has(p))) continue
    if (claimedAsSpouse.has(m.id) || seenRootAnchor.has(m.id)) continue
    seenRootAnchor.add(m.id)
    const units = unitsByAnchor.get(m.id)
    rootAnchorUnits.push(units && units.length > 0 ? units : [{ key: `solo-${m.id}`, anchor: m, spouse: null, children: [] }])
  }
  rootAnchorUnits.sort(
    (a, b) =>
      (a[0].anchor.birthDate ?? '').localeCompare(b[0].anchor.birthDate ?? '') || a[0].anchor.id.localeCompare(b[0].anchor.id),
  )

  // --- Width (in slot-columns) and row-span (in generation-rows) a unit's subtree needs ---
  // A child with no further marriages needs just their own column; a remarried child needs
  // whichever of their own units is widest (their marriages stack vertically, not side by
  // side, so they only ever need the widest one's width) — and their row-span is the *sum*
  // of all their units' spans, since those stack.
  function unitWidth(unit: FamilyUnit): number {
    if (unit.children.length === 0) return 1
    return unit.children.reduce((sum, c) => sum + childWidth(c), 0)
  }
  function childWidth(child: Member): number {
    const nested = unitsByAnchor.get(child.id)
    if (!nested || nested.length === 0) return 1
    return Math.max(...nested.map(unitWidth))
  }
  function unitRowSpan(unit: FamilyUnit): number {
    if (unit.children.length === 0) return 1
    return 1 + Math.max(...unit.children.map(childRowSpan))
  }
  function childRowSpan(child: Member): number {
    const nested = unitsByAnchor.get(child.id)
    if (!nested || nested.length === 0) return 1
    return nested.reduce((sum, u) => sum + unitRowSpan(u), 0)
  }

  const positions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()

  /** Places `unit`'s children directly beneath it (`row + 1`), then recurses into each
   * child's own marriages via `placeNestedUnit`. */
  function placeChildrenRow(unit: FamilyUnit, slotStart: number, row: number) {
    let cursor = slotStart
    for (const child of unit.children) {
      const cw = childWidth(child)
      const childRow = row + 1
      positions.set(child.id, { x: (cursor + (cw - 1) / 2) * SLOT, y: childRow * ROW_HEIGHT })
      visited.add(child.id)

      let nextRow = childRow
      for (const nestedUnit of unitsByAnchor.get(child.id) ?? []) {
        placeNestedUnit(nestedUnit, cursor, nextRow)
        nextRow += unitRowSpan(nestedUnit)
      }
      cursor += cw
    }
  }

  /** A child's own marriage. The child (`unit.anchor`) already has a fixed position from
   * `placeChildrenRow` and is never moved again — the oldest marriage's spouse joins them
   * at that same row (an ordinary couple); a 2nd+ marriage's spouse instead gets her own
   * row further down (past the previous marriage's whole subtree), connected back to the
   * anchor's one unmoved position — "husband stays put, each additional wife gets her own
   * row below the last one." */
  function placeNestedUnit(unit: FamilyUnit, slotStart: number, row: number) {
    const anchorPos = positions.get(unit.anchor.id)!
    if (unit.spouse) {
      const sameRowAsAnchor = row * ROW_HEIGHT === anchorPos.y
      const width = unitWidth(unit)
      const spouseX = sameRowAsAnchor ? (slotStart + (width - 1) / 2 + 0.5) * SLOT : anchorPos.x + SLOT
      positions.set(unit.spouse.id, { x: spouseX, y: row * ROW_HEIGHT })
      visited.add(unit.spouse.id)
    }
    placeChildrenRow(unit, slotStart, row)
  }

  /** A root-level (no recorded parents) anchor's own oldest marriage — same shape as an
   * ordinary couple, since there's no earlier fixed position to preserve here. */
  function placeRootUnit(unit: FamilyUnit, slotStart: number, row: number) {
    const width = unitWidth(unit)
    const coupleCenterSlot = slotStart + (width - 1) / 2
    const anchorSlot = unit.spouse ? coupleCenterSlot - 0.5 : coupleCenterSlot
    positions.set(unit.anchor.id, { x: anchorSlot * SLOT, y: row * ROW_HEIGHT })
    visited.add(unit.anchor.id)
    if (unit.spouse) {
      positions.set(unit.spouse.id, { x: (coupleCenterSlot + 0.5) * SLOT, y: row * ROW_HEIGHT })
      visited.add(unit.spouse.id)
    }
    placeChildrenRow(unit, slotStart, row)
  }

  const dividerPositions: { x: number; y: number }[] = []
  let rootCursor = 0
  rootAnchorUnits.forEach((units, i) => {
    if (i > 0) dividerPositions.push({ x: rootCursor * SLOT - (GROUP_GAP - HORIZONTAL_GAP) / 2, y: 0 })
    const width = childWidth(units[0].anchor)
    placeRootUnit(units[0], rootCursor, 0)
    let nextRow = unitRowSpan(units[0])
    for (let j = 1; j < units.length; j++) {
      placeNestedUnit(units[j], rootCursor, nextRow)
      nextRow += unitRowSpan(units[j])
    }
    rootCursor += width
  })

  // Safety net: nothing should ever silently disappear from the tree because of a gap in
  // the recursive traversal above (e.g. an unusual data shape not anticipated by it) — any
  // member left unvisited still gets rendered, off to the side, rather than vanishing.
  const strayMembers = members.filter((m) => !visited.has(m.id))
  strayMembers.forEach((m, i) => {
    positions.set(m.id, { x: (rootCursor + i) * SLOT, y: 0 })
  })

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
    if (!anchorPos) continue

    if (unit.spouse) {
      const spousePos = positions.get(unit.spouse.id)!
      const color = unionColors.get(unit.key)
      const unionId = `union-${unit.key}`
      nodes.push({
        id: unionId,
        type: 'unionNode',
        position: {
          x: (anchorPos.x + spousePos.x) / 2 + NODE_WIDTH / 2,
          y: (anchorPos.y + spousePos.y) / 2 + NODE_HEIGHT / 2,
        },
        data: { color },
        draggable: false,
        selectable: false,
      })

      // Same row = an ordinary couple, drawn as a plain marriage line. A remarriage's
      // spouse sits on her own row further down (see `placeNestedUnit`) — that connector
      // is instead a dashed, elbowed line back to the anchor's one fixed position, so a
      // long-distance "also married to" link never reads as an ordinary relationship line
      // even where it happens to pass near unrelated nodes.
      const sameRow = anchorPos.y === spousePos.y
      const [leftId, rightId] = anchorPos.x <= spousePos.x ? [unit.anchor.id, unit.spouse.id] : [unit.spouse.id, unit.anchor.id]
      edges.push({
        id: `spouse-${unit.anchor.id}-${unit.spouse.id}`,
        source: leftId,
        sourceHandle: 'right',
        target: rightId,
        targetHandle: 'left',
        type: sameRow ? 'spouseEdge' : 'smoothstep',
        style: sameRow ? { stroke: color } : { stroke: color, strokeDasharray: '6 4' },
      })

      for (const child of unit.children) {
        edges.push({ id: `child-${unionId}-${child.id}`, source: unionId, target: child.id, type: 'smoothstep', style: { stroke: color } })
      }
    } else {
      for (const child of unit.children) {
        edges.push({ id: `child-${unit.anchor.id}-${child.id}`, source: unit.anchor.id, target: child.id, type: 'smoothstep' })
      }
    }
  }

  return { nodes, edges }
}
