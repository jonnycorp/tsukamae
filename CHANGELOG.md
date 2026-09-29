# Changelog

All notable changes to tsukamae. Versions follow [semver](https://semver.org); dates are release dates.

## [2.0.0] — unreleased

### Sealing

- **Sealed** — a fourth commitment tier above Caught, reachable only from it. Caught means properly obtained; sealed is the assertion that this slot holder is final and will never be replaced.
- Sealing requires every metadata field to be answered, then a confirmation. A sealed Pokémon is completely frozen: no form in the popover, no Release — the popover shows a read-only record instead.
- Unsealing is a press-and-hold with a ring closing around the cursor, landing the Pokémon back on Caught. Re-sealing needs the full confirmation again.
- A sealed record that no longer meets the current requirements — a field added since it was sealed, or a value the app no longer writes — wears a small warning pin, and its sealed record marks the fields that need updating. Nothing is changed for you: the pin only points at records to revisit.

### Status renaming

- The three statuses are now **Unobtainable**, **Temporary** and **Caught**. Previously "Caught" meant any properly obtained mon and "Locked" meant a settled slot; with sealing carrying the finality claim, the middle tier was redundant and the set is more useful as a spectrum of *how gettable* something is.
- **Unobtainable** is the new bottom tier — event-locked raid mons and some mythicals that can't be obtained by any current means. Logging one keeps the slot in a completion state instead of blank forever.
- **Temporary** keeps its meaning: a placeholder holding the slot for completion, openly subject to upgrade.
- Renamed throughout — the stored ids, the CSS classes and the colour tokens all moved with the labels, so `--caught` now names the green that marks a properly obtained mon and `--unobtainable` names the orange. Colours themselves are pixel-identical; each value simply travels under its new name. Pre-2.0 progress files are not migrated, which is moot given 2.0 starts from a clean file.

### Capture metadata

- New per-Pokémon fields alongside origin game and language: **been to Champions**, **location** (in HOME, in Champions, or which game it's sitting in), **ball**, **catch date**, **gender** (species-locked mons answer themselves from PokéAPI data), **nickname**, **OT**, **level**, **trained** (untrained / 3+ perfect IVs / EV-trained) and **favorite**. **Favorite is a three-step scale — no, favorite (blue heart) or partner (red heart, 相棒)** — with partner strictly hand-picked. Giving a mon a nickname floors it at favorite until the nickname is removed, as does a Mystery Gift origin; a partner is never touched by that rule.
- Champions is two facts, not one. *Been to Champions* is provenance and survives the mon coming back, since it keeps its Champions data forever; *location* is where it is right now, and only offers "In Champions" once the mon has actually been there.
- Most fields are unanswered by default, and unanswered is distinct from "no" — that distinction is what makes the seal gate mean something. The exceptions are fields whose options already cover every state a Pokémon can be in: **been to Champions** (defaulting to no), **favorite** (defaulting to no) and **trained** (defaulting to untrained). They offer no "Unspecified" choice, never block a seal, and are stored with their value on every marked record rather than left empty; records from before are filled in once when the app loads. A species locked to one gender offers only that gender, with no blank beside it.
- Fields are declared in one registry that drives the popover form, the seal gate, the filters and the per-dex defaults, so a future column is a single entry rather than a change in five files.
- OT prefills from a game/language lookup table, since one run-through per game/language pair makes the trainer name predictable.
- **Unobtainable slots hold no metadata at all.** There is no specimen to describe, so the fields disappear from the record and every one is stored blank — switching an existing Pokémon to unobtainable clears it.
- The non-cartridge origins are **Pokémon GO, Friend Trade, Mystery Gift (ふしぎなおくりもの) and Other**. Picking a **Cherish Ball** sets the origin to Mystery Gift, since nothing catchable comes in one; the reverse isn't assumed, because plenty of distributions arrive in ordinary balls.
- Per-dex capture defaults cover the prefillable fields — status, my game, origin game, language, ball and trained — each independently leave-able unset for wildcard dexes. Per-specimen facts (catch date, gender, nickname, OT, level, favorite, Champions) deliberately take no default.
- Legendary and mythical class is derived from PokéAPI rather than authored.

### My Games

- **Playthroughs are now a first-class record** — game + language + OT, managed from My Games in the settings menu. One record does three jobs: it names an origin, lists the places a Pokémon can be sitting, and fills in OT.
- Picking one of your games as a Pokémon's origin answers game, language and OT in a single action. An explicit pick always restamps all three, since choosing a playthrough is a statement about where the Pokémon came from; a foreign OT (legacy trades, event distributions) is typed afterwards and nothing overwrites it.
- Location's "in a game" now lists your actual playthroughs rather than bare cartridge names, which distinguishes a Japanese Violet from an English one.
- **OT has no per-dex default.** It comes from the matching playthrough or from your own hand, nothing else. A blanket default would be wrong for any dex spanning more than one game, and worse, it would answer the seal gate with a guess — a blank OT blocks sealing and makes you look, whereas a wrong one sails through and then freezes.

### UI

- All dropdowns are now one custom component styled on the nav menus — the popover fields, dex modal, My Games and the nav dex switcher — replacing the OS-native selects. Menus are fixed-position so no modal or popover edge clips them, scroll past 240px, and open at the current selection.
- Ball options show their in-game pixel sprite, pulled once from pokesprite into `public/balls/` by `yarn sprites:balls` and bundled offline like everything else.
- **The capture popover docks beside the box** instead of opening over the tiles around the one clicked, and lays its fields out in two columns — where the mon came from, then the specimen itself — instead of one long list. It stays open from tile to tile: clicking the next tile marks it and switches the popover over in place, it follows its box while scrolling, and the tile being edited wears an accent frame. Where a box has no room beside it, the popover keeps clear of the tile's row instead.
- The hover status buttons are gone from metadata dexes; status lives in the popover with every other field.
- **Hotkeys:** D releases the tile under the cursor (clears it in a checklist; a sealed mon is never touched), F opens the Filters panel and R resets the filters. They stay quiet while typing, under a modal and alongside Cmd/Ctrl/Alt.
- A box outlines itself as complete once every slot is caught or unobtainable, since unobtainable is as done as a slot can currently get. The lock icon beside a complete box's title is gone; the sealed count beside it already tracks sealing.

### Themes

- **Five new themes replace the eight from 1.2: Apricot (the default), Matcha, Harbor, Wisteria and Graphite.** Each is only five hues and a chroma scale; every colour in both modes is computed from them in OKLCH, so all themes share one lightness structure and differ in character rather than in legibility. Apricot keeps contrasting statuses (sand, rose, sage); the others are waves through a single colour family, such as Matcha's celadon to spring green to sage and Harbor's sand to sea-glass to deep blue, with the statuses told apart by depth, richness and texture.
- Sealed tiles carry a soft wash from the top that names where the mon is: its own colour in a game, blue in HOME, gold in Champions. Each wash is solved per theme so it stays visible against the tile and distinct from the other two — HOME turns cyan on themes whose tiles are already blue, and Champions stays gold rather than greying out over blue and violet tiles — and tile text is solved to stay legible over every wash.
- Origin marks on sealed tiles are drawn in the tile's text colour, matching the number and name beside them, so they no longer sink into Soft Dark's deeper tiles.
- **Type is consistent across English and Japanese.** Nicknames and OTs are set by their own script rather than the UI language, so a Latin nickname no longer shrinks in Japanese and a Japanese one no longer swells in English; Japanese display text (names, the popover and modal titles) is set a size smaller to read as large as the Latin beside it. Modal titles match, the modals no longer inherit the nav's font, tile numbers stay one size when a tile is sealed, buttons share one label size, and the Japanese search placeholder and progress line fit and use Japanese punctuation.
- **Soft Dark is a full palette per theme** rather than a surface swap: soft mid-dark pages, a deep nav, and tiles in deeper versions of their colours, so pastel tiles no longer glare off a dark page.
- Every text role is solved to its WCAG target, and every status stays tellable apart from the others and from an empty slot. Yellows and oranges get extra lightness in the dark and extra chroma in the light, so they read as gold instead of brown or beige.
- `yarn lint:themes` audits every theme × mode (710 rules) on each build.
- The Mystery Gift red now extends to the catch date as well as the OT.
- The 1.2 colour-picker workbench is replaced by a read-only Theme Preview of every theme in both modes.

### Checklist dexes

- A dex can be created as a **checklist**: statuses only, nothing else. Clicking a box checks it instantly as caught, and hovering offers one-click buttons for each status; a popover never opens and there's no metadata or defaults. A marked box is inert to clicks except for press-and-hold, which clears the slot with the same closing-ring gesture — no confirmations either way.
- A caught check wears the full sealed presentation (shine and all) without any seal semantics or terminology, while temporary and unobtainable checks wear their own tile colours. The metadata surfaces — badges, flips, box counts, tag toggles and every filter but Hide Marked and Temp Only — simply don't exist there.
- The choice is made **only at creation and is permanent**. An existing dex can never convert to a checklist and a checklist can never convert back, so a metadata-rich dex can't be hollowed out by accident.

### Filters

- **The filter row is rebuilt.** The checkboxes, which could combine into nonsense like Hide Marked with Temp Only, are now one set of views: All, Missing, Temporary, Unsealed and Incomplete.
- A **Filters panel** narrows any view by generation, legendary/mythical, origin game, language, OT, location, ball, trained and favorite. Every value shows how many Pokémon it would leave under the other filters, values within a facet combine with "or" and facets with "and", and active facets sit in the bar as chips that clear with a click, beside a running count.
- Generation and legendary/mythical read the species, so they also narrow Missing ("what am I still missing from Gen 9"); record facets can't match an empty slot, so the Missing view sets them aside until you switch back.
- Checklists get All, Missing and Temporary, plus the species facets.
- Search also matches nicknames.

### Performance

- The nickname, OT and catch-date flips run on one shared clock instead of an infinite animation per track. Nothing animates between flips, flip tracks no longer hold GPU layers, and a freshly sealed mon or a box scrolling into view is in sync by construction.
- The box shine's moving layer is a 260px band instead of a 1404px one: about a fifth of the memory and raster work for the same motion.
- Each tile renders one layout instead of two, and its status buttons only mount once it has been hovered, so a full dex builds roughly a third of the DOM it used to.
- Search and filter results render in the background, keeping typing responsive on large result lists; the per-tile render delays are gone.
- Switching theme no longer re-renders every tile, and unsealing's hold ring fills with CSS instead of re-rendering its tile every frame.
- The scrollbar fade no longer restyles every tile in the dex on each frame of its transition.
- Sprite rules are keyed so each icon only checks its own species' rules, instead of every shiny or Legends: Arceus rule.

### Removed

- **Box Check** — per-Pokémon sealing supersedes it. Sealed mons are the constants; the rest of a box is explicitly moving parts, so box-level verification no longer means anything. Its place in the box header is taken by a derived sealed count.
- **Mark All / Unmark All** — legacy from the upstream app and incompatible with per-Pokémon detail: bulk-marking thirty slots can't fill in ball, date, OT or location.
- **Wipe Data** — deleting individual dexes covers it.
- Deleting a dex moved out of the dex modal and onto the landing page, behind an edit-list mode that also holds the reorder arrows — the resting list is now just titles and progress.
- The v1.0 legacy-format migration path.

### Internals

- The data file is now `dex_data.json` (was `captures.json`); the browser fallback key matches. No migration — 2.0 starts from a clean file.
- `scripts/add-japanese-names.mjs` is now `scripts/enrich-species.mjs` (`yarn dataset:species`), attaching legendary class alongside Japanese names from the same PokéAPI call.
- react-query is gone: a dex's captures come straight from the in-memory state, so opening one has no loading step.
- The palette is computed only in TypeScript and applied before the first render; the duplicate Sass derivation engine and the workbench's drift check are gone.
- Stylesheets are Sass modules with no deprecated functions, and the vendor-prefix mixins are gone since Chromium is the only target.
- Babel targets current Chromium; core-js, lodash and other unused packages were dropped, and everything moved to devDependencies so installers no longer ship the build tooling.
- The dataset script writes the current origin list (Mystery Gift, no Event or Special) and no longer emits the unused `dex-types.json`, so a rerun can't clobber either.
- Saves are written strictly in order, and quitting waits for the last one, including a write already in progress.
- Hover effects no longer switch off on touchscreen laptops, the tab title resets when leaving a dex, and national-dex box titles number by national id like their tiles.

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
