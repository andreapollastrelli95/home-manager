import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { emptyRows, type NewRow, type Row, type Rows, type TableName, TABLES } from './model'

export interface Backend {
  load(): Promise<{ rows: Rows; homeName: string }>
  add(table: TableName, row: NewRow): Promise<Row>
  update(table: TableName, id: Row['id'], patch: NewRow): Promise<Row>
  remove(table: TableName, id: Row['id']): Promise<void>
  addMany(table: TableName, rows: NewRow[]): Promise<void>
  renameHome(name: string): Promise<void>
}

export type SyncState = 'idle' | 'saving' | 'saved' | 'error'
export interface SyncInfo { state: SyncState; message?: string; at?: Date }

interface Ctx {
  rows: Rows
  homeName: string
  status: 'loading' | 'ready' | 'error'
  loadError: string
  sync: SyncInfo
  online: boolean
  add(table: TableName, row: NewRow): Promise<Row>
  update(table: TableName, id: Row['id'], patch: NewRow): Promise<void>
  remove(table: TableName, id: Row['id']): Promise<void>
  addMany(rows: Record<TableName, NewRow[]>): Promise<void>
  renameHome(name: string): Promise<void>
  reload(): Promise<void>
}

const DataContext = createContext<Ctx | null>(null)
export const useData = () => {
  const c = useContext(DataContext)
  if (!c) throw new Error('DataProvider mancante')
  return c
}

/** Messaggio comprensibile per l'utente; nessun dettaglio tecnico. */
export function friendlyError(e: unknown, action = 'salvare'): string {
  const err = e as { message?: string; code?: string; status?: number }
  const msg = String(err?.message ?? '')
  if (!navigator.onLine || /failed to fetch|networkerror|load failed|network request/i.test(msg))
    return `Senza connessione: non riesco a ${action}. Controlla internet e riprova.`
  if (err?.status === 401 || /jwt|not authenticated|token/i.test(msg)) return 'La sessione è scaduta: esci e accedi di nuovo.'
  if (err?.code === '42501' || err?.status === 403) return 'Operazione non consentita per questo account.'
  if (err?.code === '23514' || err?.code === '22001') return 'Uno dei valori inseriti non è accettato (troppo lungo o non valido).'
  return `Non riesco a ${action}. Riprova tra poco.`
}

export function DataProvider({ backend, autoRefresh, children }: { backend: Backend; autoRefresh?: boolean; children: ReactNode }) {
  const [rows, setRows] = useState<Rows>(emptyRows())
  const [homeName, setHomeName] = useState('La mia casa')
  const [status, setStatus] = useState<Ctx['status']>('loading')
  const [loadError, setLoadError] = useState('')
  const [sync, setSync] = useState<SyncInfo>({ state: 'idle' })
  const [online, setOnline] = useState(navigator.onLine)
  const pending = useRef(0)

  const seq = useRef(0) // cambia a ogni scrittura: serve a scartare letture rimaste "vecchie"

  const reload = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = seq.current
      try {
        const r = await backend.load()
        // se nel frattempo c'è stata una scrittura, questa lettura potrebbe non includerla: si riprova
        if (before !== seq.current || pending.current > 0) { await new Promise((res) => setTimeout(res, 300)); continue }
        setRows(r.rows); setHomeName(r.homeName); setStatus('ready'); setLoadError('')
        setSync((s) => (s.state === 'saving' ? s : { state: 'idle', at: new Date() }))
        return
      } catch (e) {
        setLoadError(friendlyError(e, 'caricare i dati'))
        setStatus((s) => (s === 'ready' ? s : 'error'))
        setSync({ state: 'error', message: friendlyError(e, 'aggiornare i dati') })
        return
      }
    }
  }, [backend])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const on = () => { setOnline(true); void reload() }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [reload])

  // Cloud: riallinea i dati quando si torna sull'app e ogni minuto mentre è aperta
  useEffect(() => {
    if (!autoRefresh) return
    const refresh = () => { if (document.visibilityState === 'visible' && pending.current === 0 && navigator.onLine) void reload() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    const t = window.setInterval(refresh, 60000)
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); window.clearInterval(t) }
  }, [autoRefresh, reload])

  async function run<T>(fn: () => Promise<T>, action = 'salvare'): Promise<T> {
    pending.current++
    seq.current++
    setSync((s) => ({ ...s, state: 'saving', message: undefined }))
    try {
      const r = await fn()
      setSync({ state: 'saved', at: new Date() })
      return r
    } catch (e) {
      const message = friendlyError(e, action)
      setSync({ state: 'error', message })
      throw new Error(message)
    } finally {
      pending.current--
      seq.current++
    }
  }

  const ctx: Ctx = {
    rows, homeName, status, loadError, sync, online,
    add: (table, row) =>
      run(async () => {
        const saved = await backend.add(table, row)
        setRows((p) => ({ ...p, [table]: [...p[table], saved] }))
        return saved
      }),
    update: (table, id, patch) =>
      run(async () => {
        const current = rows[table].find((r) => r.id === id)
        if (!current) throw new Error('Elemento non trovato.')
        const saved = await backend.update(table, id, { ...current, ...patch })
        setRows((p) => ({ ...p, [table]: p[table].map((r) => (r.id === id ? saved : r)) }))
      }),
    remove: (table, id) =>
      run(async () => {
        await backend.remove(table, id)
        setRows((p) => ({ ...p, [table]: p[table].filter((r) => r.id !== id) }))
      }, 'eliminare'),
    addMany: async (data) => {
      await run(async () => {
        for (const t of TABLES) if (data[t].length) await backend.addMany(t, data[t])
      }, 'importare')
      await reload()
    },
    renameHome: (name) =>
      run(async () => {
        await backend.renameHome(name)
        setHomeName(name)
      }),
    reload,
  }
  return <DataContext.Provider value={ctx}>{children}</DataContext.Provider>
}
