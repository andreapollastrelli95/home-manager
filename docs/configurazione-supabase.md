# Configurare Supabase e pubblicare Home Manager con login

Questa guida serve a **chi gestisce l'app** (una volta sola). Chi la usa ogni giorno legge la [guida rapida](guida-rapida/guida-rapida.pdf).

Come funziona: ogni persona crea il proprio account e ha **una casa privata**. I dati stanno online in un database Supabase protetto da *Row Level Security* (RLS): il database stesso impedisce a un account di leggere o modificare i dati di un altro. Non esiste nessuna casa condivisa tra familiari.

| | Demo | App con login |
|---|---|---|
| Indirizzo | radice del sito | `/app/` |
| Dati | fittizi, solo nel browser | veri, online, per ogni account |
| Sincronizzazione tra dispositivi | no | sì |

## 1. Crea il progetto Supabase

1. Vai su <https://supabase.com>, accedi e scegli **New project**.
2. Scegli un nome (es. `home-manager`), una regione europea (es. Frankfurt) e una password per il database (conservala: l'app **non** la usa).
3. Attendi qualche minuto che il progetto sia pronto.

## 2. Crea le tabelle e le regole di sicurezza

1. Nel progetto apri **SQL Editor → New query**.
2. Incolla tutto il contenuto del file [`supabase/schema.sql`](../supabase/schema.sql) e premi **Run**. Si può eseguire più volte senza danni.
3. Controlla in **Table Editor** che esistano `homes`, `expenses`, `deadlines`, `items`, `shopping`, `docs` e che ognuna mostri **RLS enabled**.

Cosa fa lo schema: abilita RLS su tutte le tabelle, toglie ogni permesso a chi non ha fatto il login (`anon`), consente a ogni utente di leggere, aggiungere, modificare ed eliminare **solo** le righe con `user_id = auth.uid()` e crea una casa vuota per ogni nuovo account.

## 3. Impostazioni di accesso (Authentication)

- **Authentication → Sign In / Providers → Email**: lascia attivo l'accesso con email e password. Imposta la lunghezza minima della password a **8**.
- **Authentication → URL Configuration**:
  - *Site URL*: l'indirizzo dell'app con login, es. `https://andreapollastrelli95.github.io/home-manager-demo/app/`
  - *Redirect URLs*: aggiungi lo stesso indirizzo (e `http://localhost:5173/` se la provi sul computer).
- **Email di conferma e recupero password**: con il servizio email predefinito di Supabase l'invio è molto limitato (pochi messaggi all'ora e, nei progetti nuovi, solo verso gli indirizzi dei membri del team). Per far registrare i familiari hai due strade:
  - **Consigliata**: configura un tuo servizio email in **Authentication → Emails → SMTP Settings** (esistono servizi con piano gratuito, per esempio Brevo o Resend). Così funzionano conferma email e «Password dimenticata?».
  - **Più semplice, meno sicura**: disattiva *Confirm email*. Gli account sono utilizzabili subito, ma chiunque conosca l'indirizzo può registrarsi con qualsiasi email, e il recupero password continua a richiedere un servizio email funzionante.
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

Il workflow [`.github/workflows/pubblica.yml`](../.github/workflows/pubblica.yml) pubblica la **demo alla radice** e l'**app con login in `/app/`**.

1. Nel repository GitHub: **Settings → Secrets and variables → Actions → New repository secret**, e crea:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chiave anon / publishable
2. **Settings → Pages → Build and deployment → Source: GitHub Actions** (oggi la sorgente è il ramo `gh-pages`: dopo il cambio la pubblicazione passa dal workflow).
3. Fai il merge del ramo `feature/account-privati` in `main` (o lancia il workflow da **Actions → Pubblica → Run workflow**).
4. A pubblicazione finita apri `https://<utente>.github.io/<repository>/app/`: deve comparire la schermata di accesso. Se i secret mancano, il workflow pubblica solo la demo e lo segnala con un avviso.

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

## 9. Assistente AI (facoltativo)

L'assistente usa Google Gemini tramite una funzione Supabase, così la chiave Gemini **resta sul server** e non finisce mai nell'app. Finché non lo attivi, nella pagina «Assistente» compare «non ancora attivo» e non viene inviato nessun dato.

1. Installa la [Supabase CLI](https://supabase.com/docs/guides/cli) e accedi: `supabase login`, poi `supabase link --project-ref IL_TUO_PROJECT_REF`.
2. Salva i segreti (restano su Supabase): `supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=...`
3. Pubblica la funzione: `supabase functions deploy assistente`
4. In GitHub: **Settings → Secrets and variables → Actions → Variables** → crea `VITE_ASSISTANT_ENABLED` = `true` e rilancia il workflow.

Quando l'assistente è attivo, la pagina elenca prima dell'invio quali dati vengono trasmessi (domanda, spese, scadenze, oggetti, lista della spesa e documenti senza i link). La funzione accetta solo utenti con il login. Le richieste dipendono dalla quota del tuo account Gemini.

## 10. Cose da sapere

- **Origine condivisa**: tutte le pagine `*.github.io/<utente>/` condividono lo stesso «dominio» per il browser. Uno script di un'altra tua pagina sullo stesso sito potrebbe leggere la sessione salvata. Per una separazione più forte usa un dominio dedicato (anche un sottodominio) per l'app.
- **Password**: non vengono salvate né nel browser né nei file; la sessione resta attiva tramite un token che il browser conserva.
- **Progetti gratuiti Supabase**: possono essere messi in pausa dopo un periodo di inattività; si riattivano dalla dashboard.
- **Backup**: ogni persona può scaricare i propri dati in JSON dalla pagina Backup. Fai anche un backup del database dalla dashboard Supabase se i dati diventano importanti.
- **Uso locale** (`npm run build:local`, server Node e Electron): resta come prima, senza account e senza Supabase.
