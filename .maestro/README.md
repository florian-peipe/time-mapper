# Maestro E2E tests

Smoke-level flows covering the golden path end-to-end. Unit tests cover
domain logic; Maestro covers "does the app link, migrate, and navigate
on a real device / simulator."

We intentionally keep this small — one onboarding flow. E2E tests are
slow, flaky, and expensive to maintain. Unit + integration tests in
`src/**/__tests__/` are the primary suite.

## Install

```sh
curl -Ls https://get.maestro.mobile.dev | bash
```

Details: [maestro.mobile.dev/getting-started/installing-maestro](https://maestro.mobile.dev/getting-started/installing-maestro).

## Run

Prereqs: a development build of Time Mapper installed on a simulator /
emulator (`npx expo run:ios` or `npx expo run:android`).

```sh
maestro test .maestro/onboarding-smoke.yaml
```

Record the run (useful for store preview videos):

```sh
maestro record .maestro/onboarding-smoke.yaml
```

## CI

**Not** wired into CI. iOS Maestro needs a macOS runner (10× minute cost)
and Android needs an emulator (slow, flaky, 15+ min per run). Running
locally before cutting a release is enough signal for a solo-dev cadence.
If we grow a team, move this to a nightly matrix job.

## Adding tests

Keep each flow under ~20 steps. If a scenario needs branching logic,
write a unit/integration test in `src/__tests__/` instead. Maestro is for
"happy path lands on the right screen," not assertion-heavy coverage.
