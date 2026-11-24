/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ASSISTANT_ENABLED?: string
  readonly VITE_DEMO_URL?: string
  readonly VITE_PASSWORD_RESET_ENABLED?: string
}
