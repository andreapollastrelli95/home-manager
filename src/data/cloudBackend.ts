import type { SupabaseClient } from '@supabase/supabase-js'
import type { Backend } from './store'
import { COLUMNS, emptyRows, normalize, TABLES, type NewRow, type Row, type TableName } from './model'

// Dal database all'interfaccia: le date nulle diventano stringa vuota, si scartano i campi tecnici
function fromDb(t: TableName, r: Record<string, unknown>): Row {
  const clean: NewRow = {}
  for (const k of Object.keys(COLUMNS[t])) clean[k] = r[k] ?? (COLUMNS[t][k].kind === 'date' ? '' : COLUMNS[t][k].def)
  return { ...normalize(t, clean), id: String(r.id) } as Row
}

// Dall'interfaccia al database: date vuote -> null. user_id lo imposta il database (auth.uid()).
function toDb(t: TableName, row: NewRow): NewRow {
  const data = normalize(t, row)
  for (const [k, c] of Object.entries(COLUMNS[t])) if (c.kind === 'date' && data[k] === '') data[k] = null
  return data
}

const fail = (error: unknown): never => { throw error }

export function cloudBackend(sb: SupabaseClient): Backend {
  return {
    async load() {
      const rows = emptyRows()
      const results = await Promise.all(TABLES.map((t) => sb.from(t).select('*').order('created_at', { ascending: true }).range(0, 4999)))
      TABLES.forEach((t, i) => {
        if (results[i].error) fail(results[i].error)
        rows[t] = (results[i].data ?? []).map((r) => fromDb(t, r))
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
      return { rows, homeName: homeName ?? 'La mia casa' }
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
