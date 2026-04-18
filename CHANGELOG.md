# Changelog

All notable changes to Time Mapper are documented here. Release tags are of
the form `vMAJOR.MINOR-shortname` where the shortname traces back to the
plan that shipped the work (`foundation`, `core-ui`, …).

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
