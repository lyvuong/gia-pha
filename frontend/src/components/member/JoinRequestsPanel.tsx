import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { approveJoinRequest, declineJoinRequest, type JoinRequest } from '../../hooks/useJoinRequests'
import { formatDate } from '../../lib/formatDate'

interface JoinRequestsPanelProps {
  giaPhaId: string
  requests: JoinRequest[]
  onClose: () => void
}

/** Lets a member let a person who has signed in (and asked) into the family tree, or turn them down. */
export function JoinRequestsPanel({ giaPhaId, requests, onClose }: JoinRequestsPanelProps) {
  const { t, i18n } = useTranslation()
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function act(request: JoinRequest, action: 'approve' | 'decline') {
    if (action === 'approve' && !confirm(t('tree.approveConfirm', { name: request.displayName }))) return
    setBusyUid(request.uid)
    setError(false)
    try {
      if (action === 'approve') await approveJoinRequest(giaPhaId, request.uid)
      else await declineJoinRequest(giaPhaId, request.uid)
    } catch {
      setError(true)
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className="member-detail-panel trash-panel">
      <button type="button" className="panel-close" onClick={onClose}>×</button>
      <h2>{t('tree.requestsTitle')}</h2>
      {requests.length === 0 ? (
        <p className="trash-empty">{t('tree.requestsEmpty')}</p>
      ) : (
        <ul className="trash-list">
          {requests.map((r) => (
            <li key={r.uid} className="trash-row">
              <span className="trash-row-name">
                {r.displayName}
                {r.contact && r.contact !== r.displayName && <span className="trash-row-date"> · {r.contact}</span>}
                {r.country && <span className="trash-row-date"> · {r.country}</span>}
                <span className="trash-row-date"> · {t('tree.requestedOn', { date: formatDate(r.requestedAt, i18n.language) })}</span>
                {r.notes && <span className="request-notes">{r.notes}</span>}
              </span>
              <div className="trash-row-actions">
                <button type="button" onClick={() => act(r, 'approve')} disabled={busyUid === r.uid}>
                  {t('tree.approve')}
                </button>
                <button type="button" onClick={() => act(r, 'decline')} disabled={busyUid === r.uid}>
                  {t('tree.decline')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error-text">{t('tree.requestActionFailed')}</p>}
    </div>
  )
}
