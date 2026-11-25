import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { btn, inputCls } from './CrudPage'
import { useData } from './data/store'
import { MODE } from './lib/config'
import { buildContext, pickSections, SECTIONS, type SectionId } from './lib/assistantData'

type Status = 'checking' | 'ready' | 'no-key' | 'unreachable'
interface Answer { ok: boolean; text?: string; error?: string; hasKey?: boolean; hint?: string }

async function callAssistant(body: unknown): Promise<Answer> {
  if (MODE === 'local') {
    const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  }
  const { getClient } = await import('./lib/supabase')
  const { data, error } = await getClient().functions.invoke('assistente', { body: body as Record<string, unknown> })
  if (error) {
    // se la funzione ha risposto con un messaggio comprensibile lo si mostra
    const answer = await (error as { context?: Response }).context?.json?.().catch(() => null)
    if (answer?.error) return { ok: false, error: String(answer.error) }
    throw error
  }
  return data as Answer
}

const Warning = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl shadow p-4 mb-4 bg-amber-50 border border-amber-200 text-amber-900">
    <p className="font-medium mb-1">{title}</p>
    <div className="text-sm space-y-2">{children}</div>
  </div>
)

/** Inserimento (o sostituzione) della chiave Gemini personale. Il valore non resta nel browser. */
function KeyForm({ onSaved, onCancel }: { onSaved: (hint: string) => void; onCancel?: () => void }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!key.trim()) return setErr('Incolla la tua chiave Gemini.')
    setBusy(true); setErr('')
    try {
      const r = await callAssistant({ action: 'saveKey', key: key.trim() })
      if (r.ok) { setKey(''); onSaved(r.hint ?? '') } else setErr(r.error ?? 'Non sono riuscito a salvare la chiave.')
    } catch { setErr(navigator.onLine ? 'Non sono riuscito a salvare la chiave. Riprova più tardi.' : 'Senza connessione: controlla internet e riprova.') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} noValidate className="bg-white rounded-xl shadow p-4 mb-4">
      <h2 className="font-semibold mb-1">La tua chiave Gemini</h2>
      <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1 mb-3">
        <li>Apri <a className="text-blue-600 underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a> con il tuo account Google.</li>
        <li>Scegli <b>Crea chiave API</b> e copiala.</li>
        <li>Incollala qui sotto e salva.</li>
      </ol>
      <label className="text-sm text-slate-600">Chiave API
        <input className={`${inputCls} mt-1`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <p className="text-xs text-slate-500 mt-2">La chiave è solo tua: viene verificata, salvata cifrata sul server, non viene più mostrata e non è condivisa con altri utenti. Le richieste usano la quota del tuo account Google; con il piano gratuito Google può usare i dati inviati per migliorare i suoi servizi.</p>
      {err && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">{err}</p>}
      <div className="flex gap-2 mt-3">
        <button className={`${btn} bg-blue-600 text-white disabled:opacity-60`} disabled={busy}>{busy ? 'Verifica in corso…' : 'Salva la chiave'}</button>
        {onCancel && <button type="button" className={`${btn} bg-slate-100 text-slate-700`} onClick={onCancel}>Annulla</button>}
      </div>
    </form>
  )
}

const SUGGESTIONS = ['Quali scadenze ho questo mese?', 'Quanto ho speso per l’auto quest’anno?', 'Quali bollette devo ancora pagare?', 'Cosa devo comprare?']

export function Assistente() {
  const { rows, carReady } = useData()
  const [params] = useSearchParams()
  const area = params.get('area') === 'car' ? 'car' : 'home'
  const [q, setQ] = useState('')
  const [manual, setManual] = useState<SectionId[] | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(MODE === 'cloud' ? 'checking' : 'ready')
  const [hint, setHint] = useState('')
  const [changing, setChanging] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const check = useCallback(async () => {
    if (MODE !== 'cloud') return
    setStatus('checking')
    try {
      const r = await callAssistant({ action: 'status' }) // non invia alcun dato dell'utente
      if (!r.ok) throw new Error(r.error)
      setHint(r.hint ?? ''); setStatus(r.hasKey ? 'ready' : 'no-key')
    } catch { setStatus('unreachable') }
  }, [])
  useEffect(() => { void check() }, [check])

  const title = <h1 className="text-2xl font-semibold mb-3">Assistente</h1>

  if (MODE === 'demo')
    return <div>{title}<Warning title="Assistente disattivato nella demo"><p>Nella versione con account risponde alle domande sui dati di casa e auto, per esempio «Quanto ho speso per l’auto quest’anno?». Qui nessun dato viene inviato.</p></Warning></div>
  if (status === 'checking') return <div>{title}<p role="status" className="text-slate-500">Controllo se l’assistente è disponibile…</p></div>
  const saved = (h: string) => { setHint(h); setChanging(false); setError(''); setStatus('ready') }
  if (status === 'unreachable')
    return (
      <div>
        {title}
        <Warning title="Assistente non disponibile">
          <p>Il servizio dell’assistente non risponde: controlla la connessione. Se il problema continua, avvisa chi gestisce l’app.</p>
          <button className={`${btn} bg-white text-slate-800`} onClick={() => void check()}>Ricontrolla</button>
        </Warning>
      </div>
    )
  if (status === 'no-key')
    return (
      <div>
        {title}
        <Warning title="Per usare l’assistente serve la tua chiave Gemini"><p>Finché non la inserisci, nessun dato viene inviato.</p></Warning>
        <KeyForm onSaved={saved} />
      </div>
    )

  async function removeKey() {
    try {
      const r = await callAssistant({ action: 'deleteKey' })
      if (!r.ok) return setError(r.error ?? 'Non sono riuscito a rimuovere la chiave.')
      setConfirmRemove(false); setAnswer(''); setStatus('no-key')
    } catch { setError('Non sono riuscito a rimuovere la chiave. Riprova.') }
  }

  const available = SECTIONS.filter((s) => carReady || s.area !== 'car')
  const selected = (manual ?? pickSections(q, area)).filter((id) => available.some((s) => s.id === id))
  const toggle = (id: SectionId) => setManual(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  async function ask() {
    if (!q.trim() || loading || !selected.length) return
    setLoading(true); setError(''); setAnswer('')
    try {
      const r = await callAssistant({ question: q.trim(), context: buildContext(rows, selected) })
      if (r.ok && r.text?.trim()) setAnswer(r.text)
      else setError(r.error ?? 'L’assistente non ha restituito alcuna risposta. Prova a riformulare la domanda.')
    } catch {
      setError(navigator.onLine ? 'Non sono riuscito a contattare l’assistente. Riprova più tardi.' : 'Senza connessione: controlla internet e riprova.')
    } finally { setLoading(false) }
  }

  return (
    <div>
      {title}
      <div className="flex flex-wrap gap-2 mb-2">
        {SUGGESTIONS.map((s) => <button key={s} className="rounded-full bg-white shadow px-3 py-2 text-sm min-h-[40px]" onClick={() => { setQ(s); setManual(null) }}>{s}</button>)}
      </div>
      <textarea className={inputCls} rows={3} value={q} maxLength={500} onChange={(e) => { setQ(e.target.value); setManual(null) }} placeholder="Scrivi la tua domanda…" aria-label="Domanda" />

      <fieldset className="bg-white rounded-xl shadow p-3 mt-3">
        <legend className="sr-only">Dati da inviare</legend>
        <p className="text-sm font-medium">Dati che verranno inviati a Google Gemini</p>
        <p className="text-xs text-slate-500 mb-2">Premendo «Chiedi» la domanda e le sezioni spuntate vengono trasmesse al servizio AI Google Gemini. Le ho scelte in base alla domanda: puoi cambiarle. Targhe, numeri di telefono e link non vengono inviati; le note e le descrizioni che hai scritto sì.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {available.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm min-h-[40px]">
              <input type="checkbox" className="w-5 h-5" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
              {s.label} <span className="text-slate-400">({rows[s.table].length})</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button className={`${btn} bg-blue-600 text-white mt-3 disabled:opacity-60`} disabled={loading || !q.trim() || !selected.length} onClick={() => void ask()}>{loading ? 'Attendi la risposta…' : 'Chiedi (invia i dati a Gemini)'}</button>
      {!selected.length && <p className="text-sm text-amber-700 mt-2">Spunta almeno una sezione.</p>}
      {error && <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {answer && <div className="mt-4 bg-white shadow rounded-xl p-4 text-sm whitespace-pre-wrap" role="status">{answer}<p className="text-xs text-slate-400 mt-3">Risposta generata da un’AI: controlla le cifre importanti nelle schede.</p></div>}

      {MODE === 'cloud' && (changing ? <div className="mt-6"><KeyForm onSaved={saved} onCancel={() => setChanging(false)} /></div> : (
        <div className="mt-6 text-sm text-slate-500 flex flex-wrap items-center gap-2">
          {confirmRemove ? (
            <>
              <span>Rimuovere la tua chiave Gemini?</span>
              <button className={`${btn} bg-red-600 text-white`} onClick={() => void removeKey()}>Sì, rimuovi</button>
              <button className={`${btn} bg-white text-slate-700`} onClick={() => setConfirmRemove(false)}>Annulla</button>
            </>
          ) : (
            <>
              <span>La tua chiave Gemini: ••••{hint}</span>
              <button className={`${btn} bg-white text-slate-700 shadow`} onClick={() => setChanging(true)}>Cambia</button>
              <button className={`${btn} bg-white text-red-700 shadow`} onClick={() => setConfirmRemove(true)}>Rimuovi</button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
