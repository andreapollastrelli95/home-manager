# Home e Car Manager: accesso, sincronizzazione e assistente Gemini

Questa guida serve a **chi gestisce l'app** (una volta sola). Chi la usa ogni giorno legge la [guida](home-car/guida/guida.pdf).

## Aggiornamento da Home Manager (se l'app è già online)

Fai i passi **in quest'ordine**:

1. (Consigliato) Ogni persona scarica un backup dalla pagina **Backup**.
2. Supabase → **SQL Editor** → incolla tutto [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Aggiunge solo le sei tabelle delle auto: le tabelle di casa e i loro dati non cambiano. L'editor può avvisare di operazioni «distruttive» perché lo script ricrea le regole di accesso: non cancella dati.
3. Pubblica la nuova versione (merge del ramo in `main`).
4. Facoltativo: attiva l'assistente (sezione 9).

Se pubblichi prima di eseguire lo schema, l'area Home continua a funzionare e l'area Car mostra cosa manca, senza salvare nulla.

Come funziona: ogni persona crea il proprio account e ha **i propri dati privati di casa e auto**. I dati stanno online in un database Supabase protetto da *Row Level Security* (RLS): il database stesso impedisce a un account di leggere o modificare i dati di un altro. Non esiste nessuna casa condivisa tra familiari.

| | Demo | App con login |
|---|---|---|
| Indirizzo | `/demo/` | radice del sito (app definitiva) |
| Dati | fittizi, solo nel browser | veri, online, per ogni account |
| Sincronizzazione tra dispositivi | no | sì |

## 1. Crea il progetto Supabase

1. Vai su <https://supabase.com>, accedi e scegli **New project**.
2. Scegli un nome (es. `home-manager`), una regione europea (es. Frankfurt) e una password per il database (conservala: l'app **non** la usa).
3. Attendi qualche minuto che il progetto sia pronto.

## 2. Crea le tabelle e le regole di sicurezza

1. Nel progetto apri **SQL Editor → New query**.
2. Incolla tutto il contenuto del file [`supabase/schema.sql`](../supabase/schema.sql) e premi **Run**. Si può eseguire più volte senza danni.
3. Controlla in **Table Editor** che esistano `homes`, `expenses`, `deadlines`, `items`, `shopping`, `docs`, `vehicles`, `car_deadlines`, `car_services`, `car_expenses`, `car_fuel`, `car_docs` e che ognuna mostri **RLS enabled**.

Cosa fa lo schema: abilita RLS su tutte le tabelle, toglie ogni permesso a chi non ha fatto il login (`anon`), consente a ogni utente di leggere, aggiungere, modificare ed eliminare **solo** le righe con `user_id = auth.uid()` crea una casa vuota per ogni nuovo account e impedisce di collegare una registrazione all'auto di un'altra persona.

## 3. Impostazioni di accesso (Authentication)

- **Authentication → Sign In / Providers → Email**: lascia attivo l'accesso con email e password. Imposta la lunghezza minima della password a **8**.
- **Authentication → URL Configuration**:
  - *Site URL*: l'indirizzo dell'app con login, es. `https://andreapollastrelli95.github.io/home-manager/`
  - *Redirect URLs*: aggiungi lo stesso indirizzo (e `http://localhost:5173/` se la provi sul computer).
- **Email di conferma e recupero password**: con il servizio email predefinito di Supabase l'invio è molto limitato (pochi messaggi all'ora e, nei progetti nuovi, solo verso gli indirizzi dei membri del team). Per far registrare i familiari hai due strade:
  - **Consigliata**: configura un tuo servizio email in **Authentication → Emails → SMTP Settings** (esistono servizi con piano gratuito, per esempio Brevo o Resend). Così funzionano conferma email e «Password dimenticata?».
  - **Più semplice, meno sicura**: disattiva *Confirm email*. Gli account sono utilizzabili subito, ma chiunque conosca l'indirizzo può registrarsi con qualsiasi email, e il recupero password continua a richiedere un servizio email funzionante.
- Finché non hai un servizio email, nell'app il link «Password dimenticata?» è nascosto. Dopo aver configurato l'SMTP crea in GitHub (Variables) `VITE_PASSWORD_RESET_ENABLED` = `true` e rilancia la pubblicazione.
- I link ricevuti per email vanno aperti **sullo stesso dispositivo e browser** da cui sono stati richiesti (l'app usa il flusso PKCE).

## 4. Chiavi del progetto

In **Project Settings → API** copia:

- **Project URL** (es. `https://abcd1234.supabase.co`)
- la chiave **anon / publishable** (è pubblica per progettazione: la protezione sono le regole RLS)

> ⚠️ Non usare mai la chiave **service_role / secret** nell'app né nei file del progetto: dà accesso a tutti i dati. L'app la rifiuta e mostra un avviso, ma non farla arrivare fin lì.

## 5. Prova sul tuo computer (facoltativo)

```bash
copy .env.example .env.local       # Windows  (macOS/Linux: cp)
# apri .env.local e inserisci VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev                        # versione con login su http://localhost:5173
npm run dev:demo                   # versione demo
```

`.env.local` non viene mai salvato su Git. Senza configurazione l'app mostra una schermata che spiega cosa manca: non finge mai un accesso riuscito.

## 6. Pubblica su GitHub Pages

Il workflow [`.github/workflows/pubblica.yml`](../.github/workflows/pubblica.yml) pubblica l'**app con login alla radice** e la **demo in `/demo/`**.

1. Nel repository GitHub: **Settings → Secrets and variables → Actions → New repository secret**, e crea:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chiave anon / publishable
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Ogni modifica che arriva su `main` viene pubblicata da sola (oppure **Actions → Pubblica → Run workflow**).
4. A pubblicazione finita apri `https://<utente>.github.io/<repository>/`: deve comparire la schermata di accesso. Se i secret mancano, il workflow pubblica solo la demo e lo segnala con un avviso.

Il sito è pubblico, ma **i dati no**: senza login il database rifiuta ogni richiesta.

## 7. Verifica che gli account siano davvero separati

1. Apri l'app con due browser (o una finestra privata) e crea due account diversi, A e B.
2. In A aggiungi una spesa. In B controlla che la spesa **non** compaia e che la casa sia vuota.
3. Esci da A, rientra: i dati ci sono ancora. Accedi con A da un secondo dispositivo: ritrovi gli stessi dati.
4. Controllo tecnico nello **SQL Editor**: `select tablename, rowsecurity from pg_tables where schemaname = 'public';` — `rowsecurity` deve essere `true` ovunque.
5. Richiesta senza login (deve fallire con «permission denied»):
   ```bash
   curl "https://TUO-PROGETTO.supabase.co/rest/v1/expenses?select=*" -H "apikey: LA_TUA_CHIAVE_ANON"
   ```
6. Facoltativo, senza internet: `npm i --no-save @electric-sql/pglite` e poi `node supabase/verifica-rls.mjs` ripete in locale i controlli sulle regole RLS con Postgres in WebAssembly.

## 8. Dati esistenti

Nulla viene caricato in automatico. Dalla pagina **Backup e importazione** ogni persona può:

- importare un file di backup (`.json`) scaricato dalla vecchia versione;
- oppure, solo con il pulsante «Cerca dati salvati in questo browser», vedere l'anteprima dei dati rimasti in quel browser (per esempio quelli della demo, che sono fittizi) e scegliere se importarli.

In entrambi i casi c'è un'anteprima e serve una conferma: gli elementi vengono **aggiunti** a quelli già presenti.

## 9. Assistente AI con Gemini (facoltativo)

L'assistente usa Google Gemini tramite la funzione Supabase [`assistente`](../supabase/functions/assistente/index.ts): la chiave **resta sul server** e non finisce mai nell'app, nel repository o nei log. Finché manca, la pagina «Assistente» mostra le istruzioni e non invia nessun dato.

1. Crea una chiave su <https://aistudio.google.com> (**Get API key**) e scegli il nome del modello tra quelli disponibili per il tuo account.
2. Installa la [Supabase CLI](https://supabase.com/docs/guides/cli), poi `supabase login` e `supabase link --project-ref IL_TUO_PROJECT_REF`.
3. Copia `supabase/functions/.env.example` in `supabase/functions/.env` (ignorato da Git), inserisci `GEMINI_API_KEY` e `GEMINI_MODEL`, poi `supabase secrets set --env-file supabase/functions/.env`. In alternativa: dashboard → **Edge Functions → Secrets**.
4. Pubblica la funzione: `supabase functions deploy assistente`
5. Apri l'app → **Assistente** → **Ricontrolla**. Non serve ripubblicare il sito.

Prima di ogni invio la pagina mostra le sezioni che verranno trasmesse (scelte in base alla domanda e modificabili). Targhe, telefoni e link non vengono inviati; note e descrizioni sì. La funzione accetta solo utenti con il login. Le richieste consumano la quota del tuo account Gemini, anche quelle dei familiari; sul piano gratuito Google può usare i dati inviati per migliorare i suoi servizi: controlla le condizioni del tuo piano.

## 10. Cose da sapere

- **Origine condivisa**: tutte le pagine `*.github.io/<utente>/` condividono lo stesso «dominio» per il browser. Uno script di un'altra tua pagina sullo stesso sito potrebbe leggere la sessione salvata. Per una separazione più forte usa un dominio dedicato (anche un sottodominio) per l'app.
- **Password**: non vengono salvate né nel browser né nei file; la sessione resta attiva tramite un token che il browser conserva.
- **Progetti gratuiti Supabase**: possono essere messi in pausa dopo un periodo di inattività; si riattivano dalla dashboard.
- **Backup**: ogni persona può scaricare i propri dati in JSON dalla pagina Backup. Fai anche un backup del database dalla dashboard Supabase se i dati diventano importanti.
- **Uso locale** (`npm run build:local`, server Node e Electron): senza account e senza Supabase; la chiave Gemini si legge da `%USERPROFILE%\.app-personali\gemini.env`.
- **Promemoria**: si vedono aprendo l'app; non ci sono notifiche né email.
