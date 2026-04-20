# Screenshots

Place store screenshots here before submitting to the App Store or Play
Store. Filenames should follow `{platform}/{locale}/{device}/{01-label}.png`
so the upload script (future work) can batch them.

## Required sizes

### iOS (App Store Connect)

Apple requires one screenshot set per localized storefront. You can
use the 6.7" set for other sizes and Apple will auto-scale.

- **6.7" iPhone (6 screenshots, mandatory)** — 1290 × 2796 px
  Device: iPhone 15 Pro Max, iPhone 14 Pro Max, iPhone 13 Pro Max.
- **6.1" iPhone (optional)** — 1179 × 2556 px
- **5.5" iPhone (legacy, optional)** — 1242 × 2208 px

### Android (Play Console)

- **Phone screenshots (8 allowed, 2 mandatory)** — 1080 × 1920 px or larger
- **Feature graphic (mandatory)** — 1024 × 500 px
- **App icon (mandatory)** — 512 × 512 px

## What to capture

Choose 6 screens that tell the story of Time Mapper in order:

1. **Timeline with entries** — shows automatic tracking working. Add
   three places ("Home", "Gym", "Office") and tap
   `Settings → Dev → Simulate visit` a few times to seed a convincing day.
2. **Running timer card** — a place is currently being tracked, big
   Rings visualization, place name prominent. Use `Settings → Dev →
Simulate visit` to produce an ongoing entry, then screenshot.
3. **Add place sheet — Phase 2** — show the map preview with a pin +
   circle over Cologne (demo data's default). Highlights the radius slider.
4. **Stats tab** — the week bar chart with a legend of 3–4 places
   filling different bars.
5. **Paywall** — the hero star + feature list + plan picker on year
   selected. Use mock-Pro toggle to ensure plans render.
6. **Onboarding permissions** — the new "Your location never leaves
   this device" pill is the hook shot. Shows up on the 2/3 screen.

## How to capture (iOS Simulator)

```sh
# Boot a 6.7" simulator:
xcrun simctl boot "iPhone 15 Pro Max"
# Run the app:
npx expo run:ios --device "iPhone 15 Pro Max"
# Once on the screen you want:
xcrun simctl io booted screenshot ~/Desktop/ios-01-timeline.png
```

## How to capture (Android emulator)

```sh
# Boot a Pixel 7 emulator at 1080x1920:
emulator -avd Pixel_7_API_34
npx expo run:android
# Once on the screen:
adb shell screencap -p /sdcard/screen.png
adb pull /sdcard/screen.png android-01-timeline.png
```

## Voice + design notes

- Let the data tell the story. No superimposed marketing text.
- Dark mode in screenshots 1 and 5, light mode in 2/3/4/6 — mixing
  both reassures users the app follows system.
- German versions: set system locale to Deutsch in the simulator before
  capturing; re-run the same sequence.
