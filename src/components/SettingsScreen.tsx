import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { e1rmForStage } from '../domain/onerm'
import {
  dayForSlot,
  programDays,
  resolveLift,
  slotsForTier,
  stageSpec,
  trackKey,
} from '../domain/program'
import type { LiftId, ProgramDay, Tier } from '../domain/types'
import { formatWeight, minWeightForTier } from '../domain/units'
import { WARMUP_METHOD_HINTS, WARMUP_METHOD_LABELS, WARMUP_METHODS } from '../domain/warmup'
import { useApp } from '../store/context'
import { downloadBackup, readImportFile } from '../store/storage'
import { MoveButtons, WeightRow } from './TrackWeightList'
import { DownloadIcon, TrashIcon, UploadIcon } from './icons'
import { PlateInventoryEditor } from './PlateInventoryEditor'
import { RestTierPicker } from './RestTierPicker'
import { WeightInput } from './WeightInput'

/** One lift's T1 and T2 working weights, side by side. */
function MainLiftGrid() {
  const { data, dispatch } = useApp()
  const days = programDays(data.t3ByDay)
  const lifts = slotsForTier('T1', data.t3ByDay)

  return (
    <div className="lift-pair-list">
      {lifts.map(({ liftId }) => {
        const lift = resolveLift(data.lifts, liftId)
        return (
          <div className="lift-pair" key={liftId}>
            <div className="lift-pair-head">
              <span className="weight-name">{lift.name}</span>
              <span className="muted tiny">
                T1 {dayForSlot(days, liftId, 'T1')?.label ?? '—'} · T2{' '}
                {dayForSlot(days, liftId, 'T2')?.label ?? '—'}
              </span>
            </div>
            <div className="lift-pair-grid">
              {(['T1', 'T2'] as Tier[]).map((tier) => {
                const key = trackKey(liftId, tier)
                const track = data.tracks[key]
                const stage = track?.stage ?? 0
                const spec = stageSpec(tier, stage)
                const e1rm = track ? e1rmForStage(track.weight, tier, stage) : null
                return (
                  <div className="lift-pair-cell" key={tier}>
                    <div className="lift-pair-tag">
                      <span className={`tier-dot tier-${tier.toLowerCase()}`}>{tier}</span>
                      <span className="muted tiny">
                        {spec.sets}×{spec.reps}+ · stage {stage + 1}
                      </span>
                    </div>
                    <WeightInput
                      compact
                      value={track?.weight ?? 0}
                      label={`${lift.name} ${tier}`}
                      min={minWeightForTier(tier)}
                      onChange={(weight) => dispatch({ type: 'updateTrackWeight', key, weight })}
                    />
                    {e1rm !== null && (
                      <span className="lift-pair-e1rm" title="Estimated one-rep max (Epley formula)">
                        e1RM {formatWeight(e1rm)} lb
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Every accessory the user has configured, with its working weight. */
function T3LibraryList() {
  const { data, dispatch } = useApp()

  if (data.t3Library.length === 0) {
    return <p className="muted small">No T3 exercises yet — add one below.</p>
  }

  return (
    <ul className="weight-list">
      {data.t3Library.map((liftId) => {
        const key = trackKey(liftId, 'T3')
        const track = data.tracks[key]
        return (
          <WeightRow
            key={liftId}
            lift={resolveLift(data.lifts, liftId)}
            tier="T3"
            weight={track?.weight ?? 0}
            stage={0}
            showStage={false}
            removeLabel={`Delete ${resolveLift(data.lifts, liftId).name} from your T3 list`}
            onRemove={() => dispatch({ type: 'deleteT3', liftId })}
            onChange={(weight) => dispatch({ type: 'updateTrackWeight', key, weight })}
          />
        )
      })}
    </ul>
  )
}

function AddT3Form() {
  const { dispatch } = useApp()
  const [name, setName] = useState('')
  const [barbell, setBarbell] = useState(false)

  const trimmed = name.trim()
  const canAdd = trimmed.length > 0

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canAdd) return
    dispatch({ type: 'createT3', name: trimmed, barbell })
    setName('')
    setBarbell(false)
  }

  return (
    <form className="accessory-add" onSubmit={submit}>
      <label className="accessory-check">
        <input
          type="checkbox"
          checked={barbell}
          onChange={(event) => setBarbell(event.target.checked)}
        />
        Barbell
      </label>
      <input
        className="accessory-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={barbell ? 'e.g. Curl' : 'Add T3 exercise'}
        aria-label="New T3 exercise"
        maxLength={40}
      />
      <button type="submit" className="btn btn-ghost accessory-submit" disabled={!canAdd}>
        Add
      </button>
      {barbell && <p className="accessory-note">“Barbell” is added automatically.</p>}
    </form>
  )
}

/** Picks which of the library accessories a single day runs. */
function DayT3Picker({ day }: { day: ProgramDay }) {
  const { data, dispatch } = useApp()
  const assigned = day.slots
    .filter((slot) => slot.tier === 'T3')
    .map((slot) => resolveLift(data.lifts, slot.liftId))
  const assignedIds = assigned.map((lift) => lift.id)
  const available = data.t3Library
    .filter((liftId) => !assignedIds.includes(liftId))
    .map((liftId) => resolveLift(data.lifts, liftId))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="day-t3">
      {assigned.length > 0 ? (
        <ul className="day-t3-list">
          {assigned.map((lift, index) => (
            <li className="day-t3-row" key={lift.id}>
              <span className="tier-dot tier-t3">T3</span>
              <span className="day-t3-name">{lift.name}</span>
              <MoveButtons
                labels={{
                  up: `Move ${lift.name} earlier in ${day.label}`,
                  down: `Move ${lift.name} later in ${day.label}`,
                }}
                canMoveUp={index > 0}
                canMoveDown={index < assigned.length - 1}
                onMove={(direction) =>
                  dispatch({ type: 'moveT3', dayId: day.id, liftId: lift.id, direction })
                }
              />
              <button
                type="button"
                className="row-remove"
                aria-label={`Remove ${lift.name} from ${day.label}`}
                onClick={() => dispatch({ type: 'unassignT3', dayId: day.id, liftId: lift.id })}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small day-t3-empty">No accessories on this day.</p>
      )}

      {available.length > 0 ? (
        <select
          className="t3-select"
          value=""
          aria-label={`Add a T3 exercise to ${day.label}`}
          onChange={(event) => {
            const liftId = event.target.value as LiftId
            if (liftId) dispatch({ type: 'assignT3', dayId: day.id, liftId })
          }}
        >
          <option value="">Add T3…</option>
          {available.map((lift) => (
            <option key={lift.id} value={lift.id}>
              {lift.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="muted tiny day-t3-note">
          {data.t3Library.length === 0
            ? 'Add T3 exercises in the Lifts card first.'
            : 'Every T3 in your list is already on this day.'}
        </p>
      )}
    </div>
  )
}

export function SettingsScreen() {
  const { data, dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const days = programDays(data.t3ByDay)

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
        <h2 className="card-title">Lifts</h2>
        <p className="muted small">
          One working weight per lift. Every day uses the same weight for it. e1RM is an Epley
          estimate from the current weight and the rep target of the current stage.
        </p>

        <MainLiftGrid />

        <h3 className="settings-subtitle">T3 · accessories</h3>
        <p className="muted small">
          3×15+. No automatic weight changes — chase reps, then add weight. Pick which days run
          them below.
        </p>
        <T3LibraryList />
        <AddT3Form />
      </section>

      <section className="card">
        <h2 className="card-title">Days</h2>
        <p className="muted small">
          T1 and T2 are fixed by GZCLP. Add or remove T3 accessories from your list for each day.
        </p>
        <div className="day-list">
          {days.map((day) => (
            <div className="day-block" key={day.id}>
              <div className="day-block-head">
                <span className="day-block-label">{day.label}</span>
                <span className="muted tiny">{day.focus}</span>
              </div>
              <div className="day-slots">
                {day.slots
                  .filter((slot) => slot.tier !== 'T3')
                  .map((slot) => (
                    <span className="day-slot" key={slot.tier}>
                      <span className={`tier-dot tier-${slot.tier.toLowerCase()}`}>{slot.tier}</span>
                      {resolveLift(data.lifts, slot.liftId).name}
                    </span>
                  ))}
              </div>
              <DayT3Picker day={day} />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Rest timer</h2>
        <p className="muted small">
          Starts automatically when you log a set. Skip unlocks at the minimum; the bar warns once
          you pass the maximum.
        </p>
        <RestTierPicker
          value={data.settings.restByTier}
          onChange={(tier, range) =>
            dispatch({
              type: 'updateSettings',
              patch: { restByTier: { ...data.settings.restByTier, [tier]: range } },
            })
          }
        />

        <label className="toggle-row">
          <span>
            <span className="toggle-title">Haptics</span>
            <span className="muted small">Vibrate when rest is ready and at max rest</span>
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
        <h2 className="card-title">Warmups</h2>
        <p className="muted small">
          T1 and T2 show a checkable warmup ramp above the work sets, based on{' '}
          <a
            className="inline-link"
            href="https://www.baystrength.com/calculating-warmup-sets/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bay Strength's warmup guide
          </a>
          . Weights are rounded to the nearest 5 lb and use the bar weight from Bar & plates. Changes
          apply to new workouts. T3 accessories have no warmup.
        </p>
        <div className="chip-row warmup-method-row" role="group" aria-label="Warmup method">
          {WARMUP_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              className={`chip ${data.settings.warmupMethod === method ? 'is-selected' : ''}`}
              aria-pressed={data.settings.warmupMethod === method}
              onClick={() => dispatch({ type: 'updateSettings', patch: { warmupMethod: method } })}
            >
              {WARMUP_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
        <p className="warmup-method-hint">{WARMUP_METHOD_HINTS[data.settings.warmupMethod]}</p>
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
