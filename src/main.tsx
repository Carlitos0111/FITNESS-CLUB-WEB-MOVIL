import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { createGateway } from './lib/supabase'

const gateway = createGateway(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App gateway={gateway} /></React.StrictMode>)
