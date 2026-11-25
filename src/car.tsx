import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CrudPage, { btn, inputCls, type Field } from './CrudPage'
import { useData } from './data/store'
import { ALIMENTAZIONI, CATEGORIE_AUTO, TIPI_DOC_AUTO, TIPI_SCADENZA_AUTO, type NewRow, type Row } from './data/model'
import { MODE } from './lib/config'
import { carAlerts, carSpend, deadlineStatus, RULE_TEXT, type Alert } from './lib/car'
import { fmtDate, fmtEuro, fmtNum, todayISO } from './lib/format'

const SELECTED = 'home-manager-auto-scelta'

/** Auto visualizzata: la scelta resta ricordata in questo browser. */
function useSelectedVehicle() {
  const { rows } = useData()
  const [id, setId] = useState(() => { try { return localStorage.getItem(SELECTED) ?? '' } catch { return '' } })
  const vehicle = rows.vehicles.find((v) => String(v.id) === id) ?? rows.vehicles[0]
  const select = (v: Row['id']) => { setId(String(v)); try { localStorage.setItem(SELECTED, String(v)) } catch { /* ignora */ } }
  return { vehicle, select }
}

/** Controlli comuni a tutte le pagine Car: caricamento, database da aggiornare, nessuna auto. */
function CarGate({ title, children }: { title: string; children: (v: Row, select: (id: Row['id']) => void) => ReactNode }) {
  const { rows, status, loadError, reload, carReady } = useData()
  const { vehicle, select } = useSelectedVehicle()
  const alerts = carAlerts(rows)

  if (status === 'loading') return <p className="text-slate-500 p-4" role="status">Caricamento dei dati…</p>
  if (status === 'error') return <div role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-800 p-4">{loadError} <button className="underline py-2" onClick={() => void reload()}>Riprova</button></div>
  if (!carReady)
    return (
      <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-4">
        <h1 className="text-lg font-semibold mb-1">L’area Car non è ancora pronta online</h1>
        <p className="text-sm">Il database non ha le tabelle delle auto. Chi gestisce l’app deve eseguire <code>supabase/schema.sql</code> nello SQL Editor di Supabase (non cancella nessun dato). L’area Home funziona normalmente e nulla viene salvato qui finché le tabelle non esistono.</p>
        <button className={`${btn} bg-white mt-3`} onClick={() => void reload()}>Ricontrolla</button>
      </div>
    )
  if (!vehicle)
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-3">{title}</h1>
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <div className="text-4xl mb-2" aria-hidden>🚗</div>
          <p className="text-slate-600 mb-4">Non hai ancora aggiunto nessuna auto. Aggiungine una per gestire scadenze, interventi, rifornimenti e documenti.</p>
          <Link className={`${btn} bg-blue-600 text-white inline-flex items-center`} to="/car/veicoli?nuovo=1">＋ Aggiungi la tua auto</Link>
        </div>
      </div>
    )

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Auto visualizzata">
        {rows.vehicles.map((v) => {
          const late = alerts.some((a) => a.vehicleId === v.id && a.level === 'overdue')
          const on = v.id === vehicle.id
          return (
            <button key={String(v.id)} aria-pressed={on} onClick={() => select(v.id)}
              className={`rounded-full px-4 py-2 text-sm min-h-[44px] ${on ? 'bg-slate-800 text-white' : 'bg-white shadow text-slate-700'}`}>
              🚗 {String(v.nome)}{late && <span className="text-red-500" title="Ha scadenze passate"> ⚠</span>}
            </button>
          )
        })}
        <Link to="/car/veicoli?nuovo=1" className="rounded-full px-4 py-2 text-sm min-h-[44px] inline-flex items-center border border-dashed border-slate-400 text-slate-600">＋ Auto</Link>
      </div>
      {children(vehicle, select)}
    </div>
  )
}

/* ---------- Dashboard Car ---------- */

const tone: Record<Alert['level'], string> = { overdue: 'border-l-4 border-red-500', soon: 'border-l-4 border-amber-400', ok: '' }

function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="bg-white rounded-xl shadow divide-y">
      {alerts.map((a) => (
        <li key={a.key} className={tone[a.level]}>
          <Link to={a.to} className="block p-3 min-h-[56px]">
            <div className="font-medium break-words">{a.title}</div>
            <div className={`text-sm ${a.level === 'overdue' ? 'text-red-700' : a.level === 'soon' ? 'text-amber-700' : 'text-slate-500'}`}>{a.kind} · {a.text}</div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Aggiornamento rapido del chilometraggio. */
function KmCard({ v }: { v: Row }) {
  const { update } = useData()
  const [open, setOpen] = useState(false)
  const [km, setKm] = useState('')
  const [msg, setMsg] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    const n = Math.round(Number(km.replace(',', '.')))
    if (!(n > 0)) return setMsg('Scrivi i chilometri segnati sul contachilometri.')
    if (n < Number(v.km || 0) && !window.confirm(`Il valore è più basso di quello salvato (${fmtNum(v.km)} km). Salvarlo comunque?`)) return
    try { await update('vehicles', v.id, { km: n, km_data: todayISO() }); setOpen(false); setMsg('') } catch (ex) { setMsg((ex as Error).message) }
  }

  const details = [v.marca, v.modello, v.anno || '', v.alimentazione].filter(Boolean).join(' · ')
  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold break-words">{String(v.nome)}</h1>
          <p className="text-sm text-slate-500">{details}</p>
          {!!v.targa && <p className="text-sm mt-1"><span className="inline-block border border-slate-400 rounded px-2 font-mono tracking-wider">{String(v.targa)}</span></p>}
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">{v.km ? `${fmtNum(v.km)} km` : 'Km non indicati'}</div>
          <div className="text-xs text-slate-500">{v.km && v.km_data ? `aggiornati il ${fmtDate(v.km_data)}` : 'inseriscili per le scadenze a km'}</div>
        </div>
      </div>
      {open ? (
        <form onSubmit={save} noValidate className="mt-3 flex flex-wrap gap-2 items-end">
          <label className="text-sm text-slate-600 flex-1 min-w-[10rem]">Chilometri attuali
            <input className={`${inputCls} mt-1`} type="number" inputMode="numeric" min={0} autoFocus value={km} onChange={(e) => setKm(e.target.value)} />
          </label>
          <button className={`${btn} bg-blue-600 text-white`}>Salva</button>
          <button type="button" className={`${btn} bg-slate-100`} onClick={() => setOpen(false)}>Annulla</button>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${btn} bg-slate-100 text-slate-800`} onClick={() => { setKm(v.km ? String(v.km) : ''); setOpen(true) }}>Aggiorna km</button>
          <Link className={`${btn} bg-slate-100 text-slate-800 inline-flex items-center`} to="/car/veicoli">Modifica auto</Link>
        </div>
      )}
      {msg && <p role="alert" className="text-sm text-red-700 mt-2">{msg}</p>}
    </div>
  )
}

export function CarDashboard() {
  const { rows } = useData()
  return (
    <CarGate title="Car">
      {(v) => {
        const alerts = carAlerts(rows).filter((a) => a.vehicleId === v.id)
        const overdue = alerts.filter((a) => a.level === 'overdue')
        const soon = alerts.filter((a) => a.level === 'soon')
        const later = alerts.filter((a) => a.level === 'ok').slice(0, 3)
        const services = rows.car_services.filter((s) => s.vehicle_id === v.id).sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 3)
        const year = todayISO().slice(0, 4)
        const spend = carSpend(rows, v.id, year)
        const all = carSpend(rows, v.id)
        return (
          <div>
            <KmCard key={String(v.id)} v={v} />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {([['/car/rifornimenti?nuovo=1', '⛽', 'Rifornimento'], ['/car/interventi?nuovo=1', '🔧', 'Intervento'], ['/car/scadenze?nuovo=1', '📅', 'Scadenza'], ['/car/spese?nuovo=1', '💶', 'Altra spesa']] as const).map(([to, icon, label]) => (
                <Link key={to} to={to} className="bg-white rounded-xl shadow p-3 flex items-center gap-2 min-h-[56px] active:bg-slate-50">
                  <span className="text-2xl" aria-hidden>{icon}</span><span className="text-sm font-medium">{label}</span>
                </Link>
              ))}
            </div>

            {overdue.length > 0 && <><h2 className="font-semibold text-red-700 mb-2">⚠ Scadute ({overdue.length})</h2><div className="mb-5"><AlertList alerts={overdue} /></div></>}
            {soon.length > 0 && <><h2 className="font-semibold text-amber-700 mb-2">Imminenti ({soon.length})</h2><div className="mb-5"><AlertList alerts={soon} /></div></>}
            {!overdue.length && !soon.length && <p className="text-sm text-slate-500 bg-white rounded-xl shadow p-3 mb-5">Niente di scaduto o imminente.</p>}
            {later.length > 0 && <><h2 className="font-semibold mb-2">Più avanti</h2><div className="mb-5"><AlertList alerts={later} /></div></>}

            <h2 className="font-semibold mb-2">Spese del {year}</h2>
            <div className="bg-white rounded-xl shadow p-4 mb-5">
              <div className="text-2xl font-semibold">{fmtEuro(spend.total)}</div>
              <dl className="grid grid-cols-3 gap-2 mt-2 text-sm">
                {([['Carburante', spend.fuel], ['Interventi', spend.services], ['Altre spese', spend.other]] as const).map(([k, n]) => (
                  <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium">{fmtEuro(n)}</dd></div>
                ))}
              </dl>
              <p className="text-xs text-slate-500 mt-2">In totale da quando registri: {fmtEuro(all.total)}. «Carburante» comprende anche le ricariche che inserisci tra i rifornimenti.</p>
            </div>

            <h2 className="font-semibold mb-2">Interventi recenti</h2>
            {services.length ? (
              <ul className="bg-white rounded-xl shadow divide-y">
                {services.map((s) => (
                  <li key={String(s.id)} className="p-3">
                    <div className="font-medium break-words">{String(s.descrizione)}</div>
                    <div className="text-sm text-slate-500">{[fmtDate(s.data), s.km ? `${fmtNum(s.km)} km` : '', s.officina, s.costo ? fmtEuro(s.costo) : ''].filter(Boolean).join(' · ')}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500 bg-white rounded-xl shadow p-3">Nessun intervento registrato.</p>}
          </div>
        )
      }}
    </CarGate>
  )
}

/* ---------- Veicoli ---------- */

const KM_HINT = 'Se è più alto di quello salvato, aggiorna anche il chilometraggio dell’auto.'

export function Veicoli() {
  const { rows, carReady } = useData()
  const { select } = useSelectedVehicle()
  if (!carReady) return <CarGate title="Le mie auto">{() => null}</CarGate>

  const related = (id: Row['id']) => [rows.car_deadlines, rows.car_services, rows.car_expenses, rows.car_fuel, rows.car_docs].reduce((a, l) => a + l.filter((r) => r.vehicle_id === id).length, 0)
  return (
    <CrudPage
      title="Le mie auto"
      intro="Aggiungi o modifica le tue auto. Serve solo il nome: il resto lo puoi completare dopo."
      table="vehicles"
      addLabel="Aggiungi auto"
      emptyIcon="🚗"
      emptyText="Nessuna auto. Aggiungi la prima: basta un nome o un soprannome."
      defaults={{ nome: '', marca: '', modello: '', targa: '', anno: '', alimentazione: ALIMENTAZIONI[0], km: '', km_data: '', note: '' }}
      // chi cambia i chilometri senza indicare la data: la data è oggi
      derive={(f, k) => (k === 'km' ? { ...f, km_data: f.km ? todayISO() : '' } : f)}
      validate={(f) => (f.anno && (Number(f.anno) < 1900 || Number(f.anno) > new Date().getFullYear() + 1) ? 'Controlla l’anno dell’auto.' : null)}
      onSaved={async (_f, saved) => {
        if (saved) select(saved.id) // la nuova auto diventa quella visualizzata
        return 'La trovi nella schermata Car.'
      }}
      deleteWarning={(r) => `Eliminare «${r.nome}» e tutto ciò che la riguarda (${related(r.id)} registrazioni tra scadenze, interventi, spese, rifornimenti e documenti)?`}
      fields={[
        { key: 'nome', label: 'Nome o soprannome', type: 'text', required: true, role: 'title', placeholder: 'Es. La Panda' },
        { key: 'marca', label: 'Marca', type: 'text' },
        { key: 'modello', label: 'Modello', type: 'text' },
        { key: 'targa', label: 'Targa', type: 'text' },
        { key: 'anno', label: 'Anno', type: 'number', step: '1', format: 'plain' },
        { key: 'alimentazione', label: 'Alimentazione', type: 'select', options: ALIMENTAZIONI },
        { key: 'km', label: 'Chilometri attuali', type: 'number', step: '1', format: 'km' },
        { key: 'km_data', label: 'Chilometri aggiornati il', type: 'date' },
        { key: 'note', label: 'Note', type: 'text' },
      ]}
    />
  )
}

/* ---------- Registrazioni dell'auto scelta ---------- */

/** Dopo un intervento o un rifornimento con più km di quelli salvati, aggiorna l'auto. */
function useKmUpdate(v: Row) {
  const { update } = useData()
  return async (f: NewRow) => {
    const km = Math.round(Number(f.km || 0))
    if (km <= Number(v.km || 0)) return
    await update('vehicles', v.id, { km, km_data: String(f.data || todayISO()) })
    return `Chilometraggio dell’auto aggiornato a ${fmtNum(km)} km.`
  }
}

const noteField: Field = { key: 'note', label: 'Note', type: 'text' }

export function CarScadenze() {
  return (
    <CarGate title="Scadenze auto">{(v) => (
      <div>
        <div className="bg-white rounded-xl shadow p-3 mb-3">
          <p className="text-sm font-medium mb-2">Nuovo promemoria</p>
          <div className="flex flex-wrap gap-2">
            {TIPI_SCADENZA_AUTO.map((t) => <Link key={t} to={`/car/scadenze?nuovo=1&tipo=${encodeURIComponent(t)}`} className="rounded-full bg-slate-100 px-3 py-2 text-sm min-h-[40px] inline-flex items-center">＋ {t}</Link>)}
          </div>
          <details className="mt-2 text-sm text-slate-600">
            <summary className="py-2 cursor-pointer">Come vengono calcolate</summary>
            <p>L’app non calcola scadenze di legge: copia la data o i chilometri da libretto, polizza, ricevuta del bollo o libretto di manutenzione. {RULE_TEXT} I promemoria si vedono aprendo l’app: non arrivano notifiche.</p>
          </details>
        </div>
        <CrudPage
          key={String(v.id)}
          title="Scadenze e manutenzioni"
          table="car_deadlines"
          addLabel="Aggiungi scadenza"
          emptyIcon="📅"
          emptyText="Nessuna scadenza per questa auto. Aggiungi revisione, assicurazione, bollo, tagliando o cambio gomme."
          only={(r) => r.vehicle_id === v.id}
          defaults={{ vehicle_id: v.id, titolo: '', tipo: TIPI_SCADENZA_AUTO[0], data: '', km: '', note: '', fatto: false }}
          doneKey="fatto"
          doneLabels={{ todo: 'Da fare', done: 'Fatte', action: 'Segna come fatta', undo: 'Rimetti da fare' }}
          status={(r) => deadlineStatus(r, v)}
          validate={(f) => (!f.data && !Number(f.km) ? 'Indica la data prevista oppure i chilometri previsti (almeno uno dei due).' : null)}
          fields={[
            { key: 'titolo', label: 'Cosa devi fare', type: 'text', required: true, role: 'title' },
            { key: 'tipo', label: 'Tipo', type: 'select', options: TIPI_SCADENZA_AUTO },
            { key: 'data', label: 'Data prevista', type: 'date', role: 'due' },
            { key: 'km', label: 'Chilometri previsti', type: 'number', step: '1', format: 'km', hint: v.km ? `Oggi l’auto segna ${fmtNum(v.km)} km.` : 'Inserisci anche i km attuali dell’auto per sapere quanto manca.' },
            noteField,
            { key: 'fatto', label: 'Già fatta', type: 'checkbox' },
          ]}
        />
      </div>
    )}</CarGate>
  )
}

function Services({ v }: { v: Row }) {
  const onSaved = useKmUpdate(v)
  return (
    <CrudPage
      title="Interventi"
      intro="Il registro di tagliandi, riparazioni e gomme."
      table="car_services"
      addLabel="Aggiungi intervento"
      emptyIcon="🔧"
      emptyText="Nessun intervento registrato per questa auto."
      only={(r) => r.vehicle_id === v.id}
      sortDesc="data"
      defaults={{ vehicle_id: v.id, descrizione: '', data: todayISO(), km: v.km || '', officina: '', costo: '', note: '' }}
      onSaved={onSaved}
      summary={(list) => `Costo totale: ${fmtEuro(list.reduce((a, r) => a + Number(r.costo || 0), 0))}`}
      fields={[
        { key: 'descrizione', label: 'Descrizione', type: 'text', required: true, role: 'title', placeholder: 'Es. Tagliando completo' },
        { key: 'data', label: 'Data', type: 'date', required: true },
        { key: 'km', label: 'Chilometri', type: 'number', step: '1', format: 'km', hint: KM_HINT },
        { key: 'officina', label: 'Officina', type: 'text' },
        { key: 'costo', label: 'Costo (€)', type: 'number', format: 'euro' },
        noteField,
      ]}
    />
  )
}
export const CarInterventi = () => <CarGate title="Interventi">{(v) => <Services key={String(v.id)} v={v} />}</CarGate>

/** Totale = litri × prezzo al litro, finché i due valori ci sono; resta modificabile. */
const fuelDerive = (f: NewRow, changed: string): NewRow => {
  const l = Number(String(f.litri).replace(',', '.')), p = Number(String(f.prezzo).replace(',', '.'))
  return (changed === 'litri' || changed === 'prezzo') && l > 0 && p > 0 ? { ...f, importo: Math.round(l * p * 100) / 100 } : f
}

function Fuel({ v }: { v: Row }) {
  const onSaved = useKmUpdate(v)
  return (
    <CrudPage
      title="Rifornimenti"
      intro="Carburante (o ricariche): inserisci ciò che hai a disposizione."
      table="car_fuel"
      addLabel="Aggiungi rifornimento"
      emptyIcon="⛽"
      emptyText="Nessun rifornimento registrato per questa auto."
      only={(r) => r.vehicle_id === v.id}
      sortDesc="data"
      defaults={{ vehicle_id: v.id, data: todayISO(), litri: '', prezzo: '', importo: '', km: v.km || '', note: '' }}
      derive={fuelDerive}
      validate={(f) => (!Number(f.litri) && !Number(f.importo) ? 'Indica almeno i litri o il totale pagato.' : null)}
      onSaved={onSaved}
      summary={(list) => `Totale: ${fmtEuro(list.reduce((a, r) => a + Number(r.importo || 0), 0))} · ${fmtNum(list.reduce((a, r) => a + Number(r.litri || 0), 0))} litri`}
      fields={[
        { key: 'data', label: 'Data', type: 'date', required: true, role: 'title' },
        { key: 'litri', label: 'Litri', type: 'number', format: 'litri', hint: 'Per le auto elettriche puoi scrivere qui i kWh e indicarlo nelle note.' },
        { key: 'prezzo', label: 'Prezzo al litro (€)', type: 'number', step: '0.001', format: 'prezzo' },
        { key: 'importo', label: 'Totale pagato (€)', type: 'number', format: 'euro', hint: 'Calcolato da litri × prezzo, ma puoi correggerlo.' },
        { key: 'km', label: 'Chilometri', type: 'number', step: '1', format: 'km', hint: KM_HINT },
        noteField,
      ]}
    />
  )
}
export const CarRifornimenti = () => <CarGate title="Rifornimenti">{(v) => <Fuel key={String(v.id)} v={v} />}</CarGate>

export const CarSpese = () => (
  <CarGate title="Spese auto">{(v) => (
    <CrudPage
      key={String(v.id)}
      title="Spese del veicolo"
      intro="Assicurazione, bollo, parcheggi e altro. Carburante e interventi hanno le loro sezioni: non ripeterli qui."
      table="car_expenses"
      addLabel="Aggiungi spesa"
      emptyIcon="💶"
      emptyText="Nessuna spesa registrata per questa auto."
      only={(r) => r.vehicle_id === v.id}
      sortDesc="data"
      defaults={{ vehicle_id: v.id, descrizione: '', categoria: CATEGORIE_AUTO[0], importo: '', data: todayISO(), note: '' }}
      filterField="categoria"
      filterAll="Tutte le categorie"
      summary={(list) => `Totale: ${fmtEuro(list.reduce((a, r) => a + Number(r.importo || 0), 0))}`}
      fields={[
        { key: 'descrizione', label: 'Descrizione', type: 'text', required: true, role: 'title', placeholder: 'Es. Polizza annuale' },
        { key: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIE_AUTO },
        { key: 'importo', label: 'Importo (€)', type: 'number', format: 'euro' },
        { key: 'data', label: 'Data', type: 'date', required: true },
        noteField,
      ]}
    />
  )}</CarGate>
)

export const CarDocumenti = () => (
  <CarGate title="Documenti auto">{(v) => (
    <CrudPage
      key={String(v.id)}
      title="Documenti e note utili"
      intro="Assicurazione, revisione, garanzia, soccorso stradale: si salvano solo dati, numeri e link, non i file."
      table="car_docs"
      addLabel="Aggiungi documento"
      emptyIcon="📄"
      emptyText="Nessun documento. Aggiungi per esempio la polizza o il numero del soccorso stradale."
      only={(r) => r.vehicle_id === v.id}
      defaults={{ vehicle_id: v.id, titolo: '', tipo: TIPI_DOC_AUTO[0], scadenza: '', telefono: '', link: '', note: '' }}
      fields={[
        { key: 'titolo', label: 'Titolo', type: 'text', required: true, role: 'title' },
        { key: 'tipo', label: 'Tipo', type: 'select', options: TIPI_DOC_AUTO },
        { key: 'scadenza', label: 'Scadenza', type: 'date', role: 'due' },
        { key: 'telefono', label: 'Telefono utile', type: 'tel' },
        { key: 'link', label: 'Link al documento', type: 'text', placeholder: 'https://…' },
        noteField,
      ]}
    />
  )}</CarGate>
)

export function CarAltro() {
  const links: [string, string, string, string][] = [
    ['/car/spese', '💶', 'Spese del veicolo', 'Assicurazione, bollo, parcheggi…'],
    ['/car/documenti', '📄', 'Documenti e note', 'Polizza, garanzia, soccorso stradale'],
    ['/car/veicoli', '🚗', 'Le mie auto', 'Aggiungi, modifica o elimina'],
    ['/assistente?area=car', '✨', 'Assistente', 'Domande sui tuoi dati'],
    ['/casa', '⚙️', MODE === 'cloud' ? 'Il mio account' : 'Impostazioni', 'Nome della casa e accesso'],
    ['/backup', '💾', 'Backup e importazione', 'Salva o ripristina i dati'],
  ]
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-3">Altro</h1>
      <ul className="space-y-2">
        {links.map(([to, icon, name, desc]) => (
          <li key={to}>
            <Link to={to} className="bg-white rounded-xl shadow p-4 flex items-center gap-3 min-h-[64px] active:bg-slate-50">
              <span className="text-2xl" aria-hidden>{icon}</span>
              <span><span className="block font-medium">{name}</span><span className="block text-sm text-slate-500">{desc}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
