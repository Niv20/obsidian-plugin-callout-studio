/**
 * manager/theme/themeCalloutsOff.ts — the setting that switches the active
 * theme's callout styling off, so Callout Studio draws every callout.
 *
 * ## Removing, not winning
 *
 * A theme that styles callouts heavily cannot be beaten by selector weight:
 * it keeps whatever it escalated, and whatever this plugin never declares — a
 * shadow, a `::before` badge, its padding — stays the theme's, so the callout
 * comes out half one and half the other. That is why "the theme owns what it
 * names" is otherwise absolute (`docs/internals-docs/06-css-generation.md`,
 * "One rule, and why there is no setting"). This setting does not compete: it
 * takes the theme's callout rules and `--callout-*` variables out of the
 * browser's parsed copy of the theme (`themeCalloutStrip.ts`). Obsidian's own
 * CSS and this plugin's then draw every callout, and the theme goes on styling
 * everything else.
 *
 * Off — the default — touches nothing at all. On, the theme's facts are read
 * as those of a theme that names no callout (`ThemeCalloutStore`,
 * `ThemeMetadataCatalog`, gated on {@link ThemeCalloutsOff.active}), so no
 * callout is the theme's, no theme type is listed, and the claim check never
 * measures a sheet that has lost its rules.
 *
 * ## Every window has its own copy
 *
 * Obsidian keeps the theme in one `<style>` in the main window and gives every
 * other window a clone of it — pop-outs, the 1.14 Settings window, the hidden
 * window a PDF export prints from — each parsed on its own. So the rules come
 * out per document: the main one at once, the others as they are met. Pop-outs
 * announce themselves (`window-open`); the Settings window and the PDF export's
 * window do not, and are found where a callout is drawn in them — a markdown
 * post-processor, and an editor extension for Live Preview. A watch on each
 * window's `<head>` catches a `<style>` written anew (a theme switched or
 * reloaded, a Style Settings change, the relay's fresh clone) before it is
 * painted: mutation records are delivered as a microtask, ahead of the frame.
 *
 * ## The way back
 *
 * Every `<style>` whose copy lost something is parsed again from its own text
 * (`reparseStyle`) — exactly what the theme wrote. The main window's element
 * mutating is what makes Obsidian copy fresh clones into the other windows.
 * Unloading the plugin takes the same way back.
 */
import type { App, EventRef, MarkdownPostProcessor } from "obsidian";
import type { Extension } from "@codemirror/state";
import { ViewPlugin } from "@codemirror/view";
import { hasThemeStyle, reparseStyle, themeStyleIn } from "./customCssApi";
import { pinCoreCalloutDefaults, stripCalloutRules } from "./themeCalloutStrip";

/** Style Settings' own `<style>`: where a theme's options set its variables. */
const STYLE_SETTINGS_ID = "css-settings-manager";

export interface ThemeCalloutsOffHost {
	app: App;
	registry: {
		settings: { themeCalloutStyles: { enabled: boolean } };
		onChange(callback: () => void): void;
	};
	cssInjector: {
		/** Whether the last session's stylesheet carried the setting's marker. */
		startedWithThemeCalloutsOff(): boolean;
		setThemeCalloutsOff(active: () => boolean): void;
	};
	/** Re-derive the theme's facts; absent until settings have loaded. */
	refreshThemeAppearance?: () => void;
	register(callback: () => void): void;
	registerEvent(ref: EventRef): void;
	registerMarkdownPostProcessor(processor: MarkdownPostProcessor): MarkdownPostProcessor;
	registerEditorExtension(extension: Extension): void;
}

export class ThemeCalloutsOff {
	/** Until settings load, the last session's stylesheet decides; then the setting does. */
	private settingsLoaded = false;
	/** Whether the theme's callout styling is out of every window met so far. */
	private applied = false;
	/** Sheets already stripped. A `<style>` parsed again is a new sheet. */
	private readonly stripped = new WeakSet<CSSStyleSheet>();
	/** Every `<style>` whose parsed copy lost something: what the way back parses again. */
	private readonly touched = new Set<HTMLStyleElement>();
	/** Per window, its copy of the theme, so a clone is searched for once. */
	private readonly themeCopies = new WeakMap<Document, HTMLStyleElement>();
	private readonly watched = new Map<Document, MutationObserver>();
	private destroyed = false;

	constructor(private readonly host: ThemeCalloutsOffHost) {}

	/** Whether the theme's callout styling is switched off — the gate every theme fact reads. */
	active(): boolean {
		if (this.destroyed) return false;
		const wanted = this.settingsLoaded
			? !this.host.registry.settings.themeCalloutStyles.enabled
			: this.host.cssInjector.startedWithThemeCalloutsOff();
		return wanted && hasThemeStyle(this.host.app);
	}

	/** Settings have loaded: from here on the setting decides. */
	settingsReady(): void {
		this.settingsLoaded = true;
		this.sync();
	}

	/**
	 * Bring every window in line with {@link active}. Whatever moved, the
	 * theme's facts are re-derived at once — ownership, the theme's rows, the
	 * claim check — rather than at the next `css-change`.
	 */
	sync(): void {
		if (this.destroyed) return;
		const want = this.active();
		if (want === this.applied) return;
		this.applied = want;
		if (want) {
			for (const doc of this.documents()) this.ensure(doc);
		} else {
			this.restore();
		}
		this.host.refreshThemeAppearance?.();
	}

	/** Take the theme's callout styling out of `doc`, and keep it out. */
	ensure(doc: Document | null | undefined): void {
		if (!doc || !this.applied || this.destroyed) return;
		this.watch(doc);
		this.stripIn(doc);
	}

	/** A `css-change`: the theme or Style Settings may have been written anew. */
	refresh(): void {
		if (!this.applied) return;
		for (const doc of this.documents()) this.ensure(doc);
	}

	/** A window closed: stop watching it. */
	forget(doc: Document): void {
		this.watched.get(doc)?.disconnect();
		this.watched.delete(doc);
	}

	destroy(): void {
		if (this.destroyed) return;
		if (this.applied) this.restore();
		this.applied = false;
		this.destroyed = true;
	}

	private stripIn(doc: Document): void {
		const theme = this.themeCopyIn(doc);
		for (const el of [theme, styleSettingsIn(doc)]) {
			const sheet = el?.sheet;
			if (!el || !sheet || this.stripped.has(sheet)) continue;
			this.stripped.add(sheet);
			stripCalloutRules(sheet);
			// Obsidian's own corners, padding, title weight and blend, where the
			// theme's general tokens would otherwise still reach every callout.
			if (el === theme) pinCoreCalloutDefaults(sheet);
			this.touched.add(el);
		}
	}

	private themeCopyIn(doc: Document): HTMLStyleElement | null {
		// Still where the relay put it? Its fresh clone replaces it in place.
		const known = this.themeCopies.get(doc);
		if (known && known.parentElement === doc.head) return known;
		const found = themeStyleIn(this.host.app, doc);
		if (found) this.themeCopies.set(doc, found);
		return found;
	}

	private watch(doc: Document): void {
		if (this.watched.has(doc) || !doc.head) return;
		const Observer =
			doc.defaultView?.MutationObserver ??
			(typeof MutationObserver === "undefined" ? undefined : MutationObserver);
		if (!Observer) return;
		const observer = new Observer(() => {
			if (this.applied && !this.destroyed) this.stripIn(doc);
		});
		observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
		this.watched.set(doc, observer);
	}

	private restore(): void {
		for (const observer of this.watched.values()) observer.disconnect();
		this.watched.clear();
		for (const el of this.touched) if (el.isConnected) reparseStyle(el);
		this.touched.clear();
	}

	/** Every window the workspace draws into, and every one met so far that is still open. */
	private documents(): Document[] {
		const docs = new Set<Document>([this.host.app.workspace.containerEl.ownerDocument, activeDocument]);
		this.host.app.workspace.iterateAllLeaves((leaf) => {
			const doc = leaf.view.containerEl?.ownerDocument;
			if (doc) docs.add(doc);
		});
		for (const doc of [...this.watched.keys()]) {
			if (doc.defaultView) docs.add(doc);
			else this.forget(doc);
		}
		return [...docs];
	}
}

/** Style Settings' `<style>` in `doc` — appended to `<head>`, and cloned into every window with it. */
function styleSettingsIn(doc: Document): HTMLStyleElement | null {
	for (const el of Array.from(doc.head?.children ?? [])) {
		if (el.tagName === "STYLE" && el.id === STYLE_SETTINGS_ID) return el as HTMLStyleElement;
	}
	return null;
}

/** Build the switch and wire it to the workspace, the registry and the renderers. */
export function registerThemeCalloutsOff(host: ThemeCalloutsOffHost): ThemeCalloutsOff {
	const off = new ThemeCalloutsOff(host);
	host.cssInjector.setThemeCalloutsOff(() => off.active());
	// Registered before the theme sweep's own listener, so a theme written
	// anew has lost its callout rules before anything in that sweep reads it.
	host.registerEvent(host.app.workspace.on("css-change", () => off.refresh()));
	host.registerEvent(host.app.workspace.on("window-open", (_win, win) => off.ensure(win.document)));
	host.registerEvent(host.app.workspace.on("window-close", (_win, win) => off.forget(win.document)));
	// The windows no workspace event announces are found where a callout is
	// drawn in them.
	host.registerMarkdownPostProcessor((el) => {
		off.ensure(el.ownerDocument);
		off.ensure(activeDocument);
	});
	host.registerEditorExtension(
		ViewPlugin.define((view) => {
			off.ensure(view.dom.ownerDocument);
			return {};
		}),
	);
	host.registry.onChange(() => off.sync());
	host.register(() => off.destroy());
	off.sync();
	return off;
}
