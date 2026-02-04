import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeSwitch() {
  const [theme, setTheme] = useState<'corporate' | 'business'>('corporate')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'corporate' | 'business'
    const currentTheme = savedTheme || 'corporate'
    setTheme(currentTheme)
    document.documentElement.setAttribute('data-theme', currentTheme)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'corporate' ? 'business' : 'corporate'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }

  if (!mounted) {
    return (
      <button className="btn btn-ghost btn-sm btn-square" aria-label="Toggle theme">
        <Moon className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-ghost btn-sm btn-square"
      aria-label="Toggle theme"
    >
      {theme === 'business' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}
