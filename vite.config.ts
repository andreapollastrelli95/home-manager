import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // La CSP consente le connessioni solo verso il progetto Supabase configurato
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const rawUrl = String(env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  let connect = ''
  try {
    const origin = new URL(rawUrl).origin
    connect = `${origin} ${origin.replace(/^http/, 'ws')}`
  } catch { /* nessun indirizzo valido */ }
  // Versione con account senza un indirizzo leggibile: ripiego sui progetti Supabase (*.supabase.co)
  if (!connect && mode !== 'demo' && mode !== 'personale') connect = 'https://*.supabase.co wss://*.supabase.co'
  console.log(`[csp] modalità=${mode} connect-src aggiuntivo: ${connect || '(nessuno)'}`)
  return {
    base: './',
    plugins: [react(), { name: 'csp-supabase', transformIndexHtml: (html: string) => html.replace('__SUPABASE_CONNECT__', connect) }],
  }
})
