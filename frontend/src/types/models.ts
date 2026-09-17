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

/** A death date where the year may be unknown (common for older ancestors — the day and
 * month of a death anniversary are often remembered long after the year is), and which
 * may be recorded on the lunar calendar rather than the solar one, as is customary for
 * Vietnamese death anniversaries (ngày giỗ). `day`/`month` are always both present;
 * a date with neither is simply not recorded at all (`Member.deathDate` is `null`). */
export interface PartialDate {
  day: number
  month: number
  year: number | null
  isLunar: boolean
}

export interface Member {
  id: string
  fullName: string
  names: NameEntry[]
  searchKey: string
  photoUrl: string | null
  gender: Gender | null
  generation: number
  birthDate: string | null
  deathDate: PartialDate | null
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
}

export type NewMember = Omit<Member, 'id' | 'searchKey' | 'lastEditedBy' | 'lastEditedAt' | 'deletedAt'>
