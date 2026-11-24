import type { Table } from 'dexie'
import { db } from '../db'
import type { Backend } from './store'
import { emptyRows, normalize, TABLES, type Row, type TableName } from './model'

// Demo e uso locale: i dati restano nel browser (IndexedDB). Nessun account.
const tbl = (t: TableName) => db[t] as unknown as Table<Row, number>
const NAME_KEY = 'home-manager-nome-casa'

export const localBackend: Backend = {
  async load() {
    const rows = emptyRows()
    for (const t of TABLES) rows[t] = await tbl(t).toArray()
    let homeName = 'La mia casa'
    try { homeName = localStorage.getItem(NAME_KEY) || homeName } catch { /* ignora */ }
    return { rows, homeName }
  },
  async add(t, row) {
    const data = normalize(t, row)
    const id = await tbl(t).add(data as Row)
    return { ...data, id } as Row
  },
  async update(t, id, patch) {
    const data = normalize(t, patch)
    await tbl(t).update(id as number, data)
    return { ...data, id } as Row
  },
  async remove(t, id) { await tbl(t).delete(id as number) },
  async addMany(t, rows) { await tbl(t).bulkAdd(rows.map((r) => normalize(t, r) as Row)) },
  async renameHome(name) { try { localStorage.setItem(NAME_KEY, name) } catch { /* ignora */ } },
}

/** Dati salvati in questo browser dalle versioni precedenti (solo lettura, per l'importazione guidata). */
export async function readLegacyBrowserData(): Promise<Record<TableName, Row[]> | null> {
  try {
    const list = (await indexedDB.databases?.()) ?? []
    if (!list.some((d) => d.name === 'home-manager')) return null
    const out = emptyRows()
    for (const t of TABLES) out[t] = await tbl(t).toArray()
    return TABLES.some((t) => out[t].length) ? out : null
  } catch {
    return null
  }
}
