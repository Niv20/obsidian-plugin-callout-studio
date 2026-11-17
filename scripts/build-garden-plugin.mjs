/**
 * scripts/build-garden-plugin.mjs — `npm run garden:build`.
 *
 * Writes the Callout Studio garden plugin to `dist/garden-plugin/`, ready to be
 * the whole content of its own repository: `garden-plugin.json` at the top,
 * as the Digital Garden plugin's installer requires. See
 * `scripts/lib/gardenPlugin.mjs` for what is in it, and
 * docs/internals-docs/20-build-test-release.md for how it is released.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGardenPlugin } from "./lib/gardenPlugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "garden-plugin");

const files = await buildGardenPlugin(root);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [name, text] of Object.entries(files)) writeFileSync(path.join(out, name), text, "utf8");

const kb = (text) => `${(Buffer.byteLength(text, "utf8") / 1024).toFixed(1)} KB`;
for (const [name, text] of Object.entries(files)) console.log(`  ${name.padEnd(20)} ${kb(text)}`);
console.log(`Garden plugin written to ${path.relative(root, out)}/`);
