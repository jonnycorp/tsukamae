# Changelog

All notable changes to tsukamae. Versions follow [semver](https://semver.org); dates are release dates.

## [1.2.0] — 2026-07-19

### Themes

- 8 selectable color themes (Peach Milk, Sakura, Butter, Mint Milk, Twilight, Matcha, Latte, Slate), picked from a swatch popover in the nav; Peach Milk is the default.
- Soft Dark: a per-theme dark variant (surfaces and text flip, the palette keeps its character) available from the theme popover; replaces the old light/dark toggle.
- Full rule-based color system: every color derives from a few theme bases, with a live `?palette=1` workbench (WCAG contrast badges, live component samples, SCSS↔JS sync check).

### Legends: Z-A

- Bundled the Lumiose City dex (232) and the Mega Dimension dex (132), sourced from PokéAPI with Japanese names included.
- Legends: Z-A available as an origin game; Serebii links for Z-A mons point at the Gen 9 dex.

### Tracker features

- Box Check: an optional per-dex pokéball toggle on every box marking it as verified against HOME; any edit inside a verified box clears its mark automatically. Rides export/import.
- All-locked boxes get a locked-color frame, title, and lock glyph — the goal-state signal.
- Progress bars segment on click into locked / caught / temporary (striped) portions, with the full count breakdown shown on the bar; choice persists.
- Tile origin marks (Friend Trade ⇄, Pokémon GO 📍, Event 🎁, Special ★) and boxed in-game-style language tags (JPN/ENG/…), each behind its own persistent checkbox in the filter section.
- Origin options reworked: "Trade (stranger)" is now "Friend Trade"; new "Event" and "Special" origins for distribution mons and special forms holding a regular slot.
- Per-dex capture defaults: optional status/origin/language prefills applied to newly marked mons.
- Wipe Data implemented: clears all dexes and progress (theme and language settings are kept) and returns to the landing page.

### Visual & UX

- Landing page with the dex list, reordering, and per-dex progress bars; the app always launches there.
- Tracker layout reworked: dex title and progress live in the search bar, boxes flow two per row, tile-anchored popover replaces the info sidebar.
- Box sprites render 30% larger; incomplete-metadata badge on tiles; themed slim scrollbars with fade; delete buttons styled in a danger color that dampens in Soft Dark.
- Full Japanese localization of every new feature.

### Internals

- Electron 31 → 43, electron-builder 24 → 26.
- Dead code removed (legacy night-mode system, unused profile/alert styling); dataset generator now supports PokéAPI-sourced dexes via `--pokeapi-only`.

## [1.1.0] — 2026-07-08

- Full app localization: every UI string available in English and Japanese, with a language toggle in the nav.
- Japanese Pokémon names (official katakana) bundled for all species; search matches Japanese names with hiragana→katakana normalization.
- Brand lowercased to "tsukamae".

## [1.0.0] — 2026-07-08

- Initial release: offline living-dex tracker forked from pokedextracker.com, rebuilt around local storage with no accounts or server.
- Bundled dex catalog (HOME national, SV, PLA, BDSP, SwSh, and older generations), capture statuses (caught / temporary / locked), origin game and language metadata, import/export, Electron desktop packaging.
