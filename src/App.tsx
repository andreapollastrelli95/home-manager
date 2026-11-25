import { useEffect, useRef } from 'react'
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { useAccount } from './account'
import { Assistente } from './assistant'
import { CarAltro, CarDashboard, CarDocumenti, CarInterventi, CarRifornimenti, CarScadenze, CarSpese, Veicoli } from './car'
import { useData } from './data/store'
import { MODE } from './lib/config'
import { fmtTime } from './lib/format'
import { Altro, Backup, Casa, Dashboard, Documenti, Inventario, ListaSpesa, Scadenze, Spese } from './pages'
import Start from './start'

type Area = 'home' | 'car'
type Item = [string, string, string]

const SIDEBAR: Record<Area, Item[]> = {
  home: [['/home', '🏠', 'Riepilogo casa'], ['/spese', '💶', 'Spese e bollette'], ['/scadenze', '📅', 'Scadenze'], ['/lista', '🛒', 'Lista della spesa'], ['/inventario', '📦', 'Inventario'], ['/documenti', '📄', 'Documenti']],
  car: [['/car', '🚗', 'Riepilogo auto'], ['/car/scadenze', '📅', 'Scadenze'], ['/car/interventi', '🔧', 'Interventi'], ['/car/rifornimenti', '⛽', 'Rifornimenti'], ['/car/spese', '💶', 'Spese'], ['/car/documenti', '📄', 'Documenti e note'], ['/car/veicoli', '🚙', 'Le mie auto']],
}
const SHARED: Item[] = [['/assistente', '✨', 'Assistente'], ['/casa', '⚙️', 'Impostazioni'], ['/backup', '💾', 'Backup e importazione']]
const TABS: Record<Area, Item[]> = {
  home: [['/home', '🏠', 'Riepilogo'], ['/spese', '💶', 'Spese'], ['/scadenze', '📅', 'Scadenze'], ['/lista', '🛒', 'Spesa'], ['/altro', '☰', 'Altro']],
  car: [['/car', '🚗', 'Riepilogo'], ['/car/scadenze', '📅', 'Scadenze'], ['/car/interventi', '🔧', 'Interventi'], ['/car/rifornimenti', '⛽', 'Rifornim.'], ['/car/altro', '☰', 'Altro']],
}
const IN_OTHER: Record<Area, string[]> = {
  home: ['/altro', '/inventario', '/documenti', '/assistente', '/casa', '/backup'],
  car: ['/car/altro', '/car/spese', '/car/documenti', '/car/veicoli', '/assistente', '/casa', '/backup'],
}

function SyncBadge() {
  const { sync, online } = useData()
  if (MODE === 'demo') return <span className="text-xs text-amber-200">Demo · dati solo in questo browser</span>
  if (!online) return <span className="text-xs text-amber-200">Senza connessione</span>
  if (sync.state === 'saving') return <span className="text-xs text-slate-300">Salvataggio…</span>
  if (sync.state === 'error') return <span className="text-xs text-red-300" title={sync.message}>⚠ {sync.message ?? 'Non salvato'}</span>
  if (MODE === 'local') return <span className="text-xs text-slate-300">Dati su questo computer</span>
  return <span className="text-xs text-slate-300">{sync.at ? `✓ Sincronizzato alle ${fmtTime(sync.at)}` : 'Sincronizzazione…'}</span>
}

/** Area corrente; le pagine comuni (assistente, impostazioni, backup) mantengono quella da cui si arriva. */
function useArea(): Area | null {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const last = useRef<Area>('home')
  if (pathname === '/') return null
  if (pathname === '/car' || pathname.startsWith('/car/')) last.current = 'car'
  else if (!SHARED.some(([to]) => to === pathname)) last.current = 'home'
  else if (params.get('area') === 'car' || params.get('area') === 'home') last.current = params.get('area') as Area
  return last.current
}

/** Passaggio rapido: inizio, Home, Car. */
function Switcher({ area }: { area: Area | null }) {
  const seg = (to: string, on: boolean, label: string) => (
    <Link to={to} aria-current={on ? 'page' : undefined} className={`flex-1 text-center rounded-lg py-2 text-sm min-h-[40px] ${on ? 'bg-white text-slate-900 font-semibold' : 'text-slate-200'}`}>{label}</Link>
  )
  return (
    <div className="flex gap-1 bg-slate-700 rounded-xl p-1" role="navigation" aria-label="Aree">
      {seg('/', area === null, 'Inizio')}{seg('/home', area === 'home', '🏠 Home')}{seg('/car', area === 'car', '🚗 Car')}
    </div>
  )
}

function Shell() {
  const { homeName, status, loadError, reload, sync } = useData()
  const acc = useAccount()
  const { pathname } = useLocation()
  const area = useArea()
  const main = useRef<HTMLElement>(null)
  useEffect(() => { main.current?.scrollTo(0, 0) }, [pathname])
  const tabActive = (to: string) => (area && to === TABS[area][4][0] ? IN_OTHER[area].includes(pathname) : pathname === to)
  const title = area === 'car' ? '🚗 Car' : area === 'home' ? `🏠 ${homeName}` : 'Home e Car Manager'
  const link = ([to, icon, label]: Item) => (
    <NavLink key={to} to={to} end className={({ isActive }) => `px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-slate-600 text-white' : 'hover:bg-slate-700'}`}>
      <span aria-hidden>{icon}</span> {label}
    </NavLink>
  )

  return (
    <div className="flex flex-col md:flex-row h-screen h-[100dvh] bg-slate-100 text-slate-800">
      {MODE === 'demo' && (
        <div className="md:hidden bg-amber-400 text-amber-950 text-xs text-center py-1.5 px-3">DEMO con dati fittizi · i dati restano solo in questo browser</div>
      )}
      <header className="md:hidden bg-slate-800 text-white px-3 py-2 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold truncate">{title}</span>
          <SyncBadge />
        </div>
        {area && <Switcher area={area} />}
      </header>
      <nav aria-label="Menu principale" className="hidden md:flex md:w-60 bg-slate-800 text-slate-200 p-3 flex-col gap-1 shrink-0 overflow-y-auto">
        <div className="font-bold text-white px-2">Home e Car Manager</div>
        <div className="px-2 pb-2"><SyncBadge /></div>
        <Switcher area={area} />
        {area && <><div className="px-2 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-400 truncate">{area === 'car' ? 'Car' : homeName}</div>{SIDEBAR[area].map(link)}</>}
        <div className="px-2 pt-3 pb-1 text-xs uppercase tracking-wide text-slate-400">Generale</div>
        {SHARED.map(link)}
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
        <main ref={main} className="flex-1 overflow-auto p-3 md:p-6 pb-24 md:pb-6">
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
            <Route path="/" element={<Start />} />
            <Route path="/home" element={<Dashboard />} />
            <Route path="/spese" element={<Spese />} />
            <Route path="/scadenze" element={<Scadenze />} />
            <Route path="/lista" element={<ListaSpesa />} />
            <Route path="/altro" element={<Altro />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/documenti" element={<Documenti />} />
            <Route path="/car" element={<CarDashboard />} />
            <Route path="/car/scadenze" element={<CarScadenze />} />
            <Route path="/car/interventi" element={<CarInterventi />} />
            <Route path="/car/rifornimenti" element={<CarRifornimenti />} />
            <Route path="/car/spese" element={<CarSpese />} />
            <Route path="/car/documenti" element={<CarDocumenti />} />
            <Route path="/car/veicoli" element={<Veicoli />} />
            <Route path="/car/altro" element={<CarAltro />} />
            <Route path="/assistente" element={<Assistente />} />
            <Route path="/casa" element={<Casa />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="*" element={<Start />} />
          </Routes>
          {MODE === 'cloud' && pathname === '/' && (
            <p className="md:hidden text-center text-sm text-slate-500 mt-6 break-all">{acc.email} · <button className="underline py-2" onClick={() => void acc.signOut?.()}>Esci</button></p>
          )}
        </main>
      </div>
      {area && (
        <nav aria-label="Menu dell’area" className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex pb-[env(safe-area-inset-bottom)] z-10">
          {TABS[area].map(([to, icon, label]) => (
            <NavLink key={to} to={to} end aria-current={tabActive(to) ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center min-h-[56px] text-xs ${tabActive(to) ? 'text-blue-700 font-semibold' : 'text-slate-500'}`}>
              <span className="text-xl leading-none" aria-hidden>{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
      )}
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
