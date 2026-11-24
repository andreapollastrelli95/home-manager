import { createContext, useContext } from 'react'
import { MODE, type AppMode } from './lib/config'

export interface Account {
  mode: AppMode
  email: string | null
  signOut: (() => Promise<void>) | null
  changePassword: ((password: string) => Promise<void>) | null
}

export const AccountContext = createContext<Account>({ mode: MODE, email: null, signOut: null, changePassword: null })
export const useAccount = () => useContext(AccountContext)
