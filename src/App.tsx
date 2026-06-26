import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { HomePage, GalleryPage } from '@/pages'
import '@/i18n'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
