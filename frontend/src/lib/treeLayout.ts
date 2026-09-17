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
/** Vertical distance from one stacked spouse's box to the next one below them in the same
 * stack — a minimum margin, not a full `ROW_HEIGHT`: unlike two different generations,
 * two stacked spouses have no children or connectors of their own sitting *between*
 * them, so there's nothing that needs a whole extra row's worth of room, just enough gap
 * to read as separate boxes. Half the usual `HORIZONTAL_GAP` rather than half of the
 * whole step — `NODE_HEIGHT` itself is the floor this can never shrink past without two
 * stacked boxes starting to overlap. */
const WIFE_STACK_STEP = NODE_HEIGHT + HORIZONTAL_GAP / 2

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
  /** Union-node only: the non-anchor spouse this union belongs to. */
  spouseId?: string
  /** Union-node only: the other half of the couple. */
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
 * without checking where the other end actually ended up). */
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

/** Extra vertical stagger, per assigned trunk row, between the union-to-children trunks
 * of a remarried anchor's different wives — so two or more such trunks never share the
 * exact same row (see where this is used). Must be *more* than `MIN_LEADER`: each row's
 * own bar sits `MIN_LEADER` below its dot, so a smaller gap between rows would let a more
 * elevated row's bar sink below the very next, less-elevated row's own dot — landing
 * inside that row's channel (its dot-to-bar leg) instead of clearing it. There's only a
 * fixed, modest sliver of room between a band's last wife and the next generation for
 * this to fit in at all, so it's kept just past that minimum rather than
 * `CHANNEL_SPACING`-sized. */
const TRUNK_ROW_GAP = MIN_LEADER + 4

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

/** Where a horizontal-leadered elbow connector (between two boxes joined on their
 * left/right edges) should bend, so both the leg leaving the source and the leg entering
 * the target run a real, visible distance horizontally before turning: prefers the true
 * midpoint (equal leaders on both sides), searching outward from it when that's blocked
 * by some other member's box. None of those can help when the source's *own row* is
 * blocked for its entire width to the target — no horizontal bend, wherever placed,
 * dodges an obstacle sitting directly on the row it would have to leave along. When every
 * bend option fails, this ducks to a nearby row that's clear before crossing over, adding
 * one extra corner rather than cutting through whatever's in the way. */
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

/** Where a vertical-leadered elbow connector (a union or a solo parent down to a group of
 * children — always joined on their top/bottom edges) should jog, so the leg leaving the
 * source and each leg entering a child both run a real vertical distance before turning:
 * prefers the row midway between the two generations (equal leaders on both sides),
 * searching outward when that row is blocked. Always keeps the leaving leg at the
 * source's own x and each entering leg at that child's own x — never a diagonal-risking
 * estimate of either — so this only ever needs to find a clear row, not a clear column
 * too. Checking every child in the group together (rather than one at a time) guarantees
 * they land on the very same row even when one of them individually would have had to
 * duck somewhere the others didn't — merging what would otherwise be several
 * near-identical parallel lines into one shared trunk. */
function pickClearSharedBarY(sourceX: number, sourceY: number, targets: { x: number; y: number }[], boxes: { x: number; y: number }[]): number {
  const targetY = targets[0].y
  const spanLo = Math.min(sourceX, ...targets.map((t) => t.x))
  const spanHi = Math.max(sourceX, ...targets.map((t) => t.x))
  const mid = (sourceY + targetY) / 2
  const lo = Math.min(sourceY, targetY)
  const hi = Math.max(sourceY, targetY)
  const isClear = (y: number) =>
    vSegmentClearsBoxes(sourceX, sourceY, y, boxes) &&
    hSegmentClearsBoxes(spanLo, spanHi, y, boxes) &&
    targets.every((t) => vSegmentClearsBoxes(t.x, y, t.y, boxes))
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
 * access to) — close enough for placing the union node, unlike the line itself, which
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

  /** Where `m`'s own recorded parent(s) already ended up (their channel x, for a stacked
   * wife, else their plain box x) — the shared basis for ordering a child left-to-right
   * against its parents' own position, used both to sort a whole block of children
   * against other blocks in its row, and (within `blockOf`) to sort a remarried parent's
   * different mothers' sibling-groups against each other inside one merged block. `0` for
   * someone with no recorded parent in this tree. */
  function parentAnchorX(m: Member): number {
    const validParents = m.parentIds.filter((p) => byId.has(p))
    if (validParents.length === 0) return 0
    const xs = validParents.map((p) => channelXByWifeId.get(p) ?? positions.get(p)?.x ?? 0)
    return xs.reduce((a, b) => a + b, 0) / xs.length
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
   * anchored on whoever has the most spouses, followed by their spouse(s).
   *
   * A cluster can hold more than one full-sibling set at once — see `clusterInto`, which
   * also merges in half-siblings sharing a remarried parent, so that parent's children
   * stay one contiguous block in the row instead of scattering whenever another block's
   * ordering happens to fall between two of the parent's mothers. Each full-sibling set
   * is still sorted internally oldest-to-left as before, but the sets themselves are
   * ordered by their own parents' position (`parentAnchorX`) rather than pooling every
   * member into one birth-date sort — pooling would happily interleave two mothers'
   * children by birth year, undoing exactly the contiguous grouping this exists for. */
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
      const siblingSets = new Map<string, Member[]>()
      for (const m of withParents) siblingSets.set(siblingKey(m), [...(siblingSets.get(siblingKey(m)) ?? []), m])
      const orderedSets = [...siblingSets.values()].sort((a, b) => parentAnchorX(a[0]) - parentAnchorX(b[0]))
      for (const siblingSet of orderedSets) {
        for (const sibling of [...siblingSet].sort(compareBirthOrder)) appendPerson(sibling)
      }
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
   * divider line. Also unions half-siblings who share a remarried ("stacked") parent —
   * without it, each mother's children form their own independent block, sorted purely by
   * her own channel x, and any other unrelated block whose anchor x happens to fall
   * between two of those mothers ends up wedged between them. Since every wife of that
   * parent still needs to route a trunk line down to her own children afterward (see
   * `trunkRowByWifeId`), scattering them like that is exactly what forces one wife's
   * trunk to reach out past another's, which is what leads to a crossing no amount of
   * trunk-row juggling alone can avoid. Keeping them one contiguous block sidesteps the
   * problem at its source instead. */
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
    const byStackedParent = new Map<string, string[]>()
    for (const m of rowMembers) {
      for (const p of m.parentIds) {
        if (!byId.has(p) || (spouseCountOf.get(p) ?? 0) < 2) continue
        byStackedParent.set(p, [...(byStackedParent.get(p) ?? []), m.id])
      }
    }
    for (const ids of byStackedParent.values()) for (let i = 1; i < ids.length; i++) union(ids[0], ids[i])
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
  // whichever of its members has the most wives stacked under them — by the tighter
  // `WIFE_STACK_STEP` per extra wife, not a full extra `ROW_HEIGHT`, since only the very
  // last wife in the tallest stack needs the same trailing `ROW_HEIGHT` worth of room the
  // single-spouse case gets, for the union-to-children trunk routing that lives there
  // (see `trunkRowByWifeId`) — the wives above her don't.
  const bandHeightOf = new Map<number, number>()
  for (const generation of generations) {
    const maxWives = Math.max(1, ...byGeneration.get(generation)!.map((m) => spouseCountOf.get(m.id) ?? 1))
    bandHeightOf.set(generation, (maxWives - 1) * WIFE_STACK_STEP + ROW_HEIGHT)
  }
  const bandTopOf = new Map<number, number>()
  let cumulativeY = 0
  for (const generation of generations) {
    bandTopOf.set(generation, cumulativeY)
    cumulativeY += bandHeightOf.get(generation)!
  }

  interface Block {
    items: BlockItem[]
    /** Sort key for this block's left-to-right position among its row's other blocks —
     * and, when `hasRealAnchor` is set, also a genuine x coordinate this block prefers to
     * center under (see the placement loop below). */
    anchorX: number
    /** Whether `anchorX` came from an actual parent position rather than the birth-date
     * fallback used for a block with no recorded parents in this tree — that fallback is
     * a sort key only (often a raw millisecond timestamp), never a real x coordinate, so
     * it must never be used to *place* a block, only to order it among its row's others. */
    hasRealAnchor: boolean
  }

  /** How much horizontal room `items` needs laid out left-to-right, matching the
   * increments the placement loop below actually applies per item — used to center a
   * block under its own preferred anchor x rather than just its left edge. */
  function blockWidth(items: BlockItem[]): number {
    let width = 0
    for (const item of items) {
      // A 'stack' item reserves a column for its anchor plus a second, wider column for
      // the wives stacked under them — matching the two `cursorX` advances the placement
      // loop below makes for one, see there.
      width += item.kind === 'stack' ? 2 * (NODE_WIDTH + HORIZONTAL_GAP) + item.wives.length * CHANNEL_SPACING : NODE_WIDTH + HORIZONTAL_GAP
    }
    return width
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
      const anchorX = withParents ? parentAnchorX(withParents) : flat[0].birthDate ? Date.parse(flat[0].birthDate) : 0
      return { items, anchorX, hasRealAnchor: !!withParents }
    })
    blocks.sort((a, b) => a.anchorX - b.anchorX)

    let cursorX = 0
    blocks.forEach((block, i) => {
      const width = blockWidth(block.items)
      // Center a block under its own parents' x when there's room to — i.e. never
      // *closer* to the previous block than the normal gap allows (packing still wins
      // when parents are close together or on top of each other), but free to sit
      // *further* out, tracking however far apart its real parents actually are. Without
      // this, every row packs at the same minimum spacing regardless of how spread out
      // the row above was, so two unrelated families' children can end up compressed
      // into the same narrow span their parents were nowhere near sharing — forcing both
      // families' union-to-children trunks to sweep sideways through that same span to
      // reach them, right on top of each other.
      const minStartX = i === 0 ? 0 : cursorX - HORIZONTAL_GAP + GROUP_GAP
      const startX = block.hasRealAnchor ? Math.max(minStartX, block.anchorX - width / 2) : minStartX
      if (i > 0) dividerPositions.push({ x: (cursorX - HORIZONTAL_GAP + startX) / 2, y: bandTop })
      cursorX = startX
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
            positions.set(wife.id, { x: stackX, y: bandTop + wi * WIFE_STACK_STEP })
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

  // Anyone who's just a few pixels off from lining up with whoever they connect to still
  // gets a real bend in the line for that tiny gap, which reads as an arbitrary
  // stair-step rather than a deliberate route (the automatic layout's own row-packing
  // doesn't try to center a child under its parent). Snap gaps that small away entirely —
  // nudging only one member at a time, and only when nothing else already occupies the
  // spot it would move into, so this can never cascade into disturbing anyone else's
  // spacing.
  const SNAP_GAP = 24

  function boxesOverlap(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    return a.x < b.x + NODE_WIDTH && a.x + NODE_WIDTH > b.x && a.y < b.y + NODE_HEIGHT && a.y + NODE_HEIGHT > b.y
  }

  function canMoveTo(id: string, candidate: { x: number; y: number }): boolean {
    for (const [otherId, pos] of positions) {
      if (otherId !== id && boxesOverlap(candidate, pos)) return false
    }
    return true
  }

  /** Nudges `moverId` onto `targetValue` along `axis` when the gap is small and the spot
   * is free, and reports whether it actually moved — so a caller whose first-choice mover
   * turns out to be blocked can fall back to nudging the other side instead. */
  function snapIfClose(moverId: string, axis: 'x' | 'y', targetValue: number): boolean {
    const pos = positions.get(moverId)
    if (!pos) return false
    const gap = targetValue - pos[axis]
    if (gap === 0) return true
    if (Math.abs(gap) > SNAP_GAP) return false
    const candidate = axis === 'y' ? { x: pos.x, y: targetValue } : { x: targetValue, y: pos.y }
    if (!canMoveTo(moverId, candidate)) return false
    positions.set(moverId, candidate)
    return true
  }

  for (const unit of unitsByKey.values()) {
    const anchorPos = positions.get(unit.anchor.id)
    if (!anchorPos) continue
    const spousePos = unit.spouse ? positions.get(unit.spouse.id) : undefined
    if (unit.spouse && spousePos) {
      // Try moving the spouse onto the anchor's row first; if that spot's taken, try
      // moving the anchor onto the spouse's instead.
      if (!snapIfClose(unit.spouse.id, 'y', anchorPos.y)) snapIfClose(unit.anchor.id, 'y', spousePos.y)
    }
    // Approximates where this unit's union sits (or the parent's own center, for a solo
    // parent) — close enough to tell whether a child is already almost lined up with it,
    // even though the union's exact position isn't settled until the edges below are
    // built.
    const sourceCenterX = spousePos ? (anchorPos.x + spousePos.x) / 2 + NODE_WIDTH / 2 : anchorPos.x + NODE_WIDTH / 2
    for (const child of unit.children) {
      snapIfClose(child.id, 'x', sourceCenterX - NODE_WIDTH / 2)
    }
  }

  // A remarried anchor's own wives are colored from their own dedicated, zero-based run
  // through the palette (colorIndexByAnchor), instead of sharing the single tree-wide
  // cycle every other couple draws from — so which colors two *sibling* wives land on
  // never depends on how many unrelated couples happen to sit between them in iteration
  // order. Two wives who are actually stacked together, right next to each other, are
  // exactly the pair whose colors most need to read as different at a glance; leaving
  // that to the global cycle risked them landing on two colors that are close in hue
  // (`UNION_COLORS` has two blues and three orange/browns) purely by coincidence.
  let colorIndex = 0
  const colorIndexByAnchor = new Map<string, number>()
  const unionColors = new Map<string, string>()
  for (const unit of unitsByKey.values()) {
    if (!unit.spouse) continue
    if ((spouseCountOf.get(unit.anchor.id) ?? 0) >= 2) {
      const local = colorIndexByAnchor.get(unit.anchor.id) ?? 0
      unionColors.set(unit.key, UNION_COLORS[local % UNION_COLORS.length])
      colorIndexByAnchor.set(unit.anchor.id, local + 1)
    } else {
      unionColors.set(unit.key, UNION_COLORS[colorIndex % UNION_COLORS.length])
      colorIndex++
    }
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

  /** Pushes one shared "trunk" edge (`sourceId` straight down to `barY`, then the full
   * horizontal bar spanning every child in `rowChildren`) plus one short "leg" edge per
   * child (bar down to that child alone) — rather than each child's own edge retracing
   * the whole shared leg on its own, which drew that shared portion once per child and
   * rendered visibly thicker near `sourceId` than out at the single farthest child. */
  function pushChildTrunkAndLegs(sourceId: string, sourceX: number, barY: number, rowChildren: Member[], color: string | undefined, idPrefix: string) {
    const childXs = rowChildren.map((c) => positions.get(c.id)!.x + NODE_WIDTH / 2)
    const style = color ? { stroke: color } : undefined
    edges.push({
      id: `trunk-${idPrefix}-${rowChildren[0].id}`,
      source: sourceId,
      target: rowChildren[0].id,
      type: 'elbowEdge',
      data: { viaY: barY, spanLoX: Math.min(sourceX, ...childXs), spanHiX: Math.max(sourceX, ...childXs) },
      style,
    })
    for (const child of rowChildren) {
      edges.push({
        id: `child-${idPrefix}-${child.id}`,
        source: sourceId,
        target: child.id,
        type: 'elbowEdge',
        data: { centerX: positions.get(child.id)!.x + NODE_WIDTH / 2, viaY: barY, legOnly: true },
        style,
      })
    }
  }

  // Which "trunk row" (0 = closest to the children's own row, 1 = one step further up,
  // ...) each stacked wife's union-to-children trunk renders on — assigned so two wives
  // of the same anchor never cross each other's trunk, and never share a row when their
  // bars would otherwise run flush together as one ambiguous line.
  //
  // A wife's trunk spans horizontally from her own channel x out to her furthest child.
  // Whenever two wives' spans overlap at all, they need separate rows just to stay
  // visually distinct — but *which* of the two gets the more elevated row is a real
  // constraint, not a free choice: a less-elevated wife's bar sits *below* a more-elevated
  // wife's own dot, so it only ever risks crossing that wife's *channel* (the line from
  // her own box down to her dot) — never her bar or her legs into her own children, both
  // of which sit lower still. So the one and only hazard to avoid is a wife's bar
  // sweeping across another wife's channel x while sitting *below* that wife's row —
  // which happens exactly when the less-elevated wife's span contains the more-elevated
  // wife's channel x. Elevating whichever wife's channel the other's span would otherwise
  // sweep across (not just whichever wife's span is wider — a wider span can still be
  // crossing-free if it happens to miss the other's channel x specifically) is what
  // actually avoids it.
  const trunkRowByWifeId = new Map<string, number>()
  {
    const wivesByAnchor = new Map<string, { wifeId: string; channelX: number; lo: number; hi: number }[]>()
    for (const unit of unitsByKey.values()) {
      if (!unit.spouse || unit.children.length === 0) continue
      if ((spouseCountOf.get(unit.anchor.id) ?? 0) < 2) continue
      const channelX = channelXByWifeId.get(unit.spouse.id)
      if (channelX === undefined) continue
      const childXs = unit.children.map((c) => positions.get(c.id)!.x + NODE_WIDTH / 2)
      const lo = Math.min(channelX, ...childXs)
      const hi = Math.max(channelX, ...childXs)
      const list = wivesByAnchor.get(unit.anchor.id) ?? []
      list.push({ wifeId: unit.spouse.id, channelX, lo, hi })
      wivesByAnchor.set(unit.anchor.id, list)
    }
    for (const wives of wivesByAnchor.values()) {
      // [lower, higher]: `lower` must end up on a strictly smaller row than `higher`.
      const constraints: [string, string][] = []
      for (let i = 0; i < wives.length; i++) {
        for (let j = i + 1; j < wives.length; j++) {
          const a = wives[i]
          const b = wives[j]
          if (a.lo >= b.hi || b.lo >= a.hi) continue // spans don't overlap at all
          const aSweepsB = b.channelX > a.lo && b.channelX < a.hi
          const bSweepsA = a.channelX > b.lo && a.channelX < b.hi
          if (aSweepsB && !bSweepsA) constraints.push([a.wifeId, b.wifeId])
          else if (bSweepsA && !aSweepsB) constraints.push([b.wifeId, a.wifeId])
          else {
            // Either direction is equally crossing-free (or equally not) — fall back to
            // elevating whoever reaches further, for a stable, deterministic result.
            const [narrower, wider] = a.hi - a.lo <= b.hi - b.lo ? [a, b] : [b, a]
            constraints.push([narrower.wifeId, wider.wifeId])
          }
        }
      }
      // Layer wives into rows via topological sort on `constraints`: a wife is safe to
      // place on the current (lowest still-open) row once every wife that must be *below*
      // her has already been placed on an earlier one. A genuine cycle (each of two wives'
      // spans sweeps across the other's channel — no elevation choice avoids it) can't be
      // resolved by row order at all; the fallback just places whatever's left so this
      // always terminates instead of looping forever.
      const remaining = new Set(wives.map((w) => w.wifeId))
      let row = 0
      while (remaining.size > 0) {
        const ready = [...remaining].filter(
          (id) => !constraints.some(([lower, higher]) => higher === id && remaining.has(lower)),
        )
        const batch = ready.length > 0 ? ready : [...remaining]
        for (const id of batch) {
          trunkRowByWifeId.set(id, row)
          remaining.delete(id)
        }
        row++
      }
    }
  }

  for (const unit of unitsByKey.values()) {
    const anchorPos = positions.get(unit.anchor.id)
    if (!anchorPos || !unit.spouse) continue
    const spousePos = positions.get(unit.spouse.id)!
    const color = unionColors.get(unit.key)
    const stacked = (spouseCountOf.get(unit.anchor.id) ?? 0) >= 2
    const unionId = `union-${unit.key}`
    let unionAnchorPos: { x: number; y: number }
    // Whether a `spouse-to-union` connector edge is needed: an ordinary adjacent couple
    // doesn't need one (the dot sits right on the marriage line already), but a stacked
    // remarried anchor's wife does, or the dot would float disconnected from its couple.
    let needsUnionEdge = false
    let unionEdgeCenterX: number | undefined

    if (!stacked) {
      // An ordinary, adjacent couple: routed the same leader-enforced, box-avoiding way
      // as every other marriage line (see `pickClearRoute`) rather than a hardcoded
      // straight line — since they're already side by side at the same row, this always
      // resolves to the very same plain straight line, just via the one shared mechanism
      // that actually guarantees it instead of an unenforced assumption.
      const [leftId, rightId] = anchorPos.x <= spousePos.x ? [unit.anchor.id, unit.spouse.id] : [unit.spouse.id, unit.anchor.id]
      const leftPos = leftId === unit.anchor.id ? anchorPos : spousePos
      const rightPos = rightId === unit.anchor.id ? anchorPos : spousePos
      const leftHandleX = leftPos.x + NODE_WIDTH
      const rightHandleX = rightPos.x
      const leftMidY = leftPos.y + NODE_HEIGHT / 2
      const rightMidY = rightPos.y + NODE_HEIGHT / 2
      const marriageRoute = pickClearRoute(leftHandleX, leftMidY, rightHandleX, rightMidY, memberBoxesExcept(new Set([unit.anchor.id, unit.spouse.id])))
      edges.push({
        id: `spouse-${unit.anchor.id}-${unit.spouse.id}`,
        source: leftId,
        sourceHandle: 'right',
        target: rightId,
        targetHandle: 'left',
        type: 'elbowEdge',
        data: marriageRoute,
        style: { stroke: color },
      })
      unionAnchorPos = midpointOnRoute(marriageRoute, leftMidY, rightMidY)
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
        // generation band below — stopping short of the band's true bottom edge (where
        // the children's own row starts) by a couple of leader-lengths, so the
        // union-to-child trunk below still has room for a real, visible stub into each
        // child. Landing exactly on the children's row, as this used to, left
        // `pickClearSharedBarY` no space to place a leadered bar at all, so the trunk
        // rendered flush against the children's own top edge — indistinguishable from
        // their boxes' border, making it unreadable which boxes it actually connected to.
        // Also placed on this wife's own assigned trunk row (see `trunkRowByWifeId`), so
        // two or more wives of the same anchor whose trunks reach anywhere near each
        // other never share the exact same row — without it, their bars only differ by
        // each wife's `channelX` (20px apart) and run flush alongside one another,
        // reading as one thick, ambiguous line.
        const channelX = channelXByWifeId.get(unit.spouse.id)!
        const trunkRow = trunkRowByWifeId.get(unit.spouse.id) ?? 0
        unionAnchorPos = {
          x: channelX,
          y: bandTop + bandHeightOf.get(unit.anchor.generation)! - 2 * MIN_LEADER - trunkRow * TRUNK_ROW_GAP,
        }
        needsUnionEdge = true
        unionEdgeCenterX = channelX
      } else {
        // No children, so no union dot will be rendered at all (see below) — this value
        // is never used, just here to satisfy definite assignment.
        unionAnchorPos = spousePos
      }
    }

    // A couple with no children has nothing for a union dot to connect to — the marriage
    // line above already shows they're a couple, so skip the dot (and any line to it)
    // entirely rather than leaving a connector that dangles or floats with no purpose.
    if (unit.children.length > 0) {
      if (needsUnionEdge) {
        // The channel is by construction to the wife's right, so this is always 'right' —
        // computed via `exitSide` anyway to stay honest with however the channel math
        // above ends up placing it.
        const sourceSide = exitSide(spousePos.x, unionAnchorPos.x)
        edges.push({
          id: `spouse-to-union-${unit.key}`,
          source: unit.spouse.id,
          sourceHandle: sourceSide,
          target: unionId,
          targetHandle: 'in',
          type: 'elbowEdge',
          data: { centerX: unionEdgeCenterX! },
          style: { stroke: color },
        })
      }

      nodes.push({
        id: unionId,
        type: 'unionNode',
        position: unionAnchorPos,
        data: { color, spouseId: unit.spouse.id, anchorId: unit.anchor.id },
        selectable: false,
      })
      // Route each union-to-child line the same box-avoiding way as every other
      // connector — vertically leadered on both ends, since a union's and a child's own
      // handles both face top/bottom — grouping siblings by their shared row (always one
      // row per unit, since every child in a unit sits in the same generation band) so
      // they share one bar (see `pickClearSharedBarY`) instead of each child computing
      // its own separately.
      const childBoxes = memberBoxesExcept(new Set(unit.children.map((c) => c.id)))
      const childrenByRow = new Map<number, Member[]>()
      for (const child of unit.children) {
        const y = positions.get(child.id)!.y
        childrenByRow.set(y, [...(childrenByRow.get(y) ?? []), child])
      }
      for (const rowChildren of childrenByRow.values()) {
        const targets = rowChildren.map((c) => {
          const p = positions.get(c.id)!
          return { x: p.x + NODE_WIDTH / 2, y: p.y }
        })
        // A stacked wife's bar is pinned a fixed leader below her own dot (already placed
        // on a row reserved for her, via `trunkRowByWifeId`) rather than independently
        // re-searched: `pickClearSharedBarY` has no notion of *other wives'* bars, so its
        // own free search routinely re-converged two different wives' bars back to
        // nearly the same y (both searches prefer the midpoint of source and target,
        // which barely differ), undoing the separation the dots were just given and
        // crossing another wife's bar or channel right through the middle.
        const barY = stacked ? unionAnchorPos.y + MIN_LEADER : pickClearSharedBarY(unionAnchorPos.x, unionAnchorPos.y, targets, childBoxes)
        pushChildTrunkAndLegs(unionId, unionAnchorPos.x, barY, rowChildren, color, unionId)
      }
    }
  }

  for (const unit of unitsByKey.values()) {
    if (unit.spouse) continue
    const parentPos = positions.get(unit.anchor.id)!
    const parentBottomX = parentPos.x + NODE_WIDTH / 2
    const parentBottomY = parentPos.y + NODE_HEIGHT
    const childBoxes = memberBoxesExcept(new Set([unit.anchor.id, ...unit.children.map((c) => c.id)]))
    const childrenByRow = new Map<number, Member[]>()
    for (const child of unit.children) {
      const y = positions.get(child.id)!.y
      childrenByRow.set(y, [...(childrenByRow.get(y) ?? []), child])
    }
    for (const rowChildren of childrenByRow.values()) {
      const targets = rowChildren.map((c) => {
        const p = positions.get(c.id)!
        return { x: p.x + NODE_WIDTH / 2, y: p.y }
      })
      const barY = pickClearSharedBarY(parentBottomX, parentBottomY, targets, childBoxes)
      pushChildTrunkAndLegs(unit.anchor.id, parentBottomX, barY, rowChildren, undefined, unit.anchor.id)
    }
  }

  return { nodes, edges }
}
