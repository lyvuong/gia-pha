import { useSyncExternalStore } from 'react'
import { applyTheme, getTheme, subscribeTheme, type Theme } from '../lib/theme'

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
  }

  return { theme, toggleTheme }
}
