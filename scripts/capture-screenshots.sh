#!/usr/bin/env bash
# Capture store screenshots on an already-running simulator / emulator.
#
# Does NOT drive the UI — that's the one thing no tooling can reliably
# automate across iOS + Android without a full UI-test harness. You
# navigate the app manually; press Enter between screens; the script
# shells out to `xcrun simctl` (iOS) or `adb` (Android) to dump a PNG
# into store/screenshots/{platform}/{locale}/.
#
# Usage:
#   ./scripts/capture-screenshots.sh ios en
#   ./scripts/capture-screenshots.sh ios de
#   ./scripts/capture-screenshots.sh android en
#   ./scripts/capture-screenshots.sh android de
#
# Prereqs:
#   iOS:     Xcode installed, target simulator already booted + app running.
#            Check: `xcrun simctl list devices | grep Booted`
#   Android: adb on PATH, emulator already running + app installed.
#            Check: `adb devices`
#
# The six screens are fixed and numbered to match store/screenshots/README.md.
# Re-running overwrites; committing the PNGs is fine (they're small and we
# want them versioned alongside the app).

set -euo pipefail

PLATFORM="${1:-}"
LOCALE="${2:-}"

if [[ -z "$PLATFORM" || -z "$LOCALE" ]]; then
  echo "Usage: $0 <ios|android> <en|de>" >&2
  exit 2
fi

if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
  echo "First arg must be 'ios' or 'android', got: $PLATFORM" >&2
  exit 2
fi

if [[ "$LOCALE" != "en" && "$LOCALE" != "de" ]]; then
  echo "Second arg must be 'en' or 'de', got: $LOCALE" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/store/screenshots/$PLATFORM/$LOCALE"
mkdir -p "$OUT_DIR"

# Keep in lockstep with store/screenshots/README.md.
SCREENS=(
  "01-timeline"
  "02-places-map"
  "03-add-place"
  "04-stats-week"
  "05-goals"
  "06-onboarding-privacy"
)

capture_ios() {
  local name="$1"
  local out="$OUT_DIR/${name}.png"
  xcrun simctl io booted screenshot "$out"
  echo "  saved → $out"
}

capture_android() {
  local name="$1"
  local out="$OUT_DIR/${name}.png"
  adb exec-out screencap -p > "$out"
  echo "  saved → $out"
}

echo "Capturing $PLATFORM/$LOCALE screenshots to $OUT_DIR"
echo "Navigate the app to each screen, then press Enter to capture."
echo "Press Ctrl-C to abort at any point."
echo

for name in "${SCREENS[@]}"; do
  read -rp "Ready for ${name}? [Enter]"
  if [[ "$PLATFORM" == "ios" ]]; then
    capture_ios "$name"
  else
    capture_android "$name"
  fi
done

echo
echo "Done. Verify the output in $OUT_DIR before uploading."
