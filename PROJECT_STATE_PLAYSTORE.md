# SmartBaibolyYarn — Project State (Play Store / Optimizations)

Last updated: 2026-03-24

## Goal
- Reduce app size and improve performance (especially low-end devices).
- Prepare Android release for Google Play publication (AAB signing, versioning, release pipeline).

## What was done (Android size/perf optimizations)

### Android release shrink
- Hermes enabled already (`android/gradle.properties`: `hermesEnabled=true`).
- Proguard/R8 enabled already for release (`android/app/build.gradle`: `minifyEnabled` + `shrinkResources`).
- Enabled R8 full mode:
  - `android/gradle.properties`: `android.enableR8.fullMode=true`
- Added conservative `packagingOptions` excludes (license/notice META-INF):
  - `android/app/build.gradle`: `packagingOptions { resources { excludes += [...] } }`

### ABIs
- Release build uses only:
  - `armeabi-v7a`, `arm64-v8a` via `ndk { abiFilters ... }` in `release`.

### DB assets packaging (dev vs prod)
- Release assets include only `data/prod` (zipped DBs).
- Debug assets include only `data/dev` (raw .db).
- Configured in `android/app/build.gradle` via `sourceSets`, pointing straight
  at the repo-root `assets/` so nothing is duplicated under `src/main/assets`:
  - debug: `../../assets/data/dev`
  - release: `../../assets/data/prod`

### Proguard rules adjustments
File: `android/app/proguard-rules.pro`
- Keep quick-sqlite:
  - `-keep class com.reactnativequicksqlite.** { *; }`
- Keep native methods:
  - `-keepclasseswithmembernames class * { native <methods>; }`
- Removed overly broad RN keep that blocked shrinking:
  - removed `-keep class com.facebook.react.** { *; }`
- Refined log stripping rule to avoid R8 warnings:
  - `-assumenosideeffects class android.util.Log { v/d/i/w/e/wtf(...) }`

### Low-end device performance toggle (opt-in)
- Added "low-end mode" setting persisted in AsyncStorage.
- File: `src/contexts/ThemeContext.tsx`
  - Added `isLowEndMode`, `enableLowEndMode()`, `disableLowEndMode()`.
  - Added storage key: `settings.lowEndMode`.
  - Added `useLowEndMode()` hook.
- Applied to Bible list rendering:
  - File: `src/components/BibleReaderView.tsx`
  - When low-end mode enabled, uses smaller `FlatList` tuning values.
- Added a temporary UI toggle in About:
  - File: `src/screens/AboutScreen.tsx`
  - Toggle label: “Enable/Disable Low-End Mode”.

## Release artifacts generated (paths + sizes)

### AAB
- Path:
  - `android/app/build/outputs/bundle/release/app-release.aab`
- Size:
  - 79,610,061 bytes (~75.9 MiB)

### APK (release)
- Path:
  - `android/app/build/outputs/apk/release/app-release.apk`
- Size:
  - 94,491,953 bytes (~90.1 MiB)

## Windows build issue encountered + fix
- Error during `minifyReleaseWithR8`: file lock on `classes.dex`.
- Fixed by:
  - `./gradlew --stop`
  - `./gradlew clean`
  - then re-run `./gradlew bundleRelease`

## Play Store publication state (starting from zero)
- Developer account NOT created yet.
- Must create Google Play Console developer account and pay fee.

### Critical: release signing
Current state previously had release signing using debug key (NOT publishable).

Implemented safe signing setup:
- Added template:
  - `android/keystore.properties.example`
- Added gitignore entry:
  - `.gitignore` ignores `android/keystore.properties` (secrets stay local).
- Updated Gradle to load `android/keystore.properties` if present and use it for `release` signing:
  - File: `android/app/build.gradle`
  - It falls back to debug signing only if properties file is missing (local builds).

### Versioning
- Bumped:
  - `android/app/build.gradle`: `versionCode 2`, `versionName "1.0.1"`

## Next steps to publish on Play Store

1) Create Google Play Console developer account.

2) Create a real release keystore (upload key) locally.
   - Example (Windows):
     - `keytool -genkeypair -v -storetype JKS -keystore <path> -alias <alias> -keyalg RSA -keysize 2048 -validity 10000`

3) Create `android/keystore.properties` locally (DO NOT COMMIT).
   - Copy `android/keystore.properties.example` -> `android/keystore.properties` and fill:
     - `storeFile=release.keystore`
     - `storePassword=...`
     - `keyAlias=...`
     - `keyPassword=...`

4) Build signed AAB for upload:
   - `./gradlew clean`
   - `./gradlew bundleRelease`

5) In Play Console:
   - Enable Play App Signing (recommended).
   - Upload `app-release.aab` to Internal testing first.

6) Store listing + compliance:
   - Prepare icon/feature graphic/screenshots.
   - Fill Data safety, privacy policy URL, ads, target audience.

## Notes
- There are existing privacy-related docs in repo:
  - `PRIVACY_POLICY.md`
  - `STORE_PRIVACY_DECLARATIONS.md`

