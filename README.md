# SmartBaibolyYarn

SmartBaibolyYarn is a cross-platform **React Native** application for reading and searching:

- **Bible** (local SQLite database)
- **Hymns** (local SQLite database)

Repository:

- https://github.com/Arotiana137-51/SmartBaibolyYarn

## Features

- **Bible reader** (chapters/verses)
- **Hymns reader**
- **Search** for Bible and hymns
- **Offline-first**: content is packaged as SQLite databases under `assets/data/`
- **About screen** with developer/contact info

## Requirements

- Node.js `>= 20` (see `package.json`)
- Yarn (recommended)
- React Native environment:
  - https://reactnative.dev/docs/set-up-your-environment

## Install

```sh
yarn
```

## Databases (Bible + Hymns)

This project includes prebuilt SQLite databases in:

- `assets/data/dev/BibleMG65.db`, `assets/data/dev/Hymns.db` (debug builds)
- `assets/data/prod/BibleMG65.zip`, `assets/data/prod/Hymns.zip` (release builds)

### Building Databases

**Development mode** (uncompressed .db files for faster builds):
```sh
yarn build:database
```

**Production mode** (compressed .zip files for smaller APK/IPA size):
```sh
yarn build:database:prod
```

The production build creates ZIP archives of the databases:
- `BibleMG65.zip` (~60% smaller)
- `Hymns.zip` (~50% smaller)

These are automatically decompressed on first app launch.

To ensure runtime data/assets are set up:

```sh
yarn setup:data
```

## Run

Start Metro:

```sh
yarn start
```

Android:

```sh
yarn android
```

iOS:

```sh
yarn ios
```

For the iOS build pipeline and the manual iCloud backup-exclusion check, see
`docs/ios-ci.md`.

## Useful scripts

- `yarn test`
- `yarn lint`
- `yarn build:database`
- `yarn setup:data`

## Notes / Troubleshooting

### SQLite FTS5

Some builds/environments may not support SQLite FTS5. The app is designed to fall back to non-FTS search when FTS is unavailable.

### Cross-platform paths

If you're working across Windows/macOS/Linux, see:

- `CROSS_PLATFORM_GUIDE.md`

## License

GPL-3.0-or-later. See `LICENSE`.

Copyright (C) 2026 Arotiana Randrianasolo

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

## Contributing

Contributions are welcome.

By submitting a contribution (pull request, patch, etc.), you agree that your work is licensed under **GPL-3.0-or-later**.

Please:

- Keep changes focused and small
- Follow the existing code style (TypeScript/React Native)
- Run `yarn test` and `yarn lint` before opening a PR
