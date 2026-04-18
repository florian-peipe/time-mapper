# Changelog

All notable changes to Time Mapper are documented here. Release tags are of
the form `vMAJOR.MINOR-shortname` where the shortname traces back to the
plan that shipped the work (`foundation`, `core-ui`, …).

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
