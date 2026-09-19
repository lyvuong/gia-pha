import { useTranslation } from 'react-i18next'
import { describeBlood, type Kinship } from '../../lib/kinship'
import type { Member } from '../../types/models'

interface KinshipSummaryProps {
  members: Member[]
  root: Member
  /** The second person, or null until one is chosen. */
  target: Member | null
  kinship: Kinship | null
}

/** Spells out, above the kinship chart, how the second person is related to the first. */
export function KinshipSummary({ members, root, target, kinship }: KinshipSummaryProps) {
  const { t, i18n } = useTranslation()
  const nameOf = (id: string) => members.find((m) => m.id === id)?.fullName ?? ''

  let sentence: string
  let detail: string | null = null
  let steps: string | null = null

  if (!target || !kinship) {
    sentence = t('tree.kinship.hint', { name: root.fullName })
  } else {
    const a = root.fullName
    const b = target.fullName
    switch (kinship.kind) {
      case 'self':
        sentence = t('tree.kinship.self', { a, b })
        break
      case 'spouse':
        sentence = t('tree.kinship.spouse', { a, b })
        break
      case 'none':
        sentence = t('tree.kinship.none', { a, b })
        break
      case 'blood':
        sentence = t('tree.kinship.blood', { a, b, relation: describeBlood(kinship.blood, members, root.id, target.id, i18n.language) })
        break
      case 'marriage': {
        const viaName = nameOf(kinship.via)
        sentence =
          kinship.viaSide === 'b'
            ? t('tree.kinship.marriageB', { a, b, via: viaName, relation: describeBlood(kinship.blood, members, root.id, kinship.via, i18n.language) })
            : t('tree.kinship.marriageA', { a, b, via: viaName, relation: describeBlood(kinship.blood, members, kinship.via, target.id, i18n.language) })
        break
      }
    }
    if (kinship.kind === 'blood' || kinship.kind === 'marriage') {
      const names = kinship.blood.commonAncestorIds.map(nameOf).join(' & ')
      detail = t('tree.kinship.commonAncestor', { names })
      steps = t('tree.kinship.steps', {
        a: kinship.kind === 'marriage' && kinship.viaSide === 'a' ? nameOf(kinship.via) : root.fullName,
        b: kinship.kind === 'marriage' && kinship.viaSide === 'b' ? nameOf(kinship.via) : target.fullName,
        stepsA: kinship.blood.stepsA,
        stepsB: kinship.blood.stepsB,
      })
    }
  }

  return (
    <div className="kinship-summary" role="status">
      <p className="kinship-sentence">{sentence}</p>
      {detail && <p className="kinship-detail">{detail}</p>}
      {steps && <p className="kinship-detail">{steps}</p>}
    </div>
  )
}
