/**
 * outline/OutlineDecorator.ts — Clean heading-callout titles in the Outline
 * pane.
 *
 * The Outline view renders HeadingCache.heading verbatim (minus brackets), so
 * `## [!tip] My Title` shows up as `!tip My Title`. This module rewrites each
 * outline item in place: the token is stripped, the callout's colored icon is
 * prepended (optional), and headings without a title fall back to the
 * callout's display name.
 *
 * The Outline view is not part of Obsidian's typed API, so instead of
 * patching it we watch its DOM with one MutationObserver per outline leaf —
 * the outline's own re-renders (file switch, metadata change, search filter,
 * virtual-tree churn) are the signal to re-process. Every rewrite records the
 * original text in `data-cs-orig` so toggling the feature off or unloading
 * the plugin restores the pane exactly.
 */
import type { App, WorkspaceLeaf } from "obsidian";
import type { PluginSettings } from "../types";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import type { OutlineHeadingToken } from "../editor/calloutTokens";
import { parseOutlineHeadingText } from "../editor/calloutTokens";
import {
	CSS_REF_TOKEN,
	buildCalloutTokenDom,
	resolveCalloutDef,
	shouldRenderToken,
	tokenIconKey,
} from "../editor/renderShared";
import { calloutTokenLabel, normalizeCalloutId } from "../utils/calloutId";

/** Narrow structural host type (avoids importing the concrete plugin class). */
export interface OutlineDecoratorHost {
	app: App;
	registry: CalloutRegistry;
	settings: PluginSettings;
}

interface OutlineAttachment {
	/** The pane itself — the route to the file whose headings it lists. */
	leaf: WorkspaceLeaf;
	container: HTMLElement;
	observer: MutationObserver;
	/** Pending requestAnimationFrame handle (0 = none). */
	rafHandle: number;
	/** True while our own pass mutates the DOM (observer must not re-fire). */
	muted: boolean;
}

/** How the callout headings of one file are written in its raw source. */
interface SourceHeadings {
	/** Normalized ids of headings written `[!id]` — real callout headings. */
	bracketedIds: Set<string>;
	/** Normalized ids of headings written plainly as `!id` — not callouts. */
	literalIds: Set<string>;
	/** Outline text each `[!id]` heading is expected to render as. */
	bracketedTexts: Set<string>;
}

const ITEM_SELECTOR = ".tree-item-inner";

/** Collapse whitespace so reconstructed and rendered text compare equal. */
const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/**
 * Rebuild what the outline will display for a `[!id]` heading: the same text
 * minus the two brackets. `rest` is the text after `]` verbatim, so a title
 * that starts right at the bracket stays glued to the id exactly as the pane
 * shows it. Used to tell two same-id headings apart when a file happens to
 * contain both `# [!bug] A` and `# !bug B`.
 *
 * The token body is rebuilt whole, `|metadata` included: the pane strips the
 * brackets and nothing else, so comparing against the split id alone would
 * never match a heading written `# [!bug|urgent] A`.
 */
const outlineTextOf = (token: OutlineHeadingToken): string =>
	collapse(
		`!${token.rawId}${token.hasMetadata ? `|${token.metadata}` : ""}${token.rest}`,
	);

export class OutlineDecorator {
	private readonly attachments = new Map<WorkspaceLeaf, OutlineAttachment>();

	constructor(private readonly host: OutlineDecoratorHost) {}

	/**
	 * Attach an observer to every current outline leaf and prune attachments
	 * whose pane is gone. Call on layout-ready and on every layout-change —
	 * both are cheap when nothing changed.
	 */
	attachAll(): void {
		for (const [leaf, att] of this.attachments) {
			if (!att.container.isConnected) {
				this.detach(leaf, att);
			}
		}
		for (const leaf of this.host.app.workspace.getLeavesOfType("outline")) {
			if (this.attachments.has(leaf)) continue;
			const container = leaf.view.containerEl;
			const att: OutlineAttachment = {
				leaf,
				container,
				observer: new MutationObserver(() => {
					if (att.muted) return;
					this.schedulePass(att);
				}),
				rafHandle: 0,
				muted: false,
			};
			att.observer.observe(container, {
				childList: true,
				subtree: true,
				characterData: true,
			});
			this.attachments.set(leaf, att);
			this.schedulePass(att);
		}
	}

	/** Re-process every attached pane (settings or registry changed). */
	refreshAll(): void {
		for (const att of this.attachments.values()) this.schedulePass(att);
	}

	/** Restore every decorated item and disconnect all observers. */
	destroy(): void {
		for (const [leaf, att] of this.attachments) {
			this.runPass(att, /* restoreOnly */ true);
			this.detach(leaf, att);
		}
	}

	private detach(leaf: WorkspaceLeaf, att: OutlineAttachment): void {
		att.observer.disconnect();
		if (att.rafHandle) {
			const win = att.container.ownerDocument.defaultView ?? window;
			win.cancelAnimationFrame(att.rafHandle);
		}
		this.attachments.delete(leaf);
	}

	/** Coalesce observer bursts into one pass per animation frame. */
	private schedulePass(att: OutlineAttachment): void {
		if (att.rafHandle) return;
		const win = att.container.ownerDocument.defaultView ?? window;
		att.rafHandle = win.requestAnimationFrame(() => {
			att.rafHandle = 0;
			this.runPass(att);
		});
	}

	private runPass(att: OutlineAttachment, restoreOnly = false): void {
		const { headingCallouts } = this.host.settings;
		const active =
			!restoreOnly &&
			headingCallouts.enabled &&
			headingCallouts.refCleanTitles;

		// One metadata lookup per pass, not per item.
		const source = active ? this.readSourceHeadings(att) : null;

		att.muted = true;
		try {
			for (const el of Array.from(
				att.container.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
			)) {
				if (source) this.processItem(el, source);
				else this.restoreItem(el);
			}
		} finally {
			// Drain the records produced by our own edits so the observer
			// callback never sees them (belt and suspenders with `muted`).
			att.observer.takeRecords();
			att.muted = false;
		}
	}

	/**
	 * Read the raw heading text of the file this pane lists and sort every
	 * callout-looking heading into the two forms it can be written in.
	 *
	 * The outline drops the brackets when it renders a heading, so `!bug Title`
	 * on screen is equally consistent with `# [!bug] Title` (a real callout)
	 * and with `# !bug Title` (plain text that merely starts with `!`). Only
	 * the raw heading text in the metadata cache tells the two apart.
	 */
	private readSourceHeadings(att: OutlineAttachment): SourceHeadings {
		const src: SourceHeadings = {
			bracketedIds: new Set(),
			literalIds: new Set(),
			bracketedTexts: new Set(),
		};
		// The Outline view is not part of the typed API — duck-type its file
		// and go through getCache(path) so no TFile identity check is needed.
		const file = (att.leaf.view as { file?: { path?: unknown } }).file;
		if (typeof file?.path !== "string") return src;
		const headings =
			this.host.app.metadataCache.getCache(file.path)?.headings ?? [];

		// Pass 1: the unambiguous `[!id]` headings, which also define the set of
		// ids the bracketless parse is allowed to extend to in pass 2.
		for (const h of headings) {
			const token = parseOutlineHeadingText(h.heading);
			if (!token?.bracketed) continue;
			src.bracketedIds.add(normalizeCalloutId(token.rawId));
			src.bracketedTexts.add(outlineTextOf(token));
		}
		// Pass 2: headings the user wrote as plain `!id ...`. Parsed exactly the
		// way the outline pane will parse them, so the ids line up.
		for (const h of headings) {
			const token = parseOutlineHeadingText(h.heading, (raw) =>
				src.bracketedIds.has(normalizeCalloutId(raw)),
			);
			if (!token || token.bracketed) continue;
			src.literalIds.add(normalizeCalloutId(token.rawId));
		}
		return src;
	}

	/**
	 * Decide whether an outline item really came from a `[!id]` heading. Only
	 * `[!id]` is callout syntax — a heading the user wrote as `# !bug Title`
	 * must stay plain text, even though the outline displays the two alike.
	 */
	private isRealCallout(
		token: OutlineHeadingToken,
		original: string,
		source: SourceHeadings,
	): boolean {
		if (token.bracketed) return true;
		const id = normalizeCalloutId(token.rawId);
		if (!source.bracketedIds.has(id)) return false;
		// No plain `!id` heading in this file, so the brackets can only have
		// come off a real callout — accept whatever title the outline shows,
		// including one whose markdown formatting it stripped.
		if (!source.literalIds.has(id)) return true;
		// Both forms share this id in this file; only an exact text match can
		// say which heading this item is.
		return source.bracketedTexts.has(collapse(original));
	}

	private processItem(el: HTMLElement, source: SourceHeadings): void {
		const textNode = this.findLeadingTextNode(el);
		if (!textNode) {
			// Nothing we can safely rewrite; drop stale state if any.
			this.restoreItem(el);
			return;
		}

		// Recover the original heading text. When the virtual tree reuses a
		// node for a different heading, its text no longer matches what we
		// wrote (data-cs-text) — treat the current text as the new original.
		const nodeText = textNode.nodeValue ?? "";
		let original: string;
		if (el.dataset.csOrig !== undefined && nodeText === el.dataset.csText) {
			original = el.dataset.csOrig;
		} else {
			original = nodeText;
			this.clearDecoration(el);
		}

		// Resolving multi-word ids against the file's own headings rather than
		// against the registry keeps the greedy extension honest — and gives
		// the bracketless form the source check it needs to be trusted at all.
		const token = parseOutlineHeadingText(original, (raw) =>
			source.bracketedIds.has(normalizeCalloutId(raw)),
		);
		if (!token || !this.isRealCallout(token, original, source)) {
			this.restoreItem(el);
			return;
		}

		const resolved = resolveCalloutDef(this.host.registry, token.rawId);
		// Theme-owned: the outline entry keeps the heading's raw text. Routed
		// through restoreItem rather than a bare return so an entry decorated
		// before the user flipped the flag is put back, not left stale.
		if (!shouldRenderToken(resolved)) {
			this.restoreItem(el);
			return;
		}
		const { def, unknown } = resolved;
		const customTitle = token.title.trim();
		const title =
			customTitle !== ""
				? customTitle
				: calloutTokenLabel(unknown ? undefined : def, token.rawId);
		const showIcon =
			this.host.settings.headingCallouts.refShowIcon && !!def;

		const key = this.renderKey(token.rawId, unknown, def?.id, title, showIcon);
		if (el.dataset.csKey === key) return; // already up to date

		this.clearDecoration(el);
		textNode.nodeValue = title;
		if (showIcon && def) {
			const iconEl = buildCalloutTokenDom({
				rawId: token.rawId,
				registry: this.host.registry,
				variant: "ref",
				showName: false,
			});
			el.insertBefore(iconEl, textNode);
		}
		el.dataset.csOrig = original;
		el.dataset.csText = title;
		el.dataset.csKey = key;
	}

	/** Put an item back to its raw outline text and drop our markers. */
	private restoreItem(el: HTMLElement): void {
		const original = el.dataset.csOrig;
		if (original === undefined) return;
		const textNode = this.findLeadingTextNode(el);
		// Only restore text we still own — if the outline already rewrote the
		// node, its current text IS the fresh original.
		if (textNode && textNode.nodeValue === el.dataset.csText) {
			textNode.nodeValue = original;
		}
		this.clearDecoration(el);
	}

	private clearDecoration(el: HTMLElement): void {
		el.querySelector(`:scope > .${CSS_REF_TOKEN}`)?.remove();
		delete el.dataset.csOrig;
		delete el.dataset.csText;
		delete el.dataset.csKey;
	}

	/**
	 * First non-empty text node of the item, skipping our own icon. Any other
	 * leading element means the item doesn't start with plain heading text —
	 * leave it alone (mirrors calloutPostProcessor.findLeadingTextNode).
	 */
	private findLeadingTextNode(el: HTMLElement): Text | null {
		for (const child of Array.from(el.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				if ((child.textContent ?? "").trim().length > 0)
					return child as Text;
				continue;
			}
			if (
				child.nodeType === Node.ELEMENT_NODE &&
				(child as Element).classList.contains(CSS_REF_TOKEN)
			) {
				continue;
			}
			return null;
		}
		return null;
	}

	/**
	 * Snapshot of everything that affects an item's rendered state. Matching
	 * key ⇒ skip; registry edits (icon, display name, Material download) and
	 * settings flips change the key and force a rewrite.
	 */
	private renderKey(
		rawId: string,
		unknown: boolean,
		defId: string | undefined,
		title: string,
		showIcon: boolean,
	): string {
		const { def } = resolveCalloutDef(this.host.registry, rawId);
		// Outline entries are reference tokens: pill-sized, so pill artwork.
		// Through tokenIconKey rather than iconRenderKey so that turning the
		// callout's icon off changes the key — `showIcon` above stays true and
		// the icon itself is untouched, so nothing else here would notice, and
		// the `dataset.csKey` early-return would keep the stale row forever.
		const iconKey = tokenIconKey(def, this.host.registry, "inline");
		return [
			rawId,
			unknown ? "u" : "",
			defId ?? "",
			title,
			showIcon ? "i" : "",
			iconKey,
		].join("|");
	}
}
