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
for (const t of ['homes', 'expenses', 'deadlines', 'items', 'shopping', 'docs']) {
  r = await as('anon', null, `select * from ${t}`); check(`anon non legge ${t}`, !!r.error, r.error ?? '')
  r = await as('anon', null, `delete from ${t}`); check(`anon non elimina da ${t}`, !!r.error)
  r = await as('authenticated', null, `select * from ${t}`); check(`login senza utente non legge ${t}`, !r.error && r.rows.length === 0)
}
r = await as('anon', null, `insert into expenses (descrizione) values ('x')`); check('anon non inserisce', !!r.error)
r = await as('authenticated', A, `select crea_casa_per_nuovo_utente()`); check('funzione trigger non richiamabile dal client', !!r.error, r.error ?? '')
r = (await db.query(`select count(*)::int c from pg_tables where schemaname='public' and not rowsecurity`)).rows[0].c; check('tutte le tabelle public hanno RLS', r === 0)
console.log(results.join('\n'))
