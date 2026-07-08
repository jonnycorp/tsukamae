# Tsukamae

A personal, fully offline living dex tracker, running as a Windows desktop app
(Electron). Forked from [pokedextracker.com](https://pokedextracker.com) and
stripped down to a single-user, single-dex tracker with no server, no login,
and no network dependency.

## What it tracks

One **HOME National Living Dex** (1,080 slots: national order with
Alolan/Galarian/Hisuian/Paldean form boxes at the bottom). On top of the usual
caught/uncaught state, each mon can also track:

- **Currently In** — which game the mon currently lives in (Scarlet, GO,
  HOME, …), picked from a fixed dropdown.
- **Temporary** — a placeholder mon (e.g. from Pokémon GO or traded from a
  stranger) that should eventually be replaced with a properly obtained one.
  Temporary mons show with an orange dashed tile, get their own count in the
  progress bar, and can be filtered with the "Temporary Only" checkbox.

## Where your data lives

**Progress is never stored in this repo.** Every fresh clone starts with an
empty tracker. Your data lives in a single JSON file:

```
%APPDATA%\tsukamae\captures.json
```

Every change auto-saves (debounced, atomic writes) — there is no save button.
Open the app, click things, close it. To move progress between machines use
**File → Export Progress… / Import Progress…**; the export is just that JSON
file.

> The storage layer is a plain JSON file on purpose. If it ever needs to be a
> real database, swap the `tracker:load` / `tracker:save` IPC handlers in
> `electron/main.js` for SQLite (`better-sqlite3`) — nothing else needs to
> change. Wholly unneeded at the current scale.

## Development

Requires Node (see `.node-version`) and Yarn.

```bash
yarn install

# Desktop app (webpack dev server + Electron, hot reload)
yarn electron:dev

# Browser-only dev (persistence falls back to localStorage)
yarn start          # http://localhost:9898

# Build a Windows installer (output in dist/)
yarn electron:build

# Lint + typecheck
yarn lint:all
```

## Updating the dex for a new game

The dex structure is a static snapshot in `data/` (`dex.json`, `games.json`,
`dex-meta.json`), generated from the live pokedextracker API:

```bash
yarn dataset        # optionally: node scripts/generate-dataset.mjs <user> <slug>
```

When a new generation lands, regenerate the dataset (and update the sprite
sheet `public/pokesprite-v12.png` + `app/styles/pokesprite.scss` from
upstream). The generation script strips all personal progress — only
structure is committed.

## Architecture notes

- React 17 + TypeScript SPA (webpack, SCSS), UI inherited from
  pokedextracker.com — grid of 30-slot PC boxes, search, hide-caught filter.
- All remote-API code was replaced by `app/utils/local-data.ts` (bundled
  dataset) + `app/hooks/queries/captures.ts` (progress store).
- The Electron main process (`electron/main.js`) serves the built bundle over
  a custom `app://` protocol and owns the progress file; the renderer talks
  to it through the `window.tracker` bridge (`electron/preload.js`).
- Fonts and sprites are self-hosted; the app makes zero network requests.

## Credits

Built on [pokedextracker.com](https://github.com/pokedextracker) by Robin
Joseph — the dex structure, box layout, and sprite system all come from that
project. Licensed MIT.
