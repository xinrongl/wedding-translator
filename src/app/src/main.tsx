import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Auto-redirect 0.0.0.0 to localhost to ensure WebRTC / getUserMedia secure context
if (typeof window !== 'undefined' && window.location.hostname === '0.0.0.0') {
  window.location.hostname = 'localhost';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
