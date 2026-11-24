import { useState, type FormEvent, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEMO_URL, type ConfigProblem } from '../lib/config'

const input = 'border border-slate-300 rounded-lg px-3 py-3 text-base w-full bg-white'
const primary = 'w-full rounded-lg bg-blue-600 text-white py-3 text-base font-medium disabled:opacity-60'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex items-start sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <div className="text-center mb-5">
          <div className="text-4xl" aria-hidden>🏠</div>
          <h1 className="text-2xl font-semibold mt-1">Home Manager</h1>
          <p className="text-sm text-slate-500">La tua casa, in ordine e sempre con te.</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export const LoadingScreen = () => (
  <Shell><p className="text-center text-slate-500" role="status">Caricamento…</p></Shell>
)

export function ConfigMissing({ problem }: { problem: Exclude<ConfigProblem, null> }) {
  return (
    <Shell>
      <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-3 text-sm mb-4" role="alert">
        {problem === 'secret-key'
          ? 'Nella configurazione c’è una chiave segreta (service_role / secret). Non va mai usata nell’app: usa la chiave pubblica “anon” o “publishable”.'
          : problem === 'bad-url'
            ? 'L’indirizzo del progetto Supabase non è valido: deve iniziare con https://.'
            : 'Questa versione di Home Manager non è ancora collegata a un archivio online, quindi non è possibile accedere né salvare dati.'}
      </div>
      <h2 className="font-semibold mb-2">Come si configura</h2>
      <ol className="list-decimal pl-5 text-sm space-y-1.5 text-slate-700">
        <li>Crea un progetto gratuito su supabase.com.</li>
        <li>Nel progetto apri <b>SQL Editor</b> ed esegui il file <code>supabase/schema.sql</code>.</li>
        <li>Copia <b>Project URL</b> e la chiave <b>anon / publishable</b> (Project Settings → API).</li>
        <li>Inseriscile in <code>.env.local</code> come <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (vedi <code>.env.example</code>), poi ricostruisci l’app.</li>
      </ol>
      <p className="text-sm text-slate-500 mt-3">La guida completa è in <code>docs/configurazione-supabase.md</code>.</p>
      {DEMO_URL && <a className="block text-center text-blue-600 mt-4 py-2" href={DEMO_URL}>Prova la demo con dati fittizi</a>}
    </Shell>
  )
}

/** Traduce gli errori di Supabase Auth in messaggi semplici. */
export function authError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? '')
  if (!navigator.onLine || /failed to fetch|network|load failed/i.test(msg)) return 'Senza connessione: controlla internet e riprova.'
  if (/invalid login credentials/i.test(msg)) return 'Email o password non corrette.'
  if (/email not confirmed/i.test(msg)) return 'Devi prima confermare l’email: apri il messaggio che ti abbiamo inviato.'
  if (/already registered|already been registered/i.test(msg)) return 'Esiste già un account con questa email: prova ad accedere.'
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Troppi tentativi: aspetta qualche minuto e riprova.'
  if (/password should|weak/i.test(msg)) return 'Password troppo debole: usa almeno 8 caratteri, meglio se con numeri e lettere.'
  if (/same password/i.test(msg)) return 'La nuova password deve essere diversa da quella attuale.'
  if (/signups not allowed|signup is disabled/i.test(msg)) return 'La registrazione di nuovi account è disattivata.'
  return 'Operazione non riuscita. Riprova tra poco.'
}

const redirectUrl = () => `${window.location.origin}${window.location.pathname}`

function PasswordField({ value, onChange, autoComplete, label }: { value: string; onChange: (v: string) => void; autoComplete: string; label: string }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <div className="flex gap-2 mt-1">
        <input className={input} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} minLength={8} required />
        <button type="button" className="px-3 text-sm text-blue-600 min-h-[44px]" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Nascondi' : 'Mostra'}</button>
      </div>
    </label>
  )
}

export function AuthScreen({ sb }: { sb: SupabaseClient }) {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  const go = (v: typeof view) => { setView(v); setErr(''); setInfo('') }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setInfo('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Scrivi un indirizzo email valido.')
    if (view !== 'forgot' && password.length < 8) return setErr('La password deve avere almeno 8 caratteri.')
    setBusy(true)
    try {
      const mail = email.trim()
      if (view === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email: mail, password })
        if (error) throw error
      } else if (view === 'register') {
        const { data, error } = await sb.auth.signUp({ email: mail, password, options: { emailRedirectTo: redirectUrl() } })
        if (error) throw error
        if (!data.session) setInfo('Ti abbiamo scritto un’email: apri il link per confermare l’indirizzo, poi torna qui e accedi.')
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: redirectUrl() })
        if (error) throw error
        setInfo('Se esiste un account con questa email, riceverai un messaggio con il link per scegliere una nuova password. Aprilo sullo stesso dispositivo e browser da cui l’hai richiesto.')
      }
    } catch (ex) {
      setErr(authError(ex))
    } finally {
      setBusy(false)
    }
  }

  const tab = (v: 'login' | 'register', label: string) => (
    <button type="button" onClick={() => go(v)} className={`flex-1 py-2.5 text-sm rounded-lg ${view === v ? 'bg-white shadow font-medium' : 'text-slate-500'}`} aria-pressed={view === v}>{label}</button>
  )

  return (
    <Shell>
      {view !== 'forgot' && <div className="flex bg-slate-100 rounded-xl p-1 mb-4">{tab('login', 'Accedi')}{tab('register', 'Crea account')}</div>}
      {view === 'forgot' && <h2 className="font-semibold mb-3">Recupera la password</h2>}
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label className="block text-sm text-slate-600">
          Email
          <input className={`${input} mt-1`} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {view !== 'forgot' && <PasswordField label="Password (almeno 8 caratteri)" value={password} onChange={setPassword} autoComplete={view === 'login' ? 'current-password' : 'new-password'} />}
        {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-sm" role="alert">{err}</div>}
        {info && <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 p-3 text-sm" role="status">{info}</div>}
        <button className={primary} disabled={busy}>
          {busy ? 'Attendi…' : view === 'login' ? 'Accedi' : view === 'register' ? 'Crea il mio account' : 'Invia il link'}
        </button>
      </form>
      <div className="mt-3 text-center text-sm">
        {view === 'login' && <button className="text-blue-600 py-2" onClick={() => go('forgot')}>Password dimenticata?</button>}
        {view === 'forgot' && <button className="text-blue-600 py-2" onClick={() => go('login')}>← Torna all’accesso</button>}
      </div>
      <p className="text-xs text-slate-500 text-center mt-3">
        Ogni persona ha il proprio account e la propria casa privata: nessuno può vedere i tuoi dati e tu non vedi quelli degli altri.
      </p>
      {DEMO_URL && <a className="block text-center text-sm text-blue-600 mt-3 py-2" href={DEMO_URL}>Prova prima la demo (dati fittizi)</a>}
    </Shell>
  )
}

export function ResetPasswordScreen({ sb, onDone }: { sb: SupabaseClient; onDone: () => void }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (p1.length < 8) return setErr('La password deve avere almeno 8 caratteri.')
    if (p1 !== p2) return setErr('Le due password non coincidono.')
    setBusy(true)
    const { error } = await sb.auth.updateUser({ password: p1 })
    setBusy(false)
    if (error) setErr(authError(error)); else onDone()
  }

  return (
    <Shell>
      <h2 className="font-semibold mb-3">Scegli una nuova password</h2>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <PasswordField label="Nuova password (almeno 8 caratteri)" value={p1} onChange={setP1} autoComplete="new-password" />
        <PasswordField label="Ripeti la nuova password" value={p2} onChange={setP2} autoComplete="new-password" />
        {err && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 p-3 text-sm" role="alert">{err}</div>}
        <button className={primary} disabled={busy}>{busy ? 'Attendi…' : 'Salva la nuova password'}</button>
      </form>
    </Shell>
  )
}
