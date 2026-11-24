import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // La CSP consente le connessioni solo verso il progetto Supabase configurato
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  let connect = ''
  try {
    const origin = new URL(env.VITE_SUPABASE_URL).origin
    connect = `${origin} ${origin.replace(/^http/, 'ws')}`
  } catch { /* nessun Supabase configurato (demo / uso locale) */ }
  return {
    base: './',
    plugins: [react(), { name: 'csp-supabase', transformIndexHtml: (html: string) => html.replace('__SUPABASE_CONNECT__', connect) }],
  }
})
