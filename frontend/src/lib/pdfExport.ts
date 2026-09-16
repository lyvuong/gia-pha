import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { generateBio } from './generateBio'
import { vietnameseCollator } from './normalizeVietnamese'
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

export async function exportGiaPhaPdf(giaPhaName: string, members: Member[], treeElement: HTMLElement): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const contentWidth = PAGE_WIDTH - MARGIN * 2

  // 1. Cover page
  doc.setFontSize(24)
  doc.text(giaPhaName || 'Gia Phả', PAGE_WIDTH / 2, 120, { align: 'center' })
  doc.setFontSize(12)
  const generatedDate = new Intl.DateTimeFormat('vi-VN').format(new Date())
  doc.text(`Tạo ngày ${generatedDate}`, PAGE_WIDTH / 2, 132, { align: 'center' })

  // 2. Tree diagram snapshot
  const canvas = await html2canvas(treeElement, { backgroundColor: '#ffffff', scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  const imgWidth = contentWidth
  const imgHeight = (canvas.height / canvas.width) * imgWidth

  doc.addPage()
  doc.setFontSize(16)
  doc.text('Cây gia phả', MARGIN, MARGIN)
  doc.addImage(imgData, 'PNG', MARGIN, MARGIN + 8, imgWidth, Math.min(imgHeight, PAGE_HEIGHT - MARGIN * 2 - 8))

  // 3. Generational listing
  const byGeneration = new Map<number, Member[]>()
  for (const m of members) {
    const list = byGeneration.get(m.generation) ?? []
    list.push(m)
    byGeneration.set(m.generation, list)
  }
  const generations = [...byGeneration.keys()].sort((a, b) => a - b)

  doc.addPage()
  let y = MARGIN
  doc.setFontSize(16)
  doc.text('Danh sách theo thế hệ', MARGIN, y)
  y += 10

  for (const generation of generations) {
    const list = [...byGeneration.get(generation)!].sort((a, b) => vietnameseCollator.compare(a.fullName, b.fullName))

    if (y > PAGE_HEIGHT - MARGIN - 20) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFontSize(13)
    doc.text(`Thế hệ ${generation}`, MARGIN, y)
    y += 7

    for (const member of list) {
      if (y > PAGE_HEIGHT - MARGIN - 20) {
        doc.addPage()
        y = MARGIN
      }
      doc.setFontSize(11)
      const years = member.deathDate
        ? `(${member.birthDate?.slice(0, 4) ?? '?'}–${member.deathDate.slice(0, 4)})`
        : member.birthDate
          ? `(${member.birthDate.slice(0, 4)}–)`
          : ''
      doc.setFont('helvetica', 'bold')
      doc.text(`${member.fullName} ${years}`, MARGIN, y)
      doc.setFont('helvetica', 'normal')
      y += 5

      if (member.phapDanh) {
        doc.text(`Pháp danh: ${member.phapDanh}`, MARGIN + 4, y)
        y += 5
      }
      if (member.placeOfBirth) {
        doc.setTextColor(30, 80, 200)
        doc.textWithLink(`Nơi sinh: ${member.placeOfBirth}`, MARGIN + 4, y, { url: mapsUrl(member.placeOfBirth) })
        doc.setTextColor(0, 0, 0)
        y += 5
      }
      if (member.queQuan) {
        doc.setTextColor(30, 80, 200)
        doc.textWithLink(`Quê quán: ${member.queQuan}`, MARGIN + 4, y, { url: mapsUrl(member.queQuan) })
        doc.setTextColor(0, 0, 0)
        y += 5
      }

      const bio = member.bioOverride || generateBio(member)
      if (bio) {
        y = addWrappedText(doc, bio, MARGIN + 4, y, contentWidth - 4)
      }

      if (member.stories?.length) {
        doc.setFont('helvetica', 'italic')
        y = addWrappedText(doc, 'Kỷ niệm & câu chuyện:', MARGIN + 4, y, contentWidth - 4)
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
