import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeVietnamese } from '../../lib/normalizeVietnamese'
import type { Member } from '../../types/models'

interface SearchBarProps {
  members: Member[]
  onSelectMember: (member: Member) => void
}

export function SearchBar({ members, onSelectMember }: SearchBarProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const normalizedQuery = normalizeVietnamese(query.trim())
    if (!normalizedQuery) return []
    return members.filter((m) => m.searchKey.includes(normalizedQuery)).slice(0, 8)
  }, [members, query])

  return (
    <div className="search-bar">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tree.search')}
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectMember(m)
                  setQuery('')
                }}
              >
                {m.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
