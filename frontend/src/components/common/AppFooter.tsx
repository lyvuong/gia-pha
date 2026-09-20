import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { checkForUpdate } from '../../lib/updateCheck'
import { DISPLAY_VERSION } from '../../lib/version'

export function AppFooter() {
  const { t } = useTranslation()
  const [updateAvailable, setUpdateAvailable] = useState(false)

  // A quiet check when the app opens; the About page has the button to install.
  useEffect(() => {
    checkForUpdate()
      .then((r) => setUpdateAvailable(r.hasUpdate))
      .catch(() => {})
  }, [])

  return (
    <footer className="app-footer">
      <span>© {new Date().getFullYear()} Ly Vuong</span>
      <span aria-hidden="true">·</span>
      <span>{DISPLAY_VERSION}</span>
      <span aria-hidden="true">·</span>
      <Link to="/about">{t('footer.about')}</Link>
      {updateAvailable && (
        <>
          <span aria-hidden="true">·</span>
          <Link to="/about" className="app-footer-update">{t('footer.updateAvailable')}</Link>
        </>
      )}
    </footer>
  )
}
