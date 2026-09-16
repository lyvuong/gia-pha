import { useState } from 'react'
import { applyTheme, getInitialTheme, type Theme } from '../lib/theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  function toggleTheme() {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }

  return { theme, toggleTheme }
}
