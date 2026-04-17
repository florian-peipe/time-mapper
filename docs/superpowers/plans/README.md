# Time Mapper — Implementation Plans Index

The MVP spec ([lets-deisgn-an-native-tidy-pudding.md](../../../../../Users/flori/.claude/plans/lets-deisgn-an-native-tidy-pudding.md)) is decomposed into 5 sequenced plans. Each plan produces working, testable software on its own and is written only when its predecessor is complete (rolling plans — avoids stale detail).

| # | Plan | Goal | Produces | Status |
|---|------|------|----------|--------|
| 1 | **Foundation** | Scaffold Expo app, data layer, theme, i18n, navigation skeleton | App launches on iOS + Android with empty tabs, SQLite migrated, theme respects system, DE/EN string fallbacks wired | **Written** |
| 2 | **Core UI with mock data** | Implement all screens (onboarding, places CRUD, entry CRUD, timeline, stats, settings, paywall) against an in-memory mock repository | A clickable app you can navigate end-to-end, no real geofencing or billing yet | Pending |
| 3 | **Location engine** | Buffer state machine (TDD) → geofence service → background task → notifications. Wire to real repository. | Auto-tracking works on a real device end-to-end | Pending |
| 4 | **Billing + paywall** | RevenueCat SDK, `usePro()` hook, paywall modal, gating in places/export/history/stats/categories | Free → Pro upgrade flows in sandbox; gates work | Pending |
| 5 | **Release polish** | a11y pass, DE translation pass, App Store/Play listings, privacy docs, EAS build/submit, acceptance checklist | TestFlight build + Play internal track, ready for store review | Pending |

## Execution order + rationale

Plans 1 → 2 → 3 is the critical path. 4 can be done in parallel with late 2 (billing SDK sandbox doesn't need real location). 5 is sequenced last because some of its work (privacy policy, screenshots) only crystallizes once the app is near-final.

Each plan ends with a manual acceptance checklist + a git tag so we can cleanly bisect regressions between plans.

## Files

- `2026-04-18-01-foundation.md` — Plan 1 (written)
- `2026-04-18-02-core-ui.md` — Plan 2 (TBD after Plan 1 executes)
- `2026-04-18-03-location-engine.md` — Plan 3 (TBD after Plan 2)
- `2026-04-18-04-billing.md` — Plan 4 (TBD after Plan 3 or in parallel with late Plan 2)
- `2026-04-18-05-release.md` — Plan 5 (TBD last)
