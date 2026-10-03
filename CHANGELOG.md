# Changelog

All notable changes to tsukamae. Versions follow [semver](https://semver.org); dates are release dates.

## [2.0.0] — unreleased

### Sealing

- **Sealed** — a fourth commitment tier above Caught, reachable only from it. Caught means properly obtained; sealed is the assertion that this slot holder is final and will never be replaced.
- Sealing requires every metadata field to be answered with a value the app still offers, then a confirmation. A sealed Pokémon is completely frozen: no form in the popover, no Release — the popover shows a read-only record instead.
- Unsealing is a press-and-hold with a ring closing around the cursor, landing the Pokémon back on Caught. Re-sealing needs the full confirmation again.
- A sealed record that no longer meets the current requirements — a field added since it was sealed, or a value the app no longer writes — wears a small warning pin, and its sealed record marks the fields that need updating. Nothing is changed for you: the pin only points at records to revisit.

### Status renaming

- The three statuses are now **Unobtainable**, **Temporary** and **Caught**. Previously "Caught" meant any properly obtained mon and "Locked" meant a settled slot; with sealing carrying the finality claim, the middle tier was redundant and the set is more useful as a spectrum of *how gettable* something is.
- **Unobtainable** is the new bottom tier — event-locked raid mons and some mythicals that can't be obtained by any current means. Logging one keeps the slot in a completion state instead of blank forever.
- **Temporary** keeps its meaning: a placeholder holding the slot for completion, openly subject to upgrade.
- Renamed throughout — the stored ids, the CSS classes and the colour tokens all moved with the labels, so `--caught` now names the green that marks a properly obtained mon and `--unobtainable` names the orange. Colours themselves are pixel-identical; each value simply travels under its new name. Pre-2.0 progress files are not migrated, which is moot given 2.0 starts from a clean file.

### Capture metadata

- New per-Pokémon fields alongside origin game and language: **been to Champions**, **location** (in HOME, in Champions, or which game it's sitting in), **ball**, **catch date**, **gender** (species-locked mons answer themselves from PokéAPI data), **nickname**, **OT**, **level**, **trained** (untrained / 3+ perfect IVs / EV-trained) and **favorite**. **Favorite is a three-step scale — no, favorite (blue heart) or partner (red heart, 相棒)** — with partner strictly hand-picked. Giving a mon a nickname floors it at favorite, as does a Mystery Gift origin; removing the nickname or moving the origin off Mystery Gift drops it back to no, and a partner is never touched by that rule.
- Champions is two facts, not one. *Been to Champions* is provenance and survives the mon coming back, since it keeps its Champions data forever; *location* is where it is right now, and only offers "In Champions" in a HOME dex, once the mon has actually been there.
- Most fields are unanswered by default, and unanswered is distinct from "no" — that distinction is what makes the seal gate mean something. The exceptions are fields whose options already cover every state a Pokémon can be in: **been to Champions** (defaulting to no), **favorite** (defaulting to no) and **trained** (defaulting to untrained). They offer no "Unspecified" choice, never block a seal, and are stored with their value on every marked record rather than left empty; records from before are filled in once when the app loads. **Nickname** is a checkbox, unticked meaning none, and blocks a seal only when ticked with no name. A new mark in a HOME dex starts **In HOME**; elsewhere it starts in a game and waits for you to say which. A species locked to one gender offers only that gender, with no blank beside it.
- Fields are declared in one registry that drives the popover form, the seal gate (and with it the Incomplete view and the stale pin) and the per-dex defaults. The Filters panel's facets are their own curated list, but take each record field's value order from the registry.
- OT prefills from a game/language lookup table, since one run-through per game/language pair makes the trainer name predictable.
- **Unobtainable slots hold no metadata at all.** There is no specimen to describe, so the fields disappear from the record and every one is stored blank — switching an existing Pokémon to unobtainable clears it.
- The non-cartridge origins are **Pokémon GO, Friend Trade, Mystery Gift (ふしぎなおくりもの) and Other**. Picking a **Cherish Ball** sets the origin to Mystery Gift, since nothing catchable comes in one; the reverse isn't assumed, because plenty of distributions arrive in ordinary balls. In a dex's defaults the rule runs at the pick, so an origin chosen after the ball is the one new marks get.
- Per-dex capture defaults cover the prefillable fields — status, my game, origin game, language, ball and trained — each independently leave-able unset for wildcard dexes. Per-specimen facts (catch date, gender, nickname, OT, level, favorite, Champions) deliberately take no default.
- Legendary and mythical class is derived from PokéAPI rather than authored.

### My Games

- **Playthroughs are now a first-class record** — game + language + OT, managed from My Games in the nav. One record does three jobs: it names an origin, lists the places a Pokémon can be sitting, and fills in OT.
- Picking one of your games as a Pokémon's origin answers game, language and OT in a single action. An explicit pick always restamps all three, since choosing a playthrough is a statement about where the Pokémon came from; a foreign OT (legacy trades, event distributions) is typed afterwards and nothing overwrites it. Moving a mon's origin or language by hand onto another of your games takes that game's OT along, as picking it would; an OT you typed stays.
- Location's "in a game" now lists your actual playthroughs rather than bare cartridge names, which distinguishes a Japanese Violet from an English one.
- A playthrough can be edited in place (the pencil under Edit List), so fixing a typo no longer means deleting it and adding it again, which left every Pokémon placed in that game without a location. Deleting one that Pokémon are sitting in says how many will need their location set again.
- **OT has no per-dex default.** It comes from the matching playthrough or from your own hand, nothing else. A blanket default would be wrong for any dex spanning more than one game, and worse, it would answer the seal gate with a guess — a blank OT blocks sealing and makes you look, whereas a wrong one sails through and then freezes.

### UI

- All dropdowns are now one custom component styled on the nav menus — the popover fields, dex modal, My Games and the nav dex switcher — replacing the OS-native selects. Menus are fixed-position so no modal or popover edge clips them, scroll past 240px, and open at the current selection. They work from the keyboard as the native ones did — arrows, Home/End and a first letter move, Enter or Space picks, Tab moves on — and Escape closes an open menu without closing the modal or popover around it.
- Ball options show their in-game pixel sprite, pulled once from pokesprite into `public/balls/` by `yarn sprites:balls` and bundled offline like everything else.
- **The capture popover docks beside the box** instead of opening over the tiles around the one clicked, and lays its fields out in two columns — where the mon came from, then the specimen itself — instead of one long list. It stays open from tile to tile: clicking the next tile marks it and switches the popover over in place, it follows its box while scrolling or when a search or filter moves it, and the tile being edited wears an accent frame. Where a box has no room beside it, the popover keeps clear of the tile's row instead.
- The hover status buttons are gone from metadata dexes; status lives in the popover with every other field.
- **A modal (and the timeline) holds the keyboard.** The page behind can't be focused or clicked while one is up; before, Tab could reach the nav's dex switcher behind Edit Dex and point the edit at another dex.
- **Timeline.** The Timeline button in the filter row (or T) opens the dex's catches as a scene of their own, over the whole window: a slash of colour, the title slamming down with a flash and a shake, the dex's name sliding in under it, then the spine drawing across as every marked mon drops onto the month it was caught in, oldest first, squashing as it lands while the stage pans along with them. Each month's pile grows as tall as the window allows and then widens, so a busy month becomes a wall; a quiet stretch of three months or more folds into a "3 years later" card, and mons with no catch date land last, greyed, on a "???" pile. The bar counts them in and names the busiest month. Hover a mon for its name, date and status, click it to close the timeline at its tile with the popover open, replay the entrance from the bar; any key or click skips it, and Escape closes.
- **Space shows what it did.** Pausing the flips flashes "Flips paused" in the corner, and a quieter badge stays there for as long as they're held; resuming flashes "Flips resumed". Holding Space no longer pages the dex down, and where nothing flips (no seals yet, a checklist, the list view) Space scrolls as usual.
- **Language tags and the progress breakdown are always on.** Their toggles are gone: sealed tiles always show their language tag, and progress bars always split into caught, unobtainable and temporary. Nothing re-renders every tile to switch them any more.
- **Sealed tiles keep their effects in every view.** Search and filter results are drawn as box-sized chunks, each with its own shine and flips like a box, so a sealed tile (or a caught check) glints in a filtered view too, the popover docks beside the chunk as it does beside a box, and offscreen chunks skip their work.
- **Hotkeys:** D releases the tile under the cursor (clears it in a checklist; a sealed mon is never touched), F opens the Filters panel, R resets the filters, Z resets the zoom and T opens the timeline. They stay quiet while typing, under a modal or the timeline, with a menu open — a dropdown, where a letter picks from the menu, or the nav's gear and theme menus, which Escape now closes too — and alongside Cmd/Ctrl/Alt.
- A box outlines itself as complete once every slot is caught or unobtainable, since unobtainable is as done as a slot can currently get. The lock icon beside a complete box's title is gone; the sealed count beside it already tracks sealing.

### Themes

- **Five new themes replace the eight from 1.2: Apricot (the default), Matcha, Harbor, Wisteria and Graphite.** Each is only five hues and a chroma scale; every colour in both modes is computed from them in OKLCH, so all themes share one lightness structure and differ in character rather than in legibility. Apricot keeps contrasting statuses (sand, rose, sage); the others are waves through a single colour family, such as Matcha's celadon to spring green to sage and Harbor's sand to sea-glass to deep blue, with the statuses told apart by depth, richness and texture.
- Sealed tiles carry a soft wash from the top that names where the mon is: its own colour in a game, blue in HOME, gold in Champions. Each wash is solved per theme so it stays visible against the tile and distinct from the other two — HOME turns cyan on themes whose tiles are already blue, and Champions stays gold rather than greying out over blue and violet tiles — and tile text is solved to stay legible over every wash.
- Origin marks on sealed tiles are drawn in the tile's text colour, matching the number and name beside them, so they no longer sink into Soft Dark's deeper tiles.
- **Type is consistent across English and Japanese.** Nicknames and OTs are set by their own script rather than the UI language, so a Latin nickname no longer shrinks in Japanese and a Japanese one no longer swells in English; Japanese display text (names, the popover and modal titles) is set a size smaller to read as large as the Latin beside it. Modal titles match, the modals no longer inherit the nav's font, tile numbers stay one size when a tile is sealed, buttons share one label size, and the Japanese search placeholder and progress line fit and use Japanese punctuation.
- **Soft Dark is a full palette per theme** rather than a surface swap: soft mid-dark pages, a deep nav, and tiles in deeper versions of their colours, so pastel tiles no longer glare off a dark page.
- Every text role is solved to its WCAG target, and every status stays tellable apart from the others and from an empty slot. Yellows and oranges get extra lightness in the dark and extra chroma in the light, so they read as gold instead of brown or beige.
- `yarn lint:themes` audits every theme × mode (710 rules). It's part of `yarn lint:all`, which `yarn electron:build` and the release workflow now run before building.
- The Mystery Gift red now extends to the catch date as well as the OT.
- The 1.2 colour-picker workbench is replaced by a read-only Theme Preview of every theme in both modes.
- The theme menu's checkmarks sit flush right at their intended size; the menu's general icon style had been overriding them since 1.2.

### Checklist dexes

- A dex can be created as a **checklist**: statuses only, nothing else. Clicking a box checks it instantly as caught, and hovering offers one-click buttons for each status; a popover never opens and there's no metadata or defaults. A marked box is inert to clicks except for press-and-hold, which clears the slot with the same closing-ring gesture — no confirmations either way.
- A caught check wears the full sealed presentation (shine and all) without any seal semantics or terminology, while temporary and unobtainable checks wear their own tile colours. The metadata surfaces — badges, flips, box counts, the Unsealed and Incomplete views and every record filter — simply don't exist there.
- The choice is made **only at creation and is permanent**. An existing dex can never convert to a checklist and a checklist can never convert back, so a metadata-rich dex can't be hollowed out by accident.

### Filters

- **The filter row is rebuilt.** The checkboxes, which could combine into nonsense like Hide Marked with Temp Only, are now one set of views: All, Missing, Temporary, Unsealed and Incomplete.
- A **Filters panel** narrows any view by generation, legendary/mythical, origin game, language, OT, location, ball, trained and favorite. Every value shows how many Pokémon it would leave under the search and the other filters (a value you've selected stays listed after its last Pokémon changes, so it can still be cleared), values within a facet combine with "or" and facets with "and", and active facets sit in the bar as chips that clear with a click, beside a running count.
- Generation and legendary/mythical read the species, so they also narrow Missing ("what am I still missing from Gen 9"); record facets can't match an empty slot, so the Missing view sets them aside until you switch back.
- Checklists get All, Missing and Temporary, plus the species facets.
- Search also matches nicknames, in either kana. It takes what an IME types — full-width digits and letters, half-width kana — and a leading #, ignores accents (flabebe) and stray spaces, and in a national dex matches only the number the tile shows. A new search, view or filter starts the list from the top.
- Tiles the popover works on stay in a filtered view until it closes, so marking one in Missing or finishing one in Incomplete doesn't pull it out from under the popover. The running count beside the filters leaves them out.
- Hovering an active option in the Filters panel deepens its accent, as the chips do, instead of swapping in the plain hover shade under its light text.

### Windows

- **Boxes are a locked 6×5 grid with every line drawn once.** Each tile used to draw its own four-sided border inside a framed box, so every inner line was two borders side by side and every edge a border plus the frame. At fractional scales those rounded unevenly, the tiles stopped short of the frame on the right, and below 100% zoom the sixth column wrapped into a sixth row. Now the grid draws its frame once and each inner line belongs to the tile right of or below it, so every line is one pixel at any scale and every fill meets it exactly. Selection and hover are rings inside the tile, and the per-status coloured and dashed tile edges are gone (stripes still mark temporary). Search results use the same grid, squared off with empty slots.
- **Pixel art holds together at 100% display scaling.** Sprites scaled by fractions only survived on a Retina screen: on Windows the ball icons lost chunks of their outlines and fills, and the landing logo's pixel grid blurred at every edge. Ball badges now draw the sprite's ball area at the size of the marks beside them, smooth while that's a reduction on screen and pixel-crisp once the dex scale enlarges it; the logo sits on a whole-pixel grid.
- The language tag is a fixed-size box centred in the space beside the number, so it no longer grows with the font's metrics, leans right, or peeks into the flipped OT and catch-date face. A sealed mon with no OT, whose number line doesn't flip, lays that line out across the whole tile like every other, so its tag lines up too.
- **An app icon of its own:** upstream's red-and-white pixel Poké Ball, the original of the landing page's logo, replaces Electron's default on the window, the taskbar, the exe and the installer, and is drawn pixel-crisp at 16, 24, 32, 48, 64, 128 and 256 px — every size at 100% and 200% display scaling. The exe also carries the app's name and version now. `yarn icon` regenerates it from the pixel grid in `scripts/generate-app-icon.mjs`.
- **The installer asks before adding shortcuts.** It's now a short wizard, not one click. A page, in English or Japanese, offers a Start menu and a desktop shortcut: on a first install neither is ticked, and a reinstall or upgrade starts from whichever you already have. The uninstaller removes whichever exist. It still installs just for you, with no admin prompt, and no longer leaves a 100 MB copy of itself in `%LOCALAPPDATA%\tsukamae-updater` (an electron-updater cache, and there's no updater).
- **No menu bar.** The File and View menus are gone on Windows; F11 still toggles fullscreen. macOS keeps its standard system menus, which carry Cmd+Q and the clipboard shortcuts.
- **The nav is the title bar.** The separate Windows title bar and its page name are gone: the nav moves the window when dragged and maximizes it on a double-click, and minimize, maximize and close sit at its right end in the theme's colours, with the nav's icons kept clear of them. They change colour in the same frame as the nav when the theme switches, rather than a frame or more ahead of its restyle, and fade with a modal's backdrop, in and out, rather than jumping. While a menu is open a click on the bar closes it instead of dragging the window. The page itself is held at 100% zoom (the dex has its own), so the bar is always exactly as tall as those buttons: a leftover 91% page zoom had left it 5px short of them.
- **The window opens at the size the layout is built for** — a 1400×900 page area, two boxes across and a full row down — on every platform, instead of losing the title and menu bars' height on Windows. Screens too small for that open maximized, and the window reopens where and how it was left, kept on-screen when that display has since shrunk or changed scaling.
- **The dex fits the window both ways.** It used to scale up by width alone, so a maximized or fullscreen window on a 16:9 monitor zoomed the boxes taller than the window, and a window a few pixels too narrow for two boxes dropped to one. It now scales, up or down, so two boxes span the width, but is never enlarged past what a whole row can show, with the first row centred under the header bar; whatever room that leaves fills with more boxes across. Only the boxes scale — the header bar keeps its size and position while zooming. A window too narrow for one box still switches to the list view.
- **Ctrl+scroll zooms the boxes** — also Ctrl+= and Ctrl+−, Ctrl+0 or Z to reset, pinch on a trackpad, Cmd on macOS — on top of the automatic fit: 100% is the fit, up to 200%. Zooming out fills the width with more boxes, with steps that land exactly on three and then four boxes across, where it stops. The level is remembered, and a small badge confirms each change.
- Scrollbars, which take up room on Windows, no longer push content off-centre: the box grid lines up with the search bar again, the popover's padding is even, and the modals scroll with the thin fading scrollbar instead of the grey system one.
- In a narrow window the nav's dex switcher gives way to the logo and the icons on the right instead of sliding under them, and the popover's buttons still work where a short window lifts it over the nav.
- Only one copy of the app runs at a time; opening it again focuses the existing window, so two copies can never race each other's saves.

### Performance

- **Flips and scrolling stay smooth with many boxes on screen.** Zoomed out to four boxes across, every flip used to stall the page for up to a quarter of a second while each tile's own nickname, OT and catch-date tracks were restyled and handed to the GPU and back, and scrolling redrew on every frame. The tiles no longer draw those lines: each row of boxes has one clipped strip per tile row and line, and every strip runs a single keyframe cycle on the compositor from a shared start, so a flip costs the page nothing and a box scrolling into view or a freshly sealed mon joins in step. The strips paint after every box's tiles, which keeps Chromium's layer bookkeeping small as boxes scroll in and out, and the dex scrolls on the compositor even at 100% display scaling.
- The flip back to the first face no longer jolts: faces are a whole number of screen pixels tall at any zoom, and the strips stay on the GPU between flips, so text never switches rendering mode at the end of a slide.
- The scroll-to-top button watches a marker instead of measuring the page on every scroll event.
- The box shine's moving layer is a 260px band instead of a 1404px one: about a fifth of the memory and raster work for the same motion.
- Each tile renders one layout instead of two, and its status buttons only mount once it has been hovered, so a full dex builds roughly a third of the DOM it used to.
- Search and filter results render in the background, keeping typing responsive on large result lists; the per-tile render delays are gone.
- Leaving a search or a filter fills the boxes back in a few a frame, below the first two, rather than building every tile in one stall.
- Switching theme no longer re-renders every tile, and unsealing's hold ring fills with CSS instead of re-rendering its tile every frame.
- The scrollbar fade no longer restyles every tile in the dex on each frame of its transition.
- Sprite rules are keyed so each icon only checks its own species' rules, instead of every shiny or Legends: Arceus rule.
- **A tile's change saves just that tile.** The main process keeps its own copy of the tracker, and a mark, an edit or a release sends only the records it changed, which it merges in before its debounced write; dex-level changes and imports still send everything. Before, every click sent the whole tracker across and re-serialized it on the page's thread.
- The bundled dataset is half its size: every Pokémon record carried upstream's whole game-family object — 13 distinct values repeated across ~9,000 records — when only the generation is read. The app bundle is a third smaller, and the dataset script keeps just the generation on future runs.

### Wording

- **Every string reviewed in both languages.** The same thing is now called the same thing everywhere: Create Dex (not New Dex, Create New Dex and Create a New Dex), Export Data and Import Data, Add Game, Not my game, Which Game. Japanese follows the games' own terms and one style: ソフト for a game throughout (自分のソフト for My Games), おや for OT, 性別不明, 個体値3V以上, あり／なし for yes/no answers, 未入力 for incomplete, 確定済み in box counts, キョダイマックスのすがた and ミアレ図鑑, full-width brackets and 、 between list items, and no space between Japanese and Latin text or numbers (記録済み760、残り320).
- Text the app built itself now follows the language too: the progress line, the box titles and sealed counts (確定済み6/30, 001〜030), filter chips listing several values, the stale pin's list of fields, the dex picker's totals, a game's label (バイオレット（ENG）), the date field's placeholder, the timeline's busiest month (2017年2月) and the empty-view messages, which now include Unsealed and Incomplete.
- The window's title is "tsukamae" (after the open dex's name), in both languages, rather than an English tagline. The gear menu, the date picker, the clear-search button and the scroll-to-top button have labels.
- English game names read as the dexes' own do: "Scarlet & Violet", not "Scarlet/Violet".

### Data safety

- **A file that isn't an export can't wipe your data.** Import used to take any JSON object — the window-state file beside your data, a 1.x export — and replace every dex and game with nothing. It now refuses anything that isn't a tsukamae 2.0 export before asking, and an import that fails partway changes nothing.
- **Data that can't be read is never overwritten.** A `dex_data.json` that couldn't be read (a hand edit with a stray character, a file held by antivirus) used to open as an empty tracker, and the next click saved that emptiness over it. It now shows an error and saves nothing; a byte-order mark left by Notepad is simply skipped. JSON that isn't tracker data (a 1.x file copied into place, a hand edit that broke its shape) is refused the same way rather than opening as an empty tracker. The error screen keeps the nav, whose Import can restore an export in the file's place; that first save copies the unreadable file aside to `dex_data.unreadable.json` before replacing it, numbered rather than over an earlier one.
- **A save that can't reach the disk says so.** A banner under the nav stays up until a save goes through, pointing at Export; before, the failure was only in a log. Import waits for its file to be written and reports a failure instead of reloading the old data, and failing saves no longer queue up behind each other.
- Loading keeps no more than Import accepts — a record with a status 2.0 doesn't know, or a game in My Games that isn't one, is dropped — so any export can be imported again. A 1.x export is now refused even when no slot in it was Locked.
- Saves reach the disk before they replace the old file, so a power cut can't leave it empty, and a file briefly held by antivirus, the search indexer or a backup tool is retried instead of the save being dropped.
- An edit still being typed as the window closes is kept, and shutting Windows down or logging off with the app open still saves it, along with the window's placement; a save already in flight can no longer land after it with older data.

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
- The Theme Preview button and Seal FX toggle switch off by themselves in production builds, instead of relying on a hand-flipped constant.
- `yarn start:fresh` and `yarn electron:dev:fresh` work on Windows (they used POSIX-only shell syntax), the dev server listens on localhost only (no firewall prompt), and source maps no longer ship in the installer.
- `yarn electron:dev` no longer prints Node's `util._extend` deprecation warning on every run: concurrently is on v10, which dropped the old spawn helper that called it.
- Form padding and icon rules left over from native selects are gone, so modal dropdowns place their chevron like the popover's.
- The per-status tile edge colours left the palette along with the edges themselves.

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
