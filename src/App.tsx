import { useCallback, useEffect, useState } from 'react'
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
import { clearRestTimer, loadRestTimer, saveRestTimer } from './store/restTimer'
import type { RestTimerState } from './store/restTimer'

function Shell() {
  const { data } = useApp()
  const [tab, setTab] = useState<Tab>('workout')
  // Seeded from storage so a reload, or the OS reclaiming the PWA while the
  // phone is locked, resumes the timer in place instead of losing it.
  const [rest, setRest] = useState<RestTimerState | null>(() => loadRestTimer())

  const startRest = useCallback(
    (tier: Tier) => {
      const range = data.settings.restByTier[tier]
      const sessionId = data.activeSession?.id
      if (!range || range.max <= 0 || !sessionId) return
      setRest({
        startedAt: Date.now(),
        min: range.min,
        max: range.max,
        sessionId,
        blocked: range.min > 0,
      })
    },
    [data.settings.restByTier, data.activeSession?.id],
  )

  // A timer left over from a finished or discarded session never shows up.
  const activeRest = rest && rest.sessionId === data.activeSession?.id ? rest : null

  // Mirror the running timer to storage; dismissing it, finishing the session,
  // or letting it go stale clears the saved copy.
  useEffect(() => {
    if (activeRest) saveRestTimer(activeRest)
    else clearRestTimer()
  }, [activeRest])

  // Rest unlocks itself once the minimum rest time has passed; the timer bar's
  // own ticker only drives the countdown display.
  useEffect(() => {
    if (!activeRest?.blocked) return
    const remaining = activeRest.startedAt + activeRest.min * 1000 - Date.now()
    const id = window.setTimeout(
      () =>
        setRest((current) =>
          current?.startedAt === activeRest.startedAt ? { ...current, blocked: false } : current,
        ),
      Math.max(0, remaining),
    )
    return () => window.clearTimeout(id)
  }, [activeRest])

  const resting = activeRest?.blocked ?? false

  if (!data.settings.setupComplete) return <Onboarding />

  const summary = data.lastSummaryId
    ? data.sessions.find((session) => session.id === data.lastSummaryId)
    : undefined

  return (
    <div className="app">
      <TopBar />

      <main className="app-main">
        {tab === 'workout' &&
          (data.activeSession ? (
            <SessionScreen onSetLogged={startRest} resting={resting} />
          ) : (
            <StartSessionCard />
          ))}
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
