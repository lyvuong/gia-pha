import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addAllowedPhone, addAllowedPhones, removeAllowedPhone, useAllowedPhones } from '../../hooks/useAllowedPhones'
import { addAllowedEmails, removeAllowedEmail, useAllowedEmails } from '../../hooks/useAllowedEmails'
import { TrashIcon } from '../common/icons'
import { normalizeEmail, parseEmailLines } from '../../lib/email'
import { normalizePhoneNumber, parsePhoneList } from '../../lib/phone'

interface AllowedPhonesPanelProps {
  giaPhaId: string
  currentUid: string
  onClose: () => void
}

/** Lets a member list relatives' phone numbers or Google emails; those people join by signing in, with no approval step. */
export function AllowedPhonesPanel({ giaPhaId, currentUid, onClose }: AllowedPhonesPanelProps) {
  const { t } = useTranslation()
  const phones = useAllowedPhones(giaPhaId)
  const emails = useAllowedEmails(giaPhaId)
  const [phone, setPhone] = useState('')
  const [label, setLabel] = useState('')
  const [bulk, setBulk] = useState('')
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: string[] } | null>(null)
  const [error, setError] = useState<'invalid' | 'failed' | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    // Anything with an "@" is an email address, otherwise a phone number.
    const isEmail = phone.includes('@')
    const email = isEmail ? normalizeEmail(phone) : null
    const e164 = isEmail ? null : normalizePhoneNumber(phone)
    if (!email && !e164) {
      setError('invalid')
      return
    }
    setError(null)
    try {
      if (email) await addAllowedEmails(giaPhaId, [{ email, label: label.trim() }], currentUid)
      else await addAllowedPhone(giaPhaId, e164!, label.trim(), currentUid)
      setPhone('')
      setLabel('')
    } catch {
      setError('failed')
    }
  }

  async function addMany(e: React.FormEvent) {
    e.preventDefault()
    const { entries: emailEntries, rest } = parseEmailLines(bulk)
    const { entries, skipped } = parsePhoneList(rest)
    setError(null)
    try {
      await addAllowedEmails(giaPhaId, emailEntries, currentUid)
      await addAllowedPhones(giaPhaId, entries, currentUid)
      setBulkResult({ added: entries.length + emailEntries.length, skipped })
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

  async function removeEmail(address: string) {
    setError(null)
    try {
      await removeAllowedEmail(giaPhaId, address)
    } catch {
      setError('failed')
    }
  }

  const rows = [
    ...phones.map((p) => ({ key: p.phone, label: p.label, onRemove: () => remove(p.phone) })),
    ...emails.map((m) => ({ key: m.email, label: m.label, onRemove: () => removeEmail(m.email) })),
  ]

  return (
    <div className="member-detail-panel trash-panel">
      <button type="button" className="panel-close" onClick={onClose}>×</button>
      <h2>{t('tree.allowedTitle')}</h2>
      <p>{t('tree.allowedIntro')}</p>
      <form onSubmit={add}>
        <label>
          {t('tree.allowedContact')}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" required />
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
      {rows.length === 0 ? (
        <p className="trash-empty">{t('tree.allowedEmpty')}</p>
      ) : (
        <ul className="trash-list">
          {rows.map((p) => (
            <li key={p.key} className="trash-row">
              <span className="trash-row-name">
                {p.key}
                {p.label && <span className="trash-row-date"> · {p.label}</span>}
              </span>
              <div className="trash-row-actions">
                <button
                  type="button"
                  className="icon-button"
                  title={t('tree.allowedRemove')}
                  aria-label={t('tree.allowedRemove')}
                  onClick={p.onRemove}
                >
                  <TrashIcon size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
