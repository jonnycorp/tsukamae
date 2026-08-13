# Changelog

All notable changes to tsukamae. Versions follow [semver](https://semver.org); dates are release dates.

## [2.0.0] — unreleased

### Sealing

- **Sealed** — a fourth commitment tier above Caught, reachable only from it. Caught means properly obtained; sealed is the assertion that this slot holder is final and will never be replaced.
- Sealing requires every metadata field to be answered, then a confirmation. A sealed Pokémon is completely frozen: no hover buttons on the tile, no form in the popover, no Release — the popover shows a read-only record instead.
- Unsealing is a press-and-hold with a ring closing around the cursor, landing the Pokémon back on Caught. Re-sealing needs the full confirmation again.

### Status renaming

- The three statuses are now **Unobtainable**, **Temporary** and **Caught**. Previously "Caught" meant any properly obtained mon and "Locked" meant a settled slot; with sealing carrying the finality claim, the middle tier was redundant and the set is more useful as a spectrum of *how gettable* something is.
- **Unobtainable** is the new bottom tier — event-locked raid mons and some mythicals that can't be obtained by any current means. Logging one keeps the slot in a completion state instead of blank forever.
- **Temporary** keeps its meaning: a placeholder holding the slot for completion, openly subject to upgrade.
- Renamed throughout — the stored ids, the CSS classes and the colour tokens all moved with the labels, so `--caught` now names the green that marks a properly obtained mon and `--unobtainable` names the orange. Colours themselves are pixel-identical; each value simply travels under its new name. Pre-2.0 progress files are not migrated, which is moot given 2.0 starts from a clean file.

### Capture metadata

- New per-Pokémon fields alongside origin game and language: **been to Champions**, **location** (in HOME, in Champions, or which game it's sitting in), **ball**, **catch date**, **gender** (species-locked mons answer themselves from PokéAPI data), **nickname**, **OT**, **level**, **trained** (untrained / 3+ perfect IVs / EV-trained) and **favorite**. **Favorite is a three-step scale — none, favorite (blue heart) or partner (red heart, 相棒)** — with partner strictly hand-picked. Giving a mon a nickname floors it at favorite until the nickname is removed; a partner is never touched by that rule.
- Champions is two facts, not one. *Been to Champions* is provenance and survives the mon coming back, since it keeps its Champions data forever; *location* is where it is right now, and only offers "In Champions" once the mon has actually been there.
- Most fields are unanswered by default, and unanswered is distinct from "no" — that distinction is what makes the seal gate mean something. The exceptions are **been to Champions** (a plain yes/no defaulting to no) and **favorite** (defaulting to none) — neither ever blocks a seal.
- Fields are declared in one registry that drives the popover form, the seal gate, the filters and the per-dex defaults, so a future column is a single entry rather than a change in five files.
- OT prefills from a game/language lookup table, since one run-through per game/language pair makes the trainer name predictable.
- Per-dex capture defaults cover the prefillable fields — status, my game, origin game, language, ball and trained — each independently leave-able unset for wildcard dexes. Per-specimen facts (catch date, gender, nickname, OT, level, favorite, Champions) deliberately take no default.
- Legendary and mythical class is derived from PokéAPI rather than authored.

### My Games

- **Playthroughs are now a first-class record** — game + language + OT, managed from My Games in the settings menu. One record does three jobs: it names an origin, lists the places a Pokémon can be sitting, and fills in OT.
- Picking one of your games as a Pokémon's origin answers game, language and OT in a single action, and never overwrites an OT you typed by hand — so foreign-OT mons (legacy trades, event distributions) stay editable.
- Location's "in a game" now lists your actual playthroughs rather than bare cartridge names, which distinguishes a Japanese Violet from an English one.
- **OT has no per-dex default.** It comes from the matching playthrough or from your own hand, nothing else. A blanket default would be wrong for any dex spanning more than one game, and worse, it would answer the seal gate with a guess — a blank OT blocks sealing and makes you look, whereas a wrong one sails through and then freezes.

### UI

- All dropdowns are now one custom component styled on the nav menus — the popover fields, dex modal, My Games and the nav dex switcher — replacing the OS-native selects. Menus are fixed-position so no modal or popover edge clips them, scroll past 240px, and open at the current selection.
- Ball options show their in-game pixel sprite, pulled once from pokesprite into `public/balls/` by `yarn sprites:balls` and bundled offline like everything else.

### Checklist dexes

- A dex can be created as a **checklist**: caught or not, nothing else. Clicking a box checks it instantly (no popover, no metadata, no defaults); a checked box is inert except for press-and-hold, which clears the slot with the same closing-ring gesture — no confirmations either way.
- A check wears the full sealed presentation (shine and all) without any seal semantics or terminology; the metadata surfaces — badges, flips, filters, box counts, tag toggles — simply don't exist there.
- The choice is made **only at creation and is permanent**. An existing dex can never convert to a checklist and a checklist can never convert back, so a metadata-rich dex can't be hollowed out by accident.

### Filters

- New filters: Unsealed Only, Incomplete Only, Favorites Only. Search also matches nicknames.

### Removed

- **Box Check** — per-Pokémon sealing supersedes it. Sealed mons are the constants; the rest of a box is explicitly moving parts, so box-level verification no longer means anything. Its place in the box header is taken by a derived sealed count.
- **Mark All / Unmark All** — legacy from the upstream app and incompatible with per-Pokémon detail: bulk-marking thirty slots can't fill in ball, date, OT or location.
- **Wipe Data** — deleting individual dexes covers it.
- Deleting a dex moved out of the dex modal and onto the landing page, behind an edit-list mode that also holds the reorder arrows — the resting list is now just titles and progress.
- The v1.0 legacy-format migration path.

### Internals

- The data file is now `dex_data.json` (was `captures.json`); the browser fallback key matches. No migration — 2.0 starts from a clean file.
- `scripts/add-japanese-names.mjs` is now `scripts/enrich-species.mjs` (`yarn dataset:species`), attaching legendary class alongside Japanese names from the same PokéAPI call.

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
