# The Another site target

Until 2026-11-16, **Publish to the web** had a fourth tab, **Another site**.
It wrote one file, `callout-studio-web.js`, to the top of the vault, for any
site that is not Obsidian Publish, Quartz or Digital Garden: the user copied
it to their site and loaded it with a `<script>` element. It was taken out
because hardly anyone publishes a vault that way. Its tab made every visitor
to the page read one more choice, and its block-callout stylesheet was a guess
about sites nobody had looked at.

This page is for whoever brings it back. The code was never released, so it
is described here in full rather than pointed at.

## What is still there

Most of what the target used is still used by Obsidian Publish, so bringing it
back is mostly joining existing pieces:

- **The renderer** (`src/web/core.ts`) and **the browser host**
  (`src/web/browser.ts`), which `publish.js` runs. The host still turns the
  whole `<body>` on a page with no content root, and still watches for content
  that arrives later.
- **`browserScript(data)`** in `src/manager/web/targets.ts`: the core, the
  browser host and one `init` call, in one function so the page gains no
  global of ours. Publish calls it with the stylesheet taken out.
- **A file of our own** (`kind: "whole"`, a header comment with a
  fingerprint), which Quartz's `index.js` still uses, and `fileProse` for the
  header.
- **`serializeWebData`**, which writes `</` as `<\/`, so the data cannot close
  a `<script>` element it is inlined in.

## What went, and where it would go back

### The target (`src/manager/web/targets.ts`)

- `"script"` in `WebTargetId` and last in `WEB_TARGET_IDS`.
- `export const SCRIPT_FILENAME = "callout-studio-web.js";`
- `case "script": return [SCRIPT_FILENAME];` in `targetPaths`, and
  `case "script": return scriptFiles(data);` in `targetFiles`.
- `scriptFiles`, which is one file:

```ts
{
	path: SCRIPT_FILENAME,
	kind: "whole",
	slot: "script",
	prose: fileProse(
		"file",
		[
			"Everything a web page needs to show your callouts as you set them up:",
			"the renderer for heading callouts (## [!tip] Title) and inline callouts",
			"([!warning], [!note]{text}), its styles, and your callouts. It runs in",
			"the reader's browser. Its styles also give block callouts (> [!tip])",
			"your colors and icons, on a site that marks them up as Obsidian does:",
			".callout[data-callout]. Callout Studio wrote it, from Settings →",
			"Callout Studio → Publish to the web.",
			"",
			"Load it on every page that shows your notes:",
			`  <script src="${SCRIPT_FILENAME}" defer></script>`,
		],
		["After making changes, copy this file to your site again.", HARD_REFRESH],
		[
			"- Don't edit this file.",
			...EDITED.map((line) => `  ${line}`),
			"- Don't rename or move it in your vault. Callout Studio updates it only",
			"  here, under this name.",
			...NOT_A_BACKUP,
		],
		[
			"- Copy it to your site under any name, in any folder.",
			"- Delete it when you no longer need it. Callout Studio does not write",
			"  it again by itself.",
			"- For Obsidian Publish, Quartz or Digital Garden, choose that service",
			"  under Publish to the web instead. Each has a better way than this file.",
		],
	),
	// The stylesheet stays in: there is no publish.css beside this file.
	body: browserScript(data),
}
```

- `["script", {}]` at the end of `REFRESHES` in
  `src/manager/web/autoUpdate.ts`, so the file is kept up to date like the
  others.
- `script: "generic"` in `BLOCK_SITE` in `src/manager/web/webData.ts`.
  `buildWebBundleData`'s `target` had `"script"` as its default. It has none
  now, and should keep none.

### The browser host (`src/web/browser.ts`)

The script carried the stylesheet, so `init` injected it:

```ts
/** Id of the injected `<style>`, so a second copy of the script adds none. */
export const STYLE_ELEMENT_ID = "callout-studio-web";

// first thing in `start()`:
if (data.css && !doc.getElementById(STYLE_ELEMENT_ID)) {
	const style = doc.createElement("style");
	style.id = STYLE_ELEMENT_ID;
	style.textContent = data.css;
	doc.head.appendChild(style);
}
```

The stylesheet writes dark mode against a `.theme-dark` ancestor. Publish and
Digital Garden set that class themselves. Quartz keeps its mode in
`<html saved-theme="dark">` instead, so for a Quartz site that loaded the
script by hand, the host mirrored the attribute onto the class, once in
`start()` and then on every change:

```ts
export function syncQuartzTheme(doc: Document): void {
	const root = doc.documentElement;
	const saved = root.getAttribute("saved-theme");
	if (saved === null) return;
	root.classList.toggle("theme-dark", saved === "dark");
}

// in `start()`, after the first sweep:
syncQuartzTheme(doc);
new MutationObserver(() => syncQuartzTheme(doc)).observe(doc.documentElement, {
	attributes: true,
	attributeFilter: ["saved-theme"],
});
```

A site that marks dark mode some other way got the light colours.

### Block callouts on an unknown site (`src/manager/css/webBlockCSS.ts`)

A fourth `WebBlockSite`, `generic`. Nothing is known about such a site's
variables, so instead of pointing one at `--cs-accent` it set what Obsidian
derives from one:

- in `SITE_ACCENT`:

```ts
generic: [
	"  background-color: color-mix(in srgb, var(--cs-accent) 10%, transparent);",
	"  border-color: color-mix(in srgb, var(--cs-accent) 25%, transparent);",
],
```

- in `SITE_COLOUR`, `generic: null`: an untouched built-in got no
  `--cs-accent` line, since the site has no name for its colour. The type was
  `Record<WebBlockSite, string | null>`, and `webBlockCSS` wrote the rule only
  when the value was not `null`.
- in `lookRules`, the title and its icon coloured directly, after the dark
  rule:

```ts
if (site === "generic") {
	parts.push(
		rule(`${list("", " > .callout-title")},\n${list("", " > .callout-title > .callout-icon svg")}`, [
			"  color: var(--cs-accent);",
		]),
	);
}
```

- **Align content with title** was off there
  (`gs.alignContentWithTitle && site !== "generic"`): the title's geometry is
  not known. `globalRules` writes nothing for it either, since it only knows
  Publish's, Digital Garden's and Quartz's.

And one rule in `CSSInjector.generateWebBlockCSS`, for a callout that only its
metadata coloured (`[!foo|pink]`, where `foo` is not defined): it has no rule
of its own to colour its title, so one rule did it for every metadata colour.
It needs `metadataWordSelector` (from `css/metadataColorCSS.ts`) and
`entryWords` (from `utils/calloutMetadata.ts`):

```ts
const title = `${".callout".repeat(WEB_BLOCK_WEIGHT)}[data-callout]${metadataWordSelector(entries.flatMap(entryWords))} > .callout-title`;
const metadataTitle =
	site === "generic" && entries.length > 0
		? `${title},\n${title} > .callout-icon svg {\n  color: var(--cs-accent);\n}`
		: "";
return [blocks, metadata, metadataTitle].filter((part) => part.trim()).join("\n\n");
```

### The page (`src/settings/declarative/webPage.ts`)

Last of the tabs, with the `globe` icon. Its first step said where the file
is; its second had two rows, one with a line to copy:

```ts
case "script":
	return [
		{ text: t("web.stepScript1") },
		{ text: t("web.stepScript2"), code: `<script src="${SCRIPT_FILENAME}" defer></script>` },
	];
```

It drew its callouts in the browser, so its first note in **Good to know** was
`web.howBrowser`, and it had a sentence that the file list does not show its files, as Publish does. **Good to
know** and `web.howBrowser` were removed later the same day (see
[Declarative settings](26-declarative-settings.md)). A restored target gets
that sentence under its first step's sentence by itself, as Publish does: `drawWrite` leaves it out only for the garden. The offer at
the top of the settings never named it: nothing in a vault points at another
site.

The strings, in `src/i18n/en.ts` (they were never translated):

| Key | English |
| --- | --- |
| `web.serviceScript` | Another site |
| `web.filesScript` | The file {{file}}, in the top folder of your vault. |
| `web.stepScript1` | Copy callout-studio-web.js to your site. |
| `web.stepScript2` | Load it on every page that shows your notes: |
| `web.againScript` | Callout Studio rewrites the file by itself. Copy it to your site again. |

`export.formatWebDesc` (now `web.desc`, the line under the page's row) ended
"…on Obsidian Publish, Quartz, Digital Garden or another site."

### The user guide (`docs/user-guide/19-publish-to-the-web.md`)

A row in the opening table (*In the reader's browser* / *See the text you
typed* / *Copy one file to your site again.*), the tab in **Open the page**, a
section of its own, and two limitations: a reader with JavaScript off sees the
text as typed, and printing shows the site's own block-callout icon. The
section said that block callouts get the user's colours and icons only on a
site that marks them up as Obsidian does: an element with the class `callout`
and a `data-callout` attribute, holding a `callout-title`, a `callout-icon`
and a `callout-content`. A site that leaves `> [!tip]` as a plain quotation
shows it as one. The picture of the page (`assets/user-guide/web-setup.svg`)
showed four tabs.

### Tests

The suites used the script as their sample target, because it is a single
file. Those cases now run on Quartz or Publish. These were the script's own:

- the script, run on a plain page with no `window.publish`, injects the
  stylesheet once, turns what is there and what arrives later, and starts once
  when loaded twice (`webExport.test.ts`, which now runs `publish.js` the same
  way, without the stylesheet);
- `generic`: no `--callout-*` variable, the fill at 10% and the frame at 25%
  of the accent, the title rule, no content alignment, no line for an
  untouched built-in, and the metadata title rule (`webBlockCSS.test.ts`);
- `syncQuartzTheme` turning `.theme-dark` on and off with the attribute
  (`webRuntime.test.ts`).

## Before bringing it back

A device that used the tab remembers `service: "script"` in its local storage
(`DeviceLocalStore.webExport`). The page now opens with nothing chosen there
(`webPage.test.ts` holds it), so the tab would simply come back. A
`callout-studio-web.js` already in a vault stopped being kept up to date when
the target went. It is a file of ours with a fingerprint, so a restored target
treats it as its own again: an automatic refresh replaces it where this
device's memory of the file still matches it (`manager/web/fileMemory.ts`),
and **Update now** does everywhere else.
