# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Legend In The Mist** (`mist-engine-fvtt`) is an official Foundry VTT v14 game system. It implements the *Legend in the Mist* RPG on top of Foundry's ApplicationV2 API.

- Foundry installation: `C:\dev\foundry\FoundryVTT-WindowsPortable-14.363`
- Foundry data root: `C:\dev\foundry\data_v14`
- System lives at: `C:\dev\foundry\data_v14\Data\systems\mist-engine-fvtt`

## Commands

```bash
npm run build          # Compile SCSS → css/mist-engine-fvtt.css (one-shot)
npm run watch          # Compile SCSS with source maps, watch for changes
npm run pack-compendium    # Pack source JSON files into Foundry compendium packs
npm run unpack-compendium  # Unpack compendium packs into source JSON files
```

**CSS rule**: Never edit `css/mist-engine-fvtt.css` directly. Always edit in `src/scss/` and rebuild.

## Architecture

### Entry point

`module/mist-engine-fvtt.mjs` — registers all document classes, data models, sheet classes, and key bindings in the `init` hook. Calls `setupHooks()` at the top level (outside any hook) so it runs immediately.

### Document / Data model layers

- **`module/documents/`** — `MistEngineActor` and `MistEngineItem`: thin document wrappers.
- **`module/data/`** — DataModel classes per actor/item type (v14 system data API). Actor types: `litm-character`, `litm-npc`, `litm-fellowship-themecard`, `litm-journey`. Item types: `themebook`, `backpack`, `scene-data`, `quintessence`, `shortchallenge`, `themekit`.

### Sheets

All sheets extend `MistEngineActorSheet` (`module/sheets/actor-sheet.mjs`), which uses `HandlebarsApplicationMixin(ActorSheetV2)`. Sheets use `static PARTS` to declare template fragments and `static DEFAULT_OPTIONS.actions` for declarative event handlers. `form.submitOnChange: true` is set everywhere — no manual save.

The primary character sheet is `MistEngineLegendInTheMistCharacterSheet` (`litm-character-sheet.mjs`).

`MistEngineCompactCharacterSheet` (`litm-character-compact-sheet.mjs`) is a narrow variant of it, registered as a second selectable sheet for `litm-character`. It subclasses the full sheet and changes exactly two things: the `header` PART (portrait next to the roll buttons instead of the reserved artwork column; no custom-background buttons, no font-colour picker) and `_applyCustomBackground()`, which it overrides to a no-op. Everything else is inherited.

Its whole layout hinges on the `--litm-premium-left-margin` custom property (default `300px`, `utils/_variables.scss`). That one value drives the reserved artwork column in four places — the tab nav (`components/_tabs.scss`), the card grid (`.character-sheet-divider .right-side`), the biography/notes tabs (`sheets/_shared.scss`) and `.col-character-name` (`components/_forms.scss`). The compact sheet redefines it to `0px` on its own root, which neutralises all four via the cascade. Prefer that over adding per-selector overrides.

The compact sheet runs on the dark `assets/backgrounds/default_sheet_background.webp` backdrop, so it keeps the light `--litm-color-accent` text of the base rules and trims `.window-content` padding to `4px` (the full sheet uses `16px`). That padding is load-bearing: at the 820px window width it is exactly what lets the edit-mode grid fit three 260px columns instead of two. Widening the padding or narrowing the window drops a column.

Both sheets carry a `static ALTERNATE_LAYOUT` descriptor; the shared `_getHeaderControls()` turns it into a header-menu entry that writes the other sheet's registration id to the `core.sheetClass` flag. Foundry's `_onSheetChange` then swaps the window. Note that ApplicationV2 merges `DEFAULT_OPTIONS` along the inheritance chain (arrays concatenated, objects merged) but does **not** merge `static PARTS` — a subclass must spread the parent's explicitly.

Handlebars templates live under `templates/` with subdirectories per sheet/app.

### Apps (non-sheet windows)

Standalone ApplicationV2 windows in `module/apps/`. Notable:

- **`MistSceneApp`** (`scene-app.mjs`) — singleton tracker for scene tags and characters. Always access via `MistSceneApp.getInstance()`. Before calling `render()`, check `instance.rendered && !instance.minimized` to avoid un-minimizing it. Live updates are broadcast via the `mistengine:sceneAppUpdated` socket event.
- **`DiceRollApp`** — custom dice roller.

### Hooks and ProseMirror extensions (`module/lib/hooks.mjs`)

All Foundry hook registrations live here. The two most complex sections:

**`getProseMirrorMenuItems`** — adds inline toolbar buttons (tag, status, limit, weakness). Commands follow the `(state, dispatch) => bool` signature.

**`getProseMirrorMenuDropDowns`** — adds dropdowns (Icons, Fake Headings, Textframes). Commands follow the `() => void` zero-arg signature using a `menu.view` closure.

#### Critical ProseMirror / Foundry schema facts

Foundry's schema (see `FoundryVTT-WindowsPortable-14.363/App/resources/app/common/prosemirror/schema/`) augments every node and mark via `AttributeCapture`, adding two attrs:
- `attrs.classes` (string) — stores the element's CSS class list
- `attrs._preserve` (object) — stores all other preserved HTML attributes

**Marks** (e.g. `schema.marks.mark` → renders as `<mark>`):
- Set CSS class via `_preserve`: `markType.create({ _preserve: { class: "my-class", "data-foo": "bar" } })`

**Nodes** (e.g. `schema.nodes.icon` → renders as `<i>`):
- `schema.nodes.icon` matches empty `<i class="...">` elements only
- Set CSS class via `classes`: `iconNodeType.create({ classes: "fa-solid fa-circle-question" })`
- To place an icon node inside a `<mark>` wrapper, pass the mark in the node's marks array: `iconNodeType.create({ classes: "..." }, null, [someMark])`. ProseMirror's DOM serializer merges adjacent nodes sharing the same mark into one wrapper element.

**Dropdown toggle blocks** use `menu._toggleBlock(nodeType, foundry.prosemirror.commands.wrapIn, { attrs: { _preserve: { class: "..." } } })` to wrap/unwrap block-level divs.

**Block type changes** (fake headings): use `foundry.prosemirror.commands.setBlockType(paragraphNode, { _preserve: { class: "fh1" } })` directly — do not use `_toggleBlock` for this.

### Tag/status markup system (`module/lib/tag-status-text-helper.mjs`)

Converts shorthand like `[tag]`, `[/w weakness]`, `[/s status]`, `[/l limit-3]` into draggable `<mark>` HTML elements. The markup token reference is at the top of that file. Output format:

- Tag: `<mark class="draggable tag" draggable="true" data-type="tag" data-name="...">`
- Weakness: `<mark class="draggable weakness" ...><i class="fa-light fa-angles-down"></i>NAME</mark>`
- Limit with value: `<div class="limit-inline"><mark ...>NAME</mark><span class="limit-value">VALUE</span></div>`

### Adapters (`module/lib/`)

- `FloatingTagAndStatusAdapter` — static methods for managing floating tags/statuses on actors and the scene.
- `StoryTagAdapter`, `PowerTagAdapter`, `ThemeKitAdapter` — similar static-method adapters for their domains.

### SCSS structure

```
src/scss/
  mist-engine-fvtt.scss  ← root import file
  utils/                 ← variables, colors, mixins, typography
  global/                ← styles not scoped to .mist-engine (journal, editor, window, etc.)
  components/            ← scoped to .mist-engine + standalone app styles
  sheets/                ← per-sheet styles, scoped to .mist-engine
```

Key SCSS variables (defined in `src/scss/utils/_colors.scss`):
- `$c-text-redish: #742a2b` — heading color
- `$c-brown: #724a32` — general brown
- `$c-icon-brown: #734a33` — icon fill color
- `$font-primary`, `$font-written`, `$font-written-brush` — the three main typefaces

Journal-specific styles are in `src/scss/global/_journal.scss`, scoped inside `.journal-entry-content`. The `@include tag-mark-def` mixin (from `_mixins.scss`) provides the colored mark styles for tags, statuses, weaknesses, and limits.

All sheet styles must live inside the `.mist-engine { }` block in `mist-engine-fvtt.scss` (either inline or via `@import`).

### Compendium packs

Source data lives under `packs/`. Use `npm run pack-compendium` / `npm run unpack-compendium` to convert between Foundry's binary format and the source JSON files.
