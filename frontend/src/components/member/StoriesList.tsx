import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addStory, deleteStory } from '../../hooks/useMembers'
import { formatDate } from '../../lib/formatDate'
import type { Member, Story } from '../../types/models'

interface StoriesListProps {
  giaPhaId: string
  member: Member
  currentUid: string
  ownerUid: string
  editorNames: Record<string, string>
}

export function StoriesList({ giaPhaId, member, currentUid, ownerUid, editorNames }: StoriesListProps) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const stories = [...member.stories].sort((a, b) => b.contributedAt - a.contributedAt)

  async function handleAdd() {
    if (!draft.trim()) return
    setSubmitting(true)
    try {
      await addStory(giaPhaId, member.id, draft.trim(), currentUid)
      setDraft('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(story: Story) {
    await deleteStory(giaPhaId, member.id, story)
  }

  return (
    <div className="stories-list">
      <h3>{t('stories.title')}</h3>
      <div className="story-composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('stories.placeholder', { name: member.fullName })}
          rows={2}
        />
        <button type="button" onClick={handleAdd} disabled={submitting || !draft.trim()}>
          {t('stories.add')}
        </button>
      </div>
      <ul>
        {stories.map((story, i) => {
          const canDelete = story.contributedBy === currentUid || currentUid === ownerUid
          const name = editorNames[story.contributedBy] ?? story.contributedBy
          return (
            <li key={`${story.contributedAt}-${i}`} className="story-item">
              <p>{story.text}</p>
              <div className="story-meta">
                <span>{t('stories.contributedBy', { name, date: formatDate(story.contributedAt, i18n.language) })}</span>
                {canDelete && (
                  <button type="button" className="story-delete" onClick={() => handleDelete(story)}>
                    {t('stories.delete')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
