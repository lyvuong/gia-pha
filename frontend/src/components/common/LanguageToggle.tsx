import { useTranslation } from 'react-i18next'

export function LanguageToggle() {
  const { i18n, t } = useTranslation()

  function toggle() {
    i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')
  }

  return (
    <button type="button" className="language-toggle" onClick={toggle} title={t('common.language')}>
      {i18n.language === 'vi' ? 'VI' : 'EN'}
    </button>
  )
}
