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
	styleEl?: { textContent?: string | null } | null;
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
 * A cheap identity for "the styling that is currently loaded".
 *
 * Theme name plus version plus the enabled snippet names. Deliberately *not* a
 * hash of the CSS itself: this is used to decide whether a re-scan is needed,
 * and hashing a megabyte to find out costs about as much as re-scanning it.
 * A theme edited in place without a version bump is the miss, and it resolves
 * the next time anything else changes.
 */
export function stylingSignature(app: App): string {
	const css = api(app);
	const name = css?.theme ?? "";
	const version = (name && css?.themes?.[name]?.version) || "";
	const snippets = enabledSnippetNames(app).join(",");
	return `${name}@${version}|${snippets}`;
}

/** The active theme's CSS text, or `""` when there is no theme. */
export function themeCss(app: App): string {
	return api(app)?.styleEl?.textContent ?? "";
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
