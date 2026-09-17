import type { TFunction } from 'i18next'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { formatDate } from './formatDate'
import { generateBio } from './generateBio'
import { vietnameseCollator } from './normalizeVietnamese'
import { generationOffset } from './treeLayout'
import type { Member } from '../types/models'

const PAGE_WIDTH = 210 // A4 mm
const PAGE_HEIGHT = 297
const MARGIN = 15

function mapsUrl(text: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6): number {
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

export async function exportGiaPhaPdf(
  giaPhaName: string,
  members: Member[],
  treeElement: HTMLElement,
  t: TFunction,
  language: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const contentWidth = PAGE_WIDTH - MARGIN * 2

  // 1. Cover page
  doc.setFontSize(24)
  doc.text(giaPhaName || t('app.name'), PAGE_WIDTH / 2, 120, { align: 'center' })
  doc.setFontSize(12)
  const generatedDate = formatDate(Date.now(), language)
  doc.text(t('pdf.generatedOn', { date: generatedDate }), PAGE_WIDTH / 2, 132, { align: 'center' })

  // 2. Tree diagram snapshot
  const canvas = await html2canvas(treeElement, { backgroundColor: '#ffffff', scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  const imgWidth = contentWidth
  const imgHeight = (canvas.height / canvas.width) * imgWidth

  doc.addPage()
  doc.setFontSize(16)
  doc.text(t('pdf.familyTree'), MARGIN, MARGIN)
  doc.addImage(imgData, 'PNG', MARGIN, MARGIN + 8, imgWidth, Math.min(imgHeight, PAGE_HEIGHT - MARGIN * 2 - 8))

  // 3. Generational listing
  const byGeneration = new Map<number, Member[]>()
  for (const m of members) {
    const list = byGeneration.get(m.generation) ?? []
    list.push(m)
    byGeneration.set(m.generation, list)
  }
  const generations = [...byGeneration.keys()].sort((a, b) => a - b)
  const genOffset = generationOffset(members)

  doc.addPage()
  let y = MARGIN
  doc.setFontSize(16)
  doc.text(t('pdf.generationalListing'), MARGIN, y)
  y += 10

  for (const generation of generations) {
    const list = [...byGeneration.get(generation)!].sort((a, b) => vietnameseCollator.compare(a.fullName, b.fullName))

    if (y > PAGE_HEIGHT - MARGIN - 20) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFontSize(13)
    doc.text(t('tree.generation', { n: generation + genOffset }), MARGIN, y)
    y += 7

    for (const member of list) {
      if (y > PAGE_HEIGHT - MARGIN - 20) {
        doc.addPage()
        y = MARGIN
      }
      doc.setFontSize(11)
      const deathYear = member.deathDate ? (member.deathDate.year != null ? String(member.deathDate.year) : '?') : null
      const years = deathYear
        ? `(${member.birthDate?.slice(0, 4) ?? '?'}–${deathYear})`
        : member.birthDate
          ? `(${member.birthDate.slice(0, 4)}–)`
          : ''
      doc.setFont('helvetica', 'bold')
      doc.text(`${member.fullName} ${years}`, MARGIN, y)
      doc.setFont('helvetica', 'normal')
      y += 5

      for (const entry of member.names) {
        if (!entry.value) continue
        doc.text(`${t(`member.${entry.label}`)}: ${entry.value}`, MARGIN + 4, y)
        y += 5
      }
      if (member.placeOfBirth) {
        doc.setTextColor(30, 80, 200)
        doc.textWithLink(`${t('member.placeOfBirth')}: ${member.placeOfBirth}`, MARGIN + 4, y, { url: mapsUrl(member.placeOfBirth) })
        doc.setTextColor(0, 0, 0)
        y += 5
      }
      if (member.queQuan) {
        doc.setTextColor(30, 80, 200)
        doc.textWithLink(`${t('member.queQuan')}: ${member.queQuan}`, MARGIN + 4, y, { url: mapsUrl(member.queQuan) })
        doc.setTextColor(0, 0, 0)
        y += 5
      }

      const bio = member.bioOverride || generateBio(member, t)
      if (bio) {
        y = addWrappedText(doc, bio, MARGIN + 4, y, contentWidth - 4)
      }

      if (member.stories?.length) {
        doc.setFont('helvetica', 'italic')
        y = addWrappedText(doc, `${t('stories.title')}:`, MARGIN + 4, y, contentWidth - 4)
        for (const story of member.stories) {
          if (y > PAGE_HEIGHT - MARGIN - 10) {
            doc.addPage()
            y = MARGIN
          }
          y = addWrappedText(doc, `• ${story.text}`, MARGIN + 8, y, contentWidth - 8)
        }
        doc.setFont('helvetica', 'normal')
      }

      y += 4
    }
    y += 4
  }

  doc.save(`${giaPhaName || 'gia-pha'}.pdf`)
}
