import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import vi from './vi.json'

const STORAGE_KEY = 'gia-pha-language'
const storedLanguage = localStorage.getItem(STORAGE_KEY)
// Shared links carry the sharer's language (?lang=en|vi); it applies until the visitor picks their own.
const linkLanguage = new URLSearchParams(window.location.search).get('lang')

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: storedLanguage ?? (linkLanguage === 'vi' || linkLanguage === 'en' ? linkLanguage : 'en'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
