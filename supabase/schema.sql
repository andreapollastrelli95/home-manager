-- Home Manager: schema Supabase con Row Level Security.
-- Esegui questo file UNA volta in Supabase > SQL Editor > New query > Run.
-- Ogni persona vede e modifica solo i propri record (user_id = auth.uid()).
-- Il ruolo "anon" (chi non ha fatto il login) non ha alcun permesso sulle tabelle.

-- La casa privata di ogni account (una per utente)
create table if not exists public.homes (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default 'La mia casa' check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  descrizione text not null check (char_length(descrizione) between 1 and 200),
  categoria   text not null default 'Altro' check (char_length(categoria) <= 60),
  importo     numeric(12, 2) not null default 0,
  data        date,
  scadenza    date,
  pagata      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.deadlines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titolo     text not null check (char_length(titolo) between 1 and 200),
  tipo       text not null default 'Scadenza' check (char_length(tipo) <= 60),
  data       date not null,
  note       text not null default '' check (char_length(note) <= 1000),
  fatto      boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 200),
  stanza     text not null default '' check (char_length(stanza) <= 100),
  quantita   numeric(12, 2) not null default 1,
  valore     numeric(12, 2) not null default 0,
  note       text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.shopping (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome       text not null check (char_length(nome) between 1 and 200),
  quantita   text not null default '1' check (char_length(quantita) <= 60),
  preso      boolean not null default false,
  created_at timestamptz not null default now()
);

-- Documenti: solo metadati e link, nessun file
create table if not exists public.docs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titolo     text not null check (char_length(titolo) between 1 and 200),
  tipo       text not null default 'Altro' check (char_length(tipo) <= 60),
  link       text not null default '' check (char_length(link) <= 2000),
  scadenza   date,
  note       text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_idx  on public.expenses  (user_id);
create index if not exists deadlines_user_idx on public.deadlines (user_id);
create index if not exists items_user_idx     on public.items     (user_id);
create index if not exists shopping_user_idx  on public.shopping  (user_id);
create index if not exists docs_user_idx      on public.docs      (user_id);

-- Row Level Security su TUTTE le tabelle esposte al client
alter table public.homes     enable row level security;
alter table public.expenses  enable row level security;
alter table public.deadlines enable row level security;
alter table public.items     enable row level security;
alter table public.shopping  enable row level security;
alter table public.docs      enable row level security;

-- Nessun permesso a chi non ha fatto il login; CRUD solo agli utenti autenticati (e comunque filtrato dalla RLS)
revoke all on public.homes, public.expenses, public.deadlines, public.items, public.shopping, public.docs from anon;
grant select, insert, update, delete on public.homes, public.expenses, public.deadlines, public.items, public.shopping, public.docs to authenticated;

do $$
declare t text;
begin
  foreach t in array array['homes', 'expenses', 'deadlines', 'items', 'shopping', 'docs'] loop
    execute format('drop policy if exists "own_select" on public.%I', t);
    execute format('drop policy if exists "own_insert" on public.%I', t);
    execute format('drop policy if exists "own_update" on public.%I', t);
    execute format('drop policy if exists "own_delete" on public.%I', t);
    execute format('create policy "own_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Ogni nuovo account riceve una casa vuota (nessun dato d'esempio, nessun dato di altri)
create or replace function public.crea_casa_per_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.homes (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists crea_casa_dopo_registrazione on auth.users;
create trigger crea_casa_dopo_registrazione
  after insert on auth.users
  for each row execute function public.crea_casa_per_nuovo_utente();

-- La funzione del trigger non deve essere richiamabile dal client
revoke all on function public.crea_casa_per_nuovo_utente() from public, anon, authenticated;
