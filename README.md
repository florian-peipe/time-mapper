# Time Mapper

A privacy-first place-aware time tracker. Sets up geofences around the
places you save, then quietly logs how long you spend at each one. All
data lives on-device; nothing leaves your phone.

Built with Expo (Router) + React Native + SQLite (via Drizzle) +
RevenueCat for billing.

## What's done

| Area | Status |
| --- | --- |
| Foundation — tokens, primitives, theme, i18n, DB | Shipped |
| Core UI — Timeline, Stats, Settings, Add Place, Paywall, EntryEdit | Shipped |
| Location engine — geofences, state machine, bootstrap, reconcile | Shipped |
| Billing — RevenueCat + mock mode + paywall wired | Shipped |
| Release polish — a11y, DE audit, Sentry, legal, store metadata, EAS, map preview | Shipped |

## What the user provides (before ship)

| Item | Where | Docs |
| --- | --- | --- |
| Apple Developer account | App Store Connect | [developer.apple.com](https://developer.apple.com) |
| Google Play Console account | Play Console | [play.google.com/console](https://play.google.com/console) |
| RevenueCat project + API keys | `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY` | [revenuecat.com](https://www.revenuecat.com) |
| Google Places API key | `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) |
| Sentry DSN (optional) | `EXPO_PUBLIC_SENTRY_DSN` | [sentry.io](https://sentry.io) |
| Impressum contact details | `docs/legal/impressum-*.md` + `src/screens/Legal/documents.ts` | See § 5 TMG |
| Privacy policy public URL | App Store Connect → App Privacy | Host `docs/legal/privacy-en.md` |
| Apple ID + ASC App ID + Team ID | `eas.json` submit.production.ios | ASC → App Information |
| Play service account JSON | `play-service-account.json` (gitignored) | Play Console → Setup → API access |
| App icon + screenshots | `assets/icon.png` + `store/screenshots/` | [Screenshot README](./store/screenshots/README.md) |

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
npx eas secret:create --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value AIza...
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

| Environment | Works? | Notes |
| --- | --- | --- |
| `npm test` (Jest) | Yes | 553 tests — repos, screens, flows, a11y, snapshots |
| `npm run typecheck` | Yes | Strict TS — no `any` added |
| `npm run lint` | Yes | Zero-warning baseline |
| `npm run build:check` | Yes | `expo export --platform ios` |
| `npx expo start` (Expo Go) | Partial | UI renders + mock billing; **no geofencing** — that needs a dev build |
| `npx expo run:ios` (dev client) | Yes | Full feature set including background geofence |
| `npx expo run:android` (dev client) | Yes | Same |

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
- **No Google Places key**: AddPlaceSheet renders three hardcoded
  Cologne / Düsseldorf addresses (the same ones used in screenshots).
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

### Google Places

1. Enable the Places API in Google Cloud Console.
2. Create an API key restricted to the iOS + Android bundle id
   `com.timemapper.app`.
3. Add to `.env.local`:
   ```
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...
   ```

### Sentry (optional)

Crash reporting is opt-in. The app runs fine without it; when enabled it
reports uncaught errors + explicit `captureException` calls.

1. `npm install @sentry/react-native`
2. Create a project at https://sentry.io and copy the DSN.
3. Add to `.env.local`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/12345
   ```

Privacy note: the wrapper in `src/lib/crash.ts` strips `latitude`,
`longitude`, and `location` fields from all breadcrumbs/events before
they leave the device. User id is the anonymous RevenueCat id only.

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
  design-system/   tokens + UI kit
  legal/           privacy/terms/impressum (markdown source of truth)
  superpowers/     implementation plans
store/
  ios/             App Store Connect metadata.yaml
  android/         Play Console metadata.yaml
  screenshots/     README with simctl/adb capture commands
```
