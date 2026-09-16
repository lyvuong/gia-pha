export interface GiaPha {
  id: string
  name: string
  ownerUid: string
  inviteCode: string
  editors: string[]
  createdAt: number
}

export interface Education {
  school: string | null
  degree: string | null
}

export interface Story {
  text: string
  contributedBy: string
  contributedAt: number
}

/** The selectable set of "other name" categories a member can have any number of. */
export type NameLabel = 'birthName' | 'aka' | 'nicknames' | 'phapDanh'

export const NAME_LABELS: NameLabel[] = ['birthName', 'aka', 'nicknames', 'phapDanh']

export interface NameEntry {
  label: NameLabel
  value: string
}

export type Gender = 'male' | 'female'

export interface Member {
  id: string
  fullName: string
  names: NameEntry[]
  searchKey: string
  photoUrl: string | null
  gender: Gender | null
  generation: number
  birthDate: string | null
  deathDate: string | null
  placeOfBirth: string
  queQuan: string
  parentIds: string[]
  spouseIds: string[]
  notes: string
  education: Education[]
  occupation: string | null
  achievements: string[]
  stories: Story[]
  bioOverride: string | null
  lastEditedBy: string
  lastEditedAt: number
  /** Set when the member is moved to Trash instead of being permanently deleted; null
   * while active. Lets an accidental delete be undone via `restoreMember`. */
  deletedAt: number | null
  /** A manual drag override for this member's position in the tree view, in the tree
   * layout's own coordinate space (see `lib/treeLayout.ts`). Null means "let the
   * automatic layout place this member" (the default and common case). Set by dragging
   * a box in the tree — lets someone nudge a box aside to clear a line crossing the
   * automatic layout didn't avoid, without affecting anyone else's position. */
  treePosition: { x: number; y: number } | null
  /** A manual drag override for the small connector dot anchoring *this member's own
   * marriage* (i.e. the union of this member and their spouse) — only meaningful for a
   * member who is the non-anchor side of some marriage (see `lib/treeLayout.ts`). Lets
   * someone nudge the dot itself, separately from either spouse's own box, to clear a
   * line crossing that moving a box alone couldn't fix. */
  unionTreePosition: { x: number; y: number } | null
}

export type NewMember = Omit<
  Member,
  'id' | 'searchKey' | 'lastEditedBy' | 'lastEditedAt' | 'deletedAt' | 'treePosition' | 'unionTreePosition'
>
