import { useTranslation } from 'react-i18next'
import { useTheme } from '../../hooks/useTheme'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      onClick={toggleTheme}
      title={t('common.theme')}
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb">{isDark ? '🌙' : '☀️'}</span>
      </span>
    </button>
  )
}
