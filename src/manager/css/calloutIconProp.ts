/**
 * manager/css/calloutIconProp.ts — what goes in `--callout-icon`.
 *
 * One decision with two answers:
 *
 * | icon | value |
 * |---|---|
 * | Lucide | a plain id token, or a safe placeholder for invalid values |
 * | pack glyph, user picture, emoji | `lucide-pencil`, as a placeholder |
 *
 * The placeholder is the interesting half. Core's `--callout-icon` takes a
 * Lucide id, so anything else has to be drawn by this plugin instead: an
 * `::after` carrying the artwork as a mask, plus `svg { display: none }` to
 * stop core drawing the slot a second time (see `iconOverrides.ts`). Naming a
 * real Lucide id here is what gives Obsidian something to draw at first paint,
 * in the right box, before that pair takes over.
 *
 * Both the per-callout block and the unknown-id fallback ask this, which is why
 * it is a free function rather than a branch inside either.
 */
import { packFor } from "../../icons/registry";
import type { CalloutDefinition } from "../../types";

/**
 * The `--callout-icon` value for one callout, or `""` when it should not be
 * declared at all.
 */
export function calloutIconProp(def: CalloutDefinition): string {
	const pack = packFor(def.icon);
	if (!pack) return "";

	// Lucide is Obsidian's own set, so the stored id is already the value core
	// CSS wants — emitted verbatim, and deliberately not put through
	// `resolveLucideId` first. That repair asks whether an id is core Lucide,
	// and this runs during plugin load, before a plugin that registered its own
	// ids with `addIcon()` has necessarily loaded; a wrong answer here would be
	// baked into the stylesheet *and* into the localStorage startup snapshot.
	// Do not trust a load-time migration as CSS validation: synced/edited
	// settings can carry declaration delimiters. Preserve ordinary third-party
	// IDs without depending on whether their plugin has registered them yet.
	if (pack.kind === "builtin") {
		return /^[A-Za-z0-9_-]+$/.test(def.icon.value) ? def.icon.value : "lucide-pencil";
	}

	// Everything else needs a valid Lucide id as a placeholder so Obsidian
	// renders *something* at first paint. The real glyph is then painted into
	// the DOM by paintIcons (which also makes it survive PDF export).
	return "lucide-pencil";
}
