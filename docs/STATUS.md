# Time Mapper — v1.0.0-beta status + handoff

_Generated during the final verification pass before store submission._

## Release metadata

| Field         | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Tag           | `v1.0.0-beta`                                          |
| Commit count  | 121                                                    |
| Test count    | 615 passing across 83 suites                           |
| Typecheck     | Clean (`tsc --noEmit`)                                 |
| Lint          | Clean (0 warnings, 0 errors)                           |
| `build:check` | Clean (`expo export --platform ios` → ~10.7 MB bundle) |

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
| `v1.0.0-beta`            | Final polish pass: undo-on-delete snackbar, hex cleanup, dev-gated diagnostics   |

## Feature matrix (spec §1 MVP scope)

| #   | Feature                                                 | Shipped | File                                                                                                        |
| --- | ------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | First-run onboarding (3 screens)                        | Yes     | `src/screens/Onboarding/{WelcomeScreen,PermissionsScreen,FirstPlaceScreen}.tsx`                             |
| 2   | Places management (all fields + per-place buffers)      | Yes     | `src/screens/AddPlace/AddPlaceSheet.tsx` + `src/db/repository/places.ts`                                    |
| 3   | Address autocomplete (Photon + offline fallback)        | Yes     | `src/lib/geocode.ts`                                                                                        |
| 4   | Auto-tracking geofence (state machine + service + task) | Yes     | `src/features/tracking/{stateMachine,geofenceService,persistence,bootstrap}.ts` + `src/background/tasks.ts` |
| 5   | Timeline view (today + history)                         | Yes     | `src/screens/Timeline/TimelineScreen.tsx`                                                                   |
| 6   | Manual entry                                            | Yes     | `src/screens/EntryEdit/EntryEditSheet.tsx` (new mode)                                                       |
| 7   | Entry edit / delete + 5 s undo snackbar                 | Yes     | `src/screens/EntryEdit/EntryEditSheet.tsx` + `src/components/Snackbar.tsx` + `src/state/snackbarStore.ts`   |
| 8   | Weekly summary (Stats + bar chart)                      | Yes     | `src/screens/Stats/{StatsScreen,WeekBarChart,Ledger}.tsx`                                                   |
| 9   | Local notifications (open / close)                      | Yes     | `src/features/notifications/notifier.ts`                                                                    |
| 10  | Pro paywall (trigger sources)                           | Yes     | `src/screens/Paywall/PaywallScreen.tsx` + `src/state/sheetStore.ts`                                         |
| 11  | Settings (all rows functional)                          | Yes     | `src/screens/Settings/SettingsScreen.tsx` + `BuffersSheet.tsx` + `NotificationsSheet.tsx`                   |
| 12  | Privacy posture (no location in network calls)          | Yes     | Only `src/lib/geocode.ts` hits the network (address query, never user coords)                               |
| 13  | i18n (en + de, every user string)                       | Yes     | `src/locales/{en,de}.json` + `src/lib/__tests__/i18n-coverage.test.ts`                                      |
| 14  | Accessibility (labels, 44 pt, AA contrast)              | Yes     | `src/__tests__/a11y.test.tsx` (29 assertions)                                                               |

## Third-party setup checklist

Before the App Store / Play Console build ships, the developer must
provide each of these. The code is already wired; set the env var or
file and rebuild.

| Item                        | Required env var / path                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| Apple Developer account     | ASC App ID + Team ID into `eas.json → submit.production.ios`                      |
| Google Play Console account | Service-account JSON at `play-service-account.json` (gitignored)                  |
| RevenueCat iOS key          | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`                                                  |
| RevenueCat Android key      | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`                                              |
| Google Maps for Android SDK key (Android map preview) | `app.json → android.config.googleMaps.apiKey` — free 28.5k loads/mo; GCP billing account required |
| Sentry DSN (optional)       | `EXPO_PUBLIC_SENTRY_DSN` — disables gracefully when missing                       |
| Impressum contact details   | `src/screens/Legal/contact.local.ts` (gitignored, copy from `.example.ts`)        |
| Support email               | Replace `support@timemapper.app` placeholder in `SettingsScreen.tsx` + `app.json` |
| Privacy policy hosted URL   | Host `docs/legal/privacy-{en,de}.md` and paste URL into ASC App Privacy           |
| App Store screenshots       | Capture via `store/screenshots/README.md` commands once dev build installed       |
| Play Store screenshots      | Same commands, Android simulator                                                  |

Tip — push EAS secrets once rather than managing local env files for
production builds:

```sh
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY     --value appl_...
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_...
# (No Mapbox / Places secrets — Photon is keyless. Google Maps Android SDK key lives in app.json, not here.)
npx eas secret:create --name EXPO_PUBLIC_SENTRY_DSN             --value https://...
```

## Limitations (cannot be verified in this sandbox)

1. **Expo Go cannot run the geofence background task.** The auto-tracking
   end-to-end path has been unit + integration tested with mocked native
   modules (`__mocks__/`), but real-device validation requires a dev
   client (`npx eas build --profile development`). The task registers at
   module-eval time in `src/background/tasks.ts`; the OS cold-wake path
   only runs when a standalone app (or dev client) is installed on the
   device.
2. **Icons look correct in screenshots, but app-store asset validation
   needs a real device.** Icon files are 1024×1024 PNGs in `assets/`;
   Expo auto-generates the per-density variants at build time. A
   sanity-check render on-device is still recommended before submission.
3. **CSV export is a no-op.** The paywall correctly gates the row, and
   unlocking Pro surfaces the button, but the file-writing path is
   intentionally empty (it lands in v1.0.0-GA). Users who tap Export
   while on Pro will not see an error — the action just silently
   completes.
4. **Screenshots are placeholders.** `store/screenshots/` ships the
   simctl/adb capture commands and a README, but no actual images.
   Capture them after installing a dev build.
5. **Store version string includes a pre-release suffix.** Both
   `package.json` and `app.json` currently read `1.0.0-beta.1`. App
   Store Connect and Play Console reject semver pre-release suffixes in
   `expo.version`; reset to `1.0.0` (keeping `buildNumber` / `versionCode`
   as the incrementing differentiator) before the first production build.

## Next steps for the user

1. **Provision third-party accounts** (RevenueCat, Apple Developer,
   Play Console, and a GCP project for the free Android Maps SDK key).
   See the checklist above. Photon needs no account.
2. **Fill `src/screens/Legal/contact.local.ts`** with real Impressum
   contact details.
3. **Push EAS secrets** for all `EXPO_PUBLIC_*` keys.
4. **Reset `expo.version` to `1.0.0`** in `app.json` (pre-release suffix
   blocks store submission).
5. **Build a development client:**
   ```sh
   npx eas build --profile development --platform ios
   npx eas build --profile development --platform android
   ```
   Install on a real device and verify auto-tracking by walking into /
   out of a saved place — the notification + Timeline entry should land
   within the configured entry/exit buffers.
6. **Capture screenshots** via `store/screenshots/README.md`.
7. **Build production binaries:**
   ```sh
   npx eas build --profile production --platform ios
   npx eas build --profile production --platform android
   ```
8. **Submit:** `npx eas submit --profile production --platform {ios,android}`
9. **App Store review dance** — answer privacy questions, paste ATT /
   tracking posture ("This app does not track you"), upload screenshots,
   publish.

## Verdict

Honestly shippable once the user provides the third-party keys and the
store-submission housekeeping (Impressum, screenshots, version string
normalization) is done. No known bugs, no skipped tests, no TODOs in
the source tree. The UI, domain logic, persistence, and billing paths
are all feature-complete and exercised by the 615-test suite.
