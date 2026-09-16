import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { Member } from '../types/models'

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 96
const HORIZONTAL_GAP = 40
const ROW_HEIGHT = 180

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
 * Only the first entry in `spouseIds` is treated as the primary lateral
 * pairing (used for x-adjacency and centering children below a couple) —
 * additional spouses (remarriage) are rendered as plain marriage lines
 * without a shared union anchor. This is an accepted v1 simplification.
 */
export function computeTreeLayout(members: Member[]): LayoutResult {
  if (members.length === 0) return { nodes: [], edges: [] }

  const byId = new Map(members.map((m) => [m.id, m]))

  const primaryPairs = new Map<string, [string, string]>()
  for (const m of members) {
    const primaryId = m.spouseIds[0]
    if (primaryId && byId.has(primaryId)) {
      const key = pairKey(m.id, primaryId)
      if (!primaryPairs.has(key)) primaryPairs.set(key, [m.id, primaryId])
    }
  }

  const allPairs = new Map<string, [string, string]>()
  for (const m of members) {
    for (const s of m.spouseIds) {
      if (byId.has(s)) {
        const key = pairKey(m.id, s)
        if (!allPairs.has(key)) allPairs.set(key, [m.id, s])
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

  const partnerOf = new Map<string, string>()
  for (const [a, b] of primaryPairs.values()) {
    partnerOf.set(a, b)
    partnerOf.set(b, a)
  }

  /** Re-threads a dagre-x-sorted row so each primary spouse pair ends up adjacent. */
  function withSpousesAdjacent(sorted: Member[]): Member[] {
    const result: Member[] = []
    const placed = new Set<string>()
    for (const member of sorted) {
      if (placed.has(member.id)) continue
      result.push(member)
      placed.add(member.id)
      const partnerId = partnerOf.get(member.id)
      if (partnerId && !placed.has(partnerId)) {
        const partner = sorted.find((x) => x.id === partnerId)
        if (partner) {
          result.push(partner)
          placed.add(partnerId)
        }
      }
    }
    return result
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
  const rowWidths = new Map<number, number>()
  for (const [generation, list] of byGeneration.entries()) {
    const sortedByDagreX = [...list].sort((a, b) => {
      const ax = g.node(a.id)?.x ?? 0
      const bx = g.node(b.id)?.x ?? 0
      return ax - bx
    })
    const sorted = withSpousesAdjacent(sortedByDagreX)
    rowMembers.set(generation, sorted)
    rowWidths.set(generation, sorted.length * NODE_WIDTH + (sorted.length - 1) * HORIZONTAL_GAP)
  }
  const maxRowWidth = Math.max(...rowWidths.values())

  const positions = new Map<string, { x: number; y: number }>()
  for (const [generation, sorted] of rowMembers.entries()) {
    const y = (generation - minGeneration) * ROW_HEIGHT
    const rowOffset = (maxRowWidth - rowWidths.get(generation)!) / 2
    let cursorX = rowOffset
    for (const m of sorted) {
      positions.set(m.id, { x: cursorX, y })
      cursorX += NODE_WIDTH + HORIZONTAL_GAP
    }
  }

  const genOffset = generationOffset(members)
  const nodes: TreeNode[] = members.map((m) => ({
    id: m.id,
    type: 'memberNode',
    position: positions.get(m.id) ?? { x: 0, y: 0 },
    data: { member: m, displayGeneration: m.generation + genOffset },
  }))

  const edges: TreeEdge[] = []
  const unionNodeIds = new Map<string, string>()

  for (const [key, [a, b]] of primaryPairs.entries()) {
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

  for (const [, [a, b]] of allPairs.entries()) {
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
