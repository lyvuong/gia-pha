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

export interface Member {
  id: string
  fullName: string
  birthName: string
  aka: string
  nicknames: string
  phapDanh: string
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
