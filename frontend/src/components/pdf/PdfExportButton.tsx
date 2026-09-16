import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportGiaPhaPdf } from '../../lib/pdfExport'
import type { Member } from '../../types/models'

interface PdfExportButtonProps {
  giaPhaName: string
  members: Member[]
  treeContainerRef: React.RefObject<HTMLDivElement | null>
}

export function PdfExportButton({ giaPhaName, members, treeContainerRef }: PdfExportButtonProps) {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    const el = treeContainerRef.current
    if (!el) return
    setExporting(true)
    try {
      await exportGiaPhaPdf(giaPhaName, members, el)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button type="button" className="pdf-export-button" onClick={handleExport} disabled={exporting}>
      {exporting ? t('common.loading') : t('tree.exportPdf')}
    </button>
  )
}
