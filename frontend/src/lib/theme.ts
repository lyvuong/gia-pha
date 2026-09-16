export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const listeners = new Set<() => void>()

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let currentTheme: Theme = getInitialTheme()

/** Applies the theme to the DOM/localStorage and notifies every useTheme() subscriber,
 * so a toggle in one component (e.g. the header) is reflected wherever else the theme
 * is read (e.g. picking a logo variant on the login page) without needing a Provider. */
export function applyTheme(theme: Theme): void {
  currentTheme = theme
  document.documentElement.dataset.theme = theme
  localStorage.setItem(STORAGE_KEY, theme)
  listeners.forEach((listener) => listener())
}

export function getTheme(): Theme {
  return currentTheme
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
