import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addAllowedPhone, removeAllowedPhone, useAllowedPhones } from '../../hooks/useAllowedPhones'
import { normalizePhoneNumber } from '../../lib/phone'

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
