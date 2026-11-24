import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAccount } from './account'
import { useData } from './data/store'
import { MODE } from './lib/config'
import { fmtTime } from './lib/format'
import { Altro, Assistente, Backup, Casa, Dashboard, Documenti, Inventario, ListaSpesa, Scadenze, Spese } from './pages'

const SIDEBAR: [string, string, string][] = [
  ['/', '🏠', 'Home'], ['/spese', '💶', 'Spese e bollette'], ['/scadenze', '📅', 'Scadenze'], ['/lista', '🛒', 'Lista della spesa'],
  ['/inventario', '📦', 'Inventario'], ['/documenti', '📄', 'Documenti'], ['/assistente', '✨', 'Assistente'],
  ['/casa', '⚙️', 'La mia casa'], ['/backup', '💾', 'Backup e importazione'],
]
const TABS: [string, string, string][] = [['/', '🏠', 'Home'], ['/spese', '💶', 'Spese'], ['/scadenze', '📅', 'Scadenze'], ['/lista', '🛒', 'Spesa'], ['/altro', '☰', 'Altro']]
const OTHER = ['/altro', '/inventario', '/documenti', '/assistente', '/casa', '/backup']

function SyncBadge() {
  const { sync, online } = useData()
  if (MODE === 'demo') return <span className="text-xs text-amber-200">Demo · dati solo in questo browser</span>
  if (!online) return <span className="text-xs text-amber-200">Senza connessione</span>
  if (sync.state === 'saving') return <span className="text-xs text-slate-300">Salvataggio…</span>
  if (sync.state === 'error') return <span className="text-xs text-red-300" title={sync.message}>⚠ {sync.message ?? 'Non salvato'}</span>
  if (MODE === 'local') return <span className="text-xs text-slate-300">Dati su questo computer</span>
  return <span className="text-xs text-slate-300">{sync.at ? `✓ Sincronizzato alle ${fmtTime(sync.at)}` : 'Sincronizzazione…'}</span>
}

function Shell() {
  const { homeName, status, loadError, reload, sync } = useData()
  const acc = useAccount()
  const { pathname } = useLocation()
  const tabActive = (to: string) => (to === '/altro' ? OTHER.includes(pathname) : pathname === to)

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-100 text-slate-800">
      {MODE === 'demo' && (
        <div className="md:hidden bg-amber-400 text-amber-950 text-xs text-center py-1.5 px-3">DEMO con dati fittizi · i dati restano solo in questo browser</div>
      )}
      <header className="md:hidden bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <span className="font-semibold truncate">🏠 {homeName}</span>
        <SyncBadge />
      </header>
      <nav aria-label="Menu principale" className="hidden md:flex md:w-60 bg-slate-800 text-slate-200 p-3 flex-col gap-1 shrink-0">
        <div className="font-bold text-white px-2 truncate">🏠 {homeName}</div>
        <div className="px-2 pb-3"><SyncBadge /></div>
        {SIDEBAR.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end className={({ isActive }) => `px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-slate-600 text-white' : 'hover:bg-slate-700'}`}>
            <span aria-hidden>{icon}</span> {label}
          </NavLink>
        ))}
        <div className="mt-auto px-2 pt-3 text-xs text-slate-400">
          {MODE === 'cloud' && acc.email && <div className="truncate mb-1">{acc.email}</div>}
          {MODE === 'cloud' && <button className="text-slate-200 underline py-1" onClick={() => void acc.signOut?.()}>Esci</button>}
        </div>
      </nav>
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {MODE === 'demo' && (
          <div className="hidden md:block bg-amber-400 text-amber-950 text-sm text-center py-1.5 px-3">
            Versione DEMO con dati fittizi: i dati inseriti restano solo in questo browser e non si sincronizzano tra persone o dispositivi.
          </div>
        )}
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-24 md:pb-6">
          {status === 'error' && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-800 p-3 text-sm flex flex-wrap items-center gap-3">
              <span className="flex-1">{loadError}</span>
              <button className="rounded-lg bg-red-600 text-white px-4 py-2 min-h-[44px]" onClick={() => void reload()}>Riprova</button>
            </div>
          )}
          {sync.state === 'error' && status === 'ready' && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-800 p-3 text-sm">{sync.message}</div>
          )}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/spese" element={<Spese />} />
            <Route path="/scadenze" element={<Scadenze />} />
            <Route path="/lista" element={<ListaSpesa />} />
            <Route path="/altro" element={<Altro />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/documenti" element={<Documenti />} />
            <Route path="/assistente" element={<Assistente />} />
            <Route path="/casa" element={<Casa />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
      <nav aria-label="Menu principale" className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex pb-[env(safe-area-inset-bottom)] z-10">
        {TABS.map(([to, icon, label]) => (
          <NavLink key={to} to={to} aria-current={tabActive(to) ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center min-h-[56px] text-xs ${tabActive(to) ? 'text-blue-700 font-semibold' : 'text-slate-500'}`}>
            <span className="text-xl leading-none" aria-hidden>{icon}</span>{label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
