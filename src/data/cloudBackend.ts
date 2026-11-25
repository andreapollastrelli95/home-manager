import type { SupabaseClient } from '@supabase/supabase-js'
import type { Backend } from './store'
import { CAR_TABLES, COLUMNS, emptyRows, normalize, TABLES, type NewRow, type Row, type TableName } from './model'

// Dal database all'interfaccia: le date nulle diventano stringa vuota, si scartano i campi tecnici
function fromDb(t: TableName, r: Record<string, unknown>): Row {
  const clean: NewRow = {}
  for (const k of Object.keys(COLUMNS[t])) clean[k] = r[k] ?? (COLUMNS[t][k].kind === 'date' ? '' : COLUMNS[t][k].def)
  return { ...normalize(t, clean), id: String(r.id) } as Row
}

// Dall'interfaccia al database: date vuote e numeri non indicati -> null. user_id lo imposta il database (auth.uid()).
function toDb(t: TableName, row: NewRow): NewRow {
  const data = normalize(t, row)
  for (const [k, c] of Object.entries(COLUMNS[t])) {
    if ((c.kind === 'date' && data[k] === '') || (c.nullable && !data[k])) data[k] = null
  }
  return data
}

const fail = (error: unknown): never => { throw error }

// Tabella assente: il database non è ancora stato aggiornato con la parte Car
const isMissingTable = (e: { code?: string }) => e.code === '42P01' || e.code === 'PGRST205'

// Il servizio restituisce al massimo 1000 righe per richiesta: si legge a blocchi
async function readAll(sb: SupabaseClient, t: TableName) {
  const out: Record<string, unknown>[] = []
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await sb.from(t).select('*').order('created_at', { ascending: true }).range(from, from + 999)
    if (error) return { data: out, error }
    out.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }
  return { data: out, error: null }
}

export function cloudBackend(sb: SupabaseClient): Backend {
  return {
    async load() {
      const rows = emptyRows()
      let carReady = true
      const results = await Promise.all(TABLES.map((t) => readAll(sb, t)))
      TABLES.forEach((t, i) => {
        const { data, error } = results[i]
        if (error) {
          // senza le tabelle auto la parte Home continua a funzionare
          if ((CAR_TABLES as TableName[]).includes(t) && isMissingTable(error)) { carReady = false; return }
          fail(error)
        }
        rows[t] = data.map((r) => fromDb(t, r))
      })
      const home = await sb.from('homes').select('name').maybeSingle()
      if (home.error) fail(home.error)
      let homeName = home.data?.name as string | undefined
      if (!homeName) {
        // account creato prima dell'installazione dello schema: crea la casa vuota
        const created = await sb.from('homes').insert({}).select('name').single()
        if (created.error) fail(created.error)
        homeName = created.data?.name as string
      }
      return { rows, homeName: homeName ?? 'La mia casa', carReady }
    },
    async add(t, row) {
      const { data, error } = await sb.from(t).insert(toDb(t, row)).select('*').single()
      if (error) fail(error)
      return fromDb(t, data!)
    },
    async update(t, id, patch) {
      const { data, error } = await sb.from(t).update(toDb(t, patch)).eq('id', id).select('*').single()
      if (error) fail(error)
      return fromDb(t, data!)
    },
    async remove(t, id) {
      const { error } = await sb.from(t).delete().eq('id', id)
      if (error) fail(error)
    },
    async addMany(t, rows) {
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await sb.from(t).insert(rows.slice(i, i + 200).map((r) => toDb(t, r)))
        if (error) fail(error)
      }
    },
    async renameHome(name) {
      const clean = name.trim().slice(0, 80)
      if (!clean) throw new Error('Il nome non può essere vuoto.')
      const { data: userData } = await sb.auth.getUser()
      const { error } = await sb.from('homes').upsert({ user_id: userData.user?.id, name: clean })
      if (error) fail(error)
    },
  }
}
