import { useTranslation } from 'react-i18next'
import { languages, type Language } from '@/i18n'

export function LanguageSwitch() {
  const { i18n } = useTranslation()

  const handleLanguageChange = (lang: Language) => {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-sm gap-2">
        <span>{languages[i18n.language as Language]?.flag || '🌐'}</span>
        <span className="hidden sm:inline">
          {languages[i18n.language as Language]?.name || 'Language'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content z-[100] menu p-2 shadow-lg bg-base-100 rounded-box w-40"
      >
        {(Object.keys(languages) as Language[]).map((lang) => (
          <li key={lang}>
            <button
              onClick={() => handleLanguageChange(lang)}
              className={`${
                i18n.language === lang ? 'active bg-primary/10 text-primary' : ''
              }`}
            >
              <span>{languages[lang].flag}</span>
              <span>{languages[lang].name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
