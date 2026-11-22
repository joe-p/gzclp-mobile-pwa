# GZCLP Tracker

A mobile-first, offline PWA for [GZCLP](https://www.reddit.com/r/gzcl/wiki/gzclp) — Cody Lefever's
linear progression program. Built to be used one-handed between sets.

## What it does

- **Fixed 4-day GZCLP rotation** (A1 / B1 / A2 / B2) with T1, T2, and T3 work.
- **Customizable T3 accessories.** Add or remove accessory exercises per day in Settings; the same
  exercise on multiple days shares one working weight.
- **Tracks current weight per lift and tier.** T1 bench and T2 bench are separate progressions, just
  like the spreadsheet.
- **Per-set logging.** Tap ✓ or ✗ for each set, including the AMRAP set.
- **AMRAP on the last set** of every lift, with an Epley e1RM estimate for T1/T2.
- **Automatic progression**:
  - Complete every rep → add 5 lb (upper body) or 10 lb (lower body).
  - Miss any set → move to the next rep scheme at the same weight.
  - Fail the final scheme → reset to the first scheme at ~90% of the working weight.
  - T3 accessories never change weight automatically.
- **Plate loading.** Enter the bar weight and how many pairs of each plate you own during onboarding
  or in Settings. Every exercise shows the plates to put on each side for its working weight, and
  warns when your rack can't make the exact jump.
- **Rest timer** starts when you log a set, with a configurable time per tier (T1/T2/T3), +30 s, and optional vibration.
- **History** of every session: sets, AMRAP reps, e1RM, and the weight earned for next time.
- **Resumable sessions** — reloading the app mid-workout picks up where you left off.
- **Interrupted workout?** Finish early; unfinished lifts keep their current weight.
- **Everything is local.** No account, no network. Export/import a JSON backup in Settings.

## The program

| Day | T1 (5×3 → 6×2 → 10×1) | T2 (3×10 → 3×8 → 3×6) | T3 (3×15+) |
| --- | ---------------------- | ---------------------- | ---------- |
| A1  | Squat                  | Bench Press            | Lat Pulldown |
| B1  | Overhead Press         | Deadlift               | Barbell Row |
| A2  | Bench Press            | Squat                  | Lat Pulldown |
| B2  | Deadlift               | Overhead Press         | Barbell Row |

The last set of every lift is AMRAP. Leave 1–2 reps in the tank rather than grinding to failure.
T1/T2 slots are fixed; each day's T3 list can be edited under Settings.

## Stack

React 19 + TypeScript + Vite, `vite-plugin-pwa` (Workbox precache, installable standalone), plain
CSS with a dark theme and safe-area support. State lives in React, persists to `localStorage`, and is
versioned/migrated on load. Progression logic is pure functions in `src/domain` and covered by Vitest.

## Development

```bash
npm install
npm run dev        # local dev server
npm run test       # unit tests (progression, sessions, storage, reducer)
npm run lint       # oxlint
npm run build      # typecheck + production build (also emits the service worker)
npm run preview    # serve the built PWA locally
npm run icons      # regenerate PWA/apple-touch icons from scripts/generate-icons.mjs
```

To try the installed PWA: run `npm run build && npm run preview`, open the URL on your phone (same
network) or on localhost, and use "Add to Home Screen". Service workers require HTTPS or localhost.

## Project layout

```
src/
  domain/       program definition, progression rules, session helpers, e1RM, formatting
  store/        reducer, persistence + backup migration, React provider/context
  components/   screens and UI pieces
  styles.css    design tokens and all component styles
scripts/        PWA icon generation
public/         icons, manifest assets
```

## Notes

- All weights are pounds, rounded to 5 lb plate jumps.
- Custom T3 exercises start at 45 lb and can be marked as barbell-loaded so plate math is shown.
- Progression is applied only when a session is finished, never mid-set.
- Resets round to the nearest 5 lb with an empty-bar floor.
