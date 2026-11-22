import { createContext, useContext } from 'react'
import type { Dispatch } from 'react'
import type { AppData } from '../domain/types'
import type { Action } from './reducer'

export interface AppContextValue {
  data: AppData
  dispatch: Dispatch<Action>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
