import { useTranslation } from 'react-i18next'
import { languages, type Language } from '@/i18n'

export function LanguageSwitch() {
  const { i18n } = useTranslation()

  const handleLanguageChange = (lang: Language) => {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="flex items-center bg-base-200 rounded-full p-1 gap-1">
      {(Object.keys(languages) as Language[]).map((lang) => (
        <button
          key={lang}
          onClick={() => handleLanguageChange(lang)}
          className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 text-lg ${
            i18n.language === lang
              ? 'bg-primary shadow-md scale-110'
              : 'hover:bg-base-300'
          }`}
          aria-label={languages[lang].name}
        >
          <span>{languages[lang].flag}</span>
        </button>
      ))}
    </div>
  )
}
