import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Remove the pre-React inline loader once React has mounted.
// The React LoadingScreen (fixed inset-0 z-[100]) is already covering it,
// so removing the inline node produces no visual gap.
document.getElementById('app-loader')?.remove()
