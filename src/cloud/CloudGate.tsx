import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import App from '../App'
import { AccountContext } from '../account'
import { cloudBackend } from '../data/cloudBackend'
import { DataProvider } from '../data/store'
import { configProblem } from '../lib/config'
import { getClient } from '../lib/supabase'
import { AuthScreen, ConfigMissing, LoadingScreen, ResetPasswordScreen } from './screens'

export default function CloudGate() {
  const problem = configProblem()
  if (problem) return <ConfigMissing problem={problem} />
  return <Gate />
}

function Gate() {
  const sb = useMemo(() => getClient(), [])
  const backend = useMemo(() => cloudBackend(sb), [sb])
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => setSession(null)).finally(() => setLoading(false))
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      setSession(s)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [sb])

  const account = useMemo(
    () => ({
      mode: 'cloud' as const,
      email: session?.user.email ?? null,
      signOut: async () => { await sb.auth.signOut({ scope: 'local' }); window.location.hash = '#/' },
      changePassword: async (password: string) => {
        const { error } = await sb.auth.updateUser({ password })
        if (error) throw error
      },
    }),
    [sb, session?.user.email],
  )

  if (loading) return <LoadingScreen />
  if (session && recovery) return <ResetPasswordScreen sb={sb} onDone={() => setRecovery(false)} />
  if (!session) return <AuthScreen sb={sb} />

  return (
    <AccountContext.Provider value={account}>
      {/* key: cambiando account si ricarica sempre la casa dell'utente corretto */}
      <DataProvider key={session.user.id} backend={backend} autoRefresh>
        <App />
      </DataProvider>
    </AccountContext.Provider>
  )
}
