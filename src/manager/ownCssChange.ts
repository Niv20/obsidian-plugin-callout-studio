/**
 * manager/ownCssChange.ts — telling this plugin's own `css-change` apart.
 *
 * `CSSInjector` fires `css-change` when the CSS it generates moves, and every
 * listener hears it alongside the theme's and the snippets'. Most must react
 * to all of them; a listener whose answer depends only on the theme — the
 * claim check, which switches this plugin's CSS off while it measures — can
 * skip this one. Style Settings names its own the same way.
 */
export const OWN_CSS_CHANGE = { source: "callout-studio" } as const;

/** True for the `css-change` payload {@link OWN_CSS_CHANGE}. */
export function isOwnCssChange(data: unknown): boolean {
	return (
		typeof data === "object" &&
		data !== null &&
		(data as { source?: unknown }).source === OWN_CSS_CHANGE.source
	);
}
