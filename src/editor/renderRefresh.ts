/**
 * editor/renderRefresh.ts — repainting what a registry change does not repaint
 * by itself.
 *
 * Two passes with a deliberate difference in reach, and picking the wrong one
 * is a real bug class rather than a performance choice:
 *
 * - **`refreshCallouts`** re-injects and rebuilds Live Preview decorations.
 *   Registry mutations do not touch the document text, so CodeMirror has no
 *   reason to rebuild its own decorations without being asked.
 * - **`refreshRenderModes`** additionally re-runs the reading-view
 *   post-processors, which is the only way an already-baked heading or inline
 *   callout is added or stripped. Needed when a render-role toggle flips, not
 *   when a colour changed.
 * - **`ReadingStructureWatch`** is the narrow version of the second, for the
 *   registry changes that alter what reading view baked — see its doc.
 *
 * Structurally typed hosts, so `main.ts` keeps the two forwarders and nothing
 * else — it is lifecycle and wiring.
 */
import { MarkdownView } from "obsidian";
import type { App } from "obsidian";
import type { CalloutDefinition } from "../types";
import { calloutIdentity } from "../utils/calloutId";
import { clearContentPillCache } from "./livepreview/contentPillRender";
import { refreshAllCalloutEditors } from "./livepreview/refresh";

/** What {@link refreshCallouts} needs. */
export interface RefreshHost {
	cssInjector: { inject(force?: boolean): void };
	/** Asked after the repaint, so a reload of the registry reaches reading view. */
	readingStructure?: { check(): void };
}

/**
 * Re-apply all callout styling and rebuild the editor decorations. Use after
 * any mutation that should be immediately visible.
 */
export function refreshCallouts(host: RefreshHost): void {
	// inject() emits "css-change" itself once the CSS is in place — a second
	// explicit trigger here would only re-enter our own listener and run the
	// whole pass again.
	host.cssInjector.inject();
	// A content pill's payload is rendered markdown and can itself hold a
	// callout token, so a registry edit can change what a cached payload should
	// look like. Dropped before the rebuild below re-renders them.
	clearContentPillCache();
	refreshAllCalloutEditors();
	host.readingStructure?.check();
}

/** Fully re-render both preview modes — see the file header. */
export function refreshRenderModes(app: App): void {
	refreshAllCalloutEditors();
	for (const view of markdownViews(app)) view.previewMode?.rerender(true);
}

function markdownViews(app: App): MarkdownView[] {
	const views: MarkdownView[] = [];
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		if (leaf.view instanceof MarkdownView) views.push(leaf.view);
	}
	return views;
}

/** What {@link ReadingStructureWatch} reads. */
export interface ReadingStructureRegistry {
	getCommitted(): CalloutDefinition[];
	get(id: string): CalloutDefinition | undefined;
	themeOwns(def: CalloutDefinition): boolean;
	settings: { fallbackCalloutId: string };
}

/** Every `[!name` a note mentions, in identity form. Escaped ones included. */
const MENTION_RE = /\[!([^\]|\n]+)/g;

/**
 * Re-renders the reading views a registry change left wrong.
 *
 * Reading view bakes part of the registry into a note's DOM when it renders
 * it, and nothing re-runs that unless the note changes: which names are
 * callouts (`.cs-unknown`, the `data-callout` spelling), whether a heading or
 * inline token has an icon at all (`hideIcon` omits the span), and whether it
 * is built in the first place (a theme-owned callout's token is not). The
 * icon sweep repaints icons and names in place, and the stylesheet carries
 * every colour — but a `## [!new]` written before its type existed kept the
 * fallback's look after the type was created, until the note was reopened.
 * `css-change` does not help: core answers it by refreshing the editors only.
 *
 * Asked on every registry round, so the common path is one string compare: a
 * colour, an icon or a name changes nothing here. Only when the structure
 * moved does it work out which names did, and re-render only the open notes
 * that mention one — a theme switch that hands four hundred names to the
 * theme re-renders the note that uses two of them, not every open note.
 */
export class ReadingStructureWatch {
	private signature: string;
	private names: Map<string, string>;
	private fallback: string;

	constructor(
		private readonly app: App,
		private readonly registry: ReadingStructureRegistry,
	) {
		this.signature = this.readSignature();
		this.names = this.readNames();
		this.fallback = this.readFallback();
	}

	check(): void {
		const signature = this.readSignature();
		if (signature === this.signature) return;
		this.signature = signature;
		const names = this.readNames();
		const fallback = this.readFallback();
		const moved = new Set<string>();
		for (const [name, facts] of names) {
			if (this.names.get(name) !== facts) moved.add(name);
		}
		for (const name of this.names.keys()) {
			if (!names.has(name)) moved.add(name);
		}
		// Every unknown token wears the fallback's icon, so a different fallback
		// (or one that hides its icon now) moves every name nobody defines.
		const fallbackMoved = fallback !== this.fallback;
		this.names = names;
		this.fallback = fallback;
		if (moved.size === 0 && !fallbackMoved) return;
		for (const view of markdownViews(this.app)) {
			const mentioned = mentionedNames(view.getViewData());
			const affected = [...mentioned].some((name) =>
				moved.has(name) || (fallbackMoved && !names.has(name)),
			);
			if (affected) view.previewMode?.rerender(true);
		}
	}

	/** Cheap and order-stable: what {@link check} compares on every round. */
	private readSignature(): string {
		const parts: string[] = [this.readFallback()];
		for (const def of this.registry.getCommitted()) {
			parts.push(`${def.id}\u0000${(def.aliases ?? []).join("\u0000")}\u0000${this.factsOf(def)}`);
		}
		return parts.join("\n");
	}

	/** Each name, in identity form, mapped to what reading view baked about it. */
	private readNames(): Map<string, string> {
		const names = new Map<string, string>();
		for (const def of this.registry.getCommitted()) {
			const facts = `${def.id}\u0000${this.factsOf(def)}`;
			for (const name of [def.id, ...(def.aliases ?? [])]) {
				names.set(calloutIdentity(name), facts);
			}
		}
		return names;
	}

	private factsOf(def: CalloutDefinition): string {
		return `${def.hideIcon === true ? "h" : ""}${this.registry.themeOwns(def) ? "t" : ""}`;
	}

	private readFallback(): string {
		const id = this.registry.settings.fallbackCalloutId;
		return `${id}\u0000${this.registry.get(id)?.hideIcon === true ? "h" : ""}`;
	}
}

function mentionedNames(text: string): Set<string> {
	const names = new Set<string>();
	for (const match of text.matchAll(MENTION_RE)) {
		const name = match[1]?.trim();
		if (name) names.add(calloutIdentity(name));
	}
	return names;
}
