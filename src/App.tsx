import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { HomePage, GalleryPage } from '@/pages'
import {
  AdminLoginPage,
  AdminLayout,
  AdminDashboardPage,
  AdminSettingsPage,
  AdminComingSoonPage,
  AdminProductsPage,
  AdminProductEditPage,
  contentSections,
} from '@/pages/admin'
import { LoadingScreen } from '@/components/ui'
import '@/i18n'

// Public sayfalar mevcut site kabuğu (nav + footer) içinde render edilir
function PublicShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function App() {
  // Admin rotalarında intro animasyonu gösterilmez — panel doğrudan açılır
  const isAdminRoute = window.location.pathname.startsWith('/admin')
  const [visible, setVisible] = useState(!isAdminRoute)

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
        <Routes>
          <Route element={<PublicShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/gallery" element={<GalleryPage />} />
          </Route>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="products/new" element={<AdminProductEditPage />} />
            <Route path="products/:id" element={<AdminProductEditPage />} />
            {/* Henüz açılmamış içerik bölümleri — "yakında" sayfaları. Bir bölüm
                açıldığında sections.ts'te ready:true yapılır ve buradan düşer. */}
            {contentSections
              .filter((s) => !s.ready)
              .map((s) => (
                <Route
                  key={s.path}
                  path={s.path.replace('/admin/', '')}
                  element={<AdminComingSoonPage section={s} />}
                />
              ))}
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
