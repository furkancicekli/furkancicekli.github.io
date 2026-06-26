import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { HomePage, GalleryPage } from '@/pages'
import { LoadingScreen } from '@/components/ui'
import '@/i18n'

function App() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Remove the inline #app-loader after React's first commit so the React
    // <LoadingScreen> (fixed inset-0 z-[100]) is guaranteed painted before the
    // inline twin disappears, eliminating any one-frame content flash.
    document.getElementById('app-loader')?.remove()
  }, [])

  return (
    <>
      <AnimatePresence>
        {/* The loading screen's grow+fade animation drives its own removal via onComplete. */}
        {visible && <LoadingScreen key="loading" onComplete={() => setVisible(false)} />}
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
