import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { localBackend } from './data/localBackend'
import { DataProvider } from './data/store'
import { seedDemo } from './db'
import { MODE } from './lib/config'
import { initSync } from './sync'
import './index.css'

// Il codice dell'accesso (Supabase) viene caricato solo nella versione con account
const CloudGate = lazy(() => import('./cloud/CloudGate'))

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  if (MODE === 'cloud') {
    root.render(
      <StrictMode>
        <Suspense fallback={<p className="p-6 text-slate-500">Caricamento…</p>}>
          <CloudGate />
        </Suspense>
      </StrictMode>,
    )
    return
  }
  // demo: dati fittizi solo nel browser, nessun server. local: sincronizzazione con il server Node locale.
  if (MODE === 'local') await initSync()
  else await seedDemo()
  root.render(
    <StrictMode>
      <DataProvider backend={localBackend}>
        <App />
      </DataProvider>
    </StrictMode>,
  )
}

void boot()
