// Quali dati inviare all'assistente: solo le sezioni utili alla domanda, senza targhe, telefoni e link.
import { normalize, type Row, type Rows, type TableName } from '../data/model'
import { carSpend } from './car'
import { todayISO } from './format'

export type SectionId = 'spese' | 'scadenze' | 'inventario' | 'lista' | 'documenti' | 'auto' | 'scadenzeAuto' | 'interventi' | 'rifornimenti' | 'speseAuto' | 'documentiAuto'

export const SECTIONS: { id: SectionId; table: TableName; area: 'home' | 'car'; label: string }[] = [
  { id: 'spese', table: 'expenses', area: 'home', label: 'Spese e bollette di casa' },
  { id: 'scadenze', table: 'deadlines', area: 'home', label: 'Scadenze di casa' },
  { id: 'inventario', table: 'items', area: 'home', label: 'Inventario' },
  { id: 'lista', table: 'shopping', area: 'home', label: 'Lista della spesa' },
  { id: 'documenti', table: 'docs', area: 'home', label: 'Documenti di casa' },
  { id: 'auto', table: 'vehicles', area: 'car', label: 'Le mie auto' },
  { id: 'scadenzeAuto', table: 'car_deadlines', area: 'car', label: 'Scadenze auto' },
  { id: 'interventi', table: 'car_services', area: 'car', label: 'Interventi auto' },
  { id: 'rifornimenti', table: 'car_fuel', area: 'car', label: 'Rifornimenti' },
  { id: 'speseAuto', table: 'car_expenses', area: 'car', label: 'Altre spese auto' },
  { id: 'documentiAuto', table: 'car_docs', area: 'car', label: 'Documenti auto' },
]

/** Scelta automatica in base alle parole della domanda; l'utente può modificarla prima di inviare. */
export function pickSections(question: string, area: 'home' | 'car'): SectionId[] {
  const q = question.toLowerCase()
  const car = /\bauto\b|macchina|veicol|\bcar\b|tagliando|bollo|revisione|gomme|carburant|benzina|diesel|gasolio|rifornim|litri|\bkm\b|chilometr|officina/.test(q)
  const home = /casa|bollett|\bluce\b|\bgas\b|acqua|internet|condominio|caldaia|inventario|stanza|comprare|lista della spesa/.test(q)
  const inCar = car || (!home && area === 'car'), inHome = home || (!car && area === 'home')
  const out = new Set<SectionId>()
  const add = (...ids: SectionId[]) => ids.forEach((i) => out.add(i))

  if (/comprare|lista della spesa/.test(q)) add('lista')
  if (/inventario|oggett|stanza|dove (è|si trova|sta)/.test(q)) add('inventario')
  if (/document|garanzi|polizz|contratt|assicura|soccorso/.test(q)) { if (inHome || !car) add('documenti'); if (inCar) add('documentiAuto', 'auto') }
  if (/scad|promemori|rinnov|revisione|tagliando|bollo|gomme|quando|in arrivo|arretrat/.test(q)) {
    // senza indicazioni, "le mie scadenze" riguarda sia la casa sia le auto
    if (home || !car) add('scadenze', 'spese', 'documenti')
    if (car || !home) add('auto', 'scadenzeAuto', 'documentiAuto')
  }
  if (/spes[oai]|speso|cost|quanto|pagat|pagare|importo|total|euro|€/.test(q) && !/lista della spesa/.test(q)) {
    if (inHome) add('spese')
    if (inCar) add('auto', 'interventi', 'rifornimenti', 'speseAuto')
  }
  if (/intervent|riparaz|officina|ultimo|tagliando|gomme/.test(q) && inCar) add('auto', 'interventi')
  if (/carburant|benzina|diesel|gasolio|rifornim|litri|consum/.test(q)) add('auto', 'rifornimenti')

  if (!out.size) { if (inCar) add('auto', 'scadenzeAuto', 'interventi'); if (inHome) add('spese', 'scadenze') }
  return SECTIONS.map((s) => s.id).filter((id) => out.has(id))
}

const HIDDEN = new Set(['targa', 'telefono', 'link', 'vehicle_id'])

export function buildContext(rows: Rows, selected: SectionId[]) {
  const vehicleName = new Map(rows.vehicles.map((v) => [v.id, String(v.nome)]))
  const out: Record<string, unknown> = { oggi: todayISO() }
  for (const s of SECTIONS) {
    if (!selected.includes(s.id)) continue
    out[s.id] = rows[s.table].map((r) => {
      const clean = Object.fromEntries(Object.entries(normalize(s.table, r)).filter(([k, v]) => !HIDDEN.has(k) && v !== '' && !(k === 'km' && !v)))
      return s.area === 'car' && s.table !== 'vehicles' ? { auto: vehicleName.get(r.vehicle_id as Row['id']) ?? '', ...clean } : clean
    })
  }
  // i totali delle auto si calcolano qui: le somme fatte dall'AI possono essere sbagliate
  if (selected.some((s) => s === 'rifornimenti' || s === 'interventi' || s === 'speseAuto')) {
    const years = new Set([...rows.car_fuel, ...rows.car_services, ...rows.car_expenses].map((r) => String(r.data).slice(0, 4)))
    out.totaliSpeseAuto = rows.vehicles.flatMap((v) => [...years].sort().map((anno) => {
      const t = carSpend(rows, v.id, anno)
      return { auto: String(v.nome), anno, carburante: t.fuel, interventi: t.services, altre: t.other, totale: t.total }
    })).filter((t) => t.totale > 0)
  }
  return out
}
