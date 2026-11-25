import { Link } from 'react-router-dom'
import { useData } from './data/store'
import { carAlerts } from './lib/car'
import { todayISO } from './lib/format'

/** Schermata iniziale: la scelta tra Home e Car. */
export default function Start() {
  const { rows, status } = useData()
  const t = todayISO()
  const homeLate = status === 'ready'
    ? rows.expenses.filter((e) => !e.pagata && e.scadenza && String(e.scadenza) < t).length
      + rows.deadlines.filter((d) => !d.fatto && d.data && String(d.data) < t).length
      + rows.docs.filter((d) => d.scadenza && String(d.scadenza) < t).length
    : 0
  const carLate = status === 'ready' ? carAlerts(rows).filter((a) => a.level === 'overdue').length : 0

  const tile = (to: string, icon: string, name: string, desc: string, late: number) => (
    <Link to={to} className="flex-1 bg-white rounded-2xl shadow p-6 min-h-[11rem] flex flex-col items-center justify-center text-center active:bg-slate-50 hover:shadow-lg">
      <span className="text-6xl leading-none" aria-hidden>{icon}</span>
      <span className="text-2xl font-semibold mt-3">{name}</span>
      <span className="text-sm text-slate-500 mt-1">{desc}</span>
      {late > 0 && <span className="mt-2 text-xs rounded-full px-3 py-1 bg-red-100 text-red-700">⚠ {late} {late === 1 ? 'scadenza passata' : 'scadenze passate'}</span>}
    </Link>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-center mt-2 mb-1">Cosa vuoi gestire?</h1>
      <p className="text-sm text-slate-500 text-center mb-5">I tuoi dati di casa e auto restano separati e privati.</p>
      <div className="flex flex-col sm:flex-row gap-4">
        {tile('/home', '🏠', 'Home', 'Bollette, scadenze, spesa, inventario e documenti', homeLate)}
        {tile('/car', '🚗', 'Car', 'Auto, manutenzioni, rifornimenti e documenti', carLate)}
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-5">
        {([['/assistente', '✨ Assistente'], ['/casa', '⚙️ Impostazioni'], ['/backup', '💾 Backup']] as const).map(([to, label]) => (
          <Link key={to} to={to} className="bg-white rounded-full shadow px-4 py-2 text-sm min-h-[44px] inline-flex items-center">{label}</Link>
        ))}
      </div>
    </div>
  )
}
