const dateFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
const euroFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const numFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 })

/** Data di oggi nel fuso orario locale, formato AAAA-MM-GG. */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "2026-11-24" -> "24/11/2026" */
export function fmtDate(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  return m ? dateFmt.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : ''
}

export const fmtEuro = (n: unknown): string => euroFmt.format(Number(n) || 0)
export const fmtNum = (n: unknown): string => numFmt.format(Number(n) || 0)

/** Giorni da oggi (negativo = nel passato). */
export function daysFromToday(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return 0
  const a = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  const t = new Date(); const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  return Math.round((a - b) / 86400000)
}

export function relativeDue(iso: string): string {
  const d = daysFromToday(iso)
  if (d === 0) return 'oggi'
  if (d === 1) return 'domani'
  if (d === -1) return 'ieri'
  return d < 0 ? `${-d} giorni fa` : `tra ${d} giorni`
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
