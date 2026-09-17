import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Member } from '../../types/models'
import { ExportIcon } from '../common/icons'

interface PdfExportButtonProps {
  giaPhaName: string
  members: Member[]
  treeContainerRef: React.RefObject<HTMLDivElement | null>
}

export function PdfExportButton({ giaPhaName, members, treeContainerRef }: PdfExportButtonProps) {
  const { t, i18n } = useTranslation()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    const el = treeContainerRef.current
    if (!el) return
    setExporting(true)
    try {
      // jsPDF, html2canvas, and the embedded Vietnamese font are only needed for this
      // one action — dynamic import keeps them out of the main bundle.
      const { exportGiaPhaPdf } = await import('../../lib/pdfExport')
      await exportGiaPhaPdf(giaPhaName, members, el, t, i18n.language)
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      className="pdf-export-button icon-button"
      onClick={handleExport}
      disabled={exporting}
      title={t('tree.exportPdf')}
    >
      {!exporting && <ExportIcon size={15} />}
      <span className="btn-label">{exporting ? t('common.loading') : t('tree.exportPdf')}</span>
    </button>
  )
}
