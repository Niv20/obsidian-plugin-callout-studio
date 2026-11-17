/**
 * web/static/gardenPlugin.ts — the Digital Garden hooks, as a bundle of their own.
 *
 * `scripts/lib/webAssets.mjs` compiles this file into the text the Callout
 * Studio garden plugin's `index.js` is made of (`scripts/lib/gardenPlugin.mjs`),
 * after the core. Apart from the Quartz host (`index.ts`) because `main.js`
 * embeds that one and never writes this one: the garden plugin is released on
 * its own, and a vault only ever gets the note.
 */
export { garden } from "./garden";
