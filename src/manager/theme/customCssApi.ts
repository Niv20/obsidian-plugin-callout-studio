/**
 * manager/theme/customCssApi.ts — the one place `app.customCss` is named.
 *
 * None of this is in `obsidian.d.ts`. It is real and stable in practice (the
 * shape below is what ships in 1.13.7, and most of it predates 1.0), but it is
 * still somebody else's private field, so every access here is optional and
 * every reader below degrades to "no theme information" rather than throwing.
 * A plugin that crashes because Obsidian renamed an internal is worse than one
 * that quietly stops offering a convenience.
 *
 * `cssSnippetExport.ts` declares a two-field version of this for its own use;
 * that one stays where it is, since it writes rather than reads.
 */
import type { App } from "obsidian";

interface ThemeManifest {
	name?: string;
	version?: string;
}

interface CustomCssApi {
	/** Active theme name; `""` for Obsidian's default. */
	theme?: string;
	themes?: Record<string, ThemeManifest | undefined>;
	/** The one `<style>` holding the theme's CSS. */
	styleEl?: { textContent?: string | null; sheet?: CSSStyleSheet | null } | null;
	/** Snippet names, sorted, enabled or not. */
	snippets?: string[];
	enabledSnippets?: Set<string>;
	/** One `<style>` per *enabled* snippet, in `snippets` order. */
	extraStyleEls?: Array<{ textContent?: string | null } | undefined>;
}

function api(app: App): CustomCssApi | undefined {
	return (app as App & { customCss?: CustomCssApi }).customCss;
}

/** The active theme's name, or `null` when Obsidian's default is in use. */
export function activeThemeName(app: App): string | null {
	const name = api(app)?.theme;
	return typeof name === "string" && name.length > 0 ? name : null;
}

/**
 * True only when Obsidian says, in so many words, that its Default theme is in
 * use — `app.customCss.theme` is the empty string.
 *
 * Not the same question as `activeThemeName(app) === null`, which is also what a
 * missing or renamed `customCss` reads as. "I cannot tell" has to answer *no*
 * for anything that decides whether the plugin may paint over a theme, so this
 * is the reader for that decision and `activeThemeName` stays the one for
 * "which theme should I name to the user".
 */
export function usesDefaultTheme(app: App): boolean {
	return api(app)?.theme === "";
}

/**
 * A cheap identity for "the styling that is currently loaded".
 *
 * Theme name plus version plus the enabled snippet names. Deliberately *not* a
 * hash of the CSS itself: this is used to decide whether a re-scan is needed,
 * and hashing a megabyte to find out costs about as much as re-scanning it.
 * A theme edited in place without a version bump is the miss, and it resolves
 * the next time anything else changes.
 */
export function stylingSignature(app: App): string {
	return `${themeSignature(app)}|${enabledSnippetNames(app).join(",")}`;
}

/**
 * The theme half of {@link stylingSignature}: name and version, no snippets.
 *
 * For an answer about the theme's own rules - the claim check's verdicts -
 * which a snippet switched on or off does not invalidate.
 */
export function themeSignature(app: App): string {
	const css = api(app);
	const name = css?.theme ?? "";
	const version = (name && css?.themes?.[name]?.version) || "";
	return `${name}@${version}`;
}

/** The active theme's CSS text, or `""` when there is no theme. */
export function themeCss(app: App): string {
	return api(app)?.styleEl?.textContent ?? "";
}

/**
 * The browser's parsed copy of the theme, or `null`.
 *
 * Read only by `ThemeClaimCheck`, which switches single rules off and back on
 * inside one synchronous task to see whether they change anything on screen.
 */
export function themeSheet(app: App): CSSStyleSheet | null {
	return api(app)?.styleEl?.sheet ?? null;
}

/**
 * Have the browser parse the theme's `<style>` again from its own text,
 * discarding any change made to the parsed copy. `ThemeClaimCheck`'s last
 * resort if a rule it switched off would not switch back on.
 */
export function reparseTheme(app: App): void {
	const el = api(app)?.styleEl;
	if (el) reparseStyle(el);
}

/**
 * Parse a `<style>` again from its own text. Changes made to the parsed copy
 * never reach the text, so this is the exact original, whatever was changed.
 * The element mutates, so Obsidian's window relay copies it to every window
 * that holds a clone of it.
 */
export function reparseStyle(el: { textContent?: string | null }): void {
	const text = el.textContent;
	if (typeof text === "string") el.textContent = text;
}

/** Whether the theme's `<style>` can be reached at all — the switch's precondition. */
export function hasThemeStyle(app: App): boolean {
	return api(app)?.styleEl != null;
}

/**
 * The `<style>` holding the active theme in `doc`, or `null`.
 *
 * In the main window that is Obsidian's own element. Every other window — a
 * pop-out, the 1.14 Settings window, the hidden window a PDF export prints
 * from — holds a clone Obsidian copied from it (`cloneNode`), each parsed on
 * its own. A clone carries nothing else to know it by, so it is found by its
 * text, length first. The main window's element still holding the text while a
 * clone has not caught up yet is not a match, which is right: the relay is
 * about to replace that clone.
 */
export function themeStyleIn(app: App, doc: Document): HTMLStyleElement | null {
	const own = api(app)?.styleEl as (HTMLStyleElement & { ownerDocument?: Document }) | null | undefined;
	if (!own) return null;
	if (own.ownerDocument === doc) return own;
	const text = own.textContent ?? "";
	if (text.length === 0 || !doc.head) return null;
	for (const el of Array.from(doc.head.children)) {
		if (el.tagName !== "STYLE") continue;
		const candidate = el.textContent ?? "";
		if (candidate.length === text.length && candidate === text) return el as HTMLStyleElement;
	}
	return null;
}

/** Enabled snippet names, in the order Obsidian loads them. */
export function enabledSnippetNames(app: App): string[] {
	const css = api(app);
	const all = css?.snippets;
	const on = css?.enabledSnippets;
	if (!Array.isArray(all) || !on) return [];
	return all.filter((name) => on.has(name));
}

/**
 * Each enabled snippet's CSS text.
 *
 * `extraStyleEls` is index-aligned to the *enabled* subset, not to `snippets`,
 * which is the one thing about this API that is easy to get wrong: a vault with
 * snippets `[a, b, c]` and only `c` enabled has a single element at index 0.
 */
export function enabledSnippetCss(app: App): string[] {
	const els = api(app)?.extraStyleEls;
	if (!Array.isArray(els)) return [];
	return enabledSnippetNames(app).map(
		(_name, i) => els[i]?.textContent ?? "",
	);
}
