# tsukamae

A personal living dex tracker, running as a Windows desktop app (Electron). Forked from [pokedextracker.com](https://pokedextracker.com) and stripped down to a local-contained, offline, and single-user app with additional marking capabilities to reflect continuous and fluid progression.

## Additional Capabilities

Beyond the upstream caught/uncaught toggle, each slot tracks how it's held and where the mon came from:

- **Capture status** — every marked slot is one of:
  - _Caught_ — properly obtained, and the only status sealing is reachable from.
  - _Temporary_ — a placeholder (often a GO transfer) taking the slot for completion's sake, openly subject to upgrade when a better method appears.
  - _Unobtainable_ — no legitimate way to get it right now (event-locked raid mons, some mythicals). Logged rather than left blank, so the slot still carries a completion state.
- **Sealed** — a commitment above Caught, and only reachable from it: this exact specimen is the slot holder forever, even if a perfect one turns up later. Sealing needs every field answered plus a confirmation, after which the mon is frozen — no form, no Release, just a read-only record, where only its location still changes (see _Moving a sealed mon_). Unsealing is a press-and-hold with a ring closing around the cursor, and drops it back to Caught.
- **Quick marking** — clicking a tile catches it and opens its popover beside the box, clear of the tiles around it, with the status and every field in two columns. Clicking the next tile switches the popover over without closing it, so a box can be worked through tile by tile. Checklists never open a popover; hovering a tile there offers one-click buttons for each status instead.
- **My Games** (nav) — each playthrough you own: game, language, and the trainer name it stamps on everything caught there, editable in place. One record names an origin, lists where a Pokémon can be sitting, and fills in OT. Picking a game as a mon's origin answers game, language and OT at once; a foreign OT is typed afterwards and nothing overwrites it.
- **Per-mon metadata** (tile popover) — _Origin Game_, _Language_, _OT_, _Been to Champions_, _Location_ (in HOME, in Champions, or which of your games it's sitting in), _Ball_, _Catch Date_ (typed as YYYY/MM/DD, three fields that keep the caret where you're editing, or picked from a calendar), _Gender_, _Nickname_, _Level_, _Trained_ and _Favorite_. Champions is deliberately two facts: having been there is permanent and survives the mon coming back, while _Location_ only offers "In Champions" (in a HOME dex) once it actually has. Fields you have to look up start unanswered, and unanswered is distinct from "no" — that's what gives the seal gate meaning. Fields whose options cover every state start at their baseline instead (_Been to Champions_ and _Favorite_ at no, _Trained_ at untrained, _Nickname_ unticked) and never block a seal; a new mark in a HOME dex also starts _In HOME_. _Release_ clears the slot and its metadata.
- **Moving a sealed mon** — a sealed mon is the slot's holder for good, but where it is can still change: taken out to a game for raids, into Champions, back to HOME. Its popover's Location row stays a dropdown, and _L_ over the tile opens the same places in a menu beside it: HOME, each of your games, and Champions in a HOME dex. Nothing else on the record changes.
- **Views and filters** — one click switches the dex between All, Missing, Temporary, Unsealed and Incomplete. The Filters panel narrows further by generation and legendary/mythical (which also work on missing slots) and by origin game, language, OT, location, ball, trained and favorite, each value showing how many Pokémon it would leave under the search and the other filters. Active filters sit beside the panel as chips that clear with a click.
- **Timeline** — the _Timeline_ button beside the search (or _T_) opens the dex's catches as a scene of their own: a title card slams in, then every marked mon drops onto the day it was caught, oldest first. Each day is one stack, the days of a month side by side with their dates under them, so a stack's height is that day's count; long quiet stretches fold into "3 years later" cards and mons with no catch date go on a pile of their own. It opens fitted to its tallest stack (never under 35%, scrolling up past that) and zooms like a map: _Ctrl+scroll_ (or a pinch) about the pointer, _+_ / _−_ or the bar's buttons, _0_, _Z_ or the zoom level to fit again; drag to pan, scroll to go along it, _Shift+scroll_ to go up the stacks. Hover a mon for its name, date and where it came from (game, language and OT, with a pad when that's one of your games); click it to go to its tile, or right-click it to copy its name.
- **Keyboard** — _/_ jumps to search, _Space_ pauses the flips (a pause button beside the _Timeline_ button resumes them, and a picker opens beside it at once for the face to hold: the record's number and badges, the trainer's nickname, catch date and OT, or the types; the words saying so slide off to the side), _F_ opens the Filters panel, _R_ resets the filters, _Z_ resets the zoom, _T_ opens the timeline, _L_ opens the move menu of the sealed tile under the cursor, and _D_ releases the tile under the cursor (never a sealed one). None of them fire while typing, with a menu open, or under a modal or the timeline.
- **Types** — a sealed tile flips on to a third face after the trainer's, its types alone: the number line and badges slide up together as one block and the types come up in their place, Scarlet and Violet's symbols redrawn as clean shapes and evened out in size (each scaled to the same measured size, half how much of it is drawn and half how far it reaches across, down and diagonally), no words, centred across the two lines' space (between the record's face and the trainer's, each line swipes on its own). Each symbol is in its Scarlet and Violet colour moved only in lightness, per theme and in Light and Soft Dark apiece, until it reads on the tile (WCAG's 3:1 for a graphic in Light, 4:1 in Soft Dark, on the fill and every location's wash). A regional form has its own (Alolan Vulpix is ice). The flips run the record's face, the trainer's, then the types', each held 5.5s. _Types in Flips_ (the palette menu) takes them out of the cycle: the lines then swing between the record's face and the trainer's, and the types stay a face to hold while paused.
- **Copying a name** — right-click a tile (or the name atop its popover, or a mon on the timeline) to copy the Pokémon's name as shown, Japanese in Japanese and with its ♂ or ♀; a tag at the cursor says so. The page's text doesn't select otherwise, so a drag that strays off the scrollbar can't highlight half of it; fields and error messages still do.
- **Fit and zoom** — the boxes scale themselves to the window so two span it, or one where two would shrink below 80% (a narrow window shows one box at a readable size rather than two at half), never enlarged past what a whole row can show, with the first row a fixed gap under the header bar; any room left over fills with more boxes across. The header bar spans the window, so neither zooming nor a change of the window's height moves it. _Ctrl+scroll_ (or _Ctrl+=_ / _Ctrl+−_, _Ctrl+0_ or _Z_ to reset; _Cmd_ on macOS) zooms the boxes on top of that fit, out through each count of boxes across to exactly four and in to 200%, and the level is remembered; the nav and header bar keep their size. Windows too narrow for one box switch to a list. _F11_ toggles fullscreen.
- **Title bar** — on Windows the nav is the window's title bar: drag it to move the window and double-click it to maximize. Minimize, maximize and close sit at its right end in the theme's colours, and the nav's icons keep clear of them. macOS keeps its standard title bar.
- **Multiple personal dexes** — each is its own instance of a catalog dex with independent progress, opened, created and reordered on the landing page (the logo returns there). Each dex can define _defaults_ for the prefillable fields (_Edit Dex_, in the filters' row), applied whenever a mon is newly marked — e.g. a regional living dex where every catch comes from the same cartridge. Leave a default unset where the dex is a wildcard and you want to fill it by hand. A dex can instead be created as a _checklist_: statuses only, with no metadata at all.
- **Localization** — the whole UI (including Pokémon names) toggles between English and Japanese from the nav. Small Japanese text (labels, menu items, notes; 12px and under) is set a pixel larger than the English, where kanji and kana don't read as well as Latin capitals.
- **Display** (the palette menu) — the theme, _Soft Dark_, _Location Tints_ (a sealed mon away from where its dex keeps them tinted for where it is: rose in one of your games and gold in Champions in a HOME dex, blue in HOME in a game's; off, those tiles look like the rest) and _Types in Flips_. The two switches restyle the dex without redrawing a tile.

## Data Persistence

All state lives on this machine; there is no server or account.

- **Desktop (Electron)** — a single JSON file, `dex_data.json`, in the per-user app data directory (e.g. `%APPDATA%/tsukamae` on Windows). The main process holds a copy of the tracker: a change to a tile sends just that record through the preload bridge, which it merges in (dex-level changes and imports send the whole state), and it coalesces rapid changes into debounced, atomic writes (temp file flushed to disk, then renamed over the old one, retried while antivirus or a backup tool holds it) that run strictly in order, and quitting waits for the last one, so progress can't be corrupted or lost mid-session. A save that can't reach the disk is reported in a banner until one does. A file that can't be read, or isn't tracker data, is reported and left alone rather than treated as empty; the error screen can still import an export in its place, which copies it aside to `dex_data.unreadable.json` first (numbered if there's one already). Only one copy of the app runs at a time, so two can never race each other's writes. The window's size and position sit beside it in `window-state.json`.
- **Browser dev** (`yarn start`) — the same state falls back to `localStorage`. `yarn start:fresh` keeps everything in the tab's session storage only, and `yarn electron:dev:fresh` runs the desktop app on a throwaway profile, so testing never touches real data.
- **Export / Import** — the nav's data menu downloads the whole tracker as a JSON snapshot and restores from one (import replaces all current state). This is also the upgrade path across dataset regenerations.

## Development

Requires Node (see `.node-version`) and Yarn. Use **Yarn, not npm** — the committed lockfile is `yarn.lock`, and some type packages (e.g. `@types/react`) are peer dependencies that npm 7+ silently auto-installs but Yarn does not. They are pinned explicitly in `package.json`, so `yarn install` gives a complete, type-checkable tree.

```bash
yarn install

# Desktop app (webpack dev server + Electron, hot reload; F12 devtools, Ctrl+R reload,
# Ctrl+Shift+P to see it as a production build has it, without the dev-only Theme Preview)
yarn electron:dev

# Browser-only dev (persistence falls back to localStorage)
yarn start # http://localhost:9898

# Build a Windows installer (output in dist/)
yarn electron:build

# Lint, typecheck and the theme audit
yarn lint:all
```

## Future-proofing

The dex structure is a static snapshot in `data/` — `dexes/<key>/` (one directory per catalog dex: `meta.json` + `pokemon.json`), `games.json` (origin-game options), generated once from the live pokedextracker API and PokéAPI, and the hand-maintained `languages.json` and `balls.json` — all committed; the app never fetches anything. Each Pokémon record keeps only what the app reads (upstream's nested game family is reduced to its generation as it's written):

```bash
yarn dataset          # scripts/generate-dataset.mjs + scripts/enrich-species.mjs + scripts/enrich-types.mjs
yarn dataset:species  # re-attach Japanese names, legendary/mythical class and gender locks only
yarn dataset:types    # re-attach each slot's types (a regional form's own) from PokéAPI's data tables
```

When a new generation arrives:

1. Export Data from the nav's gear menu (belt and braces — regeneration only touches `data/`, never personal progress, which lives outside the repo entirely).
2. Run `yarn dataset`, and add any new dex to `DEX_MANIFEST` in `scripts/generate-dataset.mjs` (or `POKEAPI_DEX_MANIFEST`, plus a `SYNTHETIC_GAMES` entry for a game pokedextracker lacks), and to the imports and `DEX_CATALOG` in `app/utils/local-data.ts` (with `GAME_NAME_OVERRIDES` for a paired release). A new game family also wants `SEREBII_LINKS` (`PokemonPopover.tsx`, which otherwise falls back to the newest dex), `ORIGIN_MARK_SPRITES` (`seal-faces.tsx`) with `MARKS` in `scripts/fetch-origin-marks.mjs`, and Japanese names in `JA_ORIGIN_GAMES`, `JA_CATALOG_GAMES`, `JA_DEX_TYPES`, `JA_CATALOG_DEX_NAMES` and `JA_BOX_NAMES` (`app/i18n/names.ts`); anything left out falls back to English or no mark.
3. Update the sprite sheet (`public/pokesprite-v12.png` + `app/styles/pokesprite.scss`) from upstream.
4. New non-cartridge origins go in `EXTRA_ORIGINS` in `scripts/generate-dataset.mjs` as well as `data/games.json` (a rerun rewrites the file from the script), plus a Japanese name in `app/i18n/names.ts`.

## Architecture

React 18 + TypeScript bundled by webpack; plain SCSS; Electron as a thin desktop shell. No router, no server, no accounts — the view is derived from which dex is active.

```
app/
├── components/
│   ├── library/          # Shared pieces: nav, modals, dropdown, progress bar, logo
│   └── pages/
│       ├── Landing.tsx   # Dex list (create, reorder, open)
│       ├── Tracker/      # The box view: search bar header, box grid, tiles,
│       │                 #   capture popover, flip strips and their clock
│       └── ThemePreview.tsx # Every theme × mode side by side (TESTING only)
├── hooks/
│   └── contexts/         # Dex state + local-storage-backed UI prefs and theme
├── i18n/                 # EN/JA dictionaries (compile-checked in sync)
├── palette/              # OKLCH theme engine, colour maths and the theme audit
├── styles/               # Sass modules per area; colors are CSS custom properties
├── types/                # Domain types (captures, dexes, games)
└── utils/                # Bundled dataset catalog, persistence, capture field registry, location moves
electron/                 # Main process: app:// static server, JSON persistence, window state, app icon
data/                     # Generated dex/game/language snapshot (see above)
scripts/                  # Dataset, sprite and app icon generation
```

Key mechanics:

- **State** — the bundled catalog (`utils/local-data.ts`) is structure; a personal dex is a catalog reference plus a sparse progress map. One in-memory app state is mutated synchronously and mirrored to disk write-behind; tiles update optimistically from the same change.
- **Color system** — a theme is five hues and a chroma scale (`palette/themes.ts`); every colour in both Light and Soft Dark is computed from them in OKLCH, on a shared lightness ladder, and written onto `:root` as role tokens (`paper`, `chrome`, `overlay`, `tile-caught`, `on-tile`…) before the first render. Text roles are solved to their WCAG target, and `yarn lint:themes` audits every theme × mode for contrast and for statuses that blur together. The type glyphs' colours (`type-*`) are solved the same way, from each type's Scarlet and Violet colour, and audited on the sealed tile's lower third. The dev-only Theme Preview (flask button, TESTING) shows every theme in both modes at once, with a sheet of all eighteen glyphs beside each on the tile and every location's wash (each glyph's ratio on hover); _Ctrl+scroll_ zooms it about the pointer, a drag pans it and _Ctrl+0_ resets it.
- **i18n** — a flat key→string dictionary per locale; `ja` is typed against `en`'s keys so the dictionaries cannot drift.
- **Flips** — a sealed tile's alternating lines (nickname, catch date, OT) aren't drawn by the tile. Each row of boxes gets an overlay (`FlipStrips`) with one clipped window per tile row and line, whose faces slide as a single composited strip, and every strip runs one keyframe cycle on the compositor from a shared start time (`use-flip-clock.ts`). A flip costs the main thread nothing, and a strip that appears later joins in step. The overlays skip rendering offscreen on their own and paint after every box's tiles: Chromium's layer assignment slows with the square of composited layers painted between boxes, which is what made zoomed-out views lag.

## Credits

Built on [pokedextracker.com](https://github.com/pokedextracker). The frontend structure comes from this project; personal additions build upon this foundation. Licensed MIT.
