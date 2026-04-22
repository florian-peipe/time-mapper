# V1.1 Launch Plan

Ten steps between "code complete" and "live in App Store + Play Store with
paying users." Ordered by priority. Check items off as you go.

Legend: **BLOCKING** = cannot submit without. **STRATEGIC** = changes the
product posture long-term. **QUALITY** = user-visible polish, non-optional
for a paid app. **MAINT** = maintainability, prevents silent rot.

---

## 1. Close user-provided submission inputs · BLOCKING · S

Repo cannot ship without these. None of them can be filled by code — they
require your personal credentials.

- [ ] `eas.json` → replace `YOUR_APPLE_ID_EMAIL`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID` with real values
- [ ] Download `play-service-account.json` from Play Console → API access → Service accounts → Create key; drop at repo root
- [x] Copy `src/screens/Legal/contact.local.example.ts` → `contact.local.ts`, fill with real Impressum details (§5 TMG — missing this is a legal violation in DE, not just a submission fail) — Florian Peipe, Lindenalee 46, 50968 Köln, info@peipe.org
- [ ] Replace placeholder images in `store/screenshots/` with real captures (run the Maestro flows or capture manually)
- [ ] Set `EXPO_PUBLIC_SENTRY_DSN` in production env (via EAS Secrets or `.env.production`)
- [ ] Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` + `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- [x] Strip "Categories for grouping places" from `store/ios/metadata.yaml` (EN + DE) — advertised but not shipped
- [ ] Run `npm run check:submit` — all green before submit
- [ ] RevenueCat dashboard sanity check: entitlement id exactly `Time Mapper Pro`, offering id `default`, products `tm_pro_monthly` + `tm_pro_yearly` attached, paywall configured

## 2. End-to-end smoke on a paid-developer iOS dev build · BLOCKING · M

Sideload provisioning can't verify these. On a real dev-client build with
your paid profile, confirm each:

- [ ] Cold install runs migrations cleanly (no orphan `pending_transitions`)
- [ ] Background geofence enter triggers an auto-entry (walk / drive across a 100m geofence; wait for entry buffer; confirm entry lands)
- [ ] Background geofence exit closes the entry
- [ ] App killed during tracking: re-open → `runOpportunisticResolve` catches up
- [ ] Sandbox purchase → `isPro` flips via the live customer-info listener (not only on next `getCustomerInfo()`)
- [ ] "Restore Purchases" from a second device on the same Apple ID works
- [ ] Customer Center opens; cancelling sandbox sub flips `isPro` back to false after the listener fires
- [ ] Paywall with `source: "2nd-place"` + PURCHASED re-opens AddPlace with the pending form hydrated
- [ ] Reset all data → onboarding → first place → auto-tracked entry end-to-end
- [ ] Dark mode + system-font large size on the hero screens: Timeline, Stats, AddPlace, Settings

## 3. Resolve the data-import gap · BLOCKING (trust) · S

`backup.ts` writes JSON but nothing reads it back. Decision: keep JSON as a
GDPR Article-20 portability export (no restore UX), rename the row to make
that explicit so users don't expect a restore flow that isn't there.

- [x] Rename "Export backup (JSON)" → "Export all data (JSON)" (EN + DE)
- [x] Row subtitle clarifies "For your records / GDPR portability. Restore not yet supported."
- [ ] v1.2+: build the import path if user demand materializes

## 4. Analytics decision · STRATEGIC · recorded as ADR

Decision for v1.1: **no telemetry beyond Sentry crashes.** Keep the privacy
posture. Revisit post-launch if the RC paywall A/B loop needs measurement.

- [x] Decision recorded in `docs/ADR-001-no-analytics.md`
- [ ] Post-launch: track paywall conversion externally (RC dashboard + StoreKit sandbox data) before committing to an in-app telemetry ping

## 5. CI PR gate + EAS release workflow · BLOCKING · M

Current `ios-unsigned.yml` builds a sideload IPA. Add:

- [x] `.github/workflows/ci.yml` — runs `typecheck`, `lint`, `test`, `build:check` on every PR; blocks merge on red. (Note: `check:submit` deliberately lives in `release.yml` only; running it on every PR would block merges until Apple IDs are filled.)
- [x] Tag-based release: `.github/workflows/release.yml` — pushing `v*.*.*` runs the gate + `check:submit` + kicks off EAS production build + auto-submit
- [ ] Wire `EAS_ACCESS_TOKEN` + `PLAY_SERVICE_ACCOUNT_JSON` (base64) as repo secrets for the release workflow
- [ ] Screenshot Maestro flows run in CI, upload as artifact on tagged builds

## 6. Sentry verification loop · BLOCKING · S

Wiring is done; verification isn't.

- [ ] Install DSN in `.env.local` + production env
- [x] Add a `__DEV__`-gated "Trigger test crash" row to Settings so you can force an event in a real build
- [ ] Force a test crash → confirm it lands in Sentry with the full breadcrumb chain (`geofence` → `entry` → `paywall`)
- [ ] Verify `scrubLocation` actually strips coords from a real event (not just the unit test) — inspect the event JSON in the Sentry issue UI
- [ ] Set crash-free-session SLO alert at 99.5% (Sentry → Alerts → Create → "Metric alert")

## 7. Accessibility pass · QUALITY · M

`a11y.test.tsx` is structural only. Before ship:

- [x] `accessibilityLiveRegion` on RunningTimerCard so VoiceOver announces the elapsed tick
- [x] Font-scaling regression tests added (asserts no primitive opts out of Dynamic Type via `allowFontScaling={false}`). **Not** a full 1.3× snapshot — device-side VoiceOver + large-text walkthrough still required.
- [ ] VoiceOver walkthrough of 5 critical flows: onboarding, add-place, start-tracking, view-timeline, open-paywall — on a physical device
- [x] Contrast test runs in CI (`src/theme/__tests__/contrast.test.ts` is picked up by Jest default glob; `ci.yml`'s `npm test` step includes it)

## 8. Retention visibility in Settings · QUALITY · S

The sweep runs but users can't see or control it.

- [x] Settings row: "History" cap — 6 months / 1 year / 2 years / forever; writes `KV_KEYS.retention.hard_cap_days`
- [x] Data-size indicator: "X places · Y entries"
- [ ] (v1.2) Soft-delete surface in Settings → "Recently deleted" with restore affordance

## 9. Architecture + contributor docs · MAINT · S

- [x] `docs/ARCHITECTURE.md` — tracking pipeline diagram, data-version reactivity, repo-provider pattern, KV-key registry
- [x] `docs/CONTRIBUTING.md` — how to add a feature hook, register a KV key, add a screen, test conventions, release process

## 10. Post-launch ops playbook · MAINT · S

- [x] `docs/POST_LAUNCH_PLAYBOOK.md` — Sentry alert thresholds, App Store review response template, Day-1 crash runbook, subscription-health check
- [ ] Support email (in `app.json` + `SettingsScreen.tsx`) monitored with a response-time target
- [ ] Pin the Sentry issue inbox + RevenueCat dashboard in your bookmarks

---

## What "done" looks like

Close items 1–10 above. Don't let these creep in for v1.1:

- **Categories feature** — scoped out of v1.1, removed from metadata
- **Full Typography migration across 110 `<Text>` sites** — leak in incrementally on touched screens
- **Widgets / watchOS / web** — v1.2+
- **Data import UX** — v1.2+

## Refactoring state (2026-04-22)

The four heaviest screens have been decomposed:

| File | Before | After |
|---|---|---|
| `AddPlaceSheet.tsx` | 724 | 384 |
| `SettingsScreen.tsx` | 621 | 317 |
| `EntryEditSheet.tsx` | 600 | 324 |
| `StatsScreen.tsx`    | 465 | 237 |

Every screen now under 450 lines. No file in the repo exceeds 500 lines
of production code. Tests + typecheck + lint all green after the split.

## What follows v1.1 (not "left to do before shipping")

Every shipping app has ongoing work. These are lifecycle items, not
launch-blockers:

- Expo SDK bumps every ~9 months (54 → 55 → 56) with breaking changes
- iOS / Android platform updates, privacy manifests, tracking labels
- Subscription edge cases that only surface at renewal boundaries
- Feature iteration driven by real user feedback
- Pricing / trial tuning

There is no "100% finished" state for a shipping app. Reachable target:
**launch-blockers closed + maintenance surface manageable.**
