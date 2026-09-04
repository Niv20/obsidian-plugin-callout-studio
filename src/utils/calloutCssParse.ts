/**
 * utils/calloutCssParse.ts — reading callout definitions back out of CSS.
 *
 * Two quite different things arrive as a block of CSS and mean the same thing:
 * what Callout Manager's Copy button puts on the clipboard, and what this
 * plugin itself generates. The second is why this matters beyond migration — a
 * user whose settings file was lost can recover colours and icons from the
 * stylesheet, either the startup snapshot in `localStorage` (see
 * `manager/StartupStyleCache.ts`) or an exported snippet, by pasting it into the
 * same import box. `tests/calloutManagerImport.test.ts` holds that round trip.
 *
 * Split out of `calloutManagerImport.ts`, which is about turning one plugin's
 * saved data into entries; this is about text.
 */
import { parseCssColorToHex } from "./colorUtils";
import { calloutIdentity } from "./calloutId";
import type { CalloutIcon } from "../types";
import type { CalloutManagerEntry } from "./calloutManagerImport";

const BLOCK_RE = /([^{}]+)\{([^}]*)\}/g;
const SELECTOR_ID_RE = /data-callout=["']([^"']+)["']/g;
// `!` ends the capture, which is how `!important` is kept out of the value.
// This plugin's own generated stylesheet marks nearly every custom property
// important, so without that a setup recovered from it — the localStorage
// snapshot, or an exported snippet — would import an icon literally named
// `lightbulb !important` and no colour at all. Themes use it just as freely.
const ICON_DECL_RE = /--callout-icon\s*:\s*([^;}!]+)/i;
const COLOR_DECL_RE = /--callout-color\s*:\s*([^;}!]+)/i;
/**
 * Turns an Obsidian icon id into our `CalloutIcon` convention: a bare Lucide
 * name. Obsidian's own `--callout-icon` variable (which both Obsidian core and
 * Callout Manager write) always uses the `lucide-` prefixed form, but every
 * render path in this plugin (`renderIcon.ts`, `constants.ts`) stores and
 * consumes the bare name directly with `setIcon`.
 *
 * Callout Manager picks icons with Obsidian's own suggester, so the value is
 * whatever `getIconIds()` listed — which is three different things (see the
 * header of `icons/lucideId.ts`): prefixed core Lucide, bare ids some other
 * plugin registered with `addIcon()`, and a handful of bare Obsidian-internal
 * ids. Stripping only the prefix leaves all three intact and drawable, and
 * whether the id names anything *here* is the planner's `createLucideNameCheck`
 * to decide — a foreign id passes exactly when the plugin that registered it is
 * installed in this vault, which is exactly when it can be drawn.
 */
export function parseIconDecl(raw: string): CalloutIcon | undefined {
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	const value = trimmed.startsWith("lucide-")
		? trimmed.slice("lucide-".length)
		: trimmed;
	if (!value) return undefined;
	return { type: "lucide", value };
}

/**
 * Parses the pasted text into one entry per callout, keyed by identity.
 * Blocks are merged by id with last-write-wins **per property** (mirrors CSS
 * cascade: a later block for the same id that only sets one property doesn't
 * erase a property an earlier block already set).
 */
export function parseCalloutManagerExport(text: string): CalloutManagerEntry[] {
	const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
	const byId = new Map<string, CalloutManagerEntry>();

	let block: RegExpExecArray | null;
	while ((block = BLOCK_RE.exec(withoutComments)) !== null) {
		const [, selector, body] = block;
		if (!selector || body === undefined) continue;

		const ids = [...selector.matchAll(SELECTOR_ID_RE)]
			.map((m) => m[1])
			.filter((id): id is string => !!id);
		if (ids.length === 0) continue;

		const iconMatch = ICON_DECL_RE.exec(body);
		const icon = iconMatch?.[1] ? parseIconDecl(iconMatch[1]) : undefined;
		const colorMatch = COLOR_DECL_RE.exec(body);
		const color = colorMatch?.[1]
			? (parseCssColorToHex(colorMatch[1].trim()) ?? undefined)
			: undefined;

		for (const id of ids) {
			const prev = byId.get(calloutIdentity(id));
			byId.set(calloutIdentity(id), {
				id,
				icon: icon ?? prev?.icon,
				color: color ?? prev?.color,
			});
		}
	}

	return [...byId.values()];
}
