/**
 * manager/web/webData.ts — the snapshot of the user's callouts that every
 * website export carries.
 *
 * A published site has neither Obsidian nor this plugin, so whatever draws a
 * heading bar or an inline pill there needs the registry's answers written
 * down beforehand: which names are callouts, what each is called, its icon as
 * finished markup, and the stylesheet. That is one read of the registry, built
 * here once and handed to whichever target is being written
 * (`manager/web/targets.ts`) — the targets differ in how the snapshot reaches
 * a site, never in what it says about a heading bar or a pill.
 *
 * The stylesheet's last part is the exception, and the reason the snapshot is
 * built for a target: a block callout is an element the site builds, and each
 * site reads a colour and an icon its own way (`manager/css/webBlockCSS.ts`).
 */
import { WEB_STRUCTURAL_CSS } from "virtual:callout-studio-web-assets";
import { RESERVED_DEMO_IDS } from "../../constants";
import { paintOwnRoleIcon } from "../../editor/roleIcon";
import { withSvgCopyToken } from "../../icons/isolateSvg";
import { followsCalloutColor, userImageFor } from "../../icons/packs/userImages";
import { packFor } from "../../icons/registry";
import { createIconResolver } from "../../icons/resolver";
import { standaloneSvg } from "../../icons/svg";
import type { CalloutDefinition, CalloutIcon, CalloutRenderRole } from "../../types";
import type { WebBundleData, WebCalloutDef } from "../../web/webBundleData";
import type { CalloutRegistry } from "../CalloutRegistry";
import type { CSSInjector } from "../CSSInjector";
import type { WebBlockArtwork, WebBlockSite } from "../css/webBlockCSS";
import type { WebFileMemory } from "./fileMemory";
import type { WebTargetId } from "./targets";

/** Structural on purpose: `SettingsTabPlugin` and a test double both satisfy it. */
export interface WebExportPlugin {
	registry: CalloutRegistry;
	cssInjector: CSSInjector;
	/** Whether this icon's artwork can no longer be had here; see {@link pendingIcons}. */
	hasIconFetchFailed?(icon: CalloutIcon, role: CalloutRenderRole): boolean;
	/**
	 * What this device remembers of the files it wrote (`fileMemory.ts`): the
	 * plugin's `DeviceLocalStore`. Under a name of its own, so a stand-in whose
	 * `localState` is a few fields of the real one is simply a device with no
	 * memory: nothing is refreshed automatically there, and a write by hand
	 * works as ever.
	 */
	webFiles?: WebFileMemory;
}

/**
 * The roles whose artwork the files carry: the two this plugin's renderer
 * draws, and the block callout's, which travels in the stylesheet.
 */
const WEB_ROLES: readonly CalloutRenderRole[] = ["inline", "heading", "regular"];

/** Whose block callout each target's stylesheet is written for. */
const BLOCK_SITE: Record<WebTargetId, WebBlockSite> = {
	publish: "publish",
	quartz: "quartz",
	garden: "garden",
};

/** The snapshot with its stylesheet, which the exporter always builds. */
export type WebExportData = WebBundleData & { css: string };

const byId = (a: CalloutDefinition, b: CalloutDefinition): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Every callout the vault itself defines: the built-ins and the user's own —
 * untouched built-ins included, unlike the CSS snippet, because `[!note]` has
 * to become a pill whether or not anyone recoloured it. Sorted by codepoint so
 * a file comes out byte-identical whatever language the UI is in.
 *
 * **Nothing here reads the active theme**, and that is a rule, not an accident.
 * The theme is not on the published site, and what it does here is a reading
 * of this device at this moment: the rows it adds (`source: "theme"`) are
 * minted when its stylesheet is scanned, and which callouts it owns and what
 * it draws are measured after startup. Taking any of that into the files would
 * make them differ between two devices on different themes, and on one device
 * between a launch and the moment its theme was measured — each difference a
 * rewrite of the site's files when they are kept up to date. So a callout only
 * the theme defines is unknown to the site and drawn with the fallback's look,
 * and a built-in the theme restyles is drawn as its own definition says.
 */
export function webBundleDefinitions(plugin: WebExportPlugin): CalloutDefinition[] {
	const { registry } = plugin;
	return [...registry.getBuiltIn(), ...registry.getUserDefined()]
		.filter((def) => !RESERVED_DEMO_IDS.has(def.id))
		.sort(byId);
}

/**
 * One role's icon as markup. Painted by the editor's own painter into a
 * detached element and read back, so a pack icon, an emoji and an uploaded
 * picture all arrive exactly as a note shows them — in `currentColor`, which
 * the export's stylesheet then sets per callout. The callout's own icon, even
 * where the theme draws another here (see {@link webBundleDefinitions}).
 *
 * `token` is what a picture that brings ids or a `<style>` of its own is
 * fenced with (`icons/isolateSvg.ts`). On screen that is a running number,
 * which made every snapshot differ from the one before it: the files were
 * rewritten for nothing and never counted as current. Here it is fixed by the
 * caller, so the same callouts are the same bytes.
 */
function bakeIcon(def: CalloutDefinition, registry: CalloutRegistry, role: CalloutRenderRole, token: string): string {
	const holder = createSpan();
	withSvgCopyToken(token, () => paintOwnRoleIcon(holder, def, registry, role));
	return holder.innerHTML;
}

/**
 * The fence token for number `index`. The callers number the drawings of one
 * snapshot apart, so two pictures on one page never share a fence. The leading
 * zero is what the on-screen counter never writes, so a token of the files
 * cannot be one of the document's either.
 */
const iconToken = (index: number): string => `0${index.toString(36)}`;

/**
 * A callout's block icon, as what a stylesheet can do with it — see
 * `WebBlockArtwork`. The block callout is the site's element, so nothing can
 * be put *in* it: the artwork goes into a rule, as a mask (one colour, tinted
 * with the accent), a background (a picture that keeps its own colours) or a
 * glyph (an emoji).
 *
 * Artwork this plugin stores is taken as stored, exactly as the vault's own
 * block rule takes it. An Obsidian icon is not stored anywhere: it is read
 * back from the painter, the way the two token roles read theirs. Where that
 * leaves nothing — an icon of another plugin's that is not loaded — the site
 * keeps the icon it drew.
 */
function blockArtwork(def: CalloutDefinition, registry: CalloutRegistry, token: string): WebBlockArtwork {
	if (def.hideIcon === true) return { kind: "hidden" };
	const pack = packFor(def.icon);
	if (pack?.kind === "glyph") return { kind: "text", text: def.icon.value };
	if (pack && pack.kind !== "builtin") {
		const svg = createIconResolver(registry).resolveSvg(def.icon, "regular");
		if (svg) {
			const picture = userImageFor(def.icon);
			return picture && !followsCalloutColor(def.icon, picture)
				? { kind: "image", svg, picture }
				: { kind: "mask", svg, picture };
		}
	}
	const svg = standaloneSvg(bakeIcon(def, registry, "regular", token));
	return svg ? { kind: "mask", svg } : { kind: "site" };
}

function webDefinition(
	def: CalloutDefinition,
	registry: CalloutRegistry,
	token: string,
	headingToken: string,
): WebCalloutDef {
	const out: WebCalloutDef = { id: def.id, name: def.displayName };
	if (def.aliases && def.aliases.length > 0) out.aliases = [...def.aliases];
	if (def.hideIcon === true) {
		out.hideIcon = true;
		return out;
	}
	const inline = bakeIcon(def, registry, "inline", token);
	const heading = bakeIcon(def, registry, "heading", token);
	if (inline) out.icon = inline;
	// Most packs draw one picture for every size; say so by saying nothing.
	// Where the two do differ they are two drawings on one page, and the
	// heading's gets a fence of its own.
	if (heading && heading !== inline) out.headingIcon = bakeIcon(def, registry, "heading", headingToken);
	return out;
}

/**
 * The callouts whose artwork is on its way to this device but not here yet:
 * a library icon still being read or fetched, which the note shows as a pencil
 * for the moment. An automatic refresh waits for them (`writeTarget.ts`), so a
 * site is never sent a placeholder for an icon that would have arrived a
 * moment later.
 *
 * Only the two remote kinds of library can be on their way. An emoji or an
 * Obsidian icon is always here, and a picture of the user's own that is
 * missing was deleted. And an icon whose fetch failed is not waited for: it is
 * drawn as the note draws it, since waiting for it would mean waiting forever.
 */
export function pendingIcons(plugin: WebExportPlugin): string[] {
	const resolver = createIconResolver(plugin.registry);
	const pending: string[] = [];
	for (const def of webBundleDefinitions(plugin)) {
		if (def.hideIcon === true) continue;
		const kind = packFor(def.icon)?.kind;
		if (kind !== "bundledRemote" && kind !== "perIconRemote") continue;
		const waiting = WEB_ROLES.some(
			(role) => resolver.resolveSvg(def.icon, role) === null && !plugin.hasIconFetchFailed?.(def.icon, role),
		);
		if (waiting) pending.push(def.id);
	}
	return pending;
}

/**
 * The snapshot the renderer reads — see `web/webBundleData.ts` — with the
 * stylesheet for `target`'s site: the structural rules, the heading and
 * inline colours, then the block callouts as that site draws them.
 */
export function buildWebBundleData(plugin: WebExportPlugin, target: WebTargetId): WebExportData {
	const { registry, cssInjector } = plugin;
	const settings = registry.settings;
	const defs = webBundleDefinitions(plugin);
	// A callout's own number, and past the last of those a second one for a
	// heading drawing that differs from the inline one.
	const tokens = new Map(defs.map((def, index) => [def.id, iconToken(index)]));
	const tokenOf = (def: CalloutDefinition): string => tokens.get(def.id) ?? iconToken(2 * defs.length);
	const sheet = [
		WEB_STRUCTURAL_CSS,
		cssInjector.generateWebTokenCSS(defs),
		cssInjector.generateWebBlockCSS(defs, BLOCK_SITE[target], (def) => blockArtwork(def, registry, tokenOf(def))),
	];
	return {
		version: 1,
		heading: settings.headingCallouts.enabled,
		inline: settings.inlineCallouts.enabled,
		content: settings.inlineCallouts.allowContent,
		fallback: settings.fallbackCalloutId || null,
		defs: defs.map((def, index) => webDefinition(def, registry, iconToken(index), iconToken(defs.length + index))),
		css: `${sheet.filter((part) => part.trim()).join("\n\n")}\n`,
	};
}

/**
 * `data` as a JavaScript expression. JSON is one already, with two repairs for
 * where the text may end up: a site may inline a script in a `<script>`
 * element, which the HTML parser closes at the first `</script` it sees
 * wherever that is — and an icon's markup may well contain one — and
 * U+2028/U+2029 end a line in older JavaScript parsers though not in JSON.
 */
export function serializeWebData(data: WebBundleData): string {
	return JSON.stringify(data)
		.replace(/<\//g, "<\\/")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}
