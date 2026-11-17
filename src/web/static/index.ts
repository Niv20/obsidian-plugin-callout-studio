/**
 * web/static/index.ts — the Quartz host, as a bundle of its own.
 *
 * `scripts/lib/webAssets.mjs` compiles this file on its own into the text the
 * Callout Studio Quartz plugin's `dist/index.js` is made of
 * (`scripts/lib/quartzPlugin.mjs`), after the core. It holds the host and the
 * small DOM it runs the renderer on, and no renderer: `web/core.ts` is a
 * separate bundle, handed to the host as an argument, so the plugin carries
 * the grammar once.
 *
 * `main.js` carries none of it. The Quartz plugin is released on its own,
 * from its own repository, and a vault only ever gets the note of callouts it
 * reads (`quartzNote.ts`). The Digital Garden hooks are the same arrangement,
 * in `gardenPlugin.ts`'s bundle.
 */
export { quartz } from "./quartz";
