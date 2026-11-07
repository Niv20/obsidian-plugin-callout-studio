/**
 * manager/css/PreviewLayer.ts — a second, tiny stylesheet for the one demo
 * callout a settings window is previewing.
 *
 * Who uses it. `CSSInjector`, which owns one. The palette editor is the case
 * it was made for; the callout editor's draft, which it previews under the
 * reserved placeholder id until Save, is the other.
 *
 * The main idea. The generated stylesheet holds a rule block for every callout
 * in the vault — three quarters of a megabyte for a vault with 750 of them —
 * and writing it is what costs the time: the browser parses all of it, twice
 * (the adopted sheet and the `<style>` copy), then re-matches the page against
 * it, and Obsidian copies the new `<style>` text into every pop-out window,
 * the Settings window included. A colour picker reports a new colour many
 * times a second while it is dragged, and a name is typed a letter at a time;
 * each step used to pay that whole bill to change the rules of one stand-in
 * callout.
 *
 * So that callout's rules live here instead, and the big sheet is left out of
 * it. Dragging then rewrites a few hundred bytes. The big sheet only changes
 * when something else does, which for a demo preview is never: the palette is
 * not applied to the real callouts until the user saves.
 *
 * The layer is written to the same two places the big sheet is, because the
 * preview can sit in either kind of window: an adopted sheet, which only the
 * main window shows, and a `<style>` element, which Obsidian copies into
 * pop-outs. Its sheet is adopted after the big one, so on a tie it wins, as
 * the rules it holds would have if they had stayed in the big sheet.
 */
import type { App } from "obsidian";

export const PREVIEW_EL_ID = "callout-studio-preview-css";

export class PreviewLayer {
	private sheet: CSSStyleSheet | null = null;
	private sheetDoc: Document | null = null;
	private styleEl: HTMLStyleElement | null = null;
	/** The text installed in both targets, or null when nothing is. */
	private text: string | null = null;

	/**
	 * The callout id the installed rules are for, or null when the layer is
	 * empty. `CSSInjector` reads it to tell a layer that is already carrying
	 * the demo (a drag step can write just the layer) from one that is not (the
	 * big sheet has to be rewritten once, without the demo's rules in it).
	 */
	owner: string | null = null;

	constructor(private readonly app: App) {}

	/** Install `css` as the rules of callout `owner`. Writes nothing when they are already there. */
	write(owner: string, css: string): void {
		this.owner = owner;
		if (css === this.text) return;
		this.ensureSheet()?.replaceSync(css);
		const el = this.ensureStyleEl();
		el.textContent = css;
		this.text = css;
	}

	/** Take the layer away, sheet and element, until the next {@link write}. */
	clear(): void {
		this.owner = null;
		this.text = null;
		if (this.sheet && this.sheetDoc) {
			const own = this.sheet;
			this.sheetDoc.adoptedStyleSheets = this.sheetDoc.adoptedStyleSheets.filter((sheet) => sheet !== own);
		}
		this.sheet = null;
		this.sheetDoc = null;
		this.styleEl?.remove();
		this.styleEl = null;
	}

	/**
	 * Switch the layer off until the returned function runs, as
	 * `CSSInjector.suspendOwnStyles` does for the big sheet: a check that wants
	 * to see the page without this plugin's paint must not leave the preview's.
	 */
	suspend(): () => void {
		const sheet = this.sheet;
		const el = this.styleEl;
		const sheetWas = sheet?.disabled ?? false;
		const elWas = el?.disabled ?? false;
		if (sheet) sheet.disabled = true;
		if (el) el.disabled = true;
		return () => {
			if (sheet) sheet.disabled = sheetWas;
			if (el) el.disabled = elWas;
		};
	}

	destroy(): void {
		this.clear();
	}

	/** The adopted sheet, made on first use. Null where adopted sheets do not exist. */
	private ensureSheet(): CSSStyleSheet | null {
		if (this.sheet) return this.sheet;
		const doc = activeDocument;
		if (!("adoptedStyleSheets" in doc)) return null;
		// Made with the target document's own window, as the big sheet is: a
		// sheet from another window's realm cannot be shared with a pop-out in
		// older Electron builds.
		const win = doc.defaultView ?? window;
		const sheet = new win.CSSStyleSheet();
		try {
			doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
		} catch {
			// The document holds a sheet adopted from a closed window. The
			// `<style>` element still carries the layer, so give up on the sheet
			// rather than throw the other sheets out to make room for it.
			return null;
		}
		this.sheet = sheet;
		this.sheetDoc = doc;
		return sheet;
	}

	/** The `<style>` element in the main window's head, made on first use. */
	private ensureStyleEl(): HTMLStyleElement {
		if (this.styleEl?.isConnected) return this.styleEl;
		const doc = this.app.workspace.containerEl.ownerDocument;
		const existing = doc.getElementById(PREVIEW_EL_ID);
		if (existing instanceof HTMLStyleElement) {
			this.styleEl = existing;
			return existing;
		}
		// The bare global `createEl` is deliberate, for the reason given at
		// `CSSInjector.ensureStyleEl`: it trips neither lint rule that the
		// `document.createElement` and `doc.createEl("style")` spellings do.
		const el = createEl("style");
		el.id = PREVIEW_EL_ID;
		doc.head.appendChild(el);
		this.styleEl = el;
		return el;
	}
}
