import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from './data/store'
import type { NewRow, Row, TableName } from './data/model'
import { fmtDate, fmtEuro, fmtNum, relativeDue, todayISO } from './lib/format'

export interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox'
  options?: string[]
  required?: boolean
  format?: 'euro' | 'number'
  role?: 'title' | 'due' | 'hidden'   // title: titolo della scheda; due: data di scadenza; hidden: solo nel modulo
  placeholder?: string
}

export interface DoneLabels { todo: string; done: string; action: string; undo: string }

export interface CrudProps {
  title: string
  intro?: string
  table: TableName
  fields: Field[]
  defaults: NewRow
  doneKey?: string
  doneLabels?: DoneLabels
  filterField?: string        // campo "select" usato per filtrare (es. categoria)
  filterAll?: string
  addLabel: string
  emptyIcon: string
  emptyText: string
  summary?: (rows: Row[]) => string
}

export const inputCls = 'border border-slate-300 rounded-lg px-3 py-2.5 text-base w-full bg-white'
export const btn = 'rounded-lg px-4 py-2.5 text-sm min-h-[44px] font-medium'

const isHttp = (s: string) => /^https?:\/\//i.test(s)

function show(f: Field, v: unknown): string {
  if (f.type === 'date') return fmtDate(v)
  if (f.format === 'euro') return fmtEuro(v)
  if (f.format === 'number') return fmtNum(v)
  return String(v ?? '')
}

export default function CrudPage(p: CrudProps) {
  const data = useData()
  const rows = data.rows[p.table]
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>(p.defaults)
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmId, setConfirmId] = useState<Row['id'] | null>(null)
  const [search, setSearch] = useState('')
  const [state, setState] = useState<'all' | 'todo' | 'done'>('all')
  const [cat, setCat] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const titleField = p.fields.find((f) => f.role === 'title') ?? p.fields[0]
  const dueField = p.fields.find((f) => f.role === 'due')
  const catField = p.fields.find((f) => f.key === p.filterField)

  function openNew() {
    setForm({ ...p.defaults }); setFormErr(''); setEditing('new')
  }
  // "?nuovo=1" (dalle azioni rapide della dashboard) apre subito il modulo
  useEffect(() => {
    if (params.get('nuovo')) { openNew(); setParams({}, { replace: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  useEffect(() => { if (editing) formRef.current?.scrollIntoView({ block: 'start' }) }, [editing])
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t) } }, [notice])

  function startEdit(r: Row) {
    const f: Record<string, unknown> = {}
    for (const fld of p.fields) f[fld.key] = r[fld.key] ?? ''
    setForm(f); setFormErr(''); setEditing(r); setConfirmId(null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const missing = p.fields.filter((f) => f.required && !String(form[f.key] ?? '').trim()).map((f) => f.label)
    if (missing.length) return setFormErr(`Compila: ${missing.join(', ')}.`)
    setBusy(true); setFormErr('')
    try {
      if (editing === 'new') await data.add(p.table, form)
      else if (editing) await data.update(p.table, editing.id, form)
      setNotice({ ok: true, text: editing === 'new' ? 'Aggiunto.' : 'Modifiche salvate.' })
      setEditing(null)
    } catch (ex) {
      setFormErr((ex as Error).message) // il modulo resta aperto con i dati inseriti
    } finally {
      setBusy(false)
    }
  }

  async function toggleDone(r: Row) {
    if (!p.doneKey) return
    try { await data.update(p.table, r.id, { [p.doneKey]: !r[p.doneKey] }) }
    catch (ex) { setNotice({ ok: false, text: (ex as Error).message }) }
  }

  async function doDelete(r: Row) {
    try { await data.remove(p.table, r.id); setNotice({ ok: true, text: 'Eliminato.' }) }
    catch (ex) { setNotice({ ok: false, text: (ex as Error).message }) }
    setConfirmId(null)
  }

  const q = search.trim().toLowerCase()
  const shown = rows
    .filter((r) => !q || p.fields.some((f) => String(r[f.key] ?? '').toLowerCase().includes(q)))
    .filter((r) => !catField || !cat || r[catField.key] === cat)
    .filter((r) => !p.doneKey || state === 'all' || (state === 'done') === !!r[p.doneKey])
    .sort((a, b) => {
      if (p.doneKey && !!a[p.doneKey] !== !!b[p.doneKey]) return a[p.doneKey] ? 1 : -1
      if (dueField) { const x = String(a[dueField.key] || '9999'), y = String(b[dueField.key] || '9999'); if (x !== y) return x < y ? -1 : 1 }
      return String(a[titleField.key]).localeCompare(String(b[titleField.key]), 'it')
    })

  const filtering = !!(q || cat || state !== 'all')

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl font-semibold">{p.title}</h1>
          {p.intro && <p className="text-sm text-slate-500">{p.intro}</p>}
        </div>
        {!editing && <button className={`${btn} bg-blue-600 text-white shrink-0`} onClick={openNew}>＋ {p.addLabel}</button>}
      </div>

      {notice && <div role="status" className={`mb-3 rounded-lg p-3 text-sm border ${notice.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>{notice.text}</div>}

      {editing && (
        <form ref={formRef} onSubmit={save} noValidate className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 scroll-mt-16">
          <h2 className="font-semibold sm:col-span-2">{editing === 'new' ? p.addLabel : 'Modifica'}</h2>
          {p.fields.map((f) =>
            f.type === 'checkbox' ? (
              <label key={f.key} className="flex items-center gap-3 text-base min-h-[44px]">
                <input type="checkbox" className="w-6 h-6" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
                {f.label}
              </label>
            ) : (
              <label key={f.key} className="text-sm text-slate-600">
                {f.label}{f.required && <span className="text-red-600"> *</span>}
                {f.type === 'select' ? (
                  <select className={`${inputCls} mt-1`} value={String(form[f.key] ?? '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    {f.options!.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className={`${inputCls} mt-1`}
                    type={f.type}
                    inputMode={f.type === 'number' ? 'decimal' : undefined}
                    step={f.type === 'number' ? '0.01' : undefined}
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
              </label>
            ),
          )}
          {formErr && <div role="alert" className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{formErr}</div>}
          <div className="sm:col-span-2 flex gap-2">
            <button className={`${btn} bg-blue-600 text-white flex-1 sm:flex-none disabled:opacity-60`} disabled={busy}>{busy ? 'Salvataggio…' : 'Salva'}</button>
            <button type="button" className={`${btn} bg-slate-100 text-slate-700 flex-1 sm:flex-none`} onClick={() => setEditing(null)}>Annulla</button>
          </div>
        </form>
      )}

      {data.status === 'loading' ? (
        <p className="text-slate-500 p-4" role="status">Caricamento dei dati…</p>
      ) : (
        <>
          {rows.length > 0 && (
            <div className="space-y-2 mb-3">
              <input className={inputCls} type="search" placeholder="Cerca…" aria-label="Cerca" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {p.doneKey && p.doneLabels && (['all', 'todo', 'done'] as const).map((s) => (
                  <button key={s} onClick={() => setState(s)} aria-pressed={state === s}
                    className={`rounded-full px-4 py-2 text-sm min-h-[40px] ${state === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow'}`}>
                    {s === 'all' ? 'Tutti' : s === 'todo' ? p.doneLabels!.todo : p.doneLabels!.done}
                  </button>
                ))}
                {catField && (
                  <select className="rounded-full px-4 py-2 text-sm min-h-[40px] bg-white shadow" aria-label="Filtra per categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="">{p.filterAll ?? 'Tutte'}</option>
                    {catField.options!.map((o) => <option key={o}>{o}</option>)}
                  </select>
                )}
              </div>
              {p.summary && <p className="text-sm text-slate-600">{p.summary(shown)}</p>}
            </div>
          )}

          {rows.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <div className="text-4xl mb-2" aria-hidden>{p.emptyIcon}</div>
              <p className="text-slate-600 mb-4">{p.emptyText}</p>
              {!editing && <button className={`${btn} bg-blue-600 text-white`} onClick={openNew}>＋ {p.addLabel}</button>}
            </div>
          ) : shown.length === 0 ? (
            <p className="text-slate-500 p-4">Nessun risultato con questi filtri.{filtering && <button className="text-blue-600 ml-2 py-2" onClick={() => { setSearch(''); setCat(''); setState('all') }}>Azzera i filtri</button>}</p>
          ) : (
            <ul className="space-y-2">
              {shown.map((r) => {
                const done = p.doneKey ? !!r[p.doneKey] : false
                const due = dueField ? String(r[dueField.key] || '') : ''
                const overdue = !!due && !done && due < todayISO()
                const meta = p.fields.filter((f) => f !== titleField && f.role !== 'hidden' && f.type !== 'checkbox' && String(r[f.key] ?? '') !== '' && !(f.format === 'euro' && !Number(r[f.key])))
                return (
                  <li key={String(r.id)} className={`bg-white rounded-xl shadow p-3 ${done ? 'opacity-70' : ''}`}>
                    <div className="flex justify-between gap-2 items-start">
                      <div className={`font-medium break-words min-w-0 ${done ? 'line-through' : ''}`}>{String(r[titleField.key])}</div>
                      {p.doneKey && p.doneLabels && (
                        <span className={`text-xs rounded-full px-2.5 py-1 whitespace-nowrap ${done ? 'bg-green-100 text-green-800' : overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                          {done ? p.doneLabels.done : overdue ? 'In ritardo' : p.doneLabels.todo}
                        </span>
                      )}
                    </div>
                    <dl className="text-sm text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {meta.map((f) => (
                        <div key={f.key} className="flex gap-1 min-w-0">
                          <dt className="text-slate-400">{f.label}:</dt>
                          <dd className="break-words min-w-0">
                            {f.key === 'link' && isHttp(String(r[f.key]))
                              ? <a className="text-blue-600 underline" href={String(r[f.key])} target="_blank" rel="noopener noreferrer">Apri</a>
                              : show(f, r[f.key])}
                            {f === dueField && !done && <span className={overdue ? ' text-red-600' : ' text-slate-400'}> ({relativeDue(due)})</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {confirmId === r.id ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 bg-red-50 rounded-lg p-2" role="alert">
                        <span className="text-sm text-red-800 flex-1 min-w-[10rem]">Eliminare «{String(r[titleField.key])}»? Non si può annullare.</span>
                        <button className={`${btn} bg-red-600 text-white`} onClick={() => doDelete(r)}>Sì, elimina</button>
                        <button className={`${btn} bg-white text-slate-700`} onClick={() => setConfirmId(null)}>Annulla</button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.doneKey && p.doneLabels && (
                          <button className={`${btn} ${done ? 'bg-slate-100 text-slate-700' : 'bg-green-600 text-white'}`} onClick={() => toggleDone(r)}>
                            {done ? p.doneLabels.undo : p.doneLabels.action}
                          </button>
                        )}
                        <button className={`${btn} bg-slate-100 text-slate-700`} onClick={() => startEdit(r)}>Modifica</button>
                        <button className={`${btn} bg-slate-100 text-red-700`} onClick={() => setConfirmId(r.id)}>Elimina</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
