import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const target = document.getElementById('studio-root')

if (target) {
  createRoot(target).render(
    <StrictMode>
      <App embedded />
    </StrictMode>,
  )
}