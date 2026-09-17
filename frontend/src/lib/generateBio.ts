import type { Member, PartialDate } from '../types/models'

function yearOf(dateStr: string): string {
  const year = dateStr.split('-')[0]
  return year || dateStr
}

function formatDeathDate(date: PartialDate): string {
  const dayMonth = `${date.day}/${date.month}`
  const withYear = date.year != null ? `${dayMonth}/${date.year}` : dayMonth
  return date.isLunar ? `${withYear} (âm lịch)` : withYear
}

export function generateBio(member: Pick<Member, 'birthDate' | 'placeOfBirth' | 'education' | 'occupation' | 'achievements' | 'deathDate'>): string {
  const parts: string[] = []

  if (member.birthDate) parts.push(`Sinh năm ${yearOf(member.birthDate)}`)
  if (member.placeOfBirth) parts.push(`tại ${member.placeOfBirth}`)
  if (member.education?.length) {
    const edu = member.education
      .map((e) => [e.degree, e.school].filter(Boolean).join(' tại '))
      .filter(Boolean)
      .join(', ')
    if (edu) parts.push(`Học vấn: ${edu}`)
  }
  if (member.occupation) parts.push(`Nghề nghiệp: ${member.occupation}`)
  if (member.achievements?.length) {
    parts.push(`Thành tựu: ${member.achievements.join('; ')}`)
  }
  if (member.deathDate) parts.push(`Mất ngày ${formatDeathDate(member.deathDate)}`)

  if (parts.length === 0) return ''
  return parts.join('. ') + '.'
}
