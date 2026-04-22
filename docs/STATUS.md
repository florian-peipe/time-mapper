# Time Mapper — v1.1 status + handoff

_Updated 2026-04-22 after the mock-Pro removal + diagnostic-log removal +
large-screen decomposition pass. See `docs/V1_LAUNCH_PLAN.md` for the
submission checklist._

## Release metadata

| Field         | Value                                                    |
| ------------- | -------------------------------------------------------- |
| `package.json` version | `1.1.0`                                        |
| `app.json` version     | `1.1.0` (in sync)                              |
| Test count    | 623 passing across 85 suites                             |
| Typecheck     | Clean (`tsc --noEmit`)                                   |
| Lint          | Clean (0 warnings, 0 errors)                             |
| `build:check` | Clean (`expo export --platform ios`)                     |
| Largest file  | 384 lines (`AddPlaceSheet.tsx` — orchestrator)           |
| Mock mode     | **Removed.** Dev builds require real RC keys — see `.env.example` |

## Release tags (chronological)

| Tag                      | Theme                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- |
| `v0.2.0-core-ui`         | First cohesive UI — Timeline / Stats / Settings / AddPlace / Paywall / EntryEdit |
| `v0.2.1-bundle-fix`      | Metro bundling + Hermes polyfill hotfix                                          |
| `v0.3.0-ux-pivot`        | Onboarding polish, pending-transitions diagnostics, map preview                  |
| `v0.4.0-location-engine` | Geofence state machine + background task + bootstrap reconcile                   |
| `v0.5.0-billing`         | RevenueCat + mock mode + paywall wiring                                          |
| `v0.6.0-release-ready`   | A11y audit, DE translation, Sentry, legal, store metadata, EAS profiles          |
| `v0.6.1-pre-ship-fixes`  | Review-driven P0 + P1 closeout (Impressum guard, persistence, sheets)            |
| `v1.0.0-beta`            | Polish pass: undo-on-delete snackbar, hex cleanup, dev-gated diagnostics         |
| (post-beta, untagged)    | Places tab, Goals, Day/Week/Month/Year cycler, Settings audit, CI cache          |

## Feature matrix

| #   | Feature                                                           | Shipped | File                                                                                                        |
| --- | ----------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | First-run onboarding (3 screens)                                  | Yes     | `src/screens/Onboarding/{WelcomeScreen,PermissionsScreen,FirstPlaceScreen}.tsx`                             |
| 2   | Places management (all fields + per-place buffers + goals)        | Yes     | `src/screens/AddPlace/AddPlaceSheet.tsx` + `src/db/repository/places.ts`                                    |
| 3   | Places tab (map + pin + list + FAB)                               | Yes     | `src/screens/Places/PlacesScreen.tsx`                                                                       |
| 4   | Address autocomplete (Photon + offline fallback)                  | Yes     | `src/lib/geocode.ts`                                                                                        |
| 5   | Auto-tracking geofence (state machine + service + task)           | Yes     | `src/features/tracking/{stateMachine,geofenceService,persistence,bootstrap}.ts` + `src/background/tasks.ts` |
| 6   | Timeline view (tap header to cycle Day/Week/Month/Year)           | Yes     | `src/screens/Timeline/TimelineScreen.tsx`                                                                   |
| 7   | Timeline nearby banner + quick-add "Start tracking at {place}"    | Yes     | `src/screens/Timeline/TimelineScreen.tsx` + `src/features/places/useClosestPlace.ts`                        |
| 8   | Manual entry                                                      | Yes     | `src/screens/EntryEdit/EntryEditSheet.tsx` (new mode)                                                       |
| 9   | Entry edit / delete + 5 s undo snackbar                           | Yes     | `src/screens/EntryEdit/EntryEditSheet.tsx` + `src/components/Snackbar.tsx` + `src/state/snackbarStore.ts`   |
| 10  | Stats — Day/Week/Month/Year cycler + lean bar chart               | Yes     | `src/screens/Stats/StatsScreen.tsx` + `src/screens/Stats/WeekBarChart.tsx`                                  |
| 11  | Per-place goals (daily + weekly minutes) with reached notification| Yes     | `src/db/migrations/0003_goals.ts` + `src/features/notifications/notifier.ts::maybeNotifyGoalReached`        |
| 12  | Local notifications (open / close / goal reached)                 | Yes     | `src/features/notifications/notifier.ts`                                                                    |
| 13  | Pro paywall (trigger sources)                                     | Yes     | `src/screens/Paywall/PaywallScreen.tsx` + `src/state/sheetStore.ts`                                         |
| 14  | Settings (all rows functional + live permission state)            | Yes     | `src/screens/Settings/SettingsScreen.tsx` + `BuffersSheet.tsx` + `NotificationsSheet.tsx`                   |
| 15  | Privacy posture (no location in network calls)                    | Yes     | Only `src/lib/geocode.ts` hits the network (address query, never user coords)                               |
| 16  | i18n (en + de, every user string)                                 | Yes     | `src/locales/{en,de}.json` + `src/lib/__tests__/i18n-coverage.test.ts`                                      |
| 17  | Accessibility (labels, 44 pt, AA contrast)                        | Yes     | `src/__tests__/a11y.test.tsx`                                                                               |

## Third-party setup checklist

Before the App Store / Play Console build ships, the developer must
provide each of these. The code is already wired; set the env var or
file and rebuild.

| Item                        | Required env var / path                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Apple Developer account     | ASC App ID + Team ID into `eas.json → submit.production.ios`                                      |
| Google Play Console account | Service-account JSON at `play-service-account.json` (gitignored)                                  |
| RevenueCat iOS key          | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`                                                                  |
| RevenueCat Android key      | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`                                                              |
| Google Maps Android SDK key | `app.json → android.config.googleMaps.apiKey` — free 28.5k loads/mo; GCP billing account required |
| Sentry DSN (optional)       | `EXPO_PUBLIC_SENTRY_DSN` — disables gracefully when missing                                       |
| Impressum contact details   | `src/screens/Legal/contact.local.ts` (gitignored, copy from `.example.ts`)                        |
| Privacy policy hosted URL   | Host `docs/legal/privacy-{en,de}.md` and paste URL into ASC App Privacy                           |
| App Store screenshots       | Capture via `store/screenshots/README.md` commands once dev build installed                       |
| Play Store screenshots      | Same commands, Android simulator                                                                  |

Tip — push EAS secrets once rather than managing local env files for
production builds:

```sh
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY     --value appl_...
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_...
npx eas secret:create --name EXPO_PUBLIC_SENTRY_DSN             --value https://...
```

## Limitations (require real-device validation)

1. **Expo Go cannot run the geofence background task.** The auto-tracking
   end-to-end path is unit + integration tested, but real-device
   validation requires a dev client (`npx eas build --profile
   development`) or a sideloaded build (see `docs/SIDELOAD.md`). The task
   registers at module-eval time in `src/background/tasks.ts`; the OS
   cold-wake path only runs when a standalone app is installed.
2. **Free Apple IDs cannot use `BGTaskScheduler`.** Sideloading with a
   free 7-day dev cert means background wakes don't fire — only
   foreground location callbacks work. Paid developer cert required for
   full background coverage.
3. **App-store icon validation needs a real device.** Icon files are
   1024×1024 PNGs in `assets/`; Expo auto-generates per-density variants
   at build time.
4. **Screenshots are not yet captured.** `store/screenshots/` ships the
   simctl/adb capture commands and a README but no actual images.

## Next steps (for the collaborator)

The codebase is ready. Only the Apple-Developer-account tasks remain
— none of these require editing source code.

1. **Clone + verify green:**
   ```sh
   git clone <repo-url>
   cd opus-4.7-time-mapper
   npm ci
   npm test && npm run typecheck && npm run lint && npm run build:check
   ```
2. **Fill `eas.json → submit.production.ios`** with the three fields:
   - `appleId`  — your Apple ID email
   - `appleTeamId` — from Apple Developer → Membership
   - `ascAppId` — from App Store Connect → My Apps → Time Mapper →
     App Information → Apple ID
3. **Build + submit:**
   ```sh
   npx eas build --profile production --platform ios
   npx eas submit --profile production --platform ios
   ```
4. The build appears in TestFlight inside App Store Connect — invite
   internal testers or process it through beta review for external
   testers.

The Impressum contact is now filled (`src/screens/Legal/contact.local.ts`
— Florian Peipe, Lindenalee 46, 50968 Köln, info@peipe.org). The Android
map preview still degrades to a warning Banner without a Google Maps SDK
key. **RevenueCat keys are now required** even for internal TestFlight —
the mock-mode fallback was removed in the v1.1 cleanup pass. Paywall +
purchase paths throw at runtime without keys.

## Verdict

Shippable to TestFlight once the Apple IDs land in `eas.json` and RC
keys are in the build environment. 623 tests across 85 suites,
typecheck clean, lint clean, iOS bundle cleanly (`expo export --platform
ios` green in CI). UI, domain logic, persistence, billing, goals, and
places-tab paths are all feature-complete.
