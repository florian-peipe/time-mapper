# Post-launch playbook

Day-1 through week-4 of a shipped release. Written so present-you can set
up the alerts + templates once, then future-you can act on any signal
without re-researching.

---

## Sentry

### One-time setup

- Project: **time-mapper** (or your name).
- Create an alert: **Issue Alerts → New Alert** → condition
  "crash-free sessions < 99.5% over 1h" → action: email + (optional)
  Slack webhook.
- Tag scheme: `environment=production`, `platform=ios|android`,
  `release=<semver>`. Baked in via `@sentry/react-native` auto-tagging.

### Triage order on a new issue

1. Look at the breadcrumb chain — every non-trivial error has one
   (`geofence` → `entry` → `paywall`). If it's empty, it fired before
   the first event breadcrumb; likely module-eval crash.
2. Check the `release` tag. If it's only the latest release, it's new.
   If it's ≥ 2 releases, it's longstanding — likely low priority.
3. Check the `platform`. iOS-only crashes often indicate a native SDK
   issue (RC, expo-location); Android-only crashes often indicate a
   channel / permission edge case.
4. If the stack names `stateMachine`, `persistence`, or `applyEffects`,
   treat as P0 — the tracking pipeline is load-bearing.

---

## Subscription health (RevenueCat)

### Bookmark

`https://app.revenuecat.com/projects/<your-project>/overview`

### What to check weekly

- **Active trials** — how many users are mid-7-day-trial.
- **Trial → Paid conversion** (7-day cohort) — this is the number that
  decides whether the paywall A/B is winning.
- **Churn** — cancels per week. A sharp uptick 30 days after launch
  often means a week-2 retention problem, not a subscription problem.
- **Failed purchases** — look for a cluster of `STORE_PROBLEM`; usually
  Apple/Google server blip, occasionally a real misconfiguration.

### If the paywall offering is missing

User sees nothing (the error surfaces in Sentry via
`captureException({ scope: "openPaywall" })`). Act:

1. RC dashboard → **Offerings** → verify `default` is marked current.
2. Verify products `tm_pro_monthly` + `tm_pro_yearly` are attached to
   the `Time Mapper Pro` entitlement.
3. App Store Connect → Subscriptions → verify both products are in
   "Ready to Submit" or "Approved" state.

---

## App Store review responses

When a user leaves a 1-star review, iOS lets you respond once. Keep a
template handy:

> Thanks for your feedback. [Apology line tied to the specific issue if
> applicable.] We've shipped a fix in [version], coming to the App Store
> in a few hours. If you'd like to follow up, please email us at
> <support@timemapper.app> — we read every message.

Don't:
- Be defensive about privacy posture. The app IS private; restating it
  sounds preachy.
- Promise features by date unless they've already cleared review.
- Respond to spam or profanity — report to Apple instead.

---

## Day-1 crash runbook

### Symptom: Sentry alert fires in the first hour

1. **Acknowledge** the alert.
2. Get the top event from Sentry → copy the stack + breadcrumb chain.
3. Is the crash reproducible on a dev build? If yes → fix + patch
   release.
4. If no → check if the breadcrumb chain points to a specific path.
   - `geofence` → likely a race with the OS event delivery. Mitigate
     by shipping the known retry-in-bootstrap fix.
   - `entry` → likely a state-machine edge case. Add the offending
     event to `stateMachine.test.ts` before fixing.
   - `paywall` → RC outage or misconfiguration. Usually resolves on
     its own within an hour; note in Sentry.
5. Post a release note even for small patches. Users read them.

### Symptom: "app crashes on launch" reviews but Sentry is quiet

Sentry init happens AFTER migrations run. If a migration crashes, Sentry
won't fire. Check:

- Does the reviewed version's migration set match shipped migrations?
- Has the user's app version survived a Drizzle migration gap (v1.0 →
  v1.2 skipping v1.1)?
- `resetAllData()` recovers but loses their data — use only as last
  resort in a support thread.

---

## Support

### Inbox

`support@timemapper.app` — forwards to your personal inbox. Configure
a filter that tags based on the subject line prefix:
- `[Time Mapper]` — all app-related
- `[Refund]` — subscription / purchase

### Response-time target

- Refund requests: 24h. Note: App Store + Play handle refunds directly;
  you're usually just confirming you saw the request.
- Bug reports: 72h with acknowledgement + repro attempt.
- Feature requests: no SLA. Thank, note, don't promise.

### Template — bug report acknowledgement

> Thanks for writing in. I reproduced the issue locally — it's caused
> by [short explanation]. A fix is in the next patch release
> (v1.X.Y, expected [date]). I'll email you when it lands.

### Template — feature request acknowledgement

> Thanks for the suggestion. Time Mapper's roadmap is small by design —
> I try to ship only features that fit the "private time tracker" lane.
> [Feature] is [on the maybe-list / out of scope]. I read every request
> and don't make commitments unless something lands in an upcoming
> release.

---

## Subscriptions that surprise users

### "Why was I charged again?"

The trial auto-renews unless cancelled. Users forget. Gentle reply:

> Your 7-day free trial converted to a paid monthly subscription on
> [date]. You can cancel any time in the App Store / Play Store
> subscription settings; there's no in-app account to close. If you'd
> like a refund, Apple/Google handles those directly — I'd recommend
> submitting the request via the store.

### "Can I transfer my subscription to a different device?"

Yes — as long as it's the same Apple ID / Google account. Point them at
**Settings → Restore Purchases**, not Customer Center (Customer Center
is for existing subscribers, restore is for re-claiming).

---

## What NOT to do post-launch

- Don't ship a hotfix with `--no-verify` or commit to `main` without
  CI. A tagged release worth doing is worth waiting 3 minutes for CI.
- Don't push a v1.X build to TestFlight that hasn't been run end-to-end
  on a real device — sideload doesn't cover bg geofence.
- Don't A/B the paywall UNTIL you have at least 200 paywall-shown
  events per variant per week. Below that, signal is noise.
- Don't add analytics retroactively without updating
  `docs/ADR-001-no-analytics.md` to formally supersede the decision.

---

## Monthly ritual

First Monday of each month, 30 minutes:

- Sentry: any crash with > 10 occurrences gets a ticket.
- RC: compare trial-start → paid-convert rate vs last month.
- Store ratings: any drop > 0.3 stars → read the reviews, respond.
- App Store Connect: check if Apple has updated privacy manifests or
  review guidelines that affect location-tracking apps.
- Expo SDK: check for a new SDK version; read breaking changes.
- `npm audit`: note (don't auto-fix) any high/critical CVEs.

Write down what you shipped that month in `CHANGELOG.md`. You'll forget
otherwise, and a month-over-month diff is the easiest way to see
whether you're iterating or drifting.
