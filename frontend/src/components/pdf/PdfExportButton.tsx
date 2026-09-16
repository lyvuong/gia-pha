import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportGiaPhaPdf } from '../../lib/pdfExport'
import type { Member } from '../../types/models'
import { ExportIcon } from '../common/icons'

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
