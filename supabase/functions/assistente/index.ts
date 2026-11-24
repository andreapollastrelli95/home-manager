// Funzione Supabase "assistente": inoltra a Google Gemini la domanda e i dati inviati dall'app.
// La chiave Gemini vive SOLO nei segreti di Supabase (GEMINI_API_KEY, GEMINI_MODEL), mai nell'app.
// Può essere usata solo da utenti che hanno fatto il login (la sola chiave pubblica "anon" non basta).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const reply = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ ok: false, error: 'Metodo non consentito.' }, 405)

  // 1) solo utenti autenticati
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return reply({ ok: false, error: 'Accesso necessario: esci e accedi di nuovo.' }, 401)

  // 2) configurazione
  const key = Deno.env.get('GEMINI_API_KEY')
  const model = Deno.env.get('GEMINI_MODEL')
  if (!key || !model) return reply({ ok: false, error: 'L’assistente non è ancora configurato sul servizio.' })

  // 3) richiesta
  let body: { question?: unknown; context?: unknown }
  try { body = await req.json() } catch { return reply({ ok: false, error: 'Richiesta non valida.' }, 400) }
  const question = String(body.question ?? '').trim().slice(0, 500)
  if (!question) return reply({ ok: false, error: 'Scrivi una domanda.' }, 400)
  const context = JSON.stringify(body.context ?? {})
  if (context.length > 200_000) return reply({ ok: false, error: 'Ci sono troppi dati da inviare all’assistente.' }, 413)

  const prompt =
    "Sei l'assistente di Home Manager, un gestionale domestico. Rispondi in italiano, in modo breve e pratico, " +
    "usando solo i dati dell'app qui sotto. Se i dati non bastano, dillo.\n\nDATI (JSON):\n" + context + '\n\nDOMANDA: ' + question

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    if (!res.ok) {
      const msg = res.status === 429 ? 'Il servizio AI ha raggiunto il limite di richieste: riprova più tardi.' : `Il servizio AI ha risposto con un errore (${res.status}).`
      return reply({ ok: false, error: msg })
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    return text ? reply({ ok: true, text }) : reply({ ok: false, error: 'L’assistente non ha restituito alcuna risposta.' })
  } catch {
    return reply({ ok: false, error: 'Non riesco a contattare il servizio AI. Riprova più tardi.' })
  }
})
