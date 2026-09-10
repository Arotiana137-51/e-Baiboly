# Typo Fix Runbook — e-Baiboly

How to publish a content correction (Bible or Hymns) so existing users on the internet pick it up for ~1 KB of cellular data instead of a full APK update.

---

## TL;DR

```
# 1. Edit the source YAML/JSON
# 2. Pick today's date as YYYYMMDD (e.g. 20260605)
yarn bump:db-version --target=bible --version=20260605
yarn build:patch     --target=bible --since=<previous-version-tag-or-sha> --version=20260605
yarn build:bible
git add docs/patches/ src/services/database/dbVersions.ts scripts/utils/dbVersions.js \
        assets/ ios/SmartBaibolyYarn/Resources/
git commit -m "fix: <verse> typo (patch 20260605)"
git push
```

> If yarn refuses to forward the `--target=...` flags, insert a literal `--` between the script name and the flags: `yarn build:patch -- --target=bible ...`. Yarn 1 needs this in some configurations; yarn 3+ usually doesn't.

---

## One-time setup (do this once, before the first patch ever)

1. **Enable GitHub Pages**
   - Go to: <https://github.com/Arotiana137-51/e-Baiboly/settings/pages>
   - Source: **Deploy from a branch**
   - Branch: **main** / folder: **/docs**
   - Save. Wait ~1 minute for the first build.
   - Verify: <https://arotiana137-51.github.io/e-Baiboly/patches/bible/index.json> should return the seeded `{"latest":20260521,"patches":[],"minBaseline":20260521}`.

2. **(Optional) Tag the current state** so future `--since=` calls have a stable reference:
   ```
   git tag db-baseline-20260521
   git push --tags
   ```

---

## Detailed steps for a Bible verse typo

### 1. Edit the source

Find the verse in the YAML:
- `scripts/source-data/bible/Yaml_Zo_Source/bible_verse_mg1865_mg_<book_id>.yaml`
- Book IDs: 1 = Genesis, 40 = Matthew, etc.

Open the file, locate the verse, fix the `verse_text` value. Save.

### 2. Pick the version

Use today's date as YYYYMMDD. Example: 5 June 2026 → `20260605`.

The version MUST be:
- a non-negative integer in YYYYMMDD format,
- strictly greater than the current `BIBLE_DB_VERSION` in `src/services/database/dbVersions.ts`.

### 3. Bump the version constants

```
yarn bump:db-version --target=bible --version=20260605
```

This updates `src/services/database/dbVersions.ts` AND `scripts/utils/dbVersions.js` atomically. Never edit either by hand.

### 4. Generate the patch JSON

```
yarn build:patch --target=bible --since=<previous-version-ref> --version=20260605
```

Pick `--since=` based on what's already deployed:
- If this is your first patch ever: `--since=db-baseline-20260521` (the tag from setup step 2), or any commit SHA from before the typo fix.
- For subsequent patches: use the previous patch's commit SHA, or `HEAD~1` if you just committed the YAML change.

What it does:
- Runs `git show <since-ref>:scripts/source-data/bible/...` to read the YAML at that ref.
- Diffs against the current working tree, row by row.
- Writes `docs/patches/bible/20260605.json` containing only the changed verses (with pre-normalized `text_plain` for the FTS index).
- Appends `20260605` to `docs/patches/bible/index.json` and updates `latest`.

Sanity check: print the file and confirm only your typo verse is listed.
```
type docs\patches\bible\20260605.json     # Windows
cat  docs/patches/bible/20260605.json     # macOS/Linux
```

If the diff picked up unintended verses, abort, fix the YAML, and re-run with `--dry-run` first:
```
yarn build:patch --target=bible --since=<ref> --version=20260605 --dry-run
```

### 5. Rebuild the bundled DB

```
yarn build:bible
```

This regenerates `BibleMG65.db` and `BibleMG65.zip` in:
- `assets/data/` (Android packages these directly — see the `sourceSets` block
  in `android/app/build.gradle`)
- `ios/SmartBaibolyYarn/Resources/data/`

The bundled DB now contains the fix too, so fresh installs (users with no prior install) skip the patch chain entirely and get the corrected text from the APK directly. Connected upgrade users get it via the OTA patch.

### 6. Commit and push

```
git add docs/patches/bible/ \
        src/services/database/dbVersions.ts \
        scripts/utils/dbVersions.js \
        scripts/source-data/bible/Yaml_Zo_Source/bible_verse_mg1865_mg_<n>.yaml \
        assets/data/dev/BibleMG65.db assets/data/prod/BibleMG65.zip \
        ios/SmartBaibolyYarn/Resources/data/dev/BibleMG65.db \
        ios/SmartBaibolyYarn/Resources/data/prod/BibleMG65.zip

git commit -m "fix(bible): <book> <ch>:<v> typo (patch 20260605)"
git push
```

GitHub Pages rebuilds within ~1 minute. Users with internet pick up the patch on their next app launch.

---

## Same flow for Hymns

Substitute `bible` → `hymns` everywhere:

```
# Edit scripts/source-data/hymns/<file>.json
yarn bump:db-version --target=hymns --version=20260605
yarn build:patch     --target=hymns --since=<ref> --version=20260605
yarn build:hymns
git add docs/patches/hymns/ ...
git commit -m "fix(hymns): <ref> typo (patch 20260605)"
git push
```

---

## What if both Bible and Hymns changed in the same release?

Run each target in sequence. The version number can be the same for both (`20260605` for both `bible` and `hymns`) or different — they're tracked independently.

```
yarn bump:db-version --target=both --version=20260605
yarn build:patch     --target=bible --since=<ref> --version=20260605
yarn build:patch     --target=hymns --since=<ref> --version=20260605
yarn build:database
```

---

## How users receive the fix

1. App launches.
2. After the DB is open, `PatchManager` checks if it's online (NetInfo). If offline → nothing happens, app boots normally.
3. If online + last check was > 5 min ago: fetches `index.json` (~250 bytes).
4. Compares `index.latest` against `PRAGMA user_version` on the device.
5. For each new version: fetches `<version>.json` (~200–500 bytes per typo), applies UPDATE + FTS rebuild + `PRAGMA user_version` bump in one atomic transaction.
6. Total cost per typo: **~1 KB** instead of a multi-megabyte APK update.

If anything fails (no internet, 404, malformed JSON, DB error), the chain stops and retries on the next launch. The app keeps working with whatever data is already on disk.

---

## Verification after pushing

1. Wait ~1 minute for GitHub Pages to rebuild.
2. Open <https://arotiana137-51.github.io/e-Baiboly/patches/bible/index.json> in a browser. Confirm `latest` is your new version.
3. Open <https://arotiana137-51.github.io/e-Baiboly/patches/bible/20260605.json>. Confirm the changed verse(s) are listed with the corrected text.
4. On a test device with the previous app version installed:
   - Note current `PRAGMA user_version` (via `yarn check:db` or a debug build).
   - Cold-launch the app while online.
   - Wait ~5 seconds, then close and re-launch.
   - Navigate to the verse — the fix should be visible.
   - The on-disk `user_version` should now equal `20260605`.

---

## Common mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| Forgot to commit YAML before running `--since=HEAD` | `build:patch` reports "no changes" | Use `--since=HEAD~1` after committing, or just don't commit until after running `build:patch`. |
| Picked a `--version=` ≤ current `BIBLE_DB_VERSION` | `bump:db-version` succeeds but users with the current version skip the patch (their on-disk == new version) | Always pick strictly greater. YYYYMMDD makes this automatic. |
| Edited `dbVersions.ts` and `dbVersions.js` by hand and they drifted | Build script stamps one version, app code expects another, staleness check misbehaves | Always use `yarn bump:db-version`. |
| Pushed before GitHub Pages enabled | Users 404 silently (harmless, but no patch applied) | Enable Pages, push any commit to retrigger publish. |
| Manually edited a JSON file in `docs/patches/` | App's runtime validator rejects malformed shape; patch silently skipped | Always regenerate via `yarn build:patch`. |

---

## Rolling back a bad patch

Don't try to "delete" a patch — that would leave devices that already applied it in an inconsistent state. Instead:

1. Edit the YAML/JSON back to the previous correct text.
2. Emit a NEW patch with a higher version:
   ```
   yarn bump:db-version --target=bible --version=<today+1>
   yarn build:patch     --target=bible --since=HEAD --version=<today+1>
   ...
   ```
3. Push. Affected users get the correction on next launch.
