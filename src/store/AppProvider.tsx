import { useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { AppData } from '../domain/types'
import { AppContext } from './context'
import { reducer } from './reducer'
import { loadData, saveData } from './storage'

function init(): AppData {
  return loadData()
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    saveData(data)
  }, [data])

  return <AppContext.Provider value={{ data, dispatch }}>{children}</AppContext.Provider>
}
