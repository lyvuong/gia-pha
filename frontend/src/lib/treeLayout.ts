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
  /** Union-node only: the non-anchor spouse this union belongs to — where a manual drag
   * override for this specific dot is persisted (see `Member.unionTreePosition`). */
  spouseId?: string
  /** Union-node only: the other half of the couple, used (along with `spouseId`'s own
   * position) to compute this dot's two drag-snap candidates. */
  anchorId?: string
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

/** Which side of a box at `boxX` a connector should leave from to reach `towardX`, so the
 * line heads straight for its target instead of exiting the far side and doubling back
 * across the box itself (which is what happens if a handle is hardcoded to one side
 * without checking where the other end actually ended up — e.g. after a manual drag). */
function exitSide(boxX: number, towardX: number): 'left' | 'right' {
  return towardX < boxX + NODE_WIDTH / 2 ? 'left' : 'right'
}

interface Point {
  x: number
  y: number
}

/** `centerX` alone means the classic single-bend elbow (horizontal out of the source,
 * vertical, horizontal into the target). `viaY` adds a detour row: vertical out of the
 * source first, over at `viaY`, then vertical again at `centerX` into the target — for
 * when the source's own row is blocked for the entire width to the target (see
 * `pickClearRoute`). Deliberately carries no source/target y of its own — see
 * `ElbowEdge` for why baking in an estimate of the endpoint's own position is a bug. */
interface Route extends Record<string, unknown> {
  centerX: number
  viaY?: number
}

/** Every connector leg touching a box must be long enough to read as a real stub, not a
 * corner planted right on the edge — a bend that lands exactly on `sourceX`/`targetX` (or
 * `sourceY`/`targetY` for a vertical leader) technically avoids every box but collapses
 * that leg to nothing, which is what a *sizable* minimum length is here to rule out. */
const MIN_LEADER = 16

function hSegmentClearsBoxes(x0: number, x1: number, y: number, boxes: { x: number; y: number }[]): boolean {
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  return !boxes.some((b) => y > b.y && y < b.y + NODE_HEIGHT && hi > b.x && lo < b.x + NODE_WIDTH)
}

function vSegmentClearsBoxes(x: number, y0: number, y1: number, boxes: { x: number; y: number }[]): boolean {
  const lo = Math.min(y0, y1)
  const hi = Math.max(y0, y1)
  return !boxes.some((b) => x > b.x && x < b.x + NODE_WIDTH && hi > b.y && lo < b.y + NODE_HEIGHT)
}

/** Whether a horizontal-then-vertical-then-horizontal route bending at `bendX` (out of
 * the source's row, then into the target's) is clear of every box — checking *all three*
 * legs, since the final horizontal leg (source's bend to the target's own x) is only
 * zero-length when `bendX` happens to equal `targetX`; any other bend has a real leg
 * there that needs checking too. */
function hvhRouteIsClear(sourceX: number, sourceY: number, bendX: number, targetX: number, targetY: number, boxes: { x: number; y: number }[]): boolean {
  return (
    hSegmentClearsBoxes(sourceX, bendX, sourceY, boxes) &&
    vSegmentClearsBoxes(bendX, sourceY, targetY, boxes) &&
    hSegmentClearsBoxes(bendX, targetX, targetY, boxes)
  )
}

/** Searches outward from `mid` in `step`-sized increments for the first value satisfying
 * `isClear`, trying the two candidates equidistant from `mid` at each step before moving
 * further out — so a bend that has to move off-center still favors whichever direction
 * needs the smaller nudge, rather than always drifting the same way. Two passes: the
 * first also requires `MIN_LEADER` clearance from both `lo` and `hi` (via `hasLeader`),
 * the second drops that requirement so a genuinely tight gap still gets *some* answer
 * rather than none. */
function searchOutward(mid: number, step: number, maxSteps: number, hasLeader: (v: number) => boolean, isClear: (v: number) => boolean): number | undefined {
  for (const requireLeader of [true, false]) {
    for (let i = 0; i <= maxSteps; i++) {
      const candidates = i === 0 ? [mid] : [mid + i * step, mid - i * step]
      for (const v of candidates) {
        if (requireLeader && !hasLeader(v)) continue
        if (isClear(v)) return v
      }
    }
  }
  return undefined
}

/** Where a horizontal-leadered elbow connector (one without the layout's own precomputed
 * crossing-free guarantees — a manual drag, or a manually moved connector dot — between
 * two boxes joined on their left/right edges) should bend, so both the leg leaving the
 * source and the leg entering the target run a real, visible distance horizontally
 * before turning: prefers the true midpoint (equal leaders on both sides), searching
 * outward from it when that's blocked by some other member's box. None of those can help
 * when the source's *own row* is blocked for its entire width to the target — no
 * horizontal bend, wherever placed, dodges an obstacle sitting directly on the row it
 * would have to leave along. When every bend option fails, this ducks to a nearby row
 * that's clear before crossing over, adding one extra corner rather than cutting through
 * whatever's in the way. */
function pickClearRoute(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  boxes: { x: number; y: number }[],
  preferredX?: number,
): Route {
  // A caller with its own already-picked bend for a *related* connector (e.g. the
  // marriage line this couple's union dot sits near) passes it here first, so the two
  // lines share one column and read as a single merged line wherever they run alongside
  // each other, instead of each computing its own slightly different bend independently.
  if (preferredX !== undefined && hvhRouteIsClear(sourceX, sourceY, preferredX, targetX, targetY, boxes)) {
    return { centerX: preferredX }
  }
  const mid = (sourceX + targetX) / 2
  const bendX = searchOutward(
    mid,
    HORIZONTAL_GAP / 4,
    60,
    (x) => Math.abs(x - sourceX) >= MIN_LEADER && Math.abs(x - targetX) >= MIN_LEADER,
    (x) => hvhRouteIsClear(sourceX, sourceY, x, targetX, targetY, boxes),
  )
  if (bendX !== undefined) return { centerX: bendX }

  const rowDir = targetY >= sourceY ? 1 : -1
  const rowStep = ROW_HEIGHT / 6
  for (let step = 1; step <= 60; step++) {
    const viaY = sourceY + rowDir * step * rowStep
    if (rowDir > 0 ? viaY >= targetY : viaY <= targetY) break
    if (!vSegmentClearsBoxes(sourceX, sourceY, viaY, boxes)) continue
    for (const x of [mid, targetX, sourceX]) {
      if (hvhRouteIsClear(sourceX, viaY, x, targetX, targetY, boxes)) return { centerX: x, viaY }
    }
  }

  return { centerX: mid }
}

/** Where a vertical-leadered elbow connector (a union or a solo parent down to a child —
 * always joined on their top/bottom edges) should jog, so the leg leaving the source and
 * the leg entering the target both run a real vertical distance before turning: prefers
 * the row midway between the two generations (equal leaders on both sides), searching
 * outward when that row is blocked. Always keeps the leaving leg at the source's own x
 * and the entering leg at the target's own x — never a diagonal-risking estimate of
 * either — so this only ever needs to find a clear row, not a clear column too. Siblings
 * sharing the same source and the same generation naturally resolve to the very same
 * row, merging what would otherwise be several near-identical parallel lines into one
 * shared trunk. */
function pickClearBarY(sourceX: number, sourceY: number, targetX: number, targetY: number, boxes: { x: number; y: number }[]): number {
  const mid = (sourceY + targetY) / 2
  const lo = Math.min(sourceY, targetY)
  const hi = Math.max(sourceY, targetY)
  const isClear = (y: number) =>
    vSegmentClearsBoxes(sourceX, sourceY, y, boxes) && hSegmentClearsBoxes(sourceX, targetX, y, boxes) && vSegmentClearsBoxes(targetX, y, targetY, boxes)
  const barY = searchOutward(
    mid,
    ROW_HEIGHT / 12,
    60,
    (y) => y > lo && y < hi && Math.abs(y - sourceY) >= MIN_LEADER && Math.abs(y - targetY) >= MIN_LEADER,
    (y) => y > lo && y < hi && isClear(y),
  )
  return barY ?? mid
}

/** A point close to a `pickClearRoute` path, for placing a union dot near the line it
 * belongs to — the midpoint between source and target for a plain single-bend route
 * (matching the classic "dot centered between the couple" look), or the detour's own
 * elbow for a route that had to duck around something. Uses the layout's own estimate of
 * each endpoint's position (not react-flow's measured one, which this function has no
 * access to) — close enough for placing a *draggable* node, unlike the line itself, which
 * must be pixel-exact (see `ElbowEdge`). */
function midpointOnRoute(route: Route, sourceY: number, targetY: number): Point {
  if (route.viaY === undefined) return { x: route.centerX, y: (sourceY + targetY) / 2 }
  return { x: route.centerX, y: route.viaY }
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
  // A stacked wife's own "children channel" x (see the positioning loop below), keyed by
  // her id. Computed alongside her position — not deferred to the edge-building pass —
  // so the *next* generation's block ordering can anchor on it directly: her children's
  // block needs to line up with where her channel line actually lands, not just with her
  // (shared-with-her-sisters) raw x, or the block order could mismatch the channel order
  // and the two would cross.
  const channelXByWifeId = new Map<string, number>()

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
        const parentXs = validParents.map((p) => channelXByWifeId.get(p) ?? positions.get(p)?.x ?? 0)
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
          const wivesCount = item.wives.length
          item.wives.forEach((wife, wi) => {
            positions.set(wife.id, { x: stackX, y: bandTop + wi * ROW_HEIGHT })
            visited.add(wife.id)
            // Each wife gets her own channel x for the line down to her children — the
            // wife closest to the band's bottom gets the nearest one, each wife above her
            // a bit further out, so a wife whose channel line must travel past another
            // wife's row never overlaps that wife's own channel line: the wives it passes
            // are always further down the stack, whose channel doesn't start until below
            // the row it's passing through.
            const reversedIndex = wivesCount - 1 - wi
            channelXByWifeId.set(wife.id, stackX + NODE_WIDTH + HORIZONTAL_GAP / 2 + reversedIndex * CHANNEL_SPACING)
          })
          // Reserve one extra channel-width per wife beyond the stack's own column, so
          // each wife's line down to her children has its own clear lane before the next
          // family block starts.
          cursorX += NODE_WIDTH + HORIZONTAL_GAP + wivesCount * CHANNEL_SPACING
        }
      }
    })
  }

  // Safety net: nothing should ever silently disappear from the tree because of a gap in
  // the logic above — any member left unvisited still gets rendered, off to the side,
  // rather than vanishing.
  members.filter((m) => !visited.has(m.id)).forEach((m, i) => positions.set(m.id, { x: i * (NODE_WIDTH + HORIZONTAL_GAP), y: 0 }))

  // A manual drag (see `Member.treePosition`) overrides the automatic position for just
  // that one member — everyone else stays exactly where the automatic layout put them.
  const overridden = new Set<string>()
  for (const m of members) {
    if (m.treePosition) {
      positions.set(m.id, m.treePosition)
      overridden.add(m.id)
    }
  }

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

  /** Every other member's box, for keeping a free-form connector from cutting through
   * someone it has nothing to do with. */
  function memberBoxesExcept(excludeIds: Set<string>): { x: number; y: number }[] {
    const list: { x: number; y: number }[] = []
    for (const [id, pos] of positions) if (!excludeIds.has(id)) list.push(pos)
    return list
  }

  for (const unit of unitsByKey.values()) {
    const anchorPos = positions.get(unit.anchor.id)
    if (!anchorPos || !unit.spouse) continue
    const spousePos = positions.get(unit.spouse.id)!
    const color = unionColors.get(unit.key)
    // A manually dragged member (either side of the pair) has left whatever slot the
    // automatic layout's no-crossing guarantees were computed for, so those guarantees —
    // and the pinned-line machinery that provides them — no longer apply here. Fall back
    // to a plain, unpinned orthogonal connector instead: still never diagonal, just no
    // longer promised crossing-free against the rest of the row.
    const manuallyPlaced = overridden.has(unit.anchor.id) || overridden.has(unit.spouse.id)
    const stacked = !manuallyPlaced && (spouseCountOf.get(unit.anchor.id) ?? 0) >= 2
    const unionId = `union-${unit.key}`
    // The connector dot itself can also be manually dragged (see `Member.unionTreePosition`,
    // stored on the non-anchor spouse) — independent of whether either box was moved —
    // to nudge just the bend point when that alone would clear a crossing.
    const unionOverride = unit.spouse.unionTreePosition
    let unionAnchorPos: { x: number; y: number }
    // Whether a `spouse-to-union` connector edge is needed: automatic & adjacent couples
    // don't need one (the dot sits right on the marriage line already), but any manually
    // placed party or dot does, or the dot would float disconnected from its couple.
    let needsUnionEdge = false
    let unionEdgeCenterX: number | undefined
    // When a spouse-to-union line is still needed alongside a marriage line, try to
    // reuse that line's own bend first, so the two merge into one visual line wherever
    // they'd otherwise run alongside each other (see `pickClearRoute`'s `preferredX`).
    let preferredUnionBendX: number | undefined

    if (manuallyPlaced) {
      // A dragged box could have landed on either side of its spouse, above or below —
      // pick whichever handle actually faces the other party instead of assuming anchor
      // is left, so the line heads straight there instead of exiting the far side and
      // cutting back across its own box to get there.
      const anchorSide = exitSide(anchorPos.x, spousePos.x + NODE_WIDTH / 2)
      const spouseSide = exitSide(spousePos.x, anchorPos.x + NODE_WIDTH / 2)
      const anchorHandleX = anchorSide === 'left' ? anchorPos.x : anchorPos.x + NODE_WIDTH
      const spouseHandleX = spouseSide === 'left' ? spousePos.x : spousePos.x + NODE_WIDTH
      const anchorMidY = anchorPos.y + NODE_HEIGHT / 2
      const spouseMidY = spousePos.y + NODE_HEIGHT / 2
      const marriageRoute = pickClearRoute(
        anchorHandleX,
        anchorMidY,
        spouseHandleX,
        spouseMidY,
        memberBoxesExcept(new Set([unit.anchor.id, unit.spouse.id])),
      )
      edges.push({
        id: `spouse-${unit.anchor.id}-${unit.spouse.id}`,
        source: unit.anchor.id,
        sourceHandle: anchorSide,
        target: unit.spouse.id,
        targetHandle: spouseSide,
        type: 'elbowEdge',
        data: marriageRoute,
        style: { stroke: color },
      })
      // Sits on the marriage line's own route, wherever that ended up, so the dot is
      // never left floating off to the side of the line it's supposed to be on — and,
      // sitting exactly on that route, needs no separate line back to it (which would
      // just be a second, independently-bent near-duplicate of the marriage line itself)
      // unless it's *also* been dragged somewhere else.
      unionAnchorPos = midpointOnRoute(marriageRoute, anchorMidY, spouseMidY)
      needsUnionEdge = !!unionOverride
      preferredUnionBendX = marriageRoute.centerX
    } else if (!stacked) {
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
      needsUnionEdge = !!unionOverride
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
      if (unit.children.length > 0) {
        // This wife's own children exit her *right* edge (never straight down, which
        // would run through whichever other wife is stacked below her) into her own
        // channel (computed above, alongside her position), then turn down into the
        // generation band below.
        const channelX = channelXByWifeId.get(unit.spouse.id)!
        unionAnchorPos = { x: channelX, y: bandTop + bandHeightOf.get(unit.anchor.generation)! }
        needsUnionEdge = true
        unionEdgeCenterX = unionOverride ? undefined : channelX
      } else {
        // No children, so no union dot will be rendered at all (see below) — this value
        // is never used, just here to satisfy definite assignment.
        unionAnchorPos = spousePos
      }
    }

    if (unionOverride) unionAnchorPos = unionOverride

    // A couple with no children has nothing for a union dot to connect to — the marriage
    // line above already shows they're a couple, so skip the dot (and any line to it)
    // entirely rather than leaving a connector that dangles or floats with no purpose.
    if (unit.children.length > 0) {
      if (needsUnionEdge) {
        // The stacked, non-overridden case always resolves to 'right' here too (the
        // channel is by construction to the wife's right), so this is safe for every
        // branch — it just also stops a manually placed/dragged dot on the *other* side
        // from making the line cut back across the spouse's own box to reach it.
        const sourceSide = exitSide(spousePos.x, unionAnchorPos.x)
        const sourceHandleX = sourceSide === 'left' ? spousePos.x : spousePos.x + NODE_WIDTH
        const sourceMidY = spousePos.y + NODE_HEIGHT / 2
        // The pinned-channel case (unionEdgeCenterX already set) is already proven
        // crossing-free by construction; anything else is free-form, so pick a route
        // that clears every other member's box the same way the marriage line does.
        const route: Route =
          unionEdgeCenterX !== undefined
            ? { centerX: unionEdgeCenterX }
            : pickClearRoute(
                sourceHandleX,
                sourceMidY,
                unionAnchorPos.x,
                unionAnchorPos.y,
                memberBoxesExcept(new Set([unit.anchor.id, unit.spouse.id])),
                preferredUnionBendX,
              )
        edges.push({
          id: `spouse-to-union-${unit.key}`,
          source: unit.spouse.id,
          sourceHandle: sourceSide,
          target: unionId,
          targetHandle: 'in',
          type: 'elbowEdge',
          data: route,
          style: { stroke: color },
        })
      }

      nodes.push({
        id: unionId,
        type: 'unionNode',
        position: unionAnchorPos,
        data: { color, spouseId: unit.spouse.id, anchorId: unit.anchor.id },
        draggable: true,
        selectable: false,
      })
      for (const child of unit.children) {
        // A child can be manually dragged too, same as anyone else — react-flow's own
        // `smoothstep` router doesn't know about other members' boxes, so a dragged
        // child could end up with a line cutting through somebody else's. Route it the
        // same box-avoiding way as every other free-form connector — vertically leadered
        // on both ends, since a union's and a child's own handles both face top/bottom.
        const childPos = positions.get(child.id)!
        const childCenterX = childPos.x + NODE_WIDTH / 2
        const barY = pickClearBarY(unionAnchorPos.x, unionAnchorPos.y, childCenterX, childPos.y, memberBoxesExcept(new Set([child.id])))
        edges.push({
          id: `child-${unionId}-${child.id}`,
          source: unionId,
          target: child.id,
          type: 'elbowEdge',
          data: { centerX: childCenterX, viaY: barY },
          style: { stroke: color },
        })
      }
    }
  }

  for (const unit of unitsByKey.values()) {
    if (unit.spouse) continue
    for (const child of unit.children) {
      const parentPos = positions.get(unit.anchor.id)!
      const childPos = positions.get(child.id)!
      const parentBottomX = parentPos.x + NODE_WIDTH / 2
      const childCenterX = childPos.x + NODE_WIDTH / 2
      const barY = pickClearBarY(parentBottomX, parentPos.y + NODE_HEIGHT, childCenterX, childPos.y, memberBoxesExcept(new Set([unit.anchor.id, child.id])))
      edges.push({
        id: `child-${unit.anchor.id}-${child.id}`,
        source: unit.anchor.id,
        target: child.id,
        type: 'elbowEdge',
        data: { centerX: childCenterX, viaY: barY },
      })
    }
  }

  return { nodes, edges }
}
