import { useRef, useState } from 'react'
import { PROGRAM_DAYS } from '../domain/program'
import { useApp } from '../store/context'
import { downloadBackup, readImportFile } from '../store/storage'
import { DayWeightList } from './TrackWeightList'
import { DownloadIcon, TrashIcon, UploadIcon } from './icons'
import { PlateInventoryEditor } from './PlateInventoryEditor'
import { RestTierPicker } from './RestTierPicker'

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

      {PROGRAM_DAYS.map((day) => (
        <section className="card" key={day.id}>
          <h2 className="card-title">
            {day.label} · {day.focus}
          </h2>
          <DayWeightList
            day={day}
            weightFor={(key) => data.tracks[key].weight}
            stageFor={(key) => data.tracks[key].stage}
            onChange={(key, weight) => dispatch({ type: 'updateTrackWeight', key, weight })}
          />
        </section>
      ))}

      <section className="card">
        <h2 className="card-title">Rest timer</h2>
        <p className="muted small">
          Countdown starts automatically when you log a set, using the rest time for that tier.
        </p>
        <RestTierPicker
          value={data.settings.restByTier}
          onChange={(tier, seconds) =>
            dispatch({
              type: 'updateSettings',
              patch: { restByTier: { ...data.settings.restByTier, [tier]: seconds } },
            })
          }
        />

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

      <section className="card">
        <h2 className="card-title">Bar & plates</h2>
        <p className="muted small">
          Used to show the plates to put on each side of the bar during a workout.
        </p>
        <PlateInventoryEditor
          value={data.settings.plates}
          onChange={(plates) => dispatch({ type: 'updateSettings', patch: { plates } })}
        />
      </section>

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
