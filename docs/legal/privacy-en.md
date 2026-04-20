# Privacy policy

_Last updated: 2026-04-17_

Time Mapper is designed to keep your data on your device. This page
describes exactly what we collect, what we store, and what (if anything)
we share.

## What we collect

**Location data.** When you enable _Always location_, the app uses
OS-level geofencing to detect entry and exit of places you've saved.
Your coordinates are never transmitted off-device — all tracking happens
locally via iOS Core Location and Android LocationManager.

**Time entries.** The moments you enter and leave each place are stored
in a SQLite database inside the app's sandbox. Uninstalling the app
removes this database entirely.

**Goals and goal-reached notifications.** Optional per-place daily and
weekly time targets are stored on-device only. When you cross one, the
app fires a local notification — generated and delivered entirely on
your device, never transmitted to us.

**User-initiated exports.** When you tap Export CSV, Export backup
(JSON), or Export diagnostic log in Settings, the file is handed to the
operating system's share sheet. Where it goes from there is your choice
(Mail, Messages, Files, etc.). We receive nothing.

**Subscription entitlement.** When you purchase Time Mapper Pro, Apple
or Google handles the transaction. We receive only an anonymous
entitlement token via RevenueCat — no personally identifiable data is
shared with us.

**Crash reports (optional).** If the developer has configured a Sentry
project, uncaught exceptions are sent to Sentry. Before transmission, we
strip `location`, `latitude`, and `longitude` from breadcrumbs and
extras. No location data or PII ever reaches Sentry.

## What we share

Nothing, aside from an anonymous RevenueCat user id generated at first
install. That id is used only to verify your Pro entitlement across
installs of the same app store account. It is never linked to your
name, email, or device id by us.

## Third-party services

- **Apple App Store / Google Play** — subscription billing. Covered by
  their respective privacy policies.
- **RevenueCat** — subscription entitlement cross-referencing. See
  [revenuecat.com/privacy](https://www.revenuecat.com/privacy).
- **Photon (Komoot GmbH, Potsdam, Germany)** — address autocomplete
  when you add a place. Typed queries are sent to Photon's EU servers.
  Your GPS coordinates are NOT included in those requests. Data is
  based on OpenStreetMap. See
  [komoot.com/privacy](https://www.komoot.com/privacy).
- **Apple Maps / Google Maps for Android** — map tile rendering for
  the place preview. iOS uses Apple Maps (no account, no personal
  data); Android uses Google Maps for Android to render tiles (no
  account, no personal data, just the viewport request).
- **Sentry (optional)** — crash reporting if the developer has
  configured a DSN. See [sentry.io/privacy](https://sentry.io/privacy/).

### Attribution

© OpenStreetMap contributors. Map tiles © Apple or © Google depending
on your device platform.

## GDPR rights

Because we store no identifying data on our side, there is nothing to
export or delete. Uninstalling the app removes all local data from
your device.

If you have questions, contact the developer — see the Impressum.
