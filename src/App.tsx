import { useCallback, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { HistoryScreen } from './components/HistoryScreen'
import { Onboarding } from './components/Onboarding'
import { OverviewScreen } from './components/OverviewScreen'
import { RestTimerBar } from './components/RestTimerBar'
import { SessionFooter } from './components/SessionFooter'
import { SessionScreen } from './components/SessionScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { StartSessionCard } from './components/StartSessionCard'
import { SummarySheet } from './components/SummarySheet'
import { TopBar } from './components/TopBar'
import type { Tier } from './domain/types'
import { AppProvider } from './store/AppProvider'
import { useApp } from './store/context'

function Shell() {
  const { data } = useApp()
  const [tab, setTab] = useState<Tab>('workout')
  const [rest, setRest] = useState<{
    startedAt: number
    min: number
    max: number
    sessionId: string
  } | null>(null)

  const startRest = useCallback(
    (tier: Tier) => {
      const range = data.settings.restByTier[tier]
      const sessionId = data.activeSession?.id
      if (!range || range.max <= 0 || !sessionId) return
      setRest({ startedAt: Date.now(), min: range.min, max: range.max, sessionId })
    },
    [data.settings.restByTier, data.activeSession?.id],
  )

  // Stale timers from a finished session are ignored rather than cleared in an effect.
  const activeRest = rest && rest.sessionId === data.activeSession?.id ? rest : null

  if (!data.settings.setupComplete) return <Onboarding />

  const summary = data.lastSummaryId
    ? data.sessions.find((session) => session.id === data.lastSummaryId)
    : undefined

  return (
    <div className="app">
      <TopBar />

      <main className="app-main">
        {tab === 'workout' &&
          (data.activeSession ? <SessionScreen onSetLogged={startRest} /> : <StartSessionCard />)}
        {tab === 'overview' && <OverviewScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </main>

      <div className="dock">
        {tab === 'workout' && data.activeSession && <SessionFooter />}
        {activeRest && (
          <RestTimerBar
            key={activeRest.startedAt}
            startedAt={activeRest.startedAt}
            min={activeRest.min}
            max={activeRest.max}
            haptics={data.settings.haptics}
            onDismiss={() => setRest(null)}
          />
        )}
        <BottomNav tab={tab} onChange={setTab} />
      </div>

      {summary && !data.activeSession && <SummarySheet session={summary} />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
