/**
 * web/webAssets.d.ts — types for the virtual module the build resolves.
 *
 * There is no file behind this specifier. `scripts/lib/webAssets.mjs` answers
 * it at bundle time, for `npm run build` and `npm test` alike, with the web
 * renderer and its hosts, each compiled on its own, and the heading/inline
 * slice of `styles.css`.
 *
 * Each `*_JS` is a script that assigns one global, named by the `*_GLOBAL`
 * beside it. A host's functions take the core as their first argument, so an
 * exported file is the core, then a host, then one call joining the two — see
 * `manager/web/targets.ts`.
 */
declare module "virtual:callout-studio-web-assets" {
	/** `src/web/core.ts`: the renderer and the grammar it imports. */
	export const WEB_CORE_JS: string;
	export const WEB_CORE_GLOBAL: string;
	/** `src/web/browser.ts`: the host for a visitor's browser. No renderer inside. */
	export const WEB_BROWSER_JS: string;
	export const WEB_BROWSER_GLOBAL: string;
	/**
	 * `src/web/static/index.ts`: the Quartz host, for the Quartz plugin's
	 * release and the tests. No renderer inside, and `main.js` imports neither.
	 */
	export const WEB_STATIC_JS: string;
	export const WEB_STATIC_GLOBAL: string;
	/**
	 * `src/web/static/gardenPlugin.ts`: the Digital Garden hooks, for the garden
	 * plugin's release and the tests. `main.js` imports neither, and drops both.
	 */
	export const WEB_GARDEN_JS: string;
	export const WEB_GARDEN_GLOBAL: string;
	/** The rules between the `@cs-web` markers in `styles.css`, comments removed. */
	export const WEB_STRUCTURAL_CSS: string;
}
