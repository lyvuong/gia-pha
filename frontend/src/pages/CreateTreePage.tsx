import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { createGiaPha } from '../hooks/useGiaPha'
import { setEditorProfile } from '../hooks/useEditorProfiles'

export function CreateTreePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    setCreating(true)
    try {
      const id = await createGiaPha(name.trim(), user.uid)
      await setEditorProfile(id, user.uid, user.displayName ?? user.phoneNumber ?? user.uid)
      navigate(`/tree/${id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="create-tree-page">
      <h1>{t('tree.createTitle')}</h1>
      <p>{t('tree.noTreeYet')}</p>
      <form onSubmit={handleSubmit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('tree.createNamePlaceholder')}
          required
        />
        <button type="submit" disabled={creating}>{t('tree.createButton')}</button>
      </form>
    </div>
  )
}
