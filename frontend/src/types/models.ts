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

export interface Member {
  id: string
  fullName: string
  names: NameEntry[]
  searchKey: string
  photoUrl: string | null
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
}

export type NewMember = Omit<Member, 'id' | 'searchKey' | 'lastEditedBy' | 'lastEditedAt'>
