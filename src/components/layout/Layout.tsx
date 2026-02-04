import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from './Header'
import { Footer } from './Footer'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { i18n } = useTranslation()

  useEffect(() => {
    // Update document direction based on language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.language

    // Save language preference
    localStorage.setItem('language', i18n.language)
  }, [i18n.language])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  )
}
