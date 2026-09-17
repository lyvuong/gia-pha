import type { TFunction } from 'i18next'
import type { Education, Member, PartialDate } from '../types/models'

function yearOf(dateStr: string): string {
  const year = dateStr.split('-')[0]
  return year || dateStr
}

function formatDeathDate(date: PartialDate, t: TFunction): string {
  const dayMonth = `${date.day}/${date.month}`
  const withYear = date.year != null ? `${dayMonth}/${date.year}` : dayMonth
  return date.isLunar ? t('bio.lunarDateSuffix', { date: withYear }) : withYear
}

function formatEducationEntry(entry: Education, t: TFunction): string {
  if (entry.degree && entry.school) return t('bio.degreeAtSchool', { degree: entry.degree, school: entry.school })
  return entry.degree || entry.school || ''
}

export function generateBio(
  member: Pick<Member, 'birthDate' | 'placeOfBirth' | 'education' | 'occupation' | 'achievements' | 'deathDate'>,
  t: TFunction,
): string {
  const parts: string[] = []

  if (member.birthDate && member.placeOfBirth) {
    parts.push(t('bio.bornInYearPlace', { year: yearOf(member.birthDate), place: member.placeOfBirth }))
  } else if (member.birthDate) {
    parts.push(t('bio.bornInYear', { year: yearOf(member.birthDate) }))
  } else if (member.placeOfBirth) {
    parts.push(t('bio.bornInPlace', { place: member.placeOfBirth }))
  }

  if (member.education?.length) {
    const edu = member.education.map((e) => formatEducationEntry(e, t)).filter(Boolean).join(', ')
    if (edu) parts.push(t('bio.education', { list: edu }))
  }
  if (member.occupation) parts.push(t('bio.occupation', { occupation: member.occupation }))
  if (member.achievements?.length) {
    parts.push(t('bio.achievements', { list: member.achievements.join('; ') }))
  }
  if (member.deathDate) parts.push(t('bio.diedOn', { date: formatDeathDate(member.deathDate, t) }))

  if (parts.length === 0) return ''
  return parts.join('. ') + '.'
}
