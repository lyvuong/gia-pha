import type { Gender, Member, NewMember } from '../types/models'

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

const RELATIONSHIP_GENDER: Record<RelationshipType, Gender> = {
  father: 'male',
  mother: 'female',
  husband: 'male',
  wife: 'female',
  son: 'male',
  daughter: 'female',
  brother: 'male',
  sister: 'female',
}

/**
 * Paired labels (father/mother, son/daughter, brother/sister, husband/wife)
 * resolve to the same structural effect on parent/spouse links — the label
 * also seeds the new member's `gender`, since it's the one point in the
 * flow where the user states it directly (used for husband-left/wife-right
 * ordering in the tree view).
 */
export function buildRelativeDraft(relationship: RelationshipType, anchor: Member): Partial<NewMember> {
  const gender = RELATIONSHIP_GENDER[relationship]
  switch (relationship) {
    case 'father':
    case 'mother': {
      const existingParentId = anchor.parentIds[0]
      return {
        gender,
        generation: anchor.generation - 1,
        parentIds: [],
        spouseIds: existingParentId ? [existingParentId] : [],
      }
    }
    case 'son':
    case 'daughter': {
      const otherParentId = anchor.spouseIds[0]
      return {
        gender,
        generation: anchor.generation + 1,
        parentIds: otherParentId ? [anchor.id, otherParentId] : [anchor.id],
        spouseIds: [],
      }
    }
    case 'brother':
    case 'sister':
      return {
        gender,
        generation: anchor.generation,
        parentIds: [...anchor.parentIds],
        spouseIds: [],
      }
    case 'husband':
    case 'wife':
      return {
        gender,
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
    case 'wife': {
      patches.push({ memberId: anchor.id, patch: { spouseIds: [...anchor.spouseIds, newMemberId] } })
      // Backfill: any of the anchor's existing children who only had the anchor as a
      // parent (because they were added before this spouse existed) should now also
      // list the new spouse, so the tree connects them to the couple's union point
      // instead of a single parent.
      for (const child of members) {
        if (child.parentIds.includes(anchor.id) && !child.parentIds.includes(newMemberId)) {
          patches.push({ memberId: child.id, patch: { parentIds: [...child.parentIds, newMemberId] } })
        }
      }
      break
    }
    case 'son':
    case 'daughter':
    case 'brother':
    case 'sister':
      break
  }

  return patches
}
