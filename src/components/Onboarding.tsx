import { useState } from 'react'
import { ALL_TRACK_KEYS, PROGRAM_DAYS } from '../domain/program'
import type { RestByTier, Tier, TrackKey } from '../domain/types'
import { useApp } from '../store/context'
import { RestTierPicker } from './RestTierPicker'
import { TrackWeightList } from './TrackWeightList'

export function Onboarding() {
  const { data, dispatch } = useApp()
  const [weights, setWeights] = useState<Record<TrackKey, number>>(() => {
    const initial = {} as Record<TrackKey, number>
    for (const key of ALL_TRACK_KEYS) initial[key] = data.tracks[key].weight
    return initial
  })
  const [restByTier, setRestByTier] = useState<RestByTier>(() => ({ ...data.settings.restByTier }))

  const setWeight = (key: TrackKey, weight: number) => {
    setWeights((current) => ({ ...current, [key]: weight }))
  }

  const setRest = (tier: Tier, seconds: number) => {
    setRestByTier((current) => ({ ...current, [tier]: seconds }))
  }

  const firstDay = PROGRAM_DAYS[0]

  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <header className="onboarding-hero">
          <span className="brand-mark large" aria-hidden="true">
            GZ
          </span>
          <span className="eyebrow">GZCLP · 4-day linear progression</span>
          <h1>Set your starting weights</h1>
          <p className="muted">
            Enter the weight you can lift today for the target reps. The app handles progression from
            there — weight never changes mid-session.
          </p>
        </header>

        <section className="card">
          <h2 className="card-title">T1 · main lifts</h2>
          <p className="muted small">5×3 with the last set AMRAP. Start near your 3–5 rep max.</p>
          <TrackWeightList tier="T1" weightFor={(key) => weights[key]} onChange={setWeight} />
        </section>

        <section className="card">
          <h2 className="card-title">T2 · secondary lifts</h2>
          <p className="muted small">3×10 with the last set AMRAP. Around 60% of your T1 weight works well.</p>
          <TrackWeightList tier="T2" weightFor={(key) => weights[key]} onChange={setWeight} />
        </section>

        <section className="card">
          <h2 className="card-title">T3 · accessories</h2>
          <p className="muted small">3×15+. No automatic weight changes — chase reps, then add weight.</p>
          <TrackWeightList tier="T3" weightFor={(key) => weights[key]} onChange={setWeight} />
        </section>

        <section className="card">
          <h2 className="card-title">Rest timer</h2>
          <p className="muted small">
            Starts automatically whenever you log a set, using the rest time for that tier.
          </p>
          <RestTierPicker value={restByTier} onChange={setRest} />
        </section>

        <button
          type="button"
          className="btn btn-primary btn-block start-btn"
          onClick={() => dispatch({ type: 'saveSetup', weights, restByTier })}
        >
          Start training
        </button>
        <p className="muted tiny center">
          First up: {firstDay.label} · {firstDay.focus}. Everything is editable in Settings.
        </p>
      </div>
    </div>
  )
}
