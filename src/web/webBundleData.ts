/**
 * web/webBundleData.ts — the data a website export carries, as the exporter
 * writes it and the renderer reads it.
 *
 * Types only, on purpose. `manager/web/webData.ts` builds one of these inside
 * Obsidian and `web/core.ts` reads it in a browser or a site's build, where
 * neither Obsidian nor this plugin exists, so this file is the whole contract
 * between the two and must import nothing that would not survive that trip.
 *
 * The shape is a snapshot of what the registry answers, not of the registry:
 * the runtime rebuilds the same three lookups from it (id, alias, attribute
 * form — see `createWebRenderer`), so a token resolves on the site exactly as
 * `resolveCalloutDef` resolves it in a note.
 */

/** One callout, reduced to what a heading token or an inline pill draws. */
export interface WebCalloutDef {
	/** The definition's own id, in its stored (space-preserving) spelling. */
	id: string;
	/** `displayName` — the label a token typed with the id itself shows. */
	name: string;
	/** Other spellings that resolve to this callout. Omitted when there are none. */
	aliases?: string[];
	/**
	 * The icon as finished markup — an `<svg>` for artwork, text for an emoji —
	 * painted in `currentColor` so the stylesheet's accent colours it. Omitted
	 * when the callout hides its icon.
	 */
	icon?: string;
	/**
	 * The heading-size drawing, only when the pack draws that size differently
	 * from the inline one. Absent means "the same as `icon`".
	 */
	headingIcon?: string;
	/** The callout is drawn with no icon at all — no span is built for it. */
	hideIcon?: true;
}

/** Everything `init` needs. Serialised as JSON into the exported file. */
export interface WebBundleData {
	/** Format version, so a later runtime can refuse data it does not understand. */
	version: 1;
	/** `settings.headingCallouts.enabled` at export time. */
	heading: boolean;
	/** `settings.inlineCallouts.enabled` at export time. */
	inline: boolean;
	/** `settings.inlineCallouts.allowContent` — whether `[!id]{…}` is a payload. */
	content: boolean;
	/** Id of the callout an unrecognised token borrows its look from, if any. */
	fallback: string | null;
	/** Every callout that may be written in a note. */
	defs: WebCalloutDef[];
	/**
	 * The stylesheet for the heading and inline DOM. Each host delivers it its
	 * own way: the browser host injects it as a `<style>`, Quartz hands it to
	 * the build as an inline resource. Left out where the rules travel in a
	 * file of their own (`publish.css`, a garden plugin's stylesheet).
	 */
	css?: string;
}
