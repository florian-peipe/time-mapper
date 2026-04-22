# ADR-001: No in-app analytics in v1.1

- **Status:** Accepted
- **Date:** 2026-04-22
- **Deciders:** Florian Peipe

## Context

Time Mapper v1.1 ships with Sentry (opt-in, crash-only) as its only form
of telemetry. The RevenueCat dashboard provides paywall funnel data
(`paywall shown → purchase → trial → paid`). Beyond that, the app has
**zero** in-app product analytics — no page views, no feature usage,
no cohort tracking, nothing.

This is a deliberate architectural + product decision, not an oversight.

## Decision

v1.1 ships with **no product-analytics ping** and **no in-app telemetry
pipeline** beyond:

1. **Sentry** for crashes — opt-in via `settings.telemetry_enabled`.
2. **RevenueCat** for subscription lifecycle — RC's dashboard only,
   not piped anywhere else.

No PostHog, Amplitude, Mixpanel, or self-hosted equivalent.

## Consequences

### What we give up

- **Paywall A/B measurement.** RC supports dashboard A/B but we can't
  measure upstream funnel (first-place → paywall-shown → convert).
- **Feature usage data.** We can't answer "how many users use Stats?"
  or "how often does anyone open Settings → Buffers?".
- **Cohort retention.** D1/D7/D30 retention per install is invisible.
- **Crash-path prioritization** beyond Sentry's own breakdown.

### What we gain

- **Privacy posture stays intact.** The marketing ("location never
  leaves your device, no analytics, no tracking pixels") is true
  without asterisks.
- **Smaller surface area.** No analytics SDK to upgrade, no data
  schema to version, no privacy-label update when adding a new event.
- **No GDPR consent flow.** The `settings.telemetry_enabled` flag
  covers Sentry alone; no second flag for analytics.
- **Lower ongoing cost.** PostHog / Amplitude hobbyist tiers are
  cheap but not free; self-hosting adds ops burden.

## Alternatives considered

### A: PostHog self-hosted

**Rejected.** Adds a server to maintain, a DB backup policy, a reverse
proxy, and a container to restart on every RPi hiccup. The indie-app
ROI is negative.

### B: PostHog Cloud, opt-in, behind `settings.telemetry_enabled`

**Rejected for v1.1.** Non-trivial implementation (events + retries
+ batching + EU region pinning). The privacy-marketing claim becomes
"no analytics unless you opt in" — still true but more asterisk.
Revisit as ADR-002 if v1.2+ needs it.

### C: Custom aggregate ping to a user-controlled endpoint

**Rejected for v1.1.** The engineering lift is real (endpoint +
aggregation + dashboard) and the data is marginal until we have
thousands of users.

## Revisit triggers

This ADR gets revisited (and potentially superseded) when ANY of:

- The RC paywall dashboard A/B is live and we need upstream funnel
  data to interpret results.
- Sentry shows a pattern that requires feature-usage context to debug
  (e.g. crash only in Stats but only for users who cycled through
  all 4 range modes).
- A decision point is blocked on "we don't know how many users do X" —
  the kind of question PostHog would answer in five minutes.

When revisiting, write ADR-002 explaining why the tradeoff flipped,
don't edit this file.

## Rationale summary

Indie apps die from lack of focus far more often than from lack of
data. v1.1 bets on shipping narrowly and iterating on user feedback +
Sentry signal + RC subscription health. If that bet fails, we'll know
fast — and adding analytics is always easier than removing it later.
