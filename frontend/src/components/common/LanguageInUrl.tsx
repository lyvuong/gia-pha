import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

/** Keeps `?lang=` in the address bar matching the current language, so a link copied from it
 * previews (e.g. on WhatsApp) in the sharer's language — see src/worker.js. */
export function LanguageInUrl() {
  const { i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  // The served page's title matches the ?lang= it was loaded with; follow later switches too.
  useEffect(() => {
    document.documentElement.lang = i18n.language
    document.title = i18n.language === 'vi' ? 'Gia Phả' : 'Family Tree'
  }, [i18n.language])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('lang') === i18n.language) return
    params.set('lang', i18n.language)
    navigate({ pathname: location.pathname, search: `?${params}`, hash: location.hash }, { replace: true, state: location.state })
  }, [i18n.language, location, navigate])

  return null
}
