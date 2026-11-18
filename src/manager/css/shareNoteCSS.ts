/**
 * manager/css/shareNoteCSS.ts — block callout icons on a page shared with the
 * Share Note plugin.
 *
 * Share Note (`share-note`, by Alan Grainger) does not render Markdown. It
 * takes the note's reading view as it stands — the DOM and every stylesheet in
 * `document.styleSheets` — and serves that as a page. So heading and inline
 * callouts, colours, backgrounds, metadata colours and the `::after` icons of
 * `iconOverrides.ts` all arrive as they are, with nothing to export.
 *
 * One thing is rebuilt on the way: a block callout's icon. Share Note empties
 * the first `<svg>` in `.callout-icon`, keeps only a name —
 * `data-share-note-lucide="<name>"`, taken from the drawing's `lucide-<name>`
 * class, else from the `--callout-icon` of the first rule naming that
 * `data-callout`, else `pencil` — and its server draws the name with its own
 * copy of Lucide. That copy is old (0.287.0, of October 2023). A name Lucide
 * gave an icon later is not in it, and the placeholder stays an empty `<svg>`:
 * no icon at all. Obsidian's own Lucide is newer, so these are exactly the
 * names a picker offers today (`circle-help`, `triangle-alert`, `house`…). So
 * is a bare `pencil`, Obsidian's internal drawing, whose class says
 * `lucide-edit-3` (the untouched `[!note]` is `lucide-pencil` and is fine).
 *
 * ## The rules key on the name, not on the callout
 *
 * Every rule here is `svg[data-share-note-lucide="<name>"]:empty`: a
 * placeholder Share Note's Lucide could not fill. It draws the drawing
 * Obsidian drew under that name, as a mask in the icon's own colour. Keying
 * on the name is what keeps the page honest about whose icon it is: the name
 * is read off what Obsidian actually painted, so an unknown callout a theme or
 * snippet gives its own icon carries the theme's name, and a name Share Note
 * can draw is never matched (`:empty`) and stays Share Note's.
 *
 * A fallback icon that is not Lucide's has no name to carry, so
 * `fallbackIcon.ts` gives the drawing it paints one,
 * {@link SHARE_NOTE_FALLBACK_CLASS}. Share Note reads it like any other, and
 * {@link SHARE_NOTE_FALLBACK_NAME} draws the fallback's artwork.
 *
 * ## Inert everywhere else
 *
 * `body.share-note-plugin` is the class Share Note writes on a shared page's
 * `<body>`, and nothing in a vault has it, so none of this applies inside
 * Obsidian or its PDF export. The rules are written only while Share Note is
 * on in the vault ({@link isShareNoteEnabled}) — only such a device can share
 * a page — and `:where()` keeps the scope weightless.
 */
import type { App } from "obsidian";
import { getIcon } from "obsidian";
import { bareLucideName } from "../../icons/lucideId";
import { standaloneSvg, svgToDataUri } from "../../icons/svg";
import { cssAttrValue } from "../../utils/calloutSelector";

/** Share Note's id in Obsidian's community plugin list. */
export const SHARE_NOTE_PLUGIN_ID = "share-note";

/** The class Share Note puts on a shared page's `<body>`. */
export const SHARE_NOTE_BODY_CLASS = "share-note-plugin";

/** The name the painted fallback drawing goes by on a shared page. */
export const SHARE_NOTE_FALLBACK_NAME = "callout-studio-fallback";

/** The class that gives it that name: Share Note reads the first `lucide-` class. */
export const SHARE_NOTE_FALLBACK_CLASS = `lucide-${SHARE_NOTE_FALLBACK_NAME}`;

type AppWithPlugins = App & { plugins?: { enabledPlugins?: Set<string>; plugins?: Record<string, unknown> } };

/**
 * Whether Share Note is switched on in this vault: in Obsidian's list of
 * enabled plugins, or loaded. Both, because Obsidian adds a plugin to the list
 * only once it has loaded — after its stylesheet went into the page, which is
 * when {@link watchShareNote} asks — and on the way out drops it from both
 * before its stylesheet leaves.
 */
export function isShareNoteEnabled(app: App): boolean {
	const plugins = (app as AppWithPlugins).plugins;
	return (
		plugins?.enabledPlugins?.has(SHARE_NOTE_PLUGIN_ID) === true || plugins?.plugins?.[SHARE_NOTE_PLUGIN_ID] != null
	);
}

/**
 * Call `onChange` when Share Note is switched on or off. Obsidian says nothing
 * when a plugin is, but every plugin with a stylesheet puts it in the page's
 * `<head>` on the way in and takes it out on the way out — Share Note has one —
 * so a change to the head's own children is when to look again. Those are
 * rare (a plugin, a theme or a snippet coming or going), and the look is a
 * set lookup. Without it a vault where Share Note was just switched on shared
 * a note before the next pass wrote these rules, and Share Note keeps the
 * stylesheet it uploads first until **Force re-upload** replaces it.
 *
 * Returns the function that stops watching.
 */
export function watchShareNote(app: App, doc: Document, onChange: () => void): () => void {
	let on = isShareNoteEnabled(app);
	const observer = new MutationObserver(() => {
		const now = isShareNoteEnabled(app);
		if (now === on) return;
		on = now;
		onChange();
	});
	observer.observe(doc.head, { childList: true });
	return () => observer.disconnect();
}

/** One drawing, under the name Share Note gives it. */
export interface ShareNoteIcon {
	name: string;
	svg: string;
	/** A picture of the user's own that keeps its colours: drawn as it is, not as a mask. */
	keepsColors?: boolean;
}

/** The `lucide-<name>` class on a drawing's root, or `null`. */
function lucideClassName(markup: string): string | null {
	const open = /^<svg\b[^>]*>/.exec(markup.trim())?.[0] ?? "";
	const classes = /\sclass="([^"]*)"/.exec(open)?.[1] ?? "";
	const found = classes.split(/\s+/).find((name) => name.startsWith("lucide-") && name.length > 7);
	return found ? found.slice("lucide-".length) : null;
}

/**
 * Obsidian's drawing for `id` and the name Share Note will give it. Kept per
 * id: the generated sheet is rebuilt on every `css-change`, and Obsidian's own
 * table never changes under a drawing it once returned. A miss is not kept — an
 * id another plugin registers with `addIcon()` can turn up later.
 */
const drawings = new Map<string, ShareNoteIcon>();

/**
 * `id` is what the painter hands `setIcon` (`resolveLucideId(value)`), and
 * `cssValue` the callout's `--callout-icon`, which is where Share Note looks
 * for a name when the drawing carries no `lucide-` class — an icon another
 * plugin registered.
 */
export function obsidianShareNoteIcon(id: string, cssValue: string): ShareNoteIcon | null {
	const key = `${id}\n${cssValue}`;
	const known = drawings.get(key);
	if (known) return known;
	const markup = getIcon(id)?.outerHTML;
	const svg = markup ? standaloneSvg(markup) : null;
	if (!svg) return null;
	const icon = { name: lucideClassName(svg) ?? bareLucideName(cssValue), svg };
	drawings.set(key, icon);
	return icon;
}

const SCOPE = `:where(body.${SHARE_NOTE_BODY_CLASS})`;

/** The rules for `icons`, one per name; empty when there are none. */
export function shareNoteIconCSS(icons: readonly ShareNoteIcon[]): string {
	const written = new Set<string>();
	const rules: string[] = [];
	for (const icon of icons) {
		if (!icon.name || written.has(icon.name)) continue;
		written.add(icon.name);
		const sel = `${SCOPE} .callout-icon > svg[data-share-note-lucide="${cssAttrValue(icon.name)}"]:empty`;
		// Declared once into a property, as iconOverrides.ts does: Share Note
		// uploads every data URI in the sheet as a file of its own, and two
		// copies of one drawing would be two uploads.
		rules.push(
			icon.keepsColors
				? `${sel} {\n` +
						`  background-image: ${svgToDataUri(icon.svg)};\n` +
						"  background-size: contain;\n" +
						"  background-repeat: no-repeat;\n" +
						"  background-position: center;\n" +
						"}"
				: `${sel} {\n` +
						`  --cs-share-icon: ${svgToDataUri(icon.svg)};\n` +
						"  -webkit-mask-image: var(--cs-share-icon);\n" +
						"  mask-image: var(--cs-share-icon);\n" +
						"  -webkit-mask-size: contain;\n" +
						"  mask-size: contain;\n" +
						"  -webkit-mask-repeat: no-repeat;\n" +
						"  mask-repeat: no-repeat;\n" +
						"  -webkit-mask-position: center;\n" +
						"  mask-position: center;\n" +
						"  background-color: currentColor;\n" +
						"}",
		);
	}
	return rules.length > 0 ? ["/* Share Note: icons its own Lucide cannot draw */", ...rules].join("\n\n") : "";
}
