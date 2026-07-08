# Tsukamae

A personal living dex tracker, running as a Windows desktop app (Electron). Forked from [pokedextracker.com](https://pokedextracker.com) and stripped down to a local-contained, offline, and single-user app with additional marking capabilities to reflect continuous and fluid progression.

## Additional Capabilities

TODO FILL

## Data Persistence

TODO FILL

## Development

Requires Node (see `.node-version`) and Yarn.

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
