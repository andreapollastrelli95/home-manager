// Modalità di build:
//  - cloud (predefinita): account personali con Supabase
//  - demo  (vite build --mode demo): nessun login, dati fittizi solo nel browser
//  - local (npm run build:local = vite build --mode personale): uso personale con server Node locale
//    ("local" non può essere un nome di modalità Vite: è riservato ai file .env.local)
export type AppMode = 'cloud' | 'demo' | 'local'

export const MODE: AppMode = import.meta.env.MODE === 'demo' ? 'demo' : import.meta.env.MODE === 'personale' ? 'local' : 'cloud'

export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
export const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
// «Password dimenticata?» richiede un servizio email (SMTP) configurato su Supabase: visibile solo se attivato
export const RESET_ENABLED = import.meta.env.VITE_PASSWORD_RESET_ENABLED === 'true'
export const DEMO_URL = String(import.meta.env.VITE_DEMO_URL ?? '').trim()

// Una chiave "service_role" / "secret" nel client darebbe accesso a tutti i dati: la rifiutiamo.
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

export type ConfigProblem = 'missing' | 'secret-key' | 'bad-url' | null

export function configProblem(): ConfigProblem {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 'missing'
  // https obbligatorio, tranne per Supabase in locale (sviluppo)
  if (!/^(https:\/\/[^/\s]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)/.test(SUPABASE_URL)) return 'bad-url'
  if (isSecretKey(SUPABASE_ANON_KEY)) return 'secret-key'
  return null
}
