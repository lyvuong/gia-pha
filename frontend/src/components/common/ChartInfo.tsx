import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChartType } from '../../lib/chartViews'
import { InfoIcon } from './icons'

interface ChartInfoProps {
  chartType: ChartType
}

/** An info button that toggles a popover explaining what the current chart does and doesn't show. */
export function ChartInfo({ chartType }: ChartInfoProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="chart-info" ref={ref}>
      <button
        type="button"
        className="icon-button"
        aria-expanded={open}
        aria-label={t('tree.chartInfo.button')}
        title={t('tree.chartInfo.button')}
        onClick={() => setOpen((v) => !v)}
      >
        <InfoIcon size={15} />
      </button>
      {open && (
        <div className="chart-info-popover" role="dialog" aria-label={t('tree.chartInfo.button')}>
          <h3>{t(`tree.chart_${chartType}`)}</h3>
          <h4>{t('tree.chartInfo.shows')}</h4>
          <p>{t(`tree.chartInfo.${chartType}.shows`)}</p>
          <h4>{t('tree.chartInfo.hides')}</h4>
          <p>{t(`tree.chartInfo.${chartType}.hides`)}</p>
        </div>
      )}
    </div>
  )
}
