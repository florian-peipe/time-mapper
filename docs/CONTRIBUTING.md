# Contributing to Time Mapper

One-page playbook for adding features without surprising anyone.
Read `docs/ARCHITECTURE.md` first — this file assumes that vocabulary.

## Local setup

```sh
npm ci
cp .env.example .env.local     # fill the keys you have (leave others blank)
npm run typecheck              # zero errors
npm run lint                   # zero warnings
npm test                       # ~600 tests, <15s
```

The app runs in dev without RC keys only because `configureRevenueCat` is
called inside a React effect — so Expo Go + Jest both skip the SDK init.
Paywall + purchase paths will throw at runtime; that's intentional.

---

## Commit style

Conventional commits. One concern per commit. Examples:

```
feat(billing): honor RC live customer-info listener
fix(tracking): swallow reconcile errors when location is "unknown"
refactor(settings): extract BuffersSheet out of SettingsScreen
test(stateMachine): add CONFIRM-past-buffer property tests
docs(architecture): diagram the reactivity loop
chore(deps): bump expo-location to 19.0.9
```

Pre-commit must be green: `typecheck`, `lint`, `test`. CI also requires
it — PRs with failures don't merge.

---

## Adding a new feature hook (reads the device DB)

1. Add any new schema to `src/db/schema.ts`, plus a Drizzle migration in
   `src/db/migrations/`.
2. Add a repo under `src/db/repository/*.ts`. Constructor takes `AnyDb`.
3. Inject the repo via a Context provider and `createDeviceRepo(db => new XxxRepo(db))`
   fallback. Copy the `usePlaces` pattern:
   ```ts
   const XxxRepoContext = createContext<XxxRepo | null>(null);
   export function XxxRepoProvider({ value, children }) { … }

   const getDeviceRepo = createDeviceRepo((db) => new XxxRepo(db));

   export function useXxxRepo(): XxxRepo {
     const injected = useContext(XxxRepoContext);
     return useMemo(() => injected ?? getDeviceRepo(), [injected]);
   }
   ```
4. If the hook writes: bump the relevant `dataVersionStore` counter after
   each mutation so other consumers see the change.
5. If the hook queries: subscribe to the counter in the `useEffect` deps
   so changes propagate.

Never write a feature that does `require("@/db/client")` directly. The
lazy-require lives in `src/db/deviceDb.ts` — one eslint-disable, one
file.

---

## Adding a KV key

1. Add it to `KV_KEYS` in `src/db/kvKeys.ts` with a docstring describing
   the value encoding (`"1"` flag, JSON blob, unix-seconds integer, etc).
2. Import `KV_KEYS` from the consumer; never hard-code the literal string.
3. Dynamic keys (e.g. per-place, per-day) get a helper alongside
   `goalDedupKvKey`.

---

## Adding a screen

1. Create `src/screens/<Screen>/<Screen>Screen.tsx`.
2. Add an Expo Router file in `app/(tabs)/<route>.tsx` or
   `app/(onboarding)/<route>.tsx` that re-exports the screen as default.
3. If it's tabbed, register it in `app/(tabs)/_layout.tsx`.
4. Add an entry in `src/lib/routes.ts` for type-safe navigation.
5. Add a smoke test in `src/screens/<Screen>/<Screen>Screen.test.tsx`
   mirroring the `TimelineScreen.test.tsx` pattern.
6. If the screen uses a new shared primitive, promote it to
   `src/components/` (with a test) before importing from the screen.

---

## Adding a notification trigger

Never fire a notification from inside a screen. The pipeline is:

1. Tracking produces a `state-machine.Effect` inside a transaction.
2. After the transaction commits, `notifier.maybeNotifyForEffects` walks
   the effect list and calls `decideNotification` per effect.
3. The decision is either `fire` (schedule), `consolidate` (group), or
   `skip` (quiet hours).

If you're adding a non-tracking notification (e.g. a digest), mount it in
`src/features/notifications/digest.ts` style — a separate scheduler that
reads KV config + the `expo-notifications` trigger API. Don't pollute
`maybeNotifyForEffects`.

---

## Adding user-facing copy

1. Add the key to BOTH `src/locales/en.json` AND `src/locales/de.json`.
   CI's `i18n-coverage.test.ts` will fail if you miss one.
2. Use template vars (`{{name}}`) rather than string concat.
3. Reference via `i18n.t("your.key")` — never inline hard-coded strings
   even for debug rows. They leak.

---

## Adding a Pro gate

1. Read `const { isPro } = usePro()` at the top of the component.
2. If free-tier users would hit the gate, call
   `openPaywall({ source: "<identifier>" })` rather than navigating
   directly. The RC-hosted paywall + A/B variants are owned by the
   dashboard — don't build a custom upsell UI inline.
3. If the user might need to resume a mid-flow task (e.g. AddPlaceSheet
   while attempting a 2nd place), stash the form in `pendingPlaceForm`
   on the sheet store before opening the paywall. `openPaywall` will
   reopen the sheet on PURCHASED / RESTORED.

---

## Adding tests

- **Pure code** — place-based tests, input → output. Examples:
  `stateMachine.test.ts`, `time.test.ts`, `range.test.ts`.
- **Repos** — use `createTestDb()`, exercise every method.
- **Hooks** — `renderHook` + the appropriate `RepoProvider`.
- **Screens** — `render()` wrapped in `SafeAreaProvider` + `ThemeProvider`
  + repo providers. Use `testID`s over brittle text matches.
- **Flows** — cross-module integration goes in `src/__tests__/critical-flows.test.tsx`.

For Pro-gated tests, set `__setProForTests(true)` in `beforeEach`; reset
with `__setProForTests(null)`.

---

## Release process

1. Update `CHANGELOG.md` under an `## [Unreleased]` header.
2. Tag: `git tag v1.X.Y && git push --tags`.
3. `.github/workflows/release.yml` runs the gate (`typecheck`, `lint`,
   `test`, `check:submit`), then kicks off EAS builds + auto-submit.
4. Required secrets: `EXPO_TOKEN`, `PLAY_SERVICE_ACCOUNT_JSON` (base64),
   `EXPO_PUBLIC_*` env vars.
5. First-ever submit: fill the placeholders in `eas.json`, copy
   `src/screens/Legal/contact.local.example.ts` → `contact.local.ts`,
   fill Impressum. `npm run check:submit` tells you what's missing.

---

## What NOT to do

- Don't import from `@/db/client` in feature code — use `deviceDb`.
- Don't hard-code KV key literals — add them to `kvKeys.ts`.
- Don't fire notifications outside the `notifier` pipeline.
- Don't add a custom in-house paywall — RC hosts it.
- Don't add telemetry without updating `docs/ADR-001-no-analytics.md`
  to supersede the current decision.
- Don't remove the `i18n-coverage` or `contrast` tests.
- Don't bypass `--max-warnings 0` on lint.
