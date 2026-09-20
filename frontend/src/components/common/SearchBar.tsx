import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeVietnamese } from '../../lib/normalizeVietnamese'
import type { Member } from '../../types/models'
import { SearchIcon } from './icons'

interface SearchBarProps {
  members: Member[]
  onSelectMember: (member: Member) => void
  placeholder?: string
  /** The person currently shown; their name fills the box (and the list stays closed) until the user types. */
  selectedName?: string
}

export function SearchBar({ members, onSelectMember, placeholder, selectedName }: SearchBarProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(selectedName ?? '')
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    setQuery(selectedName ?? '')
    setTyping(false)
  }, [selectedName])

  const results = useMemo(() => {
    if (!typing) return []
    const normalizedQuery = normalizeVietnamese(query.trim())
    if (!normalizedQuery) return []
    return members.filter((m) => m.searchKey.includes(normalizedQuery)).slice(0, 8)
  }, [members, query, typing])

  return (
    <div className="search-bar">
      <SearchIcon size={15} />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setTyping(true)
        }}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder ?? t('tree.search')}
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectMember(m)
                  setTyping(false)
                  setQuery(selectedName ?? '')
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
