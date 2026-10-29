# e-Baiboly — Claude Code Project Instructions

## Project Overview
e-Baiboly is an offline-first React Native app (Android + iOS) for reading the
Malagasy Bible (MG1865) and hymns (FFPM / Fanampiny / Antema).
It has no backend today. All data is bundled locally.

## Stack
- React Native (bare workflow, not Expo managed)
- TypeScript — strict mode ON
- Navigation: React Navigation v6 (Stack + Tab navigators)
- State: identify the actual store before touching shared state (see src/store/)
- Styling: StyleSheet.create() only — no inline style objects in JSX
- Tests: Jest + React Native Testing Library

## Commands
```
yarn android          # run on Android
yarn ios              # run on iOS
yarn test             # Jest
yarn lint             # ESLint
yarn typecheck        # tsc --noEmit
```

This project is yarn-only — never run `npm install` or `npm run …`. There is
no `package-lock.json`; only `yarn.lock` is tracked.

## Architecture Rules
- Reuse before creating. Check src/components/ before writing a new component.
- Bible reader and Hymn reader are the two primary content components.
  New features drive them; they do not change their own rendering logic
  unless the task explicitly says to.
- Navigation params are typed. Always update the RootStackParamList /
  BottomTabParamList when adding a new screen or param.
- Never put business logic inside a screen component. Extract to a hook or util.

## Code Style
- Functional components + hooks only. No class components.
- Named exports for components. Default export only for screens.
- File names: PascalCase for components, camelCase for hooks/utils.
- Hook prefix: `use` (e.g. useCultMode, useVerseRange).
- No `any`. Use `unknown` and narrow.

## When compacting
Preserve: list of modified files, current feature being implemented,
any unresolved TypeScript errors, and the active test status.

## Feature docs
- Full feature spec: @docs/feature-spec.md
- Linked list design: @docs/cult-mode-linked-list.md
- Component map: @docs/component-map.md

## Database content updates
The Bible and Hymns SQLite databases are versioned via PRAGMA user_version,
stamped at build time by the constants in src/services/database/dbVersions.ts.
Two delivery paths:
- **APK release**: bump the version, rebuild via `yarn build:bible` or
  `yarn build:hymns`. New APK ships the new bundled DB; the in-app
  staleness check in DatabaseService re-extracts on launch.
- **OTA patch (offline-first, cellular-cheap)**: emit a tiny JSON patch via
  `yarn build:patch -- --target=<bible|hymns> --since=<git-ref> --version=YYYYMMDD`.
  Files land in docs/patches/ and are served via GitHub Pages. The
  PatchManager on the app fetches and applies them on launch.
- Full workflow: @docs/patches/README.md

## Bible text corrections
The Bible is the 1865 Malagasy version (MG1865). Corrections fix slips: scan
errors, typos, dropped words. They do not retranslate it.
- Second copy: the CrossWire SWORD module `Mg1865`
  (https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Mg1865.zip,
  public domain, readable with `pysword`). It shares some slips with ours and
  has scan errors of its own ("Any" for "Ary", doubled words), so the two
  agreeing is not proof on its own.
- Meaning: when a reading is in doubt, check what the verse means in NIV and
  in the original Hebrew, Greek or Aramaic. This is for understanding only:
  change a word only when the Malagasy word means something else (Salamo 10:15
  "adinoy" = forget vs "adino" = examine; Malakia 3:22 "làlana" = road vs
  "lalàna" = law). Never copy NIV wording into the data: it is copyrighted,
  and the text must stay MG1865.
- Malagasy grammar and spelling stay as the maintainer decides: verb forms
  and word joining are not meaning fixes (Isaia 30:14 "hovakivakiana" and
  Lioka 9:25 "maty antoka" are correct as written). Bring doubtful cases to
  the maintainer instead of choosing.
- Versification differs between copies (Psalm titles, Hebrew chapter breaks),
  so match verses by content, not by number. English numbering also differs
  (Malakia 3:22 = Malachi 4:4).
- Edit `scripts/source-data/bible/Yaml_Zo_Source/*.yaml` (single-quoted
  strings, apostrophes doubled), then follow the build and patch flow above.
