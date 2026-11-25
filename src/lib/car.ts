// Regole dell'area Car. Nessuna scadenza di legge viene calcolata: date e chilometri li inserisce l'utente.
import type { Row, Rows } from '../data/model'
import { daysFromToday, fmtDate, fmtNum, relativeDue } from './format'

export const SOON_DAYS = 30
export const SOON_KM = 1000
export const RULE_TEXT = `Una scadenza è «scaduta» quando la data è passata o i chilometri previsti sono stati raggiunti; è «imminente» quando mancano al massimo ${SOON_DAYS} giorni o ${SOON_KM.toLocaleString('it-IT')} km. I chilometri si confrontano con l’ultimo valore che hai inserito per l’auto.`

export type Level = 'overdue' | 'soon' | 'ok'

/** Stato di una scadenza auto: vale la condizione che arriva prima (data o chilometri). */
export function deadlineStatus(d: Row, vehicle: Row | undefined): { level: Level; text: string } {
  const parts: string[] = []
  let level: Level = 'ok'
  const raise = (l: Level) => { if (l === 'overdue' || (l === 'soon' && level === 'ok')) level = l }

  const date = String(d.data || '')
  if (date) {
    const days = daysFromToday(date)
    raise(days < 0 ? 'overdue' : days <= SOON_DAYS ? 'soon' : 'ok')
    parts.push(`${fmtDate(date)} (${relativeDue(date)})`)
  }
  const target = Number(d.km || 0)
  if (target) {
    const now = Number(vehicle?.km || 0)
    if (!now) parts.push(`a ${fmtNum(target)} km: inserisci il chilometraggio attuale dell’auto per sapere quanto manca`)
    else {
      const left = target - now
      raise(left <= 0 ? 'overdue' : left <= SOON_KM ? 'soon' : 'ok')
      parts.push(left > 0 ? `a ${fmtNum(target)} km (mancano ${fmtNum(left)} km)` : `a ${fmtNum(target)} km (raggiunti)`)
    }
  }
  return { level, text: parts.join(' · ') }
}

export interface Spend { fuel: number; services: number; other: number; total: number }

/** Spese di un'auto (o di tutte, se vehicleId manca), eventualmente di un solo anno. */
export function carSpend(rows: Rows, vehicleId?: Row['id'], year?: string): Spend {
  const sum = (list: Row[], key: string) =>
    Math.round(list.filter((r) => (vehicleId === undefined || r.vehicle_id === vehicleId) && (!year || String(r.data).startsWith(year))).reduce((a, r) => a + Number(r[key] || 0), 0) * 100) / 100
  const fuel = sum(rows.car_fuel, 'importo'), services = sum(rows.car_services, 'costo'), other = sum(rows.car_expenses, 'importo')
  return { fuel, services, other, total: Math.round((fuel + services + other) * 100) / 100 }
}

export interface Alert { key: string; vehicleId: Row['id']; title: string; kind: string; level: Level; text: string; to: string }

/** Scadenze e documenti scaduti o futuri di tutte le auto, i più urgenti per primi. */
export function carAlerts(rows: Rows): Alert[] {
  const byId = new Map(rows.vehicles.map((v) => [v.id, v]))
  const list: (Alert & { date: string })[] = []
  for (const d of rows.car_deadlines) {
    if (d.fatto) continue
    const v = byId.get(d.vehicle_id as Row['id'])
    if (v) list.push({ key: 'd' + d.id, vehicleId: v.id, title: String(d.titolo), kind: String(d.tipo), to: '/car/scadenze', date: String(d.data || '9999'), ...deadlineStatus(d, v) })
  }
  for (const d of rows.car_docs) {
    const v = byId.get(d.vehicle_id as Row['id'])
    if (v && d.scadenza) list.push({ key: 'c' + d.id, vehicleId: v.id, title: String(d.titolo), kind: 'Documento', to: '/car/documenti', date: String(d.scadenza), ...deadlineStatus({ id: d.id, data: d.scadenza }, v) })
  }
  const order: Record<Level, number> = { overdue: 0, soon: 1, ok: 2 }
  return list.sort((a, b) => order[a.level] - order[b.level] || a.date.localeCompare(b.date))
}
