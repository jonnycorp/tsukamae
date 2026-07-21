# Tsukamae

A personal living dex tracker, running as a Windows desktop app (Electron). Forked from [pokedextracker.com](https://pokedextracker.com) and stripped down to a local-contained, offline, and single-user app with additional marking capabilities to reflect continuous and fluid progression.

## Additional Capabilities

Beyond the upstream caught/uncaught toggle, each slot tracks how it's held and where the mon came from:

- **Capture status** — every caught slot is one of:
  - _Caught_ — a regular, properly obtained mon.
  - _Temporary_ — a placeholder (e.g. from GO or a stranger trade) to replace with a proper one later.
  - _Locked_ — the slot is final and never changing.
- **Quick marking** — clicking a tile catches it; hovering reveals one-click buttons for the other statuses. Marking opens a popover anchored to the tile for follow-up edits.
- **Per-mon metadata** (tile popover) — _Origin Game_ and _Language of origin_ (English, Japanese, and the other mainline languages), since foreign-language mons are worth distinguishing. _Release_ clears the slot and its metadata. A tile shows a corner mark until its metadata is filled in.
- **Multiple personal dexes** — each is its own instance of a catalog dex with independent progress, switchable from the nav and reorderable on the landing page. Each dex can define _defaults_ (status / origin game / language) prefilled whenever a mon is newly marked — e.g. a regional living dex where every catch is a locked local catch.
- **Localization** — the whole UI (including Pokémon names) toggles between English and Japanese from the nav.

## Data Persistence

All state lives on this machine; there is no server or account.

- **Desktop (Electron)** — a single JSON file, `captures.json`, in the per-user app data directory (e.g. `%APPDATA%/tsukamae` on Windows). The renderer sends the full state through a preload bridge; the main process coalesces rapid changes into debounced, atomic writes (temp file + rename) and does a final synchronous flush on quit, so progress can't be corrupted or lost mid-session.
- **Browser dev** (`yarn start`) — the same state falls back to `localStorage`. `yarn start:fresh` keeps everything in memory only, so testing never touches real data.
- **Export / Import** — the nav's data menu downloads the whole tracker as a JSON snapshot and restores from one (import replaces all current state). This is also the upgrade path across dataset regenerations.

## Development

Requires Node (see `.node-version`) and Yarn. Use **Yarn, not npm** — the committed lockfile is `yarn.lock`, and some type packages (e.g. `@types/react`) are peer dependencies that npm 7+ silently auto-installs but Yarn does not. They are pinned explicitly in `package.json`, so `yarn install` gives a complete, type-checkable tree.

```bash
yarn install

# Desktop app (webpack dev server + Electron, hot reload)
yarn electron:dev

# Browser-only dev (persistence falls back to localStorage)
yarn start # http://localhost:9898

# Build a Windows installer (output in dist/)
yarn electron:build

# Lint + typecheck
yarn lint:all
```

## Future-proofing

The dex structure is a static snapshot in `data/` — `dexes/<key>/` (one directory per catalog dex: `meta.json` + `pokemon.json`), `games.json` (origin-game options), `languages.json`, and `dex-types.json` — generated from the live pokedextracker API:

```bash
yarn dataset      # scripts/generate-dataset.mjs + scripts/add-japanese-names.mjs
yarn dataset:ja   # re-attach Japanese names only
```

When a new generation arrives:

1. Export progress from the nav's data menu (belt and braces — regeneration only touches `data/`, never personal progress, which lives outside the repo entirely).
2. Run `yarn dataset`, and add any new dex to `DEX_MANIFEST` in `scripts/generate-dataset.mjs` + the catalog in `app/utils/local-data.ts`.
3. Update the sprite sheet (`public/pokesprite-v12.png` + `app/styles/pokesprite.scss`) from upstream.
4. New origin-game options are a one-line addition to `data/games.json` (+ a Japanese name in `app/i18n/names.ts`).

## Architecture

React 18 + TypeScript bundled by webpack; plain SCSS; Electron as a thin desktop shell. No router, no server, no accounts — the view is derived from which dex is active.

```
app/
├── components/
│   ├── library/          # Shared pieces: nav, dex modal, progress bar, logo
│   └── pages/
│       ├── Landing.tsx   # Dex list (create, reorder, open)
│       ├── Tracker/      # The box view: search bar header, box grid, tile
│       │                 #   popover (capture editing), mark-all
│       └── Palette.tsx   # Hidden theme workbench (?palette=1)
├── hooks/
│   ├── contexts/         # Dex state + local-storage-backed UI prefs
│   └── queries/          # react-query mutations/queries over local data
├── i18n/                 # EN/JA dictionaries (compile-checked in sync)
├── palette/              # JS mirror of the color system + live-preview bridge
├── styles/               # variables.scss = token system (bases + derivations
│                         #   emitted as CSS custom properties), per-area sheets
├── types/                # Domain types (captures, dexes, games)
└── utils/                # Bundled dataset catalog, persistence, formatting
electron/                 # Main process: app:// static server + JSON persistence
data/                     # Generated dex/game/language snapshot (see above)
scripts/                  # Dataset generation
```

Key mechanics:

- **State** — the bundled catalog (`utils/local-data.ts`) is structure; a personal dex is a catalog reference plus a sparse progress map. One in-memory app state is mirrored to disk write-behind; react-query wraps reads/mutations with optimistic UI updates.
- **Color system** — every color derives from a small set of hand-picked bases via recorded derivations, emitted as CSS custom properties that all styles consume. The `?palette=1` workbench re-resolves the palette live (in every open tab) and self-checks its JS mirror against the SCSS build. Light/dark is a pair of surface pointers; the palette owns everything else.
- **i18n** — a flat key→string dictionary per locale; `ja` is typed against `en`'s keys so the dictionaries cannot drift.

## Credits

Built on [pokedextracker.com](https://github.com/pokedextracker). The frontend structure comes from this project; personal additions build upon this foundation. Licensed MIT.
