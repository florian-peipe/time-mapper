# Time Mapper — contributor primer

One-page orientation for anyone (human or AI) walking into this repo
cold. Skim this first, then dig into the directories that match your
task.

## What the app does

Private, on-device time tracker. User saves a few Places (home, work,
gym, …); the OS geofence service wakes a background task when they
cross the radius; the app logs entries, renders a Timeline + Stats, and
can notify on entry open/close and goal crossings. Nothing about
location leaves the device.

Expo SDK 54 + React Native 0.81 + Hermes. Expo Router for routing.
SQLite (via Drizzle + `expo-sqlite`) for persistence. Zustand for
cross-screen stores. Jest + `@testing-library/react-native` for
tests.

## Directory map

```
app/                    Expo Router file-based routes
  _layout.tsx           root: fonts, theme, crash reporting, bootstrap, SheetHost
  (onboarding)/         welcome → permissions → first place
  (tabs)/               timeline (index), places, stats, settings
  legal/                privacy / terms / impressum routes
src/
  background/tasks.ts   OS-wake geofence handler (defineTask at module eval)
  components/           shared primitives (Banner, Button, Card, Toggle, …)
  db/
    schema.ts           Drizzle schema (places, entries, pending_transitions, kv)
    migrations/         0000_init → 0003_goals + migrations.js entry for expo-sqlite
    repository/         PlacesRepo, EntriesRepo, PendingTransitionsRepo, KvRepo
    client.ts           device DB client + runMigrations
    testClient.ts       in-memory SQLite for Jest
  features/
    billing/            RevenueCat integration (usePro + useProMock fallback)
    diagnostics/        CSV export, JSON backup, reset-all-data, telemetry consent
    entries/            useEntries, useEntriesRange, useOngoingEntry, useWeekStats
    notifications/      notifier — fire, quiet-hours, consolidation, goal-reached
    onboarding/         useOnboardingGate + useKvRepo provider
    permissions/        useLocationPermission, useNotificationPermission
    places/             usePlaces, useClosestPlace, testFixtures
    tracking/           stateMachine, geofenceService, bootstrap, persistence,
                        trackingHealth
  lib/                  pure helpers (time, range, id, i18n, crash, geocode, routes)
  locales/              en.json, de.json — every user-facing string
  screens/              composed screens (AddPlace, EntryEdit, Legal, Onboarding,
                        Paywall, Places, Settings, Stats, Timeline)
  state/                Zustand stores: sheetStore, snackbarStore, uiStore,
                        dataVersionStore
  theme/                tokens, ThemeProvider, useTheme
  __tests__/            cross-feature (a11y, snapshots, critical-flows)
docs/
  SIDELOAD.md           how to install the unsigned IPA with Sideloadly
  legal/                markdown sources for privacy/terms/impressum
scripts/
  patch-ipa-for-sideloader.sh   fixes Sideloader's __LINKEDIT vmsize bug
  generate-icons.js     regenerates assets/icon.png from the brand motif
.github/workflows/
  ios-unsigned.yml      GH Actions build → unsigned .ipa artifact
```

## The tracking pipeline (most load-bearing code)

```
OS geofence event
    ↓
background/tasks.ts::register()          ← defineTask at module eval
    ↓
handleGeofencingEvent(data, nowS)
    ↓
loadState(entries, pending) → MachineState
    ↓
step(state, event)                        ← pure reducer
    ↓
applyEffects(effects, next, entries, pending, nowS)
    ↓
maybeNotifyForEffects(effects, places, nowS) ← user-visible notification
    ↓
maybeNotifyGoalReached(...)               ← "goal hit" follow-up
```

The state machine (`src/features/tracking/stateMachine.ts`) is pure:
`IDLE → PENDING_ENTER → ACTIVE → PENDING_EXIT → IDLE`, plus drive-by
and brief-step-out transitions that cancel themselves. Everything I/O
related lives in `persistence.ts` and `tasks.ts`. The machine is the
most-tested module in the repo (~40 unit tests).

On foreground, `bootstrap.ts::startForegroundReconcileWatcher` re-
registers geofences + runs an opportunistic CONFIRM pass and bumps
both `dataVersion` counters so any entry the bg task wrote surfaces
on the UI.

## Data flow

```
Drizzle schema  →  Repo (places/entries/pending/kv)
                      ↓ constructor-injected via provider
                   React hook (usePlaces, useEntries, …)
                      ↓ selects from repo + subscribes to version
                   Zustand `dataVersionStore` (bumpPlaces / bumpEntries)
                      ↓ any consumer re-queries on bump
                   Screens
```

Mutations go through repo methods (not direct SQL). The hook wrapping
the repo calls `bumpPlaces()` / `bumpEntries()` after a write so every
other consumer hook re-renders. The bg task bumps from `bootstrapTracking`
+ the foreground-reconcile watcher so OS-driven writes don't need
their own notify path.

## Conventions

- **i18n**: every user-facing string routes through `i18n.t(...)`.
  `src/locales/en.json` + `de.json` are kept in key-parity by
  `src/lib/__tests__/i18n-coverage.test.ts`. Use template vars
  (`{{name}}`) instead of string concatenation.
- **Theme tokens**: layout / color / typography all go through
  `useTheme()` and `tokens.ts`. No inline hex colors; no literal
  spacing numbers outside the `t.space[]` scale unless there's a
  specific reason (documented inline).
- **Tests**: use the repo providers
  (`PlacesRepoProvider`, `EntriesRepoProvider`) to inject in-memory
  DBs. Fixtures live in `src/features/places/testFixtures.ts`
  (shared `makePlace`). Native modules are mocked in `jest.setup.ts`
  — consistent defaults that individual tests override per-case.
- **Commits**: conventional-commit style (`feat|fix|chore|docs|
  refactor|test|ci: subject`). One concern per commit; ship small.
- **Comments**: only for non-obvious WHY. Well-named identifiers
  speak for themselves; don't narrate WHAT the code does.

## Build + run

- `npm ci` — install (use `npm install` if you're changing deps).
- `cp .env.example .env.local` — fill the keys you have; leave the
  rest empty. Without RevenueCat keys, `configureRevenueCat` throws but
  `usePro` catches it — app loads with `isPro: false`, purchases unavailable.
  Photon still works. Sentry silently disabled.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — `eslint .` with a zero-warning baseline.
- `npm test` — Jest. Currently 630 tests across 83 suites.
- `npm run build:check` — `expo export --platform ios`. Smoke test
  that Metro bundles cleanly.
- `npx expo start` — Expo Go flow. Geofencing only works inside a
  dev-client build; use `Settings → Developer → Simulate visit` to
  exercise the state machine from the UI.

## Ship paths

- **Sideload (free Apple ID, 7-day cert)** — `docs/SIDELOAD.md`.
  Uses the `ios-unsigned.yml` workflow artifact + Sideloadly (or
  Dadoum/Sideloader on Linux) + `scripts/patch-ipa-for-sideloader.sh`
  to work around Sideloader's iOS 17+ `__LINKEDIT` bug. Limits: no
  real background task wakes (sideload provisioning profile lacks the
  entitlement), 7-day cert, mock IAP.
- **TestFlight (paid Apple Developer $99/yr)** — `eas submit
  --profile production --platform ios` after filling the placeholders
  in `eas.json → submit.production.ios` (Apple ID, Team ID, ASC App
  ID). All entitlements work. Longer cert, proper distribution.
- **App Store / Play** — submit.production profiles in `eas.json` are
  wired; fill the user-provided items table in README before `eas
  submit`.

## User-provided items that aren't in the repo

See the table in `README.md` § "What the user provides". Key ones:

- `src/screens/Legal/contact.local.ts` (gitignored; copy the
  `.example.ts` and fill real Impressum details). Until this exists,
  the Impressum page renders the "not yet configured" variant — safe
  for dev builds, a §5 TMG violation for public release.
- `play-service-account.json` (gitignored) for Android submission.
- `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY` — without these the app
  stays in mock mode (UI-previewable, purchases throw).
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` — **not needed** anymore; we
  switched to Photon.
- `app.json → android.config.googleMaps.apiKey` — only required for
  the Android map preview. Without it that surface falls back to a
  warning Banner; everything else runs.

## Further reading

- `CHANGELOG.md` — release-by-release summary of what shipped and why.
- `docs/STATUS.md` — v1.1 feature matrix + third-party setup checklist
  + next-steps block for the invited TestFlight collaborator. Read
  first if you're picking up the handoff.
- Individual feature READMEs under `src/features/*/` — none written
  yet; source comments are the source of truth.
