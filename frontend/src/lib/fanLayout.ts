import type { Member } from '../types/models'

/** Radius of the central circle holding the root person. */
const ROOT_RADIUS = 64
/** Radial thickness of each ancestor ring. */
const RING_WIDTH = 100
const PADDING = 24
/** Rings beyond this are cut off — 2^9 = 512 slots on the outermost one is already tiny. */
const MAX_RINGS = 9
/** Total angle swept by the fan, in degrees: father's side on the left, mother's on the right. */
const SWEEP = 180

export interface FanTextLine {
  text: string
  size: number
  /** Offset perpendicular to the reading direction, in px. */
  dy: number
  muted?: boolean
}

export interface FanWedge {
  member: Member
  /** 1 = parents, 2 = grandparents, ... */
  ring: number
  path: string
  /** Where the label is anchored, and how far it's rotated (degrees, clockwise) so it reads along the wedge. */
  textX: number
  textY: number
  rotate: number
  lines: FanTextLine[]
}

export interface FanLayout {
  width: number
  height: number
  cx: number
  cy: number
  rootRadius: number
  root: Member
  rootLines: FanTextLine[]
  wedges: FanWedge[]
}

function genderRank(m: Member): number {
  return m.gender === 'male' ? 0 : m.gender === 'female' ? 2 : 1
}

/** `[left, right]` slots for a person's parents: father (or the male one) on the left, mother on the right. */
function parentSlots(member: Member, byId: Map<string, Member>): [Member | null, Member | null] {
  const parents = member.parentIds.map((id) => byId.get(id)).filter((p): p is Member => !!p)
  if (parents.length >= 2) {
    const [a, b] = [parents[0], parents[1]]
    return genderRank(b) < genderRank(a) ? [b, a] : [a, b]
  }
  if (parents.length === 1) return parents[0].gender === 'female' ? [null, parents[0]] : [parents[0], null]
  return [null, null]
}

function yearsOf(member: Member): string {
  const birth = member.birthDate?.slice(0, 4)
  const death = member.deathDate ? (member.deathDate.year != null ? String(member.deathDate.year) : '?') : undefined
  return death ? `${birth ?? '?'}–${death}` : birth ? `${birth}–` : ''
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, Math.max(1, maxChars - 1)) + '…'
}

/** Splits a name into at most two lines of roughly `maxChars` each, breaking on spaces. */
function wrapTwoLines(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const words = text.split(' ')
  let first = ''
  let i = 0
  while (i < words.length && (first + ' ' + words[i]).trim().length <= maxChars) {
    first = (first + ' ' + words[i]).trim()
    i++
  }
  if (!first) return [truncate(text, maxChars)]
  return [first, truncate(words.slice(i).join(' '), maxChars)]
}

/**
 * Lays out a fan (radial pedigree) chart: the root in a central circle and their ancestors in
 * concentric half-rings, ring `n` holding the `2^n` ancestors `n` generations back. Each
 * person's parents sit in the two sub-wedges above them, father on the left and mother on
 * the right, so the whole left half of the fan is the father's line and the right half the
 * mother's. Positions in SVG pixels, origin top-left of the returned `width` x `height`.
 */
export function computeFanLayout(members: Member[], rootId: string): FanLayout | null {
  const byId = new Map(members.map((m) => [m.id, m]))
  const root = byId.get(rootId)
  if (!root) return null

  const placed: { member: Member; ring: number; slot: number }[] = []
  function place(member: Member, ring: number, slot: number, path: Set<string>) {
    if (ring > MAX_RINGS) return
    const [left, right] = parentSlots(member, byId)
    // `path` guards against a corrupt cycle of parent links; a person can legitimately
    // appear in two places when a family marries within itself (pedigree collapse).
    if (left && !path.has(left.id)) {
      placed.push({ member: left, ring, slot: slot * 2 })
      place(left, ring + 1, slot * 2, new Set(path).add(left.id))
    }
    if (right && !path.has(right.id)) {
      placed.push({ member: right, ring, slot: slot * 2 + 1 })
      place(right, ring + 1, slot * 2 + 1, new Set(path).add(right.id))
    }
  }
  place(root, 1, 0, new Set([root.id]))

  const rings = placed.reduce((max, p) => Math.max(max, p.ring), 0)
  const outerRadius = ROOT_RADIUS + rings * RING_WIDTH
  const cx = PADDING + outerRadius
  const cy = PADDING + outerRadius
  const width = 2 * cx
  const height = cy + ROOT_RADIUS + PADDING

  const point = (r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)] as const
  }

  const wedges: FanWedge[] = placed.map(({ member, ring, slot }) => {
    const slotCount = 2 ** ring
    const span = SWEEP / slotCount
    const startDeg = 180 + (SWEEP - 180) / 2 - slot * span
    const endDeg = startDeg - span
    const rIn = ROOT_RADIUS + (ring - 1) * RING_WIDTH
    const rOut = rIn + RING_WIDTH
    const [ox0, oy0] = point(rOut, startDeg)
    const [ox1, oy1] = point(rOut, endDeg)
    const [ix1, iy1] = point(rIn, endDeg)
    const [ix0, iy0] = point(rIn, startDeg)
    const large = span > 180 ? 1 : 0
    const path =
      `M ${ox0} ${oy0} A ${rOut} ${rOut} 0 ${large} 1 ${ox1} ${oy1} ` +
      `L ${ix1} ${iy1} A ${rIn} ${rIn} 0 ${large} 0 ${ix0} ${iy0} Z`

    const midDeg = (startDeg + endDeg) / 2
    const midRadius = (rIn + rOut) / 2
    const [textX, textY] = point(midRadius, midDeg)
    // Reads outward, but flipped on the left half so the text is never upside down.
    const rotate = midDeg > 90 ? 180 - midDeg : -midDeg

    // How thick the wedge is at its middle, perpendicular to the reading direction.
    const thickness = midRadius * ((span * Math.PI) / 180)
    const years = yearsOf(member)
    const twoLines = thickness >= 30 && !!years
    const nameSize = Math.max(4, Math.min(13, twoLines ? thickness * 0.3 : thickness * 0.5))
    const maxChars = Math.floor((RING_WIDTH - 12) / (nameSize * 0.55))
    const lines: FanTextLine[] = [
      { text: truncate(member.fullName, maxChars), size: nameSize, dy: twoLines ? -nameSize * 0.55 : 0 },
    ]
    if (twoLines) lines.push({ text: years, size: nameSize * 0.8, dy: nameSize * 0.7, muted: true })

    return { member, ring, path, textX, textY, rotate, lines }
  })

  const nameLines = wrapTwoLines(root.fullName, 15)
  const years = yearsOf(root)
  const rootLines: FanTextLine[] = nameLines.map((text, i) => ({
    text,
    size: 13,
    dy: (i - (nameLines.length - 1) / 2) * 16 - (years ? 8 : 0),
  }))
  if (years) rootLines.push({ text: years, size: 11, dy: (nameLines.length - 1) * 8 + 16, muted: true })

  return { width, height, cx, cy, rootRadius: ROOT_RADIUS, root, rootLines, wedges }
}
