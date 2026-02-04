import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import tr from './locales/tr.json'
import en from './locales/en.json'
import ar from './locales/ar.json'

export const languages = {
  tr: { name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  en: { name: 'English', flag: '🇬🇧', dir: 'ltr' },
  ar: { name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
} as const

export type Language = keyof typeof languages

const savedLanguage = typeof window !== 'undefined'
  ? localStorage.getItem('language') as Language
  : null

i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: savedLanguage || 'tr',
  fallbackLng: 'tr',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
