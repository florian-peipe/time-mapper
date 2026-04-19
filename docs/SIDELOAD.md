# Sideloading Time Mapper on iPhone (no Apple Developer account)

This is the zero-cost path for testing Time Mapper on a real iPhone from
a Windows machine. It uses GitHub Actions to build an unsigned `.ipa` and
Sideloadly to sign + install it with a free Apple ID.

## Limits of this path

- **App expires every 7 days.** Free Apple IDs issue 7-day signing certs.
  Re-run Sideloadly on day 7 with the same USB cable to re-sign in place;
  saved places and entries survive because the app's SQLite DB lives in
  the app sandbox, which is preserved across re-signs of the same bundle
  id pairing.
- **Max 3 free-signed apps** installed simultaneously per Apple ID.
- **In-app purchases don't work.** The build runs with RevenueCat in
  "mock mode" — purchases throw. Flip Pro on/off via
  `Settings → Developer → Toggle Pro (mock)` instead.
- **Address autocomplete uses Photon** (Komoot DE — free, no key, OSM
  worldwide). If Photon is unreachable from the device, the app falls
  back to 3 hardcoded Köln demo addresses.
- **Crash reporting is off.** Sentry only runs when a DSN is set.

Everything else — background geofencing, local notifications, the full
timeline / stats / settings UI, i18n — works identically to a real
store build.

## Step 1 — Build the .ipa via GitHub Actions

1. Push the repo to a GitHub remote (if it isn't already).
2. Go to **Actions → iOS unsigned build → Run workflow**.
   - `configuration`: leave on **Release** (Debug needs Metro running on
     your dev machine, which isn't available to a sideloaded build).
3. Wait ~20-30 minutes.
4. Scroll to the bottom of the run — under **Artifacts**, download
   `TimeMapper-Release-unsigned.ipa` (zip-wrapped by GitHub; unzip it
   to get the raw `.ipa`).

The workflow also fires automatically on every push to `main` when
anything under `src/`, `app/`, `assets/`, `app.json`, or `package.json`
changes — handy for weekly re-sign cycles. Free-tier runner minutes for
macOS count 10×, so each build consumes ~200-300 of your 2000-min/month
allowance.

## Step 2 — Install Sideloadly on Windows

1. Download the Windows installer from
   [sideloadly.io](https://sideloadly.io) and run it.
2. Install **iTunes** (from Microsoft Store or apple.com) if you don't
   already have it. Sideloadly reuses iTunes's device drivers to talk to
   the phone over USB.
3. Plug your iPhone into the PC with a Lightning or USB-C cable.
   - On the iPhone, tap **Trust this computer** and enter your passcode.

## Step 3 — Sign and install the .ipa

1. Open Sideloadly.
2. Drag the `.ipa` file into the Sideloadly window.
3. Enter your **Apple ID** email. Sideloadly uses it only to request a
   free 7-day signing cert from Apple.
4. Click **Start**. Sideloadly will prompt for your Apple ID password
   (use an app-specific password if you have 2FA — generate at
   [appleid.apple.com](https://appleid.apple.com) → Sign-in and
   security → App-Specific Passwords).
5. Sideloadly resigns the IPA with a per-device provisioning profile
   and pushes it to the phone. Takes 1-3 minutes.
6. On the iPhone: **Settings → General → VPN & Device Management →
   [your Apple ID] → Trust**. Until you tap Trust, the app won't launch
   (iOS shows "Untrusted Developer" instead).

## Step 4 — First launch permissions

Time Mapper needs these granted on-device before auto-tracking works:

1. **Location: Always allow**
   - When the app first asks, tap **Allow While Using**.
   - Walk through onboarding; it will ask again for **Allow Always**.
   - If you miss it, go to
     `iOS Settings → Time Mapper → Location → Always`.
2. **Precise location: On** (in the same screen).
3. **Notifications: Allow** — needed for entry/exit confirmations.
4. **Background App Refresh: On**
   (`iOS Settings → General → Background App Refresh → Time Mapper`).

## Step 5 — Verify auto-tracking works

1. Open Time Mapper, complete onboarding, add a place at your current
   address with a 100m radius.
2. Walk >150m away from the place. Wait ~60 seconds.
3. Walk back. You should:
   - get a local notification within the exit/entry buffer window, and
   - see a new row on the Timeline tab.

If nothing happens after 2-3 minutes, check
`Settings → Developer → Export diagnostic log` — it dumps the last 50
pending geofence transitions plus which env keys are set. Share the JSON
back to the repo for debugging.

## Renewing every 7 days

When the certificate expires, the app icon stays on the home screen but
tapping it does nothing. To renew:

1. Plug the iPhone back into the PC.
2. Open Sideloadly, drag the same `.ipa` in, hit Start.
3. Trust the new certificate in iOS Settings if prompted.

App data survives the re-sign.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Untrusted Developer` on launch | Settings → General → VPN & Device Management → Trust |
| Sideloadly can't find the phone | Reinstall iTunes, replace cable (many USB-C cables are power-only) |
| Build fails with "No such scheme" | Clear the workflow's `pods` cache and re-run — Expo SDK upgrades sometimes change the workspace name |
| "Toggle Pro (mock)" row missing | You built with valid RevenueCat keys set as env vars — the mock-mode gate is closed. Unset them, rebuild |
| Geofence never fires | Precise location is off, or Always permission got downgraded. Re-check Step 4 |
| App crashes on launch, no logs | Open iOS Settings → Privacy & Security → Analytics → Analytics Data; long-press "Time Mapper" entries, share to yourself |
