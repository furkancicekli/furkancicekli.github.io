import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { HomePage, GalleryPage } from '@/pages'
import { LoadingScreen } from '@/components/ui'
import '@/i18n'

// Minimum time the loading screen must be visible (ms).
const MIN_DISPLAY_MS = 700

function App() {
  const [visible, setVisible] = useState(true)
  const startTime = useRef(Date.now())

  useEffect(() => {
    let cancelled = false

    function hide() {
      if (cancelled) return
      const elapsed = Date.now() - startTime.current
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)
      setTimeout(() => {
        if (!cancelled) setVisible(false)
      }, remaining)
    }

    if (document.readyState === 'complete') {
      // Window already loaded — just respect the min display time.
      hide()
    } else {
      window.addEventListener('load', hide, { once: true })
    }

    return () => {
      cancelled = true
      window.removeEventListener('load', hide)
    }
  }, [])

  return (
    <>
      <AnimatePresence>
        {visible && <LoadingScreen key="loading" />}
      </AnimatePresence>

      {/* Router mounts immediately underneath — content is ready when overlay fades */}
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/gallery" element={<GalleryPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </>
  )
}

export default App
