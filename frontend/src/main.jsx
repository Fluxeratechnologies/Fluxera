import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import './index.css'
import './components/product-stages.css'
import './components/public-motion.css'
import './styles/public-site.css'
import App from './App.jsx'

document.documentElement.dataset.siteLoading = 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
