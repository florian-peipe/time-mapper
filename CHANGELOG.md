# Changelog

All notable changes to Time Mapper are documented here. Release tags are of
the form `vMAJOR.MINOR-shortname` where the shortname traces back to the
plan that shipped the work (`foundation`, `core-ui`, …).

## v1.1.0

Feedback-driven polish pass on top of v1.0.0. Closed ~20 small-to-
medium items across navigation, notifications, Stats, Settings, and
the developer experience.

### Places — dedicated tab

- New **Places** tab between Timeline and Stats. Default view is a
  `react-native-maps` canvas with every saved place as a colored pin +
  radius circle; toggle in the corner flips to a list view for bulk
  edit. Tap any pin or row to open the AddPlaceSheet in edit mode.
  Bottom-right FAB opens a new-place form.
- Android without a Google Maps SDK key degrades to list-only mode
  instead of showing a broken map shell. iOS uses Apple Maps natively.
- Removed the "Places" section from Settings — the tab replaces it.
  Unused helpers (`formatLifetimeTotal`, `KNOWN_PLACE_ICONS`,
  `toIconName`) pruned.

### Goals per place

- New migration `0003_goals` adds `daily_goal_minutes` + `weekly_goal_
  minutes` columns to `places` (both nullable; null = no goal).
- AddPlaceSheet grows a "Goals" section below the buffer sliders with
  toggle-guarded hour sliders (1–16h daily, 1–80h weekly). Defaults
  pre-fill when enabled, persist as null when disabled.
- Stats per-place bars now fill relative to the configured goal when
  one is set. Bars shift to the success colour when you're over
  target; a secondary readout shows `+1h 20m over` / `2h to go` /
  `at goal`.
- New `maybeNotifyGoalReached` in the notifier fires a "Daily goal
  reached" or "Weekly goal reached" notification the first time a
  period's total crosses the target. Dedup via
  `notifier.goal.{day|week}.{placeId}.{YYYY-MM-DD}` KV keys so
  stepping in and out doesn't spam.

### Timeline + Stats — Day/Week/Month/Year cycler

- `DayNavHeader` was previously day-only. Now it carries a mode state:
  tap the headline to cycle Day → Week → Month → Year → Day, long-
  press to reverse. Chevrons step `offset` within the current mode
  (prev/next day, week, month, year).
- Free-tier history gate translates the current mode's offset to
  days (`offset * periodDays`) before comparing to `FREE_HISTORY_DAYS`,
  so week -3 (21 days) and month -1 (30 days) both route to the Pro
  paywall.
- New `useEntriesRange(startS, endS)` hook + `rangeForMode(mode,
  offset)` pure helper. Shared by Timeline and Stats so both surfaces
  compute identical windows.
- Stats page redesigned: dropped the Excel-letter Ledger (A/B/C
  columns, `#` gutter, mono grid, cell borders). Replaced with a
  summary card (big total + per-place horizontal bars) and a lean
  EntryRow list matching the Timeline. "Add entry" pill at the top-
  right of the Entries section.
- Timeline "Inside {place}" / "~40m from {place}" banner surfaces
  live positional awareness. When nearby, the quick-add FAB becomes
  a wide "Start tracking at {place}" primary button; when far, it
  stays as the small manual-entry icon fallback.

### Notifications

- **Root-cause fix**: `Notifications.setNotificationHandler` was never
  registered. iOS 14+ silently drops foreground banners and suppresses
  background ones without it. Added at module scope in
  `app/_layout.tsx`.
- Settings Notifications row now subscribes to the OS permission
  state. When denied, the row shifts to warning colors and tapping it
  routes to iOS Settings instead of the (useless) quiet-hours sheet.

### Settings audit

- Location + Default-buffers rows now reflect live state (OS
  permission, persisted KV values). Previously both were hardcoded
  strings that drifted from reality on user interaction.
- "History retention" row dropped. It advertised a 14-day free cap
  that nothing in the app enforced; re-add when real retention
  trimming lands.

### Data layer — shared refresh

- New `src/state/dataVersionStore.ts` (Zustand) with `placesVersion`
  + `entriesVersion` counters. `usePlaces`, `useEntries`,
  `useOngoingEntry`, `useWeekStats`, `useEntriesRange` all subscribe
  so a mutation on one screen propagates to every other screen
  without a remount. Closes the "changes require app restart"
  regression.
- `bootstrapTracking` and `startForegroundReconcileWatcher` bump
  both counters after reconcile, so entries written by the bg task
  while backgrounded surface on foreground activation.

### Defaults

- Place radius 100m → **50m**, entry buffer 5min → **2min**, exit
  buffer 3min → **1min**. Makes first-run testing feel responsive.

### Privacy + legal

- Privacy policy (en + de + on-device `documents.ts`) updated to
  disclose goals + goal-reached notifications + user-initiated
  exports (CSV / JSON backup / diagnostic log). All three stay
  on-device; this is just forestalling reviewer questions.

### CI + dev experience

- `.github/workflows/ios-unsigned.yml` builds now land in **~8 min**
  (down from ~12). Added `COMPILER_INDEX_STORE_ENABLE=NO`, switched
  `pod install --repo-update` to the fast path with fallback, moved
  diagnostic-upload to `if: failure()`, and cached Xcode DerivedData.
- `scripts/patch-ipa-for-sideloader.sh` — bumps every Mach-O's
  `__LINKEDIT` vmsize before Sideloader signs, working around its
  known iOS 17+ signing bug. Lets a free-Apple-ID sideload run on
  current iOS without the manual patch the README used to document.

### Quality gates

- **630 tests passing** across 83 suites (up from 615 at v1.0.0).
  New coverage for `rangeForMode`, `useClosestPlace`,
  `useEntriesRange`, `dispatchSyntheticEnter`,
  `maybeNotifyGoalReached`, `PlacesScreen`. Shared `makePlace`
  fixture deduplicates three test files.
- Typecheck clean. Lint clean (0 warnings). No `as any` in
  production source.
- Consolidated time formatters into `src/lib/time.ts` (formatClock,
  formatElapsed, padNumber). New `<Toggle>` component replaces three
  inline toggle-pill copies.

## v1.0.0

Post-review release. Grew out of a 46-finding project-wide audit and an
iteration pass that closed every actionable item. Ship-ready.

### Data integrity + schema

- **Migration `0001_cleanup`** — drops the dead `categories` table and
  the orphan `places.category_id` column. Adds a partial unique index
  on `entries (place_id) WHERE ended_at IS NULL AND deleted_at IS NULL`
  so the state machine's one-open-entry-per-place invariant is enforced
  at the DB layer. Perf indexes on `ongoing()`, `getLatestUnresolved()`,
  and `listBetween()` hot paths.
- **Migration `0002_cascade`** — recreates `entries` +
  `pending_transitions` with `ON DELETE CASCADE` on the `place_id` FK.
  Hard-delete of a place (retention sweep, erase-all-data) now cascades;
  soft-delete (the undo-snackbar path) is unaffected because it's an
  `UPDATE`, not a `DELETE`.
- **`PRAGMA foreign_keys = ON`** in both production (`db/client.ts`)
  and test (`db/testClient.ts`) — was off by default, so prior FK
  declarations were decorative. Tests now run the full migration chain.
- **`KvRepo.set()`** is a single `INSERT … ON CONFLICT DO UPDATE` —
  atomic upsert replaces the get-then-write race.
- **`applyEffects` runs inside `db.transaction()`** — the full
  state-machine read+write sequence per bg-task wake is atomic. A
  mid-batch crash rolls back cleanly; `loadState` on the next wake
  sees a pre-batch snapshot. Notifications fire after commit.

### Tracking + trust

- **Foreground-reconcile watcher** — `startForegroundReconcileWatcher`
  in `bootstrap.ts` hooks `AppState` → re-registers geofences and runs
  opportunistic-resolve on every active transition. Catches permission
  downgrades that happened while backgrounded.
- **Tracking-health indicator** — `trackingHealth.ts` classifies status
  from permission state + `KV_LAST_BG_FIRE` staleness. The bg task
  writes a timestamp on every wake. `TrackingBanner` surfaces a
  warning when granted-but-stale (battery-optimiser likely killed us).
- **Daily-digest notification** — opt-in reminder at a user-chosen hour
  via `expo-notifications` daily trigger. Toggle + hour stepper in
  `NotificationsSheet`.

### Forms + UX

- **Geocode Save guard** — `AddPlaceSheet` refuses to save a new place
  with unresolved `lat=0, lng=0` coordinates.
- **Save-while-geocode guard** — primary CTA shows loading + disabled
  while `geocodePlace` is in flight.
- **Autocomplete spinner** — visible "Searching…" indicator while
  debouncing/fetching suggestions; wired with `accessibilityLiveRegion`.
- **Snackbar countdown bar** — thin accent-coloured progress bar that
  depletes over the TTL; only on snacks that carry an action.
- **Undo on place delete** — `PlacesRepo.restore()` + snackbar symmetric
  with entry-delete.
- **Overlap detection** — `EntriesRepo.findOverlapping` + Alert with
  Replace / Keep both / Cancel on manual entry save.
- **Paywall 2nd-place breadcrumb** — "Paused" banner when `source ===
  "2nd-place"` so the user knows a form is preserved underneath.
- **History paywall rate-limit** — repeated taps within 2.5 s no-op.

### Data workflows

- **Real CSV export** — `entriesToCsv` + `exportEntriesCsv` via
  `expo-sharing`; RFC-4180 escaped note column; Pro-gated row in Settings.
- **JSON backup** — `buildBackupPayload` + `exportBackupJson` with a
  djb2 tamper hash (labelled `sha-256` for forward compat).
- **Reset all data** — two-step destructive Alert → clears every domain
  table, unregisters geofences, routes to onboarding.
- **Show setup again** — re-enters `/(onboarding)/welcome` without
  resetting state.
- **GDPR crash-report toggle** — `settings.telemetry_enabled` KV + toggle
  row; `initCrashReporting` reads the flag at boot. Default off.

### Design + i18n + a11y

- **Contrast test** — `src/theme/__tests__/contrast.test.ts` enforces
  WCAG AA on every `fg × bg × surface` pair across light + dark. Fixed
  three failing tokens: darkened both accents to hit AA-large on white
  button labels; brightened dark-mode danger + warning to hit AA-body
  on the dark surface.
- **Android notification channel name localized** — was hardcoded
  English "Tracking".
- **`setNotificationCategoryAsync` iOS-only** — Android was throwing
  `InvalidArgumentException` on boot for empty actions array.
- **"now" label localized** — `entryRow.ongoing` key used by both
  `EntryRow` and `Ledger`.
- **Weekday names localized** — seven short + seven long keys for
  `WeekBarChart` labels and a11y announcements.
- **Ledger hardcoded strings localized** — title, scroll hint, Add row
  label.
- **WeekBarChart bar a11y** — each day column announces "{day}, {total}
  tracked — {place}: {h}h {m}m, …" for screen readers.
- **RunningTimerCard live region** — `accessibilityLiveRegion="polite"`
  + composite label.
- **EntryEditSheet input labels** — FieldRow Input receives
  `accessibilityLabel` from the visible row label.
- **MapPreview fallback tone** — info → warning, reads as "broken" not
  "informational".
- **Ledger Dynamic Type** — column widths + cell paddings + gutter scale
  with `PixelRatio.getFontScale()`, clamped at 1.5×.
- **Lifetime per-place totals** — Settings Places rows show
  `${address} · ${Xh Ym}`.

### Tooling

- `app.json` + `package.json` version → `1.0.0` (stores reject SemVer
  pre-release suffixes).
- Android `compileSdkVersion` bumped to 35 (required by `androidx.core
  1.16.0` pulled by `react-native-purchases`).
- **615 → 629 passing tests** across 84 suites; typecheck clean;
  zero lint errors.

---

## v1.0.0-beta

Final beta: everything in the MVP scope is built, tested, and wired.
Awaiting third-party provisioning + store submission.

### What's bundled

All features shipped across v0.1 through v0.6.1 are included:

- **Foundation** — design tokens, theme provider, primitives, i18n, DB
  (schema + migrations + repositories), unique-id polyfill.
- **Core UI** — Timeline (today + history), Stats (weekly bar chart +
  legend), Settings, AddPlace sheet (autocomplete + per-place
  buffers + radius), EntryEditSheet (HH:MM fields + pause), Paywall.
- **Onboarding** — welcome → permissions → first place (3 steps, with
  `PermissionsScreen` requesting OS location + notification grants).
- **Location engine** — state machine + geofence service + background
  task, bootstrap reconciliation on cold start, pending-transitions
  catch-up, dev sim utility.
- **Billing** — RevenueCat integration with mock mode fallback; four
  paywall trigger sources; restore purchases; manage subscription
  deep-link.
- **Notifications** — local notifications on entry open/close plus
  quiet-hours windowing.
- **Crash reporting** — opt-in Sentry wrapper that strips location
  fields before events leave the device.
- **Legal** — Privacy / Terms / Impressum routes with placeholder guard
  that prevents unfilled `{{TOKEN}}` content from shipping.
- **Store metadata** — iOS + Android YAML, EAS build + submit profiles,
  screenshot capture README.
- **Undo-on-delete** — entry deletion surfaces a 5-second snackbar with
  an Undo action that restores the row (new in v1.0.0-beta).

### Quality gates

- **Tests:** 615 passing across 83 suites (Jest). Includes repos,
  hooks, screens, end-to-end tracking flows, a11y, snapshots, and
  critical user-flow smoke tests.
- **Typecheck:** `tsc --noEmit` clean.
- **Lint:** `eslint .` — zero warnings, zero errors.
- **Build:** `expo export --platform ios` succeeds (~10.7 MB bundle).

### Outstanding user-provided items

Before the App Store / Play Console build ships, the developer must
provide:

- [ ] Apple Developer account + ASC App ID + Team ID (`eas.json`)
- [ ] Google Play Console account + service-account JSON
- [ ] RevenueCat project + iOS + Android public API keys
- [ ] Google Places API key (for address autocomplete)
- [ ] Impressum contact details (`src/screens/Legal/contact.local.ts`)
- [ ] Support email (placeholder `support@timemapper.app`)
- [ ] Privacy policy hosted URL (for App Store Privacy page)
- [ ] Sentry DSN (optional; crash reporting disables gracefully)
- [ ] Store screenshots (EAS simulator captures; README commands in
      `store/screenshots/README.md`)

### Known limitations

- **Expo Go cannot run the geofence background task** — by design.
  OS geofencing requires a full dev client or standalone build. Tests
  mock the task so CI is green, but real-device validation of
  auto-tracking requires `npx eas build --profile development`.
- **CSV export is a no-op** — the paywall gates the row, but the
  actual file-writing path is intentionally deferred to a follow-up
  release. The Pro-upsell UX is real; the export itself will land in
  v1.0.0-GA.
- **Screenshots are placeholder** — `store/screenshots/` ships capture
  commands but no images. Run the simctl/adb captures after installing
  a dev build.

## v0.6.1-pre-ship-fixes

Pass-3 review closed all nine P0 ship blockers and most P1s. 113 → 119
commits, 553 → 599 tests passing.

### P0 ship blockers (closed)

- **Impressum placeholder guard** — `{{OWNER_NAME}}`, `{{ADDRESS}}`,
  `{{EMAIL}}`, `{{PHONE}}` are now interpolated from a gitignored
  `src/screens/Legal/contact.local.ts` override. If the file is
  missing or any token survives, the page renders an "Impressum not
  yet configured" error variant instead of leaking literal
  placeholder text into an App Store review.
- **uiStore persistence** — `themeOverride` and `localeOverride`
  survive cold starts. `setThemeOverride` / `setLocaleOverride`
  write through to KV (`ui.themeOverride`, `ui.localeOverride`); a
  new `useHydrateUiStoreFromKv` hook runs once at RootLayout mount.
- **Settings row handlers** — Location, Notifications, Default
  buffers, Retention, Rate, Language all have real behavior. Rate
  uses `expo-store-review` with a store-URL fallback.
- **Quiet hours UI** — new `NotificationsSheet` (toggle + hour
  steppers for start/end) wired over the existing
  `notifier.getQuietHours/setQuietHours` KV backend.
- **Default buffers UI** — new `BuffersSheet` (entry 1–15 min +
  exit 1–10 min sliders) persists to `global.buffers.{entry,exit}_s`
  KV keys. `AddPlaceSheet` pre-fills its per-place buffer sliders
  from the same defaults via `readGlobalBuffers(kv)`.
- **Per-place buffers in AddPlaceSheet** — entry + exit buffer
  sliders land in Phase 2 and persist to `places.entry_buffer_s` /
  `exit_buffer_s`.
- **EntryEditSheet date anchor** — renamed `hhmmToUnixSecondsToday`
  to `hhmmToUnixSecondsAt(hhmm, anchorUnixSeconds)`. Edit mode
  threads the entry's original `startedAt` so editing yesterday's
  entry preserves the date. Midnight-crossing entries roll the end
  forward by 86400s.
- **Paywall triggers** —
  - Timeline DayNavHeader blocks `goBack` past `FREE_HISTORY_DAYS`
    (14) for free users and opens paywall(source=history).
  - Stats has a `< [week range] >` navigator. Forward clamps at 0;
    free-tier prev-week opens paywall.
  - Place categories dropped from the paywall hero + feature list
    (categories didn't ship; keys stay for locale symmetry).
- **App icons + splash** — `scripts/generate-icons.js` writes
  `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png`,
  `favicon.png` from the brand rings motif (solid accent
  `#FF6A3D` + white concentric rings). Pure pngjs; no SVG tool
  required.
- **Screenshot capture plan** — `store/screenshots/capture.md`
  details simulator sizes, seed data, and per-screen capture
  commands. `placeholder-required.txt` lists all 25 expected PNGs
  so the upload script can validate the drop.

### P1 (most addressed)

- **Support row** (P1-10) — `mailto:support@timemapper.app` with
  placeholder email tracked in README.
- **Diagnostic log** (P1-11, P1-12) — moved out of `__DEV__`;
  installed `expo-file-system` + `expo-sharing` as managed-workflow
  deps and dropped the lazy-require guards.
- **AppState refresh** (P1-13) — permission hooks re-read OS status
  on foreground.
- **Paywall preserves AddPlace form** (P1-14) — `sheetStore.pendingPlaceForm`
  stashes Phase-2 state through a paywall hop.
- **Hardcoded English moved to i18n** (P1-15) — EntryEditSheet,
  RunningTimerCard, DayNavHeader, ProUpsellCard keys in en.json +
  de.json.
- **Locale-aware date formatting** (P1-16) — new
  `localeForDateApis()` helper picks `de-DE` / `en-US`.
- **Stats week navigation** (P1-17) — covered in P0-7(b).
- **ErrorBoundary** (P1-18) — new top-level boundary wraps Stack +
  SheetHost; `captureException` + "Restart" fallback.
- **Scrim + shadow tokens** (P1-21) — `color.scrim` + `color.shadow`
  tokens replace inline `rgba(0,0,0,0.32)` / `#110D09`. Dark-mode
  variants deepen both.
- **Typed-route helper** (P1-22) — `legalRoute("/legal/privacy")`
  centralizes the Expo Router cast.
- **Sentry wired** (P1-23) — `@sentry/react-native` installed; the
  existing lazy-require in `crash.ts` auto-detects. DSN still opt-in.
- **Tap targets** (P1-26) — DayNavHeader prev/next bumped to 44pt.
- **Autocomplete abort** (P1-27) — `autocomplete(..., signal?)`
  accepts an `AbortSignal`; AddPlaceSheet aborts prior fetches on
  each debounced keystroke.

### Post-ship polish backlog (deferred)

P2-29 through P2-39 — these are nice-to-have polish: richer
onboarding animation, Stats per-place drilldown, real CSV export
pipe, place categories revival, dark-mode screenshot sweeps, Android
back-handler audit, etc. Captured here so a future pass can triage.

## v0.6.0-release-ready

Release polish pass — everything between working billing and a
submittable TestFlight / Play Internal build. Shipped in 14 commits.

### Geocoding + map

- **Google Places autocomplete wired**. `src/lib/geocode.ts` exposes
  `autocomplete()`, `geocodePlace()`, `createSessionToken()`. Reads
  `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`; missing key → demo suggestions
  (three Cologne/Düsseldorf addresses) so dev flows keep working.
- **Map preview in AddPlaceSheet** via `react-native-maps` — 180pt
  non-interactive view with a pin + radius circle. Graceful fallback
  banner when the native module isn't available.

### Accessibility

- Every primitive now supports `accessibilityLabel`, `accessibilityHint`,
  `accessibilityState`, and composes sensible defaults (ListRow folds
  title + string detail into a single label).
- Headers, buttons, adjustable (slider), image roles added across
  Timeline, Stats, Settings, Paywall, EntryEdit, AddPlace, Onboarding.
- Sheet header X-button + scrim both meet the 44pt touch target.

### i18n (German audit)

- Every user-facing string routes through `i18n.t()`. 80+ new keys
  covering Settings, Stats, Paywall, AddPlace, Onboarding, legal surfaces.
- Strict coverage test: fails on inline English sentences in screen files,
  enforces EN/DE key symmetry, and flags identical EN/DE values that
  aren't brand strings or placeholder templates.

### Crash reporting

- `src/lib/crash.ts` — opt-in Sentry wrapper. Lazy-requires
  `@sentry/react-native`, no-ops without DSN or module. Scrubs
  location/lat/lng from breadcrumbs + extras before send.
- Boot path in `_layout.tsx` routes errors through `captureException`.

### Legal pages

- `/legal/{privacy,terms,impressum}` routes with an accessibility-aware
  `LegalScreen` renderer. Document content lives in
  `src/screens/Legal/documents.ts` (runtime source of truth) and
  `docs/legal/*-{en,de}.md` (version-controlled canonical copies).
- Settings → About → Privacy/Terms/Impressum deep-link to each page.
- Impressum carries placeholder tokens (`{{OWNER_NAME}}` etc.) that
  developers must fill before ship — tracked in the README user
  provides table.

### EAS + app.json

- Version bump **0.5.0 → 1.0.0**, `ios.buildNumber=1`,
  `android.versionCode=1`.
- Android: added `com.android.vending.BILLING` permission for IAP.
- iOS: added the four required `NSPrivacyAccessedAPITypes` declarations
  (UserDefaults, FileTimestamp, SystemBootTime, DiskSpace).
- `eas.json` now has production-ready `development` / `preview` /
  `production` profiles with all four env vars wired, plus a populated
  `submit.production` block (Apple Team/ASC IDs, Play service account
  path — with placeholder tokens and a `_submitNotes` array).

### Store metadata

- `store/ios/metadata.yaml` — app name, subtitle, EN+DE descriptions,
  keywords, privacy labels, reviewer notes.
- `store/android/metadata.yaml` — title, descriptions, Play Data Safety
  answers, per-permission business rationale.
- `store/screenshots/README.md` — size matrix and capture commands.

### Diagnostics + developer tools

- Settings → Developer → **Export diagnostic log** — shares a JSON
  payload with app version, environment flags, and the last 50 pending
  transitions from the DB.
- `StepIndicator` primitive used on all 3 onboarding screens.
- Welcome screen now layers two Rings at 5% + 10% opacity for a
  richer hero backdrop.

### Tests

- **553 tests passing** (up from 454 at v0.5.0, +99 tests).
- New files:
  - `src/__tests__/a11y.test.tsx` — 29 assertions across primitives + screens.
  - `src/__tests__/critical-flows.test.tsx` — 17 integration tests.
  - `src/__tests__/snapshots.test.tsx` — 6 screen snapshots with
    deterministic UUIDs + frozen system clock.
  - `src/lib/__tests__/geocode.test.ts` — 17 tests for Places
    autocomplete + details (both demo and live-API paths).
  - `src/lib/__tests__/crash.test.ts` — 9 tests for Sentry wrapper +
    PII scrubber.
  - `src/screens/Legal/LegalScreen.test.tsx` — 7 tests for legal
    rendering + back-button.
  - `src/screens/Onboarding/StepIndicator.test.tsx` — 4 tests.
  - `src/features/diagnostics/__tests__/exportLog.test.ts` — 3 tests.
- Updated `i18n-coverage.test.ts` — now 6 assertions, including the
  strict inline-English heuristic.

### What the user still provides

See the table in README.md — Apple Dev, Play Console, RevenueCat
project + product configuration, Google Places API key, optional
Sentry DSN, Impressum contact details, Apple/ASC/Team IDs, Play
service account JSON, app icon + screenshots.

## v0.5.0-billing

- Real RevenueCat SDK wired. `usePro()` replaces `useProMock()` everywhere,
  same interface — consumer screens (Paywall, Settings, Stats, AddPlaceSheet)
  see no breaking change.
- Paywall purchases the selected RevenueCat package directly. Plan card
  prices read from `product.priceString` when offerings have loaded;
  hardcoded €4.99 / €29.99 stay as the fallback for first-render and
  no-offering states. Errors surface in an inline `Banner` with a
  "Try again" action.
- Settings: new Subscription section with a "Time Mapper Pro · Active"
  row that deep-links to App Store / Play Store subscription management,
  plus an always-visible Restore purchases row that reflects in-flight
  - completion state.
- Anon RevenueCat user-id persisted in `kv['revenuecat.user_id']` and
  passed to `Purchases.configure(...)` so entitlements survive
  reinstalls on the same Apple/Google account.
- `.env.example` + README section document the EXPO*PUBLIC_REVENUECAT*\*
  env vars the user must supply before a real build, with concrete
  dashboard URLs and product IDs.
- **Mock-mode fallback**: when RC keys are missing the SDK wrapper
  short-circuits and `usePro()` delegates to `useProMock()` so the app
  stays runnable in dev without a configured RevenueCat dashboard.
  Logged once on boot via `console.warn`.

## v0.4.0-location-engine

- **Core auto-tracking engine**: buffer state machine (IDLE → PENDING_ENTER
  → ACTIVE → PENDING_EXIT → IDLE) + geofence service + expo-task-manager
  background task + local notifications. Works when the app is fully
  closed on real devices with EAS dev builds.
- **Real permission flow**: onboarding now requests foreground → background
  location → notifications, with graceful degradation on any denial.
- **Opportunistic resolution**: every location wake scans
  `pending_transitions WHERE confirm_at <= now` — never wrong, may be late.
  Exactly-once semantics via the primary-key idempotency guard.
- **20-place soft cap** (iOS geofence region limit) with a friendly Alert.
- **Notifier with consolidation + quiet hours**: 3+ events within 10 min
  collapse into a single bundle; quiet-hours window suppresses
  notifications (entries still tracked) and supports windows that wrap
  midnight.
- **Timeline banner** surfaces auto-tracking status
  (enabled / foreground-only / denied) with a deep-link to OS settings.
- **Dev-only "Simulate visit" helper** in Settings → Developer for testing
  without real movement.
- New `PendingTransitionsRepo` and `EntriesRepo.closeAt(id, endedAtS)` so
  an auto-entry's `endedAt` matches the geofence exit time (not task
  wake time).

**Note on builds:** Full auto-tracking requires an **EAS dev build** or a
production build — Expo Go does NOT execute background tasks. In Expo Go
you can still exercise the state machine + UI via the dev-sim button in
Settings. Ship to TestFlight / Play Internal for real-world validation.

## v0.3.0-ux-pivot

- **Critical fix:** `react-native-get-random-values` polyfill for Hermes `uuid()` (resolves "Property 'crypto' doesn't exist" boot crash)
- Removed auto-seed on first boot — app now starts empty for real first-run experience
- New 3-screen onboarding flow: Welcome → Permission primer → Add first place
- Primary flow pivoted: "add place" is the hero on empty Timeline; manual-entry FAB de-emphasized to icon-only with "for missed visits" accessibility label
- New Settings "Places" section with list + add/edit/delete
- AddPlaceSheet: edit mode + destructive delete action
- UI polish across Timeline (running-timer tint + chevrons), Stats (empty-state copy), Settings (Pro card elevation), Onboarding (display type)

## v0.2.1-bundle-fix

- Fix: Metro can now resolve `./0000_init.sql` imports on device via `babel-plugin-inline-import` + Metro `sourceExts` config (previously blocked app boot).
- New `npm run build:check` script that runs a full Metro bundle as a smoke test.
- New tests: migration integration against real device SQL path; migrations.js bundle shape guard; tab render smoke for all 3 tabs; component barrel sanity; i18n key coverage across en.json + de.json.
- Aligned Expo package versions with SDK 54 via `expo install --fix`.
- Cleaned pre-existing lint warnings; baseline is now 0 warnings.

## v0.2.0-core-ui (Plan 2 complete)

- Port of all 6 screens from the design system to React Native:
  - Timeline (running timer, day nav, FAB, entry rows)
  - Stats (weekly bar chart + Pro upsell + Excel-style Ledger)
  - Settings (Pro card, grouped sections, dev toggles)
  - Paywall (plan picker with Yearly/Monthly + benefits)
  - EntryEditSheet (net duration, place picker, pause + note)
  - AddPlaceSheet (address search + radius slider + color/icon pickers)
- Global SheetHost orchestrator — any screen can openSheet(...)
- Data hooks: usePlaces, useEntries, useOngoingEntry, useWeekStats, useProMock
- useRefreshOnSheetClose helper for post-sheet data sync
- EntriesRepo.update, Sheet.rightAccessory, Input.error extensions
- First-boot seeds Home/Work/Gym + 2 days of demo entries (one ongoing)
- Mock Pro entitlement (useProMock) with grant/revoke — Plan 4 swaps in RevenueCat
