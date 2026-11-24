// Modello dati condiviso da demo, uso locale e cloud (Supabase).
export type TableName = 'expenses' | 'deadlines' | 'items' | 'shopping' | 'docs'
export const TABLES: TableName[] = ['expenses', 'deadlines', 'items', 'shopping', 'docs']

export const TABLE_LABEL: Record<TableName, string> = {
  expenses: 'Spese e bollette',
  deadlines: 'Scadenze e manutenzioni',
  items: 'Inventario',
  shopping: 'Lista della spesa',
  docs: 'Documenti',
}

export type Row = { id: string | number; [key: string]: unknown }
export type NewRow = Record<string, unknown>
export type Rows = Record<TableName, Row[]>
export const emptyRows = (): Rows => ({ expenses: [], deadlines: [], items: [], shopping: [], docs: [] })

type Kind = 'text' | 'number' | 'date' | 'bool'
interface Col { kind: Kind; def: unknown; required?: boolean; max?: number }

export const COLUMNS: Record<TableName, Record<string, Col>> = {
  expenses: {
    descrizione: { kind: 'text', def: '', required: true, max: 200 },
    categoria: { kind: 'text', def: 'Altro', max: 60 },
    importo: { kind: 'number', def: 0 },
    data: { kind: 'date', def: '' },
    scadenza: { kind: 'date', def: '' },
    pagata: { kind: 'bool', def: false },
  },
  deadlines: {
    titolo: { kind: 'text', def: '', required: true, max: 200 },
    tipo: { kind: 'text', def: 'Scadenza', max: 60 },
    data: { kind: 'date', def: '', required: true },
    note: { kind: 'text', def: '', max: 1000 },
    fatto: { kind: 'bool', def: false },
  },
  items: {
    nome: { kind: 'text', def: '', required: true, max: 200 },
    stanza: { kind: 'text', def: '', max: 100 },
    quantita: { kind: 'number', def: 1 },
    valore: { kind: 'number', def: 0 },
    note: { kind: 'text', def: '', max: 1000 },
  },
  shopping: {
    nome: { kind: 'text', def: '', required: true, max: 200 },
    quantita: { kind: 'text', def: '1', max: 60 },
    preso: { kind: 'bool', def: false },
  },
  docs: {
    titolo: { kind: 'text', def: '', required: true, max: 200 },
    tipo: { kind: 'text', def: 'Altro', max: 60 },
    link: { kind: 'text', def: '', max: 2000 },
    scadenza: { kind: 'date', def: '' },
    note: { kind: 'text', def: '', max: 1000 },
  },
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Porta una riga qualsiasi (form, backup, database) alla forma attesa, scartando i campi sconosciuti. */
export function normalize(table: TableName, raw: unknown): NewRow {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: NewRow = {}
  for (const [key, col] of Object.entries(COLUMNS[table])) {
    const v = src[key]
    if (col.kind === 'text') out[key] = (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : String(col.def)).slice(0, col.max ?? 200)
    else if (col.kind === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'))
      out[key] = Number.isFinite(n) ? Math.round(n * 100) / 100 : col.def
    } else if (col.kind === 'date') out[key] = typeof v === 'string' && ISO_DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : ''
    else out[key] = v === true
  }
  return out
}

/** Campi obbligatori mancanti (etichette per il messaggio). */
export function missingRequired(table: TableName, row: NewRow): string[] {
  return Object.entries(COLUMNS[table]).filter(([k, c]) => c.required && !row[k]).map(([k]) => k)
}

export interface ParsedBackup { rows: Record<TableName, NewRow[]>; total: number; skipped: number }

/** Controlla un file di backup JSON. Lancia un errore con il motivo in italiano se non è valido. */
export function parseBackup(text: string): ParsedBackup {
  let obj: any
  try { obj = JSON.parse(text) } catch { throw new Error('Il file non è un JSON valido.') }
  if (!obj || obj.app !== 'home-manager' || typeof obj.data !== 'object' || obj.data === null)
    throw new Error('Il file non è un backup di Home Manager.')
  const rows = {} as Record<TableName, NewRow[]>
  let total = 0, skipped = 0
  for (const t of TABLES) {
    const list = obj.data[t]
    if (!Array.isArray(list)) throw new Error(`Backup incompleto: manca la sezione «${TABLE_LABEL[t]}».`)
    rows[t] = []
    for (const r of list) {
      const n = normalize(t, r)
      if (missingRequired(t, n).length) { skipped++; continue }
      rows[t].push(n); total++
    }
  }
  if (total > 5000) throw new Error('Il backup contiene troppi elementi (massimo 5000).')
  return { rows, total, skipped }
}
