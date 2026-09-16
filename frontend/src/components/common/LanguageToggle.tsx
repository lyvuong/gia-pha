import { useTranslation } from 'react-i18next'
import { LanguageIcon } from './icons'

export function LanguageToggle() {
  const { i18n, t } = useTranslation()

  function toggle() {
    i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')
  }

  return (
    <button type="button" className="language-toggle icon-button" onClick={toggle} title={t('common.language')}>
      <LanguageIcon size={15} />
      <span className="btn-label">{i18n.language === 'vi' ? 'VI' : 'EN'}</span>
    </button>
  )
}
