import { useRef, useState } from 'react'
import { REST_CHOICES } from '../domain/program'
import type { Tier } from '../domain/types'
import { useApp } from '../store/context'
import { downloadBackup, readImportFile } from '../store/storage'
import { DownloadIcon, TrashIcon, UploadIcon } from './icons'
import { TrackWeightList } from './TrackWeightList'

const TIER_SECTIONS: readonly { tier: Tier; title: string; blurb: string }[] = [
  { tier: 'T1', title: 'T1 · main lifts', blurb: '5×3 → 6×2 → 10×1, last set AMRAP' },
  { tier: 'T2', title: 'T2 · secondary lifts', blurb: '3×10 → 3×8 → 3×6, last set AMRAP' },
  { tier: 'T3', title: 'T3 · accessories', blurb: '3×15+, manual weight only' },
]

export function SettingsScreen() {
  const { data, dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const imported = await readImportFile(file)
      dispatch({
        type: 'importData',
        data: { ...imported, settings: { ...imported.settings, setupComplete: true } },
      })
      setMessage('Backup imported.')
    } catch {
      setMessage('Import failed — that file is not a GZCLP backup.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const reset = () => {
    if (window.confirm('Delete every workout and reset all weights to defaults? This cannot be undone.')) {
      dispatch({ type: 'resetData' })
    }
  }

  return (
    <div className="stack">
      <h1 className="screen-title">Settings</h1>

      <section className="card">
        <h2 className="card-title">Rest timer</h2>
        <p className="muted small">Countdown starts automatically when you log a set.</p>
        <div className="chip-row">
          {REST_CHOICES.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={`chip ${data.settings.restSeconds === seconds ? 'is-selected' : ''}`}
              onClick={() => dispatch({ type: 'updateSettings', patch: { restSeconds: seconds } })}
            >
              {seconds / 60}:00
            </button>
          ))}
        </div>

        <label className="toggle-row">
          <span>
            <span className="toggle-title">Haptics</span>
            <span className="muted small">Vibrate when rest is over</span>
          </span>
          <input
            type="checkbox"
            className="toggle"
            checked={data.settings.haptics}
            onChange={(event) =>
              dispatch({ type: 'updateSettings', patch: { haptics: event.target.checked } })
            }
          />
        </label>
      </section>

      {TIER_SECTIONS.map(({ tier, title, blurb }) => (
        <section className="card" key={tier}>
          <h2 className="card-title">{title}</h2>
          <p className="muted small">{blurb}</p>
          <TrackWeightList
            tier={tier}
            weightFor={(key) => data.tracks[key].weight}
            stageFor={(key) => data.tracks[key].stage}
            onChange={(key, weight) => dispatch({ type: 'updateTrackWeight', key, weight })}
          />
        </section>
      ))}

      <section className="card">
        <h2 className="card-title">Data</h2>
        <p className="muted small">
          Everything lives on this device. Export a JSON backup before clearing browser data or
          switching phones.
        </p>
        <div className="button-row">
          <button type="button" className="btn btn-ghost" onClick={() => downloadBackup(data)}>
            <DownloadIcon />
            Export
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            Import
          </button>
          <button type="button" className="btn btn-ghost danger" onClick={reset}>
            <TrashIcon />
            Reset
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
        {message && <p className="note">{message}</p>}
      </section>

      <section className="card subtle">
        <h2 className="card-title">About</h2>
        <p className="muted small">
          GZCLP by Cody Lefever. Complete every rep and the app adds 5 lb to upper-body lifts or 10 lb
          to lower-body lifts. Miss a set and you move to the next rep scheme at the same weight;
          fail the last scheme and it resets to 90%.
        </p>
      </section>
    </div>
  )
}
