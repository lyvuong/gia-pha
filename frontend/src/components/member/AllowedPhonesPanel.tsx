import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addAllowedPhone, addAllowedPhones, removeAllowedPhone, useAllowedPhones } from '../../hooks/useAllowedPhones'
import { normalizePhoneNumber, parsePhoneList } from '../../lib/phone'

interface AllowedPhonesPanelProps {
  giaPhaId: string
  currentUid: string
  onClose: () => void
}

/** Lets a member list relatives' phone numbers; those people join by signing in, with no approval step. */
export function AllowedPhonesPanel({ giaPhaId, currentUid, onClose }: AllowedPhonesPanelProps) {
  const { t } = useTranslation()
  const phones = useAllowedPhones(giaPhaId)
  const [phone, setPhone] = useState('')
  const [label, setLabel] = useState('')
  const [bulk, setBulk] = useState('')
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: string[] } | null>(null)
  const [error, setError] = useState<'invalid' | 'failed' | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const e164 = normalizePhoneNumber(phone)
    if (!e164) {
      setError('invalid')
      return
    }
    setError(null)
    try {
      await addAllowedPhone(giaPhaId, e164, label.trim(), currentUid)
      setPhone('')
      setLabel('')
    } catch {
      setError('failed')
    }
  }

  async function addMany(e: React.FormEvent) {
    e.preventDefault()
    const { entries, skipped } = parsePhoneList(bulk)
    setError(null)
    try {
      await addAllowedPhones(giaPhaId, entries, currentUid)
      setBulkResult({ added: entries.length, skipped })
      // Keep only the lines that couldn't be read, so they can be fixed and retried.
      setBulk(skipped.join('\n'))
    } catch {
      setError('failed')
    }
  }

  async function remove(number: string) {
    setError(null)
    try {
      await removeAllowedPhone(giaPhaId, number)
    } catch {
      setError('failed')
    }
  }

  return (
    <div className="member-detail-panel trash-panel">
      <button type="button" className="panel-close" onClick={onClose}>×</button>
      <h2>{t('tree.allowedTitle')}</h2>
      <p>{t('tree.allowedIntro')}</p>
      <form onSubmit={add}>
        <label>
          {t('auth.phoneNumberPlaceholder')}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" required />
        </label>
        <label>
          {t('tree.allowedLabel')}
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} autoComplete="off" />
        </label>
        <button type="submit">{t('tree.allowedAdd')}</button>
      </form>
      <form onSubmit={addMany}>
        <label>
          {t('tree.allowedBulkLabel')}
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={t('tree.allowedBulkPlaceholder')}
            rows={5}
          />
        </label>
        <button type="submit" disabled={!bulk.trim()}>{t('tree.allowedBulkAdd')}</button>
      </form>
      {bulkResult && (
        <p>
          {t('tree.allowedBulkResult', { count: bulkResult.added })}
          {bulkResult.skipped.length > 0 && (
            <> {t('tree.allowedBulkSkipped', { count: bulkResult.skipped.length })} {bulkResult.skipped.join(' | ')}</>
          )}
        </p>
      )}
      {error && <p className="error-text">{t(error === 'invalid' ? 'tree.allowedInvalid' : 'tree.requestActionFailed')}</p>}
      {phones.length === 0 ? (
        <p className="trash-empty">{t('tree.allowedEmpty')}</p>
      ) : (
        <ul className="trash-list">
          {phones.map((p) => (
            <li key={p.phone} className="trash-row">
              <span className="trash-row-name">
                {p.phone}
                {p.label && <span className="trash-row-date"> · {p.label}</span>}
              </span>
              <div className="trash-row-actions">
                <button type="button" onClick={() => remove(p.phone)}>{t('tree.allowedRemove')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
