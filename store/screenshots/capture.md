# Screenshot capture — step-by-step

Sandboxed automation can't drive real simulators; this file is the
hand-run checklist for the user. Budget: ~30 minutes if you already
have Xcode + Android Studio installed.

## Prerequisites

- Xcode 15+ with the iPhone 15 Pro Max simulator installed.
- Android Studio with a Pixel 7 AVD (1080 × 2400) and a Pixel XL AVD
  (1440 × 2560) as a stand-in for the 5.5" size bucket.
- `npx expo install --check` shows no drift.
- Run `node scripts/generate-icons.js` once beforehand to refresh
  `assets/icon.png` etc. (already in git, no need to rerun unless the
  brand color changes).

## Seed data toggle

Screenshots need populated UI. In Settings → Developer:

1. Tap **Toggle Pro (mock)** so Stats shows the past-week nav without
   the paywall intercept.
2. Create three places via `Settings → Places → Add place`: "Home"
   (dumbbell), "Office" (briefcase), "Café" (coffee). Use Cologne demo
   addresses — they're baked in when no Google Places key is set.
3. Tap **Simulate visit** 6–8 times across the three places so the
   Timeline + Stats have data. Wait ≥30 s between taps so the state
   machine posts distinct entries.
4. Take screenshots in the same session so the Pro toggle + seeds
   stay consistent.

## Devices + filename scheme

Store each PNG with the name shown below — the upload script (future)
looks for exactly these. `store/screenshots/placeholder-required.txt`
lists the same set so nothing gets missed.

### iOS

| File                         | Simulator         | Size        | Screen                                     |
| ---------------------------- | ----------------- | ----------- | ------------------------------------------ |
| `iphone-67-1-timeline.png`   | iPhone 15 Pro Max | 1290 × 2796 | Timeline, 3+ entries, dark mode            |
| `iphone-67-2-running.png`    | iPhone 15 Pro Max | 1290 × 2796 | Running timer card visible, Timeline below |
| `iphone-67-3-addplace.png`   | iPhone 15 Pro Max | 1290 × 2796 | AddPlaceSheet Phase 2, map preview Cologne |
| `iphone-67-4-stats.png`      | iPhone 15 Pro Max | 1290 × 2796 | Stats week chart + ledger                  |
| `iphone-67-5-paywall.png`    | iPhone 15 Pro Max | 1290 × 2796 | Paywall sheet, yearly selected             |
| `iphone-67-6-onboarding.png` | iPhone 15 Pro Max | 1290 × 2796 | Permissions screen (step 2/3)              |
| `iphone-61-*.png`            | iPhone 15         | 1179 × 2556 | Same six shots                             |
| `iphone-55-*.png`            | iPhone 8 Plus     | 1242 × 2208 | Same six shots                             |

### Android

| File                             | AVD     | Size        | Screen                                    |
| -------------------------------- | ------- | ----------- | ----------------------------------------- |
| `android-phone-1-timeline.png`   | Pixel 7 | 1080 × 2400 | Same as iOS 67-1                          |
| `android-phone-2-running.png`    | Pixel 7 | 1080 × 2400 | Same as iOS 67-2                          |
| `android-phone-3-addplace.png`   | Pixel 7 | 1080 × 2400 | Same as iOS 67-3                          |
| `android-phone-4-stats.png`      | Pixel 7 | 1080 × 2400 | Same as iOS 67-4                          |
| `android-phone-5-paywall.png`    | Pixel 7 | 1080 × 2400 | Same as iOS 67-5                          |
| `android-phone-6-onboarding.png` | Pixel 7 | 1080 × 2400 | Same as iOS 67-6                          |
| `android-feature-graphic.png`    | —       | 1024 × 500  | Marketing banner (brand rings + wordmark) |

## Steps (iOS, 6.7")

```sh
xcrun simctl boot "iPhone 15 Pro Max"
open -a Simulator
# System settings → Appearance → Dark (for shots 1 + 5)
npx expo run:ios --device "iPhone 15 Pro Max"
```

Then, for each shot:

1. **Timeline, dark mode (shot 1)**
   - Switch simulator to Dark Appearance.
   - Open Time Mapper → Timeline tab.
   - Confirm 3+ entries from the Simulate visit seed are visible.
   - `xcrun simctl io booted screenshot store/screenshots/iphone-67-1-timeline.png`

2. **Running timer (shot 2)**
   - Switch simulator to Light Appearance.
   - Settings → Developer → Simulate visit → pick "Home".
   - Wait ≤10 s for the running card to appear at the top of Timeline.
   - `xcrun simctl io booted screenshot ...-2-running.png`

3. **AddPlaceSheet phase 2 (shot 3)**
   - Settings → Places → Add place → search "Mediapark 8" → pick demo.
   - `...-3-addplace.png`

4. **Stats (shot 4)**
   - Close the sheet. Tap the Stats tab. Confirm bar chart + ledger.
   - `...-4-stats.png`

5. **Paywall (shot 5)**
   - Dark Appearance.
   - Settings → Developer → Toggle Pro (mock) → Off.
   - Tap the Pro upsell card. Wait for the paywall to finish animating.
   - `...-5-paywall.png`

6. **Onboarding permissions (shot 6)**
   - Uninstall + reinstall the app (or clear AsyncStorage via
     Settings → Developer → "Clear onboarding flag" when we add it;
     until then, delete the `.expo/xxx/AsyncStorage` file).
   - Advance the welcome screen once; the permissions step appears.
   - `...-6-onboarding.png`

Repeat the same six for iPhone 15 (6.1") and iPhone 8 Plus (5.5").

## Steps (Android, Pixel 7)

```sh
emulator -avd Pixel_7_API_34 &
adb wait-for-device
npx expo run:android
```

For each shot:

```sh
adb exec-out screencap -p > store/screenshots/android-phone-1-timeline.png
```

The on-device navigation sequence matches iOS 1-6.

### Feature graphic

`android-feature-graphic.png` is a marketing banner (1024 × 500). Use
any vector tool (Figma, Sketch) to compose:

- Brand accent `#FF6A3D` background
- Centered white concentric Rings (`docs/design-system/project/assets/patterns/rings.svg`)
- Wordmark "Time Mapper" in Inter Bold, white, right-aligned

Drop the PNG into `store/screenshots/`.

## Validation

After you've dropped all files in:

```sh
ls store/screenshots/*.png | wc -l   # expect ≥ 19 (6×3 iOS + feature + 6 android)
```

## Localized shots (optional but recommended)

Change the simulator system language to Deutsch and repeat shots 1, 4,
5 — these contain the most translated copy. Save them under
`store/screenshots/de/<same-filename>.png`.
