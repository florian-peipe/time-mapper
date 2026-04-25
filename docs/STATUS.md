# Time Mapper — v1.1 status + handoff

_Updated 2026-04-25: launch-hardening pass complete (Stages 0–2 of plan).
See `CLAUDE.md` § "Ship paths" and the plan at
`C:\Users\flori\.claude\plans\the-full-project-the-replicated-hammock.md`
for the full submission checklist._

## Release metadata

| Field         | Value                                                    |
| ------------- | -------------------------------------------------------- |
| `package.json` version | `1.1.0`                                        |
| `app.json` version     | `1.1.0` (in sync)                              |
| Test count    | 695 passing across 97 suites                             |
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
| Privacy policy hosted URL   | **Done** — GitHub Pages at `florian-peipe.github.io/time-mapper/privacy-en.html` (see Stage 2 below) |
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

## Launch-hardening stages (as of 2026-04-25)

| Stage | Description | Status |
|-------|-------------|--------|
| 0 | Code polish: console.warn → captureException, app.json fixes (targetSdk 35, UIBackgroundModes, RECEIVE_BOOT_COMPLETED restored), metadata copy | ✅ Done |
| 1 | Keystone artifacts verified: contact.local.ts filled, icon 1024×1024 opaque, expo-location foregroundServiceType confirmed | ✅ Done |
| 2 | GitHub Pages site live at `florian-peipe.github.io/time-mapper/` — privacy-en/de, terms-en/de, impressum, support/index | ✅ Done (needs activation — see below) |
| 3 | External accounts: Apple Developer, Google Play, RevenueCat, EAS secrets | ⏳ User action required |
| 4 | Store listing assets: screenshots (6 × 2 locales × 2 platforms), Android feature graphic, background-location demo video | ⏳ User action required |
| 5 | iOS submission via EAS Build + Submit → TestFlight → App Store review | ⏳ User action required |
| 6 | Android submission via EAS Build + Submit → Internal → Closed → Production | ⏳ User action required |
| 7 | Post-launch monitoring | Future |

## Next steps (for the user)

### Activate GitHub Pages (5 minutes)
Go to **github.com → your repo → Settings → Pages → Source: Deploy from branch →
Branch: `main`, Folder: `/docs`** → Save.
The site becomes live at `https://florian-peipe.github.io/time-mapper/`.

### Confirm green before building
```sh
npm test && npm run typecheck && npm run lint && npm run build:check
node scripts/check-submission-ready.js
```
The preflight exits with 4 blockers (all credential-related — not code problems):
eas.json Apple credentials + play-service-account.json.

### EAS secrets (one-time)
```sh
npx eas login
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY     --value appl_...
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_...
```

### Fill eas.json (3 fields)
- `appleId` — your Apple ID email
- `appleTeamId` — from developer.apple.com → Membership
- `ascAppId` — from App Store Connect → My Apps → App Information → Apple ID

### Build + submit iOS
```sh
npx eas build --profile production --platform ios
npx eas submit --profile production --platform ios
```

### Build + submit Android
```sh
npx eas build --profile production --platform android
npx eas submit --profile production --platform android
```

## Notes

- Impressum contact filled: Florian Peipe, Lindenalee 46, 50968 Köln, info@peipe.org
- **RevenueCat keys required** even for TestFlight — mock mode was removed in v1.1
- Android map preview degrades gracefully to a warning Banner without a Google Maps SDK key
- `expo-task-manager` plugin adds `'fetch'` to iOS UIBackgroundModes during prebuild (library behavior, not a bug)

## Verdict

Shippable. 695 tests across 97 suites, typecheck clean, lint clean, iOS bundle clean.
UI, domain logic, persistence, billing, goals, places-tab paths are feature-complete.
Only credentials and store assets (screenshots) remain before first submission.
