# Changelog

All notable changes to Time Mapper are documented here. Release tags are of
the form `vMAJOR.MINOR-shortname` where the shortname traces back to the
plan that shipped the work (`foundation`, `core-ui`, …).

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
  + completion state.
- Anon RevenueCat user-id persisted in `kv['revenuecat.user_id']` and
  passed to `Purchases.configure(...)` so entitlements survive
  reinstalls on the same Apple/Google account.
- `.env.example` + README section document the EXPO_PUBLIC_REVENUECAT_*
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
