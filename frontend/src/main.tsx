import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import './i18n'
import { App } from './App.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { applyTheme, getInitialTheme } from './lib/theme'

// Applied before the first paint so there's no flash of the wrong theme.
applyTheme(getInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
