import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import CrudPage, { btn, inputCls } from './CrudPage'
import { useAccount } from './account'
import { readLegacyBrowserData } from './data/localBackend'
import { useData } from './data/store'
import { normalize, missingRequired, parseBackup, TABLE_LABEL, TABLES, type NewRow, type Row, type TableName } from './data/model'
import { CATEGORIE_SPESE } from './db'
import { ASSISTANT_ENABLED, MODE } from './lib/config'
import { addDaysISO, fmtDate, fmtEuro, relativeDue, todayISO } from './lib/format'

const Page = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h1 className="text-2xl font-semibold mb-3">{title}</h1>
    {children}
  </div>
)
const Card = ({ children, tone = 'white' }: { children: React.ReactNode; tone?: 'white' | 'amber' | 'red' | 'green' }) => (
  <div className={`rounded-xl shadow p-4 mb-4 ${{ white: 'bg-white', amber: 'bg-amber-50 border border-amber-200 text-amber-900', red: 'bg-red-50 border border-red-200 text-red-800', green: 'bg-green-50 border border-green-200 text-green-800' }[tone]}`}>{children}</div>
)

/* ---------- Sezioni con elenco ---------- */

export function Spese() {
  return (
    <CrudPage
      title="Spese e bollette"
      intro="Registra le bollette e le spese di casa e segna quelle pagate."
      table="expenses"
      addLabel="Aggiungi spesa"
      emptyIcon="💶"
      emptyText="Nessuna spesa registrata. Inizia aggiungendo una bolletta o una spesa di casa."
      defaults={{ descrizione: '', categoria: CATEGORIE_SPESE[0], importo: '', data: todayISO(), scadenza: '', pagata: false }}
      doneKey="pagata"
      doneLabels={{ todo: 'Da pagare', done: 'Pagate', action: 'Segna come pagata', undo: 'Segna da pagare' }}
      filterField="categoria"
      filterAll="Tutte le categorie"
      summary={(rows) => {
        const tot = rows.reduce((a, r) => a + Number(r.importo || 0), 0)
        const open = rows.filter((r) => !r.pagata).reduce((a, r) => a + Number(r.importo || 0), 0)
        return `Totale: ${fmtEuro(tot)} · ancora da pagare: ${fmtEuro(open)}`
      }}
      fields={[
        { key: 'descrizione', label: 'Descrizione', type: 'text', required: true, role: 'title', placeholder: 'Es. Bolletta luce' },
        { key: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIE_SPESE },
        { key: 'importo', label: 'Importo', type: 'number', format: 'euro', placeholder: 'Es. 82,50' },
        { key: 'data', label: 'Data della spesa', type: 'date' },
        { key: 'scadenza', label: 'Scadenza di pagamento', type: 'date', role: 'due' },
        { key: 'pagata', label: 'Già pagata', type: 'checkbox' },
      ]}
    />
  )
}

export const Scadenze = () => (
  <CrudPage
    title="Scadenze e manutenzioni"
    intro="Tasse, controlli, tagliandi e lavori da non dimenticare."
    table="deadlines"
    addLabel="Aggiungi scadenza"
    emptyIcon="📅"
    emptyText="Nessuna scadenza. Aggiungi per esempio la revisione della caldaia o il rinnovo di un’assicurazione."
    defaults={{ titolo: '', tipo: 'Scadenza', data: todayISO(), note: '', fatto: false }}
    doneKey="fatto"
    doneLabels={{ todo: 'Da fare', done: 'Fatte', action: 'Segna come fatta', undo: 'Rimetti da fare' }}
    fields={[
      { key: 'titolo', label: 'Cosa devi fare', type: 'text', required: true, role: 'title' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Scadenza', 'Manutenzione'] },
      { key: 'data', label: 'Data', type: 'date', required: true, role: 'due' },
      { key: 'note', label: 'Note', type: 'text' },
      { key: 'fatto', label: 'Già fatta', type: 'checkbox' },
    ]}
  />
)

export const Inventario = () => (
  <CrudPage
    title="Inventario"
    intro="Cosa c’è in casa e dove si trova."
    table="items"
    addLabel="Aggiungi oggetto"
    emptyIcon="📦"
    emptyText="L’inventario è vuoto. Aggiungi elettrodomestici, attrezzi o altri oggetti, con la stanza in cui si trovano."
    defaults={{ nome: '', stanza: '', quantita: '1', valore: '', note: '' }}
    fields={[
      { key: 'nome', label: 'Oggetto', type: 'text', required: true, role: 'title' },
      { key: 'stanza', label: 'Stanza', type: 'text', placeholder: 'Es. Cucina' },
      { key: 'quantita', label: 'Quantità', type: 'number', format: 'number' },
      { key: 'valore', label: 'Valore', type: 'number', format: 'euro' },
      { key: 'note', label: 'Note', type: 'text' },
    ]}
  />
)

export const ListaSpesa = () => (
  <CrudPage
    title="Lista della spesa"
    intro="Scrivi cosa comprare e spunta quello che hai preso."
    table="shopping"
    addLabel="Aggiungi articolo"
    emptyIcon="🛒"
    emptyText="La lista è vuota. Aggiungi gli articoli da comprare."
    defaults={{ nome: '', quantita: '1', preso: false }}
    doneKey="preso"
    doneLabels={{ todo: 'Da comprare', done: 'Presi', action: 'Preso', undo: 'Rimetti in lista' }}
    fields={[
      { key: 'nome', label: 'Articolo', type: 'text', required: true, role: 'title' },
      { key: 'quantita', label: 'Quantità', type: 'text' },
      { key: 'preso', label: 'Già preso', type: 'checkbox' },
    ]}
  />
)

export const Documenti = () => (
  <CrudPage
    title="Documenti della casa"
    intro="Contratti, garanzie e polizze: qui si salvano solo il titolo, la scadenza e il link, non i file."
    table="docs"
    addLabel="Aggiungi documento"
    emptyIcon="📄"
    emptyText="Nessun documento. Aggiungi contratti, garanzie o assicurazioni con un link per ritrovarli."
    defaults={{ titolo: '', tipo: 'Contratto', link: '', scadenza: '', note: '' }}
    fields={[
      { key: 'titolo', label: 'Titolo', type: 'text', required: true, role: 'title' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Contratto', 'Garanzia', 'Assicurazione', 'Fattura', 'Altro'] },
      { key: 'link', label: 'Link al documento', type: 'text', placeholder: 'https://…' },
      { key: 'scadenza', label: 'Scadenza', type: 'date', role: 'due' },
      { key: 'note', label: 'Note', type: 'text' },
    ]}
  />
)

/* ---------- Dashboard ---------- */

interface Entry { key: string; table: TableName; id: Row['id']; label: string; date: string; amount?: number; kind: string; doneKey?: string; doneLabel?: string }

export function Dashboard() {
  const { rows, homeName, status, loadError, reload, update } = useData()
  const [err, setErr] = useState('')
  const t = todayISO(), limit = addDaysISO(30)

  if (status === 'loading') return <p className="text-slate-500 p-4" role="status">Caricamento dei dati…</p>
  if (status === 'error')
    return (
      <Card tone="red">
        <p className="font-medium mb-2">Non riesco a caricare i tuoi dati.</p>
        <p className="text-sm mb-3">{loadError}</p>
        <button className={`${btn} bg-red-600 text-white`} onClick={() => void reload()}>Riprova</button>
      </Card>
    )

  const unpaid: Entry[] = rows.expenses.filter((e) => !e.pagata).map((e) => ({
    key: 'e' + e.id, table: 'expenses', id: e.id, label: String(e.descrizione), date: String(e.scadenza || ''), amount: Number(e.importo || 0),
    kind: String(e.categoria), doneKey: 'pagata', doneLabel: 'Pagata',
  }))
  const todo: Entry[] = rows.deadlines.filter((d) => !d.fatto).map((d) => ({
    key: 'd' + d.id, table: 'deadlines', id: d.id, label: String(d.titolo), date: String(d.data), kind: String(d.tipo), doneKey: 'fatto', doneLabel: 'Fatta',
  }))
  const docs: Entry[] = rows.docs.filter((d) => d.scadenza).map((d) => ({
    key: 'c' + d.id, table: 'docs', id: d.id, label: String(d.titolo), date: String(d.scadenza), kind: 'Documento in scadenza',
  }))
  const byDate = (a: Entry, b: Entry) => (a.date || '9999').localeCompare(b.date || '9999')
  const overdue = [...unpaid, ...todo, ...docs].filter((e) => e.date && e.date < t).sort(byDate)
  const toPay = unpaid.filter((e) => !e.date || e.date >= t).sort(byDate)
  const upcoming = [...todo, ...docs].filter((e) => e.date >= t && e.date <= limit).sort(byDate)
  const toBuy = rows.shopping.filter((s) => !s.preso).length
  const empty = TABLES.every((tb) => rows[tb].length === 0)

  async function complete(e: Entry) {
    setErr('')
    try { await update(e.table, e.id, { [e.doneKey!]: true }) } catch (ex) { setErr((ex as Error).message) }
  }

  const list = (entries: Entry[], tone: 'red' | 'normal') => (
    <ul className="bg-white rounded-xl shadow divide-y">
      {entries.map((e) => (
        <li key={e.key} className="p-3 flex items-center gap-2 justify-between">
          <div className="min-w-0">
            <div className="font-medium break-words">{e.label}</div>
            <div className="text-sm text-slate-500">
              {e.kind}{e.amount ? ` · ${fmtEuro(e.amount)}` : ''}
              {e.date ? <span className={tone === 'red' ? 'text-red-600' : ''}> · {fmtDate(e.date)} ({relativeDue(e.date)})</span> : ' · senza scadenza'}
            </div>
          </div>
          {e.doneKey && <button className={`${btn} bg-green-600 text-white shrink-0`} onClick={() => complete(e)}>{e.doneLabel}</button>}
        </li>
      ))}
    </ul>
  )

  return (
    <div>
      <h1 className="text-2xl font-semibold">{homeName}</h1>
      <p className="text-sm text-slate-500 mb-4">Ecco cosa richiede la tua attenzione.</p>
      {err && <Card tone="red"><span role="alert">{err}</span></Card>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {([['/spese?nuovo=1', '💶', 'Nuova spesa'], ['/scadenze?nuovo=1', '📅', 'Nuova scadenza'], ['/lista?nuovo=1', '🛒', 'Articolo spesa'], ['/inventario?nuovo=1', '📦', 'Nuovo oggetto']] as const).map(([to, icon, label]) => (
          <Link key={to} to={to} className="bg-white rounded-xl shadow p-3 flex items-center gap-2 min-h-[56px] active:bg-slate-50">
            <span className="text-2xl" aria-hidden>{icon}</span><span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {empty && (
        <Card tone="green">
          <h2 className="font-semibold mb-1">Benvenuto! La tua casa è ancora vuota.</h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 mb-3">
            <li>Dai un nome alla casa in <Link className="underline" to="/casa">La mia casa</Link>.</li>
            <li>Aggiungi la prima bolletta o spesa e la sua scadenza.</li>
            <li>Segna le scadenze di manutenzione (caldaia, revisioni…).</li>
            <li>Usa la lista della spesa e l’inventario quando ti serve.</li>
          </ol>
          <p className="text-sm">Hai già dei dati? Importali dalla pagina <Link className="underline" to="/backup">Backup e importazione</Link>.</p>
        </Card>
      )}

      {overdue.length > 0 && (<><h2 className="font-semibold text-red-700 mb-2">⚠ Arretrati ({overdue.length})</h2><div className="mb-5">{list(overdue, 'red')}</div></>)}

      <h2 className="font-semibold mb-2">Pagamenti da fare{toPay.length > 0 && <span className="font-normal text-slate-500"> · {fmtEuro(toPay.reduce((a, e) => a + (e.amount ?? 0), 0))}</span>}</h2>
      <div className="mb-5">{toPay.length ? list(toPay, 'normal') : <p className="text-sm text-slate-500 bg-white rounded-xl shadow p-3">Nessun pagamento in sospeso. 🎉</p>}</div>

      <h2 className="font-semibold mb-2">In arrivo nei prossimi 30 giorni</h2>
      <div className="mb-5">{upcoming.length ? list(upcoming, 'normal') : <p className="text-sm text-slate-500 bg-white rounded-xl shadow p-3">Niente in scadenza nel prossimo mese.</p>}</div>

      <Link to="/lista" className="block bg-white rounded-xl shadow p-3 min-h-[56px]">
        🛒 <b>Lista della spesa:</b> {toBuy ? `${toBuy} ${toBuy === 1 ? 'articolo' : 'articoli'} da comprare` : 'niente da comprare'}
      </Link>
    </div>
  )
}

/* ---------- Altro / La mia casa ---------- */

export function Altro() {
  const links: [string, string, string, string][] = [
    ['/inventario', '📦', 'Inventario', 'Cosa c’è in casa e dove'],
    ['/documenti', '📄', 'Documenti', 'Contratti, garanzie, polizze'],
    ['/assistente', '✨', 'Assistente', 'Domande sui tuoi dati'],
    ['/casa', '🏠', 'La mia casa', MODE === 'cloud' ? 'Nome della casa e account' : 'Nome della casa'],
    ['/backup', '💾', 'Backup e importazione', 'Salva o ripristina i dati'],
  ]
  return (
    <Page title="Altro">
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
    </Page>
  )
}

export function Casa() {
  const { homeName, renameHome } = useData()
  const acc = useAccount()
  const [name, setName] = useState(homeName)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pw, setPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function saveName(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setMsg({ ok: false, text: 'Scrivi un nome per la casa.' })
    try { await renameHome(name.trim()); setMsg({ ok: true, text: 'Nome salvato.' }) } catch (ex) { setMsg({ ok: false, text: (ex as Error).message }) }
  }
  async function savePw(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 8) return setPwMsg({ ok: false, text: 'La password deve avere almeno 8 caratteri.' })
    try { await acc.changePassword!(pw); setPw(''); setPwMsg({ ok: true, text: 'Password cambiata.' }) } catch { setPwMsg({ ok: false, text: 'Non riesco a cambiare la password. Riprova o esci e rientra.' }) }
  }
  const note = (m: typeof msg) => m && <p role="status" className={`text-sm mt-2 ${m.ok ? 'text-green-700' : 'text-red-700'}`}>{m.text}</p>

  return (
    <Page title="La mia casa">
      <Card>
        <form onSubmit={saveName}>
          <label className="text-sm text-slate-600">Nome della casa
            <input className={`${inputCls} mt-1`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className={`${btn} bg-blue-600 text-white mt-3`}>Salva il nome</button>
          {note(msg)}
        </form>
      </Card>
      {MODE === 'cloud' ? (
        <>
          <Card>
            <h2 className="font-semibold mb-1">Il tuo account</h2>
            <p className="text-sm text-slate-600 mb-1">Hai effettuato l’accesso come <b className="break-all">{acc.email}</b>.</p>
            <p className="text-sm text-slate-500 mb-3">Questa casa è privata: la vedi solo tu, da tutti i dispositivi in cui accedi con questo account.</p>
            <button className={`${btn} bg-slate-100 text-slate-800`} onClick={() => void acc.signOut?.()}>Esci dall’account</button>
          </Card>
          <Card>
            <form onSubmit={savePw}>
              <h2 className="font-semibold mb-1">Cambia password</h2>
              <input className={inputCls} type="password" autoComplete="new-password" placeholder="Nuova password (almeno 8 caratteri)" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button className={`${btn} bg-slate-100 text-slate-800 mt-3`}>Cambia password</button>
              {note(pwMsg)}
            </form>
          </Card>
        </>
      ) : (
        <Card tone="amber">{MODE === 'demo' ? 'Stai usando la demo: non c’è nessun account. I dati restano in questo browser.' : 'Uso locale: i dati restano su questo computer.'}</Card>
      )}
    </Page>
  )
}

/* ---------- Backup e importazione ---------- */

interface Preview { source: string; rows: Record<TableName, NewRow[]>; total: number; skipped: number }

function download(name: string, payload: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Backup() {
  const { rows, homeName, addMany } = useData()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function exportAll() {
    const data: Record<string, NewRow[]> = {}
    for (const t of TABLES) data[t] = rows[t].map((r) => normalize(t, r))
    download(`home-manager-backup-${todayISO()}.json`, { app: 'home-manager', version: 2, exportedAt: new Date().toISOString(), homeName, data })
    setMsg({ ok: true, text: 'Backup scaricato. Conservalo in un posto sicuro: contiene i dati della tua casa.' })
  }

  async function onFile(file?: File) {
    setMsg(null); setPreview(null)
    if (!file) return
    if (file.size > 10e6) return setMsg({ ok: false, text: 'Il file è troppo grande per essere un backup di Home Manager.' })
    try {
      const p = parseBackup(await file.text())
      if (p.total === 0) return setMsg({ ok: false, text: 'Il file è valido ma non contiene elementi da importare.' })
      setPreview({ source: `file «${file.name}»`, ...p })
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'File non leggibile.' }) }
  }

  async function fromBrowser() {
    setMsg(null); setPreview(null)
    const legacy = await readLegacyBrowserData()
    if (!legacy) return setMsg({ ok: false, text: 'In questo browser non ci sono dati salvati dalle versioni precedenti.' })
    const out = {} as Record<TableName, NewRow[]>
    let total = 0, skipped = 0
    for (const t of TABLES) {
      out[t] = []
      for (const r of legacy[t]) { const n = normalize(t, r); if (missingRequired(t, n).length) skipped++; else { out[t].push(n); total++ } }
    }
    setPreview({ source: 'i dati salvati in questo browser', rows: out, total, skipped })
  }

  async function confirmImport() {
    if (!preview) return
    setBusy(true)
    try {
      await addMany(preview.rows)
      setMsg({ ok: true, text: `Importazione completata: ${preview.total} elementi aggiunti.` })
      setPreview(null)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <Page title="Backup e importazione">
      <Card>
        <h2 className="font-semibold mb-1">Salva una copia</h2>
        <p className="text-sm text-slate-500 mb-3">Scarica tutti i dati della tua casa in un file JSON.</p>
        <button className={`${btn} bg-blue-600 text-white`} onClick={exportAll}>Scarica il backup</button>
      </Card>
      <Card>
        <h2 className="font-semibold mb-1">Importa dati esistenti</h2>
        <p className="text-sm text-slate-500 mb-3">
          Scegli da dove prendere i dati: vedrai un’anteprima e non verrà importato nulla finché non confermi.
          Gli elementi vengono <b>aggiunti</b> a quelli già presenti, senza cancellare niente.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className={`${btn} bg-slate-100 text-slate-800 cursor-pointer inline-flex items-center`}>
            Scegli un file di backup
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {MODE === 'cloud' && <button className={`${btn} bg-slate-100 text-slate-800`} onClick={() => void fromBrowser()}>Cerca dati salvati in questo browser</button>}
        </div>
        {MODE === 'cloud' && <p className="text-xs text-slate-500 mt-2">I dati della demo (fittizi) o delle vecchie versioni restano nel browser: vengono caricati nel tuo account solo se li scegli qui.</p>}
      </Card>

      {preview && (
        <Card tone="amber">
          <h2 className="font-semibold mb-2">Anteprima: {preview.source}</h2>
          <ul className="text-sm mb-2 space-y-0.5">
            {TABLES.filter((t) => preview.rows[t].length).map((t) => (
              <li key={t}><b>{preview.rows[t].length}</b> · {TABLE_LABEL[t]}
                <span className="text-amber-800/80"> — es. {preview.rows[t].slice(0, 3).map((r) => String(r.descrizione ?? r.titolo ?? r.nome)).join(', ')}</span>
              </li>
            ))}
          </ul>
          {preview.skipped > 0 && <p className="text-sm mb-2">{preview.skipped} elementi incompleti verranno ignorati.</p>}
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} bg-blue-600 text-white disabled:opacity-60`} disabled={busy} onClick={() => void confirmImport()}>{busy ? 'Importazione…' : `Importa ${preview.total} elementi nella mia casa`}</button>
            <button className={`${btn} bg-white text-slate-700`} onClick={() => setPreview(null)}>Annulla</button>
          </div>
        </Card>
      )}
      {msg && <Card tone={msg.ok ? 'green' : 'red'}><span role="status">{msg.text}</span></Card>}
    </Page>
  )
}

/* ---------- Assistente ---------- */

async function askAssistant(question: string, context: unknown): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (MODE === 'local') {
    const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context }) })
    return res.json()
  }
  const { getClient } = await import('./lib/supabase')
  const { data, error } = await getClient().functions.invoke('assistente', { body: { question, context } })
  if (error) return { ok: false, error: 'Il servizio dell’assistente non risponde. Riprova più tardi.' }
  return data
}

const SUGGESTIONS = ['Cosa scade nei prossimi 30 giorni?', 'Quali bollette devo ancora pagare?', 'Quanto ho speso per ogni categoria?', 'Cosa devo comprare?']

export function Assistente() {
  const { rows } = useData()
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (MODE === 'demo')
    return (
      <Page title="Assistente">
        <Card tone="amber">
          <p className="font-medium mb-1">Assistente disattivato nella demo</p>
          <p className="text-sm">Nella versione con account, l’assistente risponde alle domande sui dati della tua casa. Qui non è attivo e nessun dato viene inviato.</p>
        </Card>
      </Page>
    )
  if (MODE === 'cloud' && !ASSISTANT_ENABLED)
    return (
      <Page title="Assistente">
        <Card tone="amber">
          <p className="font-medium mb-1">Assistente non ancora attivo</p>
          <p className="text-sm">Per attivarlo serve un passaggio di configurazione sul servizio online (vedi <code>docs/configurazione-supabase.md</code>, sezione «Assistente»). Finché non è attivo non viene inviato nessun dato.</p>
        </Card>
      </Page>
    )

  const context = {
    oggi: todayISO(),
    spese: rows.expenses.map((r) => normalize('expenses', r)),
    scadenze: rows.deadlines.map((r) => normalize('deadlines', r)),
    inventario: rows.items.map((r) => normalize('items', r)),
    listaSpesa: rows.shopping.map((r) => normalize('shopping', r)),
    documenti: rows.docs.map(({ link: _link, ...r }) => normalize('docs', r)),
  }

  async function ask() {
    if (!q.trim() || loading) return
    setLoading(true); setError(''); setAnswer('')
    try {
      const r = await askAssistant(q.trim(), context)
      if (r.ok) setAnswer(r.text ?? ''); else setError(r.error ?? 'Non sono riuscito a ottenere una risposta.')
    } catch {
      setError(navigator.onLine ? 'Non sono riuscito a contattare l’assistente. Riprova più tardi.' : 'Senza connessione: controlla internet e riprova.')
    } finally { setLoading(false) }
  }

  return (
    <Page title="Assistente">
      <Card>
        <p className="text-sm font-medium mb-1">Quali dati vengono inviati</p>
        <p className="text-sm text-slate-600">
          Solo quando premi «Chiedi», la tua domanda e questi dati della casa vengono inviati al servizio Google Gemini per preparare la risposta:{' '}
          {rows.expenses.length} spese, {rows.deadlines.length} scadenze, {rows.items.length} oggetti, {rows.shopping.length} articoli della spesa e {rows.docs.length} documenti
          (titolo, tipo, scadenza e note; i link ai documenti non vengono inviati). Se non vuoi inviarli, non usare questa funzione.
        </p>
      </Card>
      <div className="flex flex-wrap gap-2 mb-2">
        {SUGGESTIONS.map((s) => <button key={s} className="rounded-full bg-white shadow px-3 py-2 text-sm" onClick={() => setQ(s)}>{s}</button>)}
      </div>
      <textarea className={inputCls} rows={3} value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} placeholder="Scrivi la tua domanda…" aria-label="Domanda" />
      <button className={`${btn} bg-blue-600 text-white mt-2 disabled:opacity-60`} disabled={loading || !q.trim()} onClick={() => void ask()}>{loading ? 'Attendi…' : 'Chiedi (invia i dati a Gemini)'}</button>
      {error && <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {answer && <div className="mt-4 bg-white shadow rounded-xl p-4 text-sm whitespace-pre-wrap">{answer}</div>}
    </Page>
  )
}
