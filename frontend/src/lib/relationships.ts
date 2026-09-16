import type { Member, NewMember } from '../types/models'

export type RelationshipType = 'father' | 'mother' | 'husband' | 'wife' | 'son' | 'daughter' | 'brother' | 'sister'

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'father',
  'mother',
  'husband',
  'wife',
  'son',
  'daughter',
  'brother',
  'sister',
]

/**
 * The data model has no gender field, so paired labels (father/mother,
 * son/daughter, brother/sister, husband/wife) resolve to the same
 * structural effect — the distinction is only for the picker's wording.
 */
export function buildRelativeDraft(relationship: RelationshipType, anchor: Member): Partial<NewMember> {
  switch (relationship) {
    case 'father':
    case 'mother': {
      const existingParentId = anchor.parentIds[0]
      return {
        generation: anchor.generation - 1,
        parentIds: [],
        spouseIds: existingParentId ? [existingParentId] : [],
      }
    }
    case 'son':
    case 'daughter': {
      const otherParentId = anchor.spouseIds[0]
      return {
        generation: anchor.generation + 1,
        parentIds: otherParentId ? [anchor.id, otherParentId] : [anchor.id],
        spouseIds: [],
      }
    }
    case 'brother':
    case 'sister':
      return {
        generation: anchor.generation,
        parentIds: [...anchor.parentIds],
        spouseIds: [],
      }
    case 'husband':
    case 'wife':
      return {
        generation: anchor.generation,
        parentIds: [],
        spouseIds: [anchor.id],
      }
  }
}

/**
 * Follow-up writes needed on *other* existing members once the new relative
 * has been created, so the link is bidirectional (e.g. the anchor's own
 * `parentIds`/`spouseIds` needs the new member's id too). Child and sibling
 * relationships need no back-link since parentage is only stored on the
 * child's own document.
 */
export function relativeBackLinks(
  relationship: RelationshipType,
  anchor: Member,
  newMemberId: string,
  members: Member[],
): { memberId: string; patch: Partial<NewMember> }[] {
  const patches: { memberId: string; patch: Partial<NewMember> }[] = []

  switch (relationship) {
    case 'father':
    case 'mother': {
      patches.push({ memberId: anchor.id, patch: { parentIds: [...anchor.parentIds, newMemberId] } })
      const existingParentId = anchor.parentIds[0]
      const existingParent = existingParentId ? members.find((m) => m.id === existingParentId) : undefined
      if (existingParent && !existingParent.spouseIds.includes(newMemberId)) {
        patches.push({ memberId: existingParent.id, patch: { spouseIds: [...existingParent.spouseIds, newMemberId] } })
      }
      break
    }
    case 'husband':
    case 'wife':
      patches.push({ memberId: anchor.id, patch: { spouseIds: [...anchor.spouseIds, newMemberId] } })
      break
    case 'son':
    case 'daughter':
    case 'brother':
    case 'sister':
      break
  }

  return patches
}
