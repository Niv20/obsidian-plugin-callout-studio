# Callout Studio plugin API

Callout Studio exposes a small, read-only API so other Obsidian plugins can find
out which callout types the user has available and react when that list changes.

It answers three questions — *which callouts exist*, *what are they called*, and
*tell me when that changes*. It deliberately does not write markdown for you:
inserting a callout is one line of text, and every plugin wants to place it
differently.

**API version: 1** · Plugin id: `callout-studio`

---

## Getting the handle

```ts
import { Plugin } from "obsidian";
import type { CalloutStudioApi } from "./calloutStudio";

function getCalloutStudio(app: App): CalloutStudioApi | null {
	const plugin = app.plugins.plugins["callout-studio"];
	const api = plugin?.api as CalloutStudioApi | undefined;
	return api?.version ? api : null;
}
```

Two things to be aware of:

* **Ask under `onLayoutReady`.** Callout Studio assigns `api` late in its own
  `onload()`, so a plugin that reads it during its own `onload()` may find
  `undefined` depending on load order.
* **The plugin may not be installed.** Always handle `null` — do not assume the
  user has Callout Studio.

```ts
export default class MyPlugin extends Plugin {
	async onload() {
		this.app.workspace.onLayoutReady(() => {
			const api = getCalloutStudio(this.app);
			if (!api) return; // not installed, or too old
			this.buildCommands(api.getCallouts());
		});
	}
}
```

---

## Type declarations

No `.d.ts` is published, so copy this into your own project. Callout Studio is
under a permissive 0BSD-style licence — copying is fine, no attribution
required.

```ts
export interface CalloutStudioApi {
	readonly version: number;
	getCallouts(): readonly Callout[];
	getCalloutsDetailed(): readonly CalloutDetails[];
	getCallout(id: string): Callout | undefined;
	onChange(callback: () => void): () => void;
}

export interface Callout {
	readonly id: string;
	readonly title: string;
	readonly aliases: readonly string[];
}

export interface CalloutDetails extends Callout {
	readonly color: string; // #rrggbb, for the theme mode on screen now
	readonly colorLight: string;
	readonly colorDark: string;
	readonly bgColorLight?: string;
	readonly bgColorDark?: string;
	readonly textColorLight?: string;
	readonly textColorDark?: string;
	readonly icon: CalloutIconInfo;
	readonly hideIcon: boolean; // check before drawing `icon`
	readonly foldable: boolean;
	readonly defaultFolded: boolean;
	readonly builtIn: boolean;
	readonly source: "builtin" | "user" | "fallback" | "theme" | "plugin";
	readonly externalStyle: boolean; // Callout Studio emits nothing for it
	readonly themeStyled: boolean;   // ...because the active theme owns it
}

export interface CalloutIconInfo {
	readonly pack: string;
	readonly name: string;
	readonly style?: string; // Material Symbols only
	readonly weight?: number; // Material Symbols only
}
```

Everything the API returns is frozen. Holding onto a result is safe, and you
cannot corrupt the plugin by writing to one.

---

## Methods

### `getCallouts()`

Every callout the user can currently write, sorted by title in their interface
language.

```ts
for (const callout of api.getCallouts()) {
	console.log(callout.id, callout.title, callout.aliases);
}
// "abstract"  "Abstract"  ["summary", "tldr"]
// "bug"       "Bug"       []
// "danger"    "Danger"    ["error"]
// …
```

### `getCalloutsDetailed()`

The same list with colours, icon and fold behaviour attached. Use this only if
you draw callouts yourself — for naming them in a command or a dropdown,
`getCallouts()` is enough.

```ts
const [first] = api.getCalloutsDetailed();
first.color; // "#00bfbc"  (already resolved to the active theme mode)
first.icon; // { pack: "lucide", name: "clipboard-list" }
first.foldable; // false
```

Check `hideIcon` before you draw `icon`. A callout the user set to render with
no icon still reports one — that is deliberate, so the choice stays undoable —
but Callout Studio paints nothing for it, and drawing the stored icon would not
match what the vault shows.

```ts
if (!callout.hideIcon && callout.icon.pack === "lucide") {
	setIcon(el, callout.icon.name);
}
```

### `getCallout(id)`

Look up one callout. Returns `undefined` when nothing matches — it never
substitutes a default.

The lookup is forgiving in the three ways Obsidian itself is:

```ts
api.getCallout("abstract"); // by id
api.getCallout("tldr"); // by alias        → the abstract callout
api.getCallout("WARNING"); // case-insensitive
api.getCallout("my-callout"); // dashed spelling of the id "my callout"
api.getCallout("note|purple"); // `|metadata` is stripped → the note callout
api.getCallout("nope"); // undefined
```

### `onChange(callback)`

Fires whenever any callout is added, removed or edited — including colour and
icon tweaks. The callback receives no arguments and no diff; re-read the list.

**Subscriptions are not cleaned up for you.** Keep the returned function and
call it when your plugin unloads.

```ts
const unsubscribe = api.onChange(() => this.rebuildCommands());
this.register(unsubscribe);
```

**Treat it as a hint, not a precise event.** A single user action can fire it
more than once — editing the callout that other manually discovered callouts mirror
emits one event for the edit and another for the rows it restyled — and most
events change nothing you care about, since a colour tweak fires it just as a
rename does. If reacting is expensive, diff against what you last saw:

```ts
let known = "";

const resync = () => {
	const ids = JSON.stringify(
		api.getCallouts().map((c) => [c.id, c.title])
	);

	if (ids === known) return; // colour tweak, nothing to rebuild
	known = ids;
	this.rebuildCommands();
};

this.register(api.onChange(resync));
```

---

## Which callouts you get

The list contains:

* **All of Obsidian's built-in types** — `note`, `abstract`, `info`, `todo`,
  `tip`, `success`, `question`, `warning`, `failure`, `danger`, `bug`,
  `example`, `quote` — whether or not the user has customized them. Callout
  Studio lets users restyle the built-ins, so they belong in any list you show.
* Everything the user created themselves.
* Manually discovered theme types and saved types from another plugin.
* All manually discovered callouts, including uncustomized or unused types.

Callouts Callout Studio does not style **are** included — whether because the
active theme owns them or because the user styles them in their own CSS. It
stops painting them, but the id is still perfectly valid to write into a note.
Manually discovered types declared by the active theme are listed without
Callout Studio painting over them.

### `externalStyle` and `themeStyled`

Two booleans about the same thing at two widths, and the difference matters if
you draw callouts yourself.

| Member | True when |
|---|---|
| `externalStyle` | Callout Studio emits **no CSS** for this callout. |
| `themeStyled` | ...and the reason is that the **active theme** supplies or restyles it. |

`themeStyled` implies `externalStyle`. The gap between them is a callout the
user has handed to their own CSS snippet.

`themeStyled` also means the callout has **only** its block form: Callout
Studio's own Heading and Inline syntaxes are not rendered for a callout the
theme supplies, so `## [!id]` and a mid-line `[!id]` stay as literal text until
the theme stops claiming the id.

**When `externalStyle` is true, the colours and icon on this object are what is
*stored*, not what renders.** Do not draw them. There is no API for reading back
what the theme actually draws; if you need that, render a real callout and let
the cascade do it, which is what Callout Studio itself does.

Both report the **resolved** answer. Theme ownership in particular is derived
from the active theme's stylesheet and is recorded nowhere on the definition, so
do not try to work it out from a definition yourself — and expect it to change
when the user changes theme.

`themeStyled` was added after `externalStyle`; feature-detect it before relying
on it, and keep reading `externalStyle` if that is all you need — it is not
going away.

---

## Writing a callout into a note

The API does not do this for you. The header format is:

```
> [!<id>]<foldMark> <title>
```

where `foldMark` is:

| `foldable` | `defaultFolded` | `foldMark` |
| ---------- | --------------- | ---------- |
| `false`    | —               | `""`       |
| `true`     | `false`         | `"+"`      |
| `true`     | `true`          | `"-"`      |

```ts
function calloutHeader(callout: CalloutDetails, title?: string): string {
	const fold = callout.foldable ? (callout.defaultFolded ? "-" : "+") : "";
	return `> [!${callout.id}]${fold} ${title ?? callout.title}`;
}
```

### Always write the title

Colours and the icon are applied by CSS keyed on the rendered
`data-callout` attribute, so they follow the user's settings no matter who wrote
the markdown. **The title text does not.** Callout Studio deliberately leaves a
regular callout's title alone — it is Obsidian's own DOM — so Obsidian derives
the visible title from the id whenever the header carries no title text.

That matters because Callout Studio lets users rename the built-ins:

| You write        | User renamed `note` to `Memo` | Shown  |
| ---------------- | ----------------------------- | ------ |
| `> [!note]`      | yes                           | `Note` |
| `> [!note] Memo` | yes                           | `Memo` |

So pass `title` through rather than letting Obsidian generate one, or the user's
own naming silently disappears.

### Other details that trip people up

* **Ids may contain spaces.** `[!my callout]` is valid, and Obsidian renders it
  and `[!my-callout]` to the same `data-callout="my-callout"`. Write `id`
  through verbatim; don't slugify it.
* **Obsidian splits the header at the first `|`.** Everything after it is
  metadata, not part of the type — `> [!note|purple]` is the `note` callout
  carrying the metadata `purple`. No Callout Studio id ever contains a `|`, so
  you can append your own metadata safely.

---

## Stability

Version `1` guarantees the members above keep their names, signatures and
meaning. New members may be added without bumping the version, so feature-detect
those:

```ts
if (typeof api.somethingNew === "function") { … }
```

The plugin id `callout-studio` is permanent — it is the vault folder name and
the community-plugin registry key, so it can never change.

---

## What is deliberately not exposed

| Not exposed                   | Why, and what to do instead                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creating or editing callouts  | Keeping this read-only removes a whole class of conflicts between plugins. Ask the user to create the callout in Callout Studio's settings.                                                                                       |
| Opening its modals            | Its icon picker and callout editor are internal UI, not an integration point.                                                                                                                                                     |
| Icon artwork                  | Only `pack: "lucide"` names are usable outside the plugin — pass `icon.name` to Obsidian's `setIcon()`. Other packs need artwork Callout Studio downloads and caches for itself.                                                  |
| Wrapping/unwrapping selection | Every plugin scopes this differently (lines vs. selection, titles kept or dropped). If you want Callout Studio's exact frontmatter-skipping, fence-aware version, copy `src/editor/CalloutBlockTools.ts` — the licence allows it. |

---

## Questions

Open an issue at
https://github.com/Niv20/obsidian-Plugin-Callout-Studio/issues.
