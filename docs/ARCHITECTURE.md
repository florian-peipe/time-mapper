# Architecture

Reading order for anyone (human or AI) opening this repo cold:

1. This file.
2. `CLAUDE.md` — the top-of-tree primer.
3. `docs/V1_LAUNCH_PLAN.md` — what's left before ship.

---

## Mental model

Time Mapper is a **local-first** time tracker. The OS geofence service is
the only thing that wakes the app in the background; everything else is
reactive UI over an SQLite store.

Three pillars:

1. A **pure state machine** (`src/features/tracking/stateMachine.ts`)
   translates geofence events into ordered `Effect[]`. No I/O.
2. A **persistence layer** (`src/features/tracking/persistence.ts`)
   applies those effects inside `db.transaction(...)`. Atomic.
3. A **reactive UI** subscribed to the `dataVersionStore` re-queries on
   every mutation. Works the same whether the mutation came from the UI,
   a foreground reconcile, or a cold-wake background task.

---

## The tracking pipeline

```
┌──────────────────────────────┐
│  OS geofence service         │
│  (iOS LocationRegion / …)    │
└──────────────┬───────────────┘
               │
               ▼  dispatches to defineTask
┌──────────────────────────────────────────────────────┐
│  src/background/tasks.ts                             │
│  register() at module-eval time                      │
│                                                      │
│  handleGeofencingEvent(data, nowS):                  │
│    db.transaction(tx => {                            │
│      loadState(entries, pending)  ──▶  MachineState  │
│      step(state, event)           ──▶  { next, effects }
│      applyEffects(...)                               │
│      // CONFIRM loop for pending whose buffer expired│
│    })                                                │
│    maybeNotifyForEffects(allEffects, ...)            │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  stateMachine.ts             │     │  persistence.ts              │
│  pure: reduce-like           │     │  applyEffects(..., tx-repos) │
│  IDLE → PENDING_ENTER        │     │  open_entry → entries.open   │
│      → ACTIVE → PENDING_EXIT │     │  close_entry → entries.close │
│      → IDLE                  │     │  clear_pending → pending.resolve
└──────────────────────────────┘     └──────────────────────────────┘
```

### Exactly-once semantics

- `PendingTransitionsRepo.get(id)` guard in `applyEffects`'s
  `persist_pending` branch short-circuits duplicate inserts (OS may
  deliver twice).
- Partial unique index on open entries (migration `0001`) makes two
  simultaneous opens for the same place syntactically impossible.
- `db.transaction(...)` means a mid-batch crash rolls back atomically.
  `loadState` on the next wake sees a pre-batch snapshot, not a
  half-applied one.

### Foreground reconcile

When the app returns to the foreground, `bootstrapTracking()` +
`startForegroundReconcileWatcher()` run one opportunistic CONFIRM pass to
catch any pending whose buffer expired while JS was suspended. This is how
the Timeline "catches up" after the OS let the task dormant for hours.

---

## Data + reactivity

```
                    ┌─────────────────────────────────────┐
                    │  SQLite (expo-sqlite / better-sqlite)│
                    │  via Drizzle schema + migrations    │
                    └──────────────┬──────────────────────┘
                                   │
                           ┌───────┴───────┐
                           ▼               ▼
               ┌────────────────┐    ┌────────────────┐
               │  PlacesRepo    │    │  EntriesRepo   │
               │  KvRepo        │    │  PendingRepo   │
               └────────┬───────┘    └────────┬───────┘
                        │                     │
                        └──────────┬──────────┘
                                   │ constructor-injected via
                                   ▼ Context providers (tests) OR
                                     createDeviceRepo() (prod)
               ┌──────────────────────────────────────┐
               │  usePlaces / useEntriesRange / …     │
               │  subscribe to `dataVersionStore`     │
               │  re-query on bumpPlaces() / bumpEntries()
               └──────────────────────────────────────┘
                                   │
                                   ▼
                              Screens + sheets
```

### `dataVersionStore`

Global Zustand store (33 lines) exposing `placesVersion` + `entriesVersion`
integer counters and `bump*` mutators. Feature hooks include the version
in their `useEffect` deps so a bump anywhere triggers a re-query
everywhere.

Writers bump:
- `usePlaces.create/update/remove` → `bumpPlaces()`
- `useOngoingEntry.start/stop` + `entryEdit` mutations → `bumpEntries()`
- `bootstrapTracking` + foreground reconcile → `bumpAll()`

OS-driven writes in the bg task land in the DB via `applyEffects`; the UI
sees them because `startForegroundReconcileWatcher` calls `bumpAll()` on
every `inactive → active` transition.

---

## The deviceDb factory pattern

Every feature that reads from the device DB faces the same tension:

- At runtime we need `@/db/client` (wraps `expo-sqlite`).
- In Jest, requiring `@/db/client` pulls in the native binding.

Solved once in `src/db/deviceDb.ts`:

```ts
export function getDeviceDb(): AnyDb { /* lazy-require, cached */ }
export function createDeviceRepo<T>(make: (db) => T): () => T { /* lazy repo */ }
```

Every feature hook (`usePlaces`, `useEntries`, `useOnboardingGate`,
`uiStore`, `counters`, `appUserId`) uses `createDeviceRepo(db => new XxxRepo(db))`.
The single `eslint-disable @typescript-eslint/no-require-imports` lives in
`deviceDb.ts` — not sprinkled across six files.

---

## KV-key registry

Every key the app reads or writes from the `kv` table lives in
`src/db/kvKeys.ts`:

```ts
export const KV_KEYS = {
  ONBOARDING_COMPLETE: "onboarding.complete",
  UI_THEME_OVERRIDE: "ui.themeOverride",
  NOTIFIER_RECENT: "notifier.recent",
  // …etc
} as const;
```

Rationale: string literals typo silently, and a stray `"notifier.recents"`
vs `"notifier.recent"` would break the dedup logic at runtime with no
compile error. Adding a new KV key = one line in this file + one import.

Dynamic keys (e.g. per-place goal-dedup) get a helper next to the
registry — see `goalDedupKvKey`.

---

## Notifications split

Four modules, thin orchestrator:

- `quietHours.ts` — KV read/write + `isQuietAt(nowS, window)`
- `consolidation.ts` — `decideNotification(...)` pure fn + ring buffer
- `channels.ts` — iOS categories + Android channels (one-time setup)
- `digest.ts` — daily digest scheduler
- `notifier.ts` — orchestrates `maybeNotifyForEffects` by iterating
  state-machine effects and wiring the above.

Goal-reached lives in its own feature: `src/features/goals/goalsNotifier.ts`.
Separate from notifier because the ownership is product (per-place
goals), not plumbing (quiet hours / consolidation).

---

## Billing

`src/features/billing/revenuecat.ts` wraps `react-native-purchases`. One
entry point (`configureRevenueCat`), throws if API keys are missing —
fail loud, never silently fall back to a mock.

`src/features/billing/usePro.ts` is the single consumer-facing hook:

- Configures the SDK on first mount (idempotent).
- Fetches `customerInfo` + `offerings` in parallel.
- Subscribes to `onCustomerInfoUpdate` for live renewal/refund events.
- Exposes `{ isPro, loading, offerings, purchase, restore }`.

Tests override the SDK state via `__setProForTests(true | false | null)`
— a module-level flag wrapped in `useSyncExternalStore` so overrides
propagate to mounted components. No separate mock store.

---

## Screens / sheets

- `app/` — Expo Router file-based routes, thin re-exports.
- `src/screens/<Screen>/` — one folder per screen.
- `src/screens/shared/` — cross-screen primitives
  (`DayNavHeader`, `EntryRow`, `dayNavGuard`).
- `src/components/` — design-system primitives + `SheetHost` +
  `Typography`.

Global sheets (`entryEdit`, `addPlace`) are driven by `useSheetStore` —
any screen opens a sheet by dispatching; `SheetHost` (mounted once at
root) owns the Modal lifecycle.

---

## Testing patterns

- Pure code (state machine, range math, decideNotification) gets
  property-style tests with explicit inputs.
- Repos test against `createTestDb()` — an in-memory SQLite that runs
  the real migrations. Every schema change is verified end-to-end.
- Hooks use `renderHook` with a `PlacesRepoProvider` /
  `EntriesRepoProvider` wrapper so the repo is injected, not real.
- Screens use `render` with `SafeAreaProvider` + `ThemeProvider` +
  repo providers, assert on `testID`s and a11y props.
- i18n parity is enforced by `src/lib/__tests__/i18n-coverage.test.ts`.
- Contrast is enforced by `src/theme/__tests__/contrast.test.ts` (every
  fg/bg pairing WCAG AA on both schemes).
