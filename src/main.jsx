import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { checkSetup } from './services/supabaseService'

if (import.meta.env.DEV) {
  // Expose diagnostics for local troubleshooting only.
  window.checkSmartCampusSetup = checkSetup;
  console.log("Tip: Run checkSmartCampusSetup() in console to diagnose setup issues");
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
