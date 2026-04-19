# Time Mapper

A privacy-first place-aware time tracker. Sets up geofences around the
places you save, then quietly logs how long you spend at each one. All
data lives on-device; nothing leaves your phone.

Built with Expo (Router) + React Native + SQLite (via Drizzle) +
RevenueCat for billing.

## What's in v1.0.0

Everything the MVP scope asks for is shipped and tested:

- First-run onboarding (welcome → permissions → add your first place).
- Places — add/edit/delete with name, address, color, icon, radius, and
  per-place entry + exit buffers.
- Address autocomplete via Photon (Komoot's OSM-backed service, hosted
  in Germany — no key, no sign-up, no US data transfer). Falls back to a
  small hardcoded demo list if Photon is unreachable.
- Auto-tracking via OS geofencing. A state machine sits behind a
  background task; the UI reconciles OS state on every cold boot so
  crashes never leak into double-counting.
- Timeline (today + history within retention). Entries show place,
  start, end, duration, and source (auto / manual).
- Manual entry + edit + delete (with a 5-second Undo snackbar that
  restores the row on tap).
- Weekly summary — bar chart + total for the current / prior week,
  with a Pro-gated multi-week navigator.
- Local notifications on entry open / close (opt-in via OS settings).
- Pro paywall with 4 trigger sources: 2nd-place, history depth,
  export, and the Settings upsell card.
- Full Settings surface: OS permissions deep-link, per-place buffers,
  notifications quiet-hours, theme, language, retention gate, legal
  pages, support, Pro management, diagnostic export.
- Privacy: location data never leaves the device. Sentry is opt-in
  and location-field-stripped when enabled.
- i18n: every user-facing string in en + de.
- Accessibility: semantic labels, 44pt touch targets, WCAG AA contrast.

## What's done (release history)

| Area                                                                | Status                |
| ------------------------------------------------------------------- | --------------------- |
| Foundation — tokens, primitives, theme, i18n, DB                    | Shipped (v0.1)        |
| Core UI — Timeline, Stats, Settings, Add Place, Paywall, EntryEdit  | Shipped (v0.2)        |
| UX pivot — onboarding polish, pending-transitions, map preview      | Shipped (v0.3)        |
| Location engine — geofences, state machine, bootstrap, reconcile    | Shipped (v0.4)        |
| Billing — RevenueCat + mock mode + paywall wired                    | Shipped (v0.5)        |
| Release polish — a11y, DE audit, Sentry, legal, store metadata, EAS | Shipped (v0.6)        |
| Pre-ship fixes — Impressum guard, KV persistence, sheets, snackbar  | Shipped (v1.0.0-beta) |

## What the user provides (before ship)

| Item                            | Where                                                         | Docs                                                                          |
| ------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Apple Developer account         | App Store Connect                                             | [developer.apple.com](https://developer.apple.com)                            |
| Google Play Console account     | Play Console                                                  | [play.google.com/console](https://play.google.com/console)                    |
| RevenueCat project + API keys   | `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY`                    | [revenuecat.com](https://www.revenuecat.com)                                  |
| Google Maps for Android SDK key | `app.json → android.config.googleMaps.apiKey`                 | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) — free tier (28.5k loads/mo), GCP billing account required |
| Sentry DSN (optional)           | `EXPO_PUBLIC_SENTRY_DSN`                                      | [sentry.io](https://sentry.io)                                                |
| Impressum contact details       | `src/screens/Legal/contact.local.ts` (gitignored)             | See § 5 TMG                                                                   |
| Support email                   | `src/screens/Settings/SettingsScreen.tsx` (mailto) + app.json | Placeholder `support@timemapper.app`                                          |
| Privacy policy public URL       | App Store Connect → App Privacy                               | Host `docs/legal/privacy-en.md`                                               |
| Apple ID + ASC App ID + Team ID | `eas.json` submit.production.ios                              | ASC → App Information                                                         |
| Play service account JSON       | `play-service-account.json` (gitignored)                      | Play Console → Setup → API access                                             |
| App icon + screenshots          | `assets/icon.png` + `store/screenshots/`                      | [Screenshot README](./store/screenshots/README.md)                            |

## How to build + submit

### 1. Install

```sh
npm install
cp .env.example .env.local   # fill in the keys you have
```

### 2. Push EAS secrets (one-time)

```sh
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_...
npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_...
# (No Mapbox / Google Places secrets — Photon is keyless, Apple Maps is keyless, Google Maps Android SDK key lives in app.json not EAS secrets)
npx eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value https://...   # optional
```

### 3. Build

```sh
# Development client (simulators only, hot reload):
npx eas build --profile development --platform ios
npx eas build --profile development --platform android

# Internal testing (TestFlight / Play Internal):
npx eas build --profile preview --platform ios
npx eas build --profile preview --platform android

# Production (autoIncrement, store-ready):
npx eas build --profile production --platform ios
npx eas build --profile production --platform android
```

### 4. Submit

Before `eas submit`, fill the placeholders in `eas.json → submit.production`
and drop your Play service-account JSON at `play-service-account.json`.

```sh
npx eas submit --profile production --platform ios
npx eas submit --profile production --platform android
```

See `store/ios/metadata.yaml` + `store/android/metadata.yaml` for the
exact strings to paste into App Store Connect and Play Console.

## How to test locally

| Environment                         | Works?  | Notes                                                                 |
| ----------------------------------- | ------- | --------------------------------------------------------------------- |
| `npm test` (Jest)                   | Yes     | 615 tests — repos, screens, flows, a11y, snapshots                    |
| `npm run typecheck`                 | Yes     | Strict TS — no `any` added                                            |
| `npm run lint`                      | Yes     | Zero-warning baseline                                                 |
| `npm run build:check`               | Yes     | `expo export --platform ios`                                          |
| `npx expo start` (Expo Go)          | Partial | UI renders + mock billing; **no geofencing** — that needs a dev build |
| `npx expo run:ios` (dev client)     | Yes     | Full feature set including background geofence                        |
| `npx expo run:android` (dev client) | Yes     | Same                                                                  |

### Dev toggles (in a debug build)

- **Settings → Developer → Toggle Pro (mock)** — flip Pro state
  without touching RevenueCat, handy for previewing Pro-gated UI.
- **Settings → Developer → Simulate visit** — fire a synthetic
  "entered then exited" pair through a place of your choice, bypassing
  the OS geofence hardware.
- **Settings → Developer → Export diagnostic log** — dumps last 50
  pending transitions + environment flags to a JSON share sheet for
  bug reports.

### Mock-mode behaviour

When an env var is missing the app does NOT crash — it falls back to a
local mock so dev workflows keep working:

- **No RevenueCat keys**: `usePro()` delegates to `useProMock()`. The
  Settings → Developer → "Toggle Pro (mock)" row flips the in-memory
  Pro flag so you can preview Pro-gated UI without a real subscription.
  Purchases throw a "mock mode" error if attempted; the paywall surfaces
  this in its error Banner.
- **Photon unreachable** (or inside Jest): AddPlaceSheet falls back to
  three hardcoded Cologne / Düsseldorf addresses (the same ones used in
  screenshots). Photon itself needs no key.
- **No Google Maps for Android SDK key**: Android map preview falls
  back to a warning Banner. iOS is always fine — Apple Maps needs no
  keys.
- **No Sentry DSN**: crash reporting is disabled; `captureException`
  falls through to `console.error`.

This is intentional — the project ships with a "fully functional with no
keys" baseline so contributors can hack on UI without waiting on infra
setup.

## Third-party setup (details)

These are needed for production builds. The codebase is wired to read
keys from `EXPO_PUBLIC_*` env vars (which Expo substitutes into
`app.json#extra` at build time).

### RevenueCat

1. Create a project at https://app.revenuecat.com and add iOS + Android
   apps for the bundle id `com.timemapper.app`.
2. In App Store Connect + Google Play Console, configure two products:
   - `tm_pro_monthly` — auto-renewable, €4.99 / month
   - `tm_pro_yearly` — auto-renewable, €29.99 / year with a 7-day free trial
3. In the RevenueCat dashboard:
   - Create an offering called `default` and attach both products.
   - Create an entitlement called `pro` and link both products to it.
4. Copy the iOS + Android public API keys into `.env.local`.

### Photon (address autocomplete + geocoding)

No setup needed. Photon (photon.komoot.io) is OSM-backed, hosted by
Komoot GmbH in Potsdam, Germany. No API key, no sign-up, free forever
for fair-use. Typed addresses never leave the EU — the main reason we
prefer Photon over Google Places for a privacy-positioned app.

If Photon is unreachable, `src/lib/geocode.ts` falls back to a three-row
Köln / Düsseldorf demo list so the AddPlaceSheet flow still works.

### Google Maps for Android SDK (Android map preview only)

iOS renders the map preview via Apple Maps natively — no key, no
account, no card. Android uses Google Maps for Android under the hood
via `react-native-maps`, which requires a free SDK key embedded in
`app.json → android.config.googleMaps.apiKey`.

1. Create a GCP project at https://console.cloud.google.com.
2. Enable the **Maps SDK for Android** only (leave Places, Directions,
   and friends disabled — the app uses none of them).
3. Create an API key and restrict it to the Android bundle id
   `com.timemapper.app` + the Maps SDK for Android.
4. Enable billing on the GCP project. **This is a GCP requirement
   even for free-tier usage** — you won't be charged unless you
   exceed 28,500 map loads/month.
5. Paste the key into `app.json`:
   ```json
   "android": {
     "package": "com.timemapper.app",
     "config": {
       "googleMaps": { "apiKey": "AIza..." }
     }
   }
   ```

When the key is missing, the Android map preview degrades to a warning
Banner ("map preview unavailable") — the rest of the app (Timeline,
Stats, Settings, auto-tracking) works fine.

### Sentry (optional)

Crash reporting is opt-in. The app runs fine without it; when enabled it
reports uncaught errors + explicit `captureException` calls.

1. `npx expo install @sentry/react-native`
2. Create a project at https://sentry.io and copy the DSN.
3. Add to `.env.local`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/12345
   ```

Privacy note: the wrapper in `src/lib/crash.ts` strips `latitude`,
`longitude`, and `location` fields from all breadcrumbs/events before
they leave the device. User id is the anonymous RevenueCat id only.

### Impressum contact details

German law (§ 5 TMG) requires apps distributed in the EU to publish real
contact info on a reachable "Impressum" page. We keep these details
out of git — copy the template and fill in your real values:

```sh
cp src/screens/Legal/contact.local.example.ts src/screens/Legal/contact.local.ts
```

Then edit `src/screens/Legal/contact.local.ts` with your real
`ownerName`, `address`, `email`, and `phone`. The `.local.ts` file is
gitignored. If the file is missing (or any field contains `{{...}}`
tokens), the Impressum page displays an "Impressum not yet configured"
notice instead of the literal placeholder text — App Store review
would otherwise reject the build.

## Repo layout

```
app/               expo-router routes (file-based)
  (onboarding)/    welcome → permissions → first-place
  (tabs)/          timeline, stats, settings
  legal/           privacy, terms, impressum
src/
  components/      shared UI primitives (Banner, Button, Card, …)
  features/        domain logic (billing, places, tracking, diagnostics, …)
  screens/         composed screens
  state/           Zustand stores (sheet, ui)
  theme/           design tokens + ThemeProvider
  db/              Drizzle schema + migrations + repositories
  lib/             tiny utilities (i18n, id, geocode, crash)
  locales/         en.json + de.json
  __tests__/       barrel, a11y, critical-flows, snapshots, sanity
docs/
  legal/           privacy/terms/impressum (markdown source of truth)
  SIDELOAD.md      zero-cost iPhone sideload guide
  STATUS.md        release status + third-party checklist
store/
  ios/             App Store Connect metadata.yaml
  android/         Play Console metadata.yaml
  screenshots/     README with simctl/adb capture commands
```

## Troubleshooting

### Geofences never fire

OS geofences require a **development build or standalone app** — they
do not fire inside Expo Go. If you see the OS permission banner but no
entry/exit events, rebuild with `npx eas build --profile development`
and install the dev client on your device.

On iOS, check **Settings → Time Mapper → Location → Always**. The app
asks for _Always_ up-front because "When In Use" will not wake
geofences when the app is backgrounded.

On Android 10+, Android requires the same **Allow all the time**
selection in the permission prompt. If the user dismissed the prompt,
the Settings → "Location permissions" row deep-links to the OS page.

### "Pro mode: mock" banner won't go away

The app is running without RevenueCat keys. Set
`EXPO_PUBLIC_REVENUECAT_IOS_KEY` + `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
in `.env.local`, or push them as EAS secrets for production builds.

### Impressum shows "not yet configured"

You forgot to create `src/screens/Legal/contact.local.ts` (or any of
the four required fields is empty / still has a `{{TOKEN}}`
placeholder). Copy the example file and fill in real values — see
"Impressum contact details" above. The file is gitignored so your
address never hits the repo.

### Paywall shows "Unable to load pricing"

Either (a) RevenueCat keys are missing so the pricing fetch failed
gracefully, or (b) the Offering `default` + Entitlement `pro` are not
configured on the RevenueCat dashboard, or (c) the store products
(`tm_pro_monthly`, `tm_pro_yearly`) are not in "Ready to submit" /
"Active" state in App Store Connect / Play Console.

### Sentry crashes have missing location context

That's intentional — `src/lib/crash.ts` strips `latitude`, `longitude`,
`location`, and related fields from every breadcrumb and event before
Sentry sees it. Coordinates never leave the device.

### Jest test fails with "Cannot find module 'expo-sqlite'"

A repository or hook is being imported at module-eval time in a
non-device context. Check that the offending import uses the
lazy-`require()` pattern in `usePlaces` / `useEntries` etc. — see
`getDeviceRepo()` helpers.

## License

Copyright © 2026 Time Mapper developer.

This source is proprietary. No grant of rights is implied by its
publication in this repository. A commercial license will be issued
once the App Store build ships; until then assume "all rights
reserved".

The Time Mapper wordmark, icon, and color palette are unregistered
trademarks of the developer.
