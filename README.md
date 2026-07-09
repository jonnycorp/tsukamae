# Tsukamae

A personal living dex tracker, running as a Windows desktop app (Electron). Forked from [pokedextracker.com](https://pokedextracker.com) and stripped down to a local-contained, offline, and single-user app with additional marking capabilities to reflect continuous and fluid progression.

## Additional Capabilities

Beyond the upstream caught/uncaught toggle, each slot tracks how it's held and
where the mon came from:

- **Capture status** — every caught slot is one of:
  - _Caught_ — a regular, properly obtained mon.
  - _Temporary_ — a placeholder (e.g. from GO or a stranger trade) to replace
    with a proper one later.
  - _Locked_ — the slot is final and never changing.
- **Quick marking** — clicking a tile catches it; hovering reveals one-click
  buttons for the other statuses. Every tile click opens the info sidebar.
- **Per-mon metadata** (info sidebar) — _Origin Game_ and _Language of origin_
  (English, Japanese, and the other mainline languages), since foreign-language
  mons are worth distinguishing. _Release_ clears the slot and its metadata.
- **Multiple personal dexes** — each is its own instance of a catalog dex with
  independent progress, switchable from the nav.

## Data Persistence

TODO FILL

## Development

Requires Node (see `.node-version`) and Yarn. Use **Yarn, not npm** — the
committed lockfile is `yarn.lock`, and some type packages (e.g. `@types/react`)
are peer dependencies that npm 7+ silently auto-installs but Yarn does not. They
are pinned explicitly in `package.json`, so `yarn install` gives a complete,
type-checkable tree.

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

The dex structure is a static snapshot in `data/` (`dex.json`, `games.json`, `dex-meta.json`), generated from the live pokedextracker API:

```bash
yarn dataset
```

When a new generation arrives, regenerate the dataset (and update the sprite sheet `public/pokesprite-v12.png` + `app/styles/pokesprite.scss` from upstream). The generation script strips all personal progress — only structure is committed, so make sure to export data beforehand.

TODO VERIFY ABOVE IS POSSIBLE (EXPORT) AND PROVIDE UPDATE SCRIPT

## Architecture

TODO REDO WITH LESS REFERENCE TO FORK, ADD REPO DIAGRAM

## Credits

Built on [pokedextracker.com](https://github.com/pokedextracker). The frontend structure comes from this project; personal additions build upon this foundation. Licensed MIT.
