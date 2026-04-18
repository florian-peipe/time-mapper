# Time Mapper

A privacy-first place-aware time tracker. Sets up geofences around the
places you save, then quietly logs how long you spend at each one. All
data lives on-device; nothing leaves your phone.

Built with Expo (Router) + React Native + SQLite (via Drizzle) +
RevenueCat for billing.

## Local development

```sh
npm install
cp .env.example .env.local   # and fill in keys you have (see below)
npx expo start
```

The app boots fine without any third-party keys configured — it falls
back to mock implementations so UI work doesn't require a configured
RevenueCat / Google Cloud account. See _Mock-mode behaviour_ below for
the specifics.

## Scripts

| Script | What it does |
| --- | --- |
| `npm test` | Jest, all suites |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run build:check` | `expo export` for iOS — catches build-time issues |
| `npm run db:generate` | Drizzle migration generator |
| `npm run db:studio` | Drizzle Studio (DB browser) |

## Third-party setup (user-provided before ship)

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
4. Copy the iOS + Android public API keys into `.env.local`:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
   ```
5. For EAS builds, push the same secrets to the build pipeline:
   ```sh
   npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_...
   npx eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_...
   ```
   then `eas build --profile development` (or `production`).

### Google Places (Plan 5 integration)

1. Enable the Places API in Google Cloud Console.
2. Create an API key restricted to the iOS + Android bundle id
   `com.timemapper.app`.
3. Add to `.env.local`:
   ```
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...
   ```

## Mock-mode behaviour

When an env var is missing the app does NOT crash — it falls back to a
local mock so dev workflows keep working:

- **No RevenueCat keys**: `usePro()` delegates to `useProMock()`. The
  Settings → Developer → "Toggle Pro (mock)" row flips the in-memory
  Pro flag so you can preview Pro-gated UI without a real subscription.
  Purchases throw a "mock mode" error if attempted; the paywall surfaces
  this in its error Banner.
- **No Google Places key**: AddPlaceSheet renders three hardcoded
  Cologne / Düsseldorf addresses (the same ones used in screenshots).

This is intentional — the project ships with a "fully functional with no
keys" baseline so contributors can hack on UI without waiting on infra
setup.

## Repo layout

```
app/             expo-router routes (file-based)
src/
  components/    shared UI primitives
  features/      domain logic (billing, places, tracking, …)
  screens/       composed screens
  state/         Zustand stores
  theme/         design tokens + ThemeProvider
  db/            Drizzle schema + migrations + repositories
  lib/           tiny utilities (i18n, id, …)
docs/            design system + plans
```
