// Verifica le regole RLS di supabase/schema.sql con Postgres in WebAssembly (nessun account Supabase necessario).
// Uso:  npm i --no-save @electric-sql/pglite   poi   node supabase/verifica-rls.mjs
// Simula due utenti (A e B) e un visitatore senza login: ogni riga deve iniziare con "OK".
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'
const db = new PGlite()
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222'
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`)
await db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
await db.exec(`insert into auth.users values ('${A}'), ('${B}');`)
const results = []
const check = (name, ok, extra = '') => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!ok) process.exitCode = 1 }
const as = async (role, uid, sql) => {
  await db.exec(`reset role; ${uid ? `select set_config('request.jwt.claim.sub','${uid}',false);` : `select set_config('request.jwt.claim.sub','',false);`} set role ${role};`)
  try { return { rows: (await db.query(sql)).rows } } catch (e) { return { error: e.message } } finally { await db.exec('reset role') }
}
check('trigger: ogni nuovo utente ha una casa vuota', (await db.query('select count(*)::int c from public.homes')).rows[0].c === 2)
let r = await as('authenticated', A, `insert into expenses (descrizione, categoria, importo) values ('Luce A', 'Luce', 10) returning id`)
const idA = r.rows?.[0]?.id; check('A inserisce una spesa (user_id automatico)', !!idA)
r = await as('authenticated', B, `insert into expenses (descrizione, importo) values ('Gas B', 20) returning id`); check('B inserisce una spesa', !!r.rows?.[0]?.id)
r = await as('authenticated', A, 'select descrizione from expenses'); check('A vede solo la propria spesa', r.rows?.length === 1 && r.rows[0].descrizione === 'Luce A')
r = await as('authenticated', B, 'select descrizione from expenses'); check('B vede solo la propria spesa', r.rows?.length === 1 && r.rows[0].descrizione === 'Gas B')
r = await as('authenticated', B, `update expenses set importo = 999 where id = '${idA}' returning id`); check('B non puo modificare la spesa di A', r.rows?.length === 0)
r = await as('authenticated', B, `delete from expenses where id = '${idA}' returning id`); check('B non puo eliminare la spesa di A', r.rows?.length === 0)
r = await as('authenticated', B, `insert into expenses (user_id, descrizione) values ('${A}', 'finta') returning id`); check('B non puo inserire righe a nome di A', !!r.error, r.error ?? '')
r = await as('authenticated', B, `update expenses set user_id = '${A}' where descrizione = 'Gas B' returning id`); check('B non puo cedere una riga ad A', !!r.error || r.rows?.length === 0)
r = await as('authenticated', A, 'select name from homes'); check('A vede solo la propria casa', r.rows?.length === 1)
r = await as('authenticated', A, `update homes set name = 'Casa di A' returning name`); check('A rinomina la propria casa', r.rows?.[0]?.name === 'Casa di A')
r = await as('authenticated', B, 'select name from homes'); check('B non vede il nome della casa di A', r.rows?.length === 1 && r.rows[0].name === 'La mia casa')
// ---------- Area Car ----------
r = await as('authenticated', A, `insert into vehicles (nome, km) values ('Auto di A', 1000) returning id`); const vA = r.rows?.[0]?.id; check('A inserisce un auto', !!vA, r.error ?? '')
r = await as('authenticated', B, `insert into vehicles (nome) values ('Auto di B') returning id`); check('B inserisce un auto', !!r.rows?.[0]?.id)
const carInserts = {
  car_deadlines: (v) => `insert into car_deadlines (vehicle_id, titolo, km) values ('${v}', 'Tagliando', 2000)`,
  car_services: (v) => `insert into car_services (vehicle_id, descrizione, data) values ('${v}', 'Olio', '2026-01-10')`,
  car_expenses: (v) => `insert into car_expenses (vehicle_id, descrizione, data, importo) values ('${v}', 'Bollo', '2026-01-10', 100)`,
  car_fuel: (v) => `insert into car_fuel (vehicle_id, data, litri, prezzo) values ('${v}', '2026-01-10', 30, 1.789)`,
  car_docs: (v) => `insert into car_docs (vehicle_id, titolo) values ('${v}', 'Polizza')`,
}
for (const [t, sql] of Object.entries(carInserts)) {
  r = await as('authenticated', A, sql(vA) + ' returning id'); const id = r.rows?.[0]?.id; check(`A inserisce in ${t}`, !!id, r.error ?? '')
  r = await as('authenticated', B, `select * from ${t}`); check(`B non vede ${t} di A`, r.rows?.length === 0)
  r = await as('authenticated', B, `update ${t} set note = 'x' where id = '${id}' returning id`); check(`B non modifica ${t} di A`, r.rows?.length === 0)
  r = await as('authenticated', B, `delete from ${t} where id = '${id}' returning id`); check(`B non elimina ${t} di A`, r.rows?.length === 0)
  r = await as('authenticated', B, sql(vA)); check(`B non collega ${t} all'auto di A`, !!r.error)
}
r = await as('authenticated', B, 'select nome from vehicles'); check('B vede solo la propria auto', r.rows?.length === 1 && r.rows[0].nome === 'Auto di B')
r = await as('authenticated', B, `delete from vehicles where id = '${vA}' returning id`); check('B non elimina l auto di A', r.rows?.length === 0)
r = await as('authenticated', A, `insert into car_deadlines (vehicle_id, titolo) values ('${vA}', 'x')`); check('scadenza auto senza data e km rifiutata', !!r.error)
await db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
r = (await db.query('select count(*)::int c from expenses')).rows[0].c; check('rieseguire lo schema non cancella dati', r === 2)
await as('authenticated', A, `delete from vehicles where id = '${vA}'`)
r = (await db.query(`select ((select count(*) from car_services) + (select count(*) from car_fuel) + (select count(*) from car_docs) + (select count(*) from car_expenses) + (select count(*) from car_deadlines))::int as c`)).rows[0].c; check('eliminando l auto spariscono le sue registrazioni', r === 0)
for (const t of ['homes', 'expenses', 'deadlines', 'items', 'shopping', 'docs', 'vehicles', 'car_deadlines', 'car_services', 'car_expenses', 'car_fuel', 'car_docs']) {
  r = await as('anon', null, `select * from ${t}`); check(`anon non legge ${t}`, !!r.error, r.error ?? '')
  r = await as('anon', null, `delete from ${t}`); check(`anon non elimina da ${t}`, !!r.error)
  r = await as('authenticated', null, `select * from ${t}`); check(`login senza utente non legge ${t}`, !r.error && r.rows.length === 0)
}
r = await as('anon', null, `insert into expenses (descrizione) values ('x')`); check('anon non inserisce', !!r.error)
r = await as('authenticated', A, `select crea_casa_per_nuovo_utente()`); check('funzione trigger non richiamabile dal client', !!r.error, r.error ?? '')
r = (await db.query(`select count(*)::int c from pg_tables where schemaname='public' and not rowsecurity`)).rows[0].c; check('tutte le tabelle public hanno RLS', r === 0)
// chiavi Gemini: nessun accesso dal client, nemmeno alle proprie
await db.exec(`insert into public.ai_keys (user_id, key_enc, hint) values ('${A}', 'cifrata', '1234')`)
for (const [role, uid] of [['anon', null], ['authenticated', A], ['authenticated', B]]) {
  const who = uid === A ? 'A' : uid === B ? 'B' : 'anon'
  r = await as(role, uid, 'select * from ai_keys'); check(`${who} non legge le chiavi AI`, !!r.error)
  r = await as(role, uid, `insert into ai_keys (user_id, key_enc) values ('${B}', 'x')`); check(`${who} non scrive chiavi AI`, !!r.error)
  r = await as(role, uid, 'delete from ai_keys'); check(`${who} non elimina chiavi AI`, !!r.error)
}
console.log(results.join('\n'))
