// Modello dati condiviso da demo, uso locale e cloud (Supabase).
export type HomeTable = 'expenses' | 'deadlines' | 'items' | 'shopping' | 'docs'
export type CarTable = 'vehicles' | 'car_deadlines' | 'car_services' | 'car_expenses' | 'car_fuel' | 'car_docs'
export type TableName = HomeTable | CarTable

export const HOME_TABLES: HomeTable[] = ['expenses', 'deadlines', 'items', 'shopping', 'docs']
// "vehicles" per prima: le altre tabelle auto puntano a un veicolo
export const CAR_TABLES: CarTable[] = ['vehicles', 'car_deadlines', 'car_services', 'car_expenses', 'car_fuel', 'car_docs']
export const CAR_CHILD_TABLES: CarTable[] = CAR_TABLES.filter((t) => t !== 'vehicles')
export const TABLES: TableName[] = [...HOME_TABLES, ...CAR_TABLES]

export const TABLE_LABEL: Record<TableName, string> = {
  expenses: 'Spese e bollette',
  deadlines: 'Scadenze e manutenzioni',
  items: 'Inventario',
  shopping: 'Lista della spesa',
  docs: 'Documenti',
  vehicles: 'Auto',
  car_deadlines: 'Scadenze auto',
  car_services: 'Interventi auto',
  car_expenses: 'Spese auto',
  car_fuel: 'Rifornimenti',
  car_docs: 'Documenti auto',
}

export const CATEGORIE_SPESE = ['Luce', 'Gas', 'Acqua', 'Internet', 'Condominio', 'Tasse', 'Manutenzione', 'Altro']
export const ALIMENTAZIONI = ['Benzina', 'Diesel', 'GPL', 'Metano', 'Ibrida', 'Ibrida plug-in', 'Elettrica', 'Altro']
export const TIPI_SCADENZA_AUTO = ['Revisione', 'Assicurazione', 'Bollo', 'Tagliando', 'Cambio gomme', 'Altro']
// Carburante e interventi hanno le loro sezioni: qui non compaiono per non contarli due volte
export const CATEGORIE_AUTO = ['Assicurazione', 'Bollo', 'Revisione', 'Parcheggio', 'Pedaggi', 'Multe', 'Lavaggio', 'Accessori', 'Altro']
export const TIPI_DOC_AUTO = ['Assicurazione', 'Revisione', 'Garanzia', 'Soccorso stradale', 'Libretto', 'Altro']

export type Row = { id: string | number; [key: string]: unknown }
export type NewRow = Record<string, unknown>
export type Rows = Record<TableName, Row[]>
export const emptyRows = (): Rows => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Rows

// ref: id di un veicolo (numero in locale, uuid online). "nullable": 0 = non indicato
type Kind = 'text' | 'number' | 'date' | 'bool' | 'ref'
export interface Col { kind: Kind; def: unknown; required?: boolean; max?: number; dec?: number; nullable?: boolean }

const vehicle_id: Col = { kind: 'ref', def: '', required: true }
const km: Col = { kind: 'number', def: 0, dec: 0, nullable: true }
const note: Col = { kind: 'text', def: '', max: 1000 }

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
    note,
    fatto: { kind: 'bool', def: false },
  },
  items: {
    nome: { kind: 'text', def: '', required: true, max: 200 },
    stanza: { kind: 'text', def: '', max: 100 },
    quantita: { kind: 'number', def: 1 },
    valore: { kind: 'number', def: 0 },
    note,
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
    note,
  },
  vehicles: {
    nome: { kind: 'text', def: '', required: true, max: 80 },
    marca: { kind: 'text', def: '', max: 60 },
    modello: { kind: 'text', def: '', max: 60 },
    targa: { kind: 'text', def: '', max: 20 },
    anno: { kind: 'number', def: 0, dec: 0, nullable: true },
    alimentazione: { kind: 'text', def: 'Benzina', max: 40 },
    km,
    km_data: { kind: 'date', def: '' },
    note,
  },
  car_deadlines: {
    vehicle_id,
    titolo: { kind: 'text', def: '', required: true, max: 200 },
    tipo: { kind: 'text', def: 'Altro', max: 60 },
    data: { kind: 'date', def: '' },
    km,
    note,
    fatto: { kind: 'bool', def: false },
  },
  car_services: {
    vehicle_id,
    descrizione: { kind: 'text', def: '', required: true, max: 200 },
    data: { kind: 'date', def: '', required: true },
    km,
    officina: { kind: 'text', def: '', max: 120 },
    costo: { kind: 'number', def: 0 },
    note,
  },
  car_expenses: {
    vehicle_id,
    descrizione: { kind: 'text', def: '', required: true, max: 200 },
    categoria: { kind: 'text', def: 'Altro', max: 60 },
    importo: { kind: 'number', def: 0 },
    data: { kind: 'date', def: '', required: true },
    note,
  },
  car_fuel: {
    vehicle_id,
    data: { kind: 'date', def: '', required: true },
    litri: { kind: 'number', def: 0 },
    prezzo: { kind: 'number', def: 0, dec: 3 },
    importo: { kind: 'number', def: 0 },
    km,
    note,
  },
  car_docs: {
    vehicle_id,
    titolo: { kind: 'text', def: '', required: true, max: 200 },
    tipo: { kind: 'text', def: 'Altro', max: 60 },
    scadenza: { kind: 'date', def: '' },
    telefono: { kind: 'text', def: '', max: 40 },
    link: { kind: 'text', def: '', max: 2000 },
    note,
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
      const f = 10 ** (col.dec ?? 2)
      out[key] = Number.isFinite(n) ? Math.round(n * f) / f : col.def
      if (col.nullable && (out[key] as number) < 0) out[key] = 0
    } else if (col.kind === 'date') out[key] = typeof v === 'string' && ISO_DATE.test(v.slice(0, 10)) ? v.slice(0, 10) : ''
    else if (col.kind === 'ref') out[key] = typeof v === 'number' || typeof v === 'string' ? v : ''
    else out[key] = v === true
  }
  return out
}

/** Campi obbligatori mancanti. */
export function missingRequired(table: TableName, row: NewRow): string[] {
  const missing = Object.entries(COLUMNS[table]).filter(([k, c]) => c.required && !row[k]).map(([k]) => k)
  if (table === 'car_deadlines' && !row.data && !row.km) missing.push('data o chilometraggio')
  return missing
}

export type ImportRows = Record<TableName, NewRow[]>
export interface ParsedBackup { rows: ImportRows; total: number; skipped: number }

/**
 * Valida un insieme di righe da importare. I veicoli conservano "_ref" (il vecchio id) per ricollegare
 * le registrazioni auto; quelle senza un veicolo presente nell'importazione vengono scartate.
 */
export function cleanImport(data: Partial<Record<TableName, unknown[]>>): ParsedBackup {
  const rows = emptyRows() as unknown as ImportRows
  let total = 0, skipped = 0
  const vehicles = new Set<string>()
  for (const t of TABLES) {
    for (const r of data[t] ?? []) {
      const n = normalize(t, r)
      if (missingRequired(t, n).length) { skipped++; continue }
      if (t === 'vehicles') {
        const ref = String((r as NewRow).id ?? (r as NewRow)._ref ?? '')
        if (ref) { vehicles.add(ref); n._ref = ref }
      } else if ((CAR_CHILD_TABLES as TableName[]).includes(t) && !vehicles.has(String(n.vehicle_id))) { skipped++; continue }
      rows[t].push(n); total++
    }
  }
  return { rows, total, skipped }
}

/** Controlla un file di backup JSON. Lancia un errore con il motivo in italiano se non è valido. */
export function parseBackup(text: string): ParsedBackup {
  let obj: any
  try { obj = JSON.parse(text) } catch { throw new Error('Il file non è un JSON valido.') }
  if (!obj || obj.app !== 'home-manager' || typeof obj.data !== 'object' || obj.data === null)
    throw new Error('Il file non è un backup di Home e Car Manager.')
  // le sezioni auto mancano nei backup creati prima dell'area Car: sono facoltative
  for (const t of HOME_TABLES) if (!Array.isArray(obj.data[t])) throw new Error(`Backup incompleto: manca la sezione «${TABLE_LABEL[t]}».`)
  for (const t of CAR_TABLES) if (obj.data[t] !== undefined && !Array.isArray(obj.data[t])) throw new Error(`Sezione «${TABLE_LABEL[t]}» non valida.`)
  const parsed = cleanImport(obj.data)
  if (parsed.total > 5000) throw new Error('Il backup contiene troppi elementi (massimo 5000).')
  return parsed
}
