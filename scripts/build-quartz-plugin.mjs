/**
 * scripts/build-quartz-plugin.mjs — `npm run quartz:build`.
 *
 * Writes the Callout Studio Quartz plugin to `dist/quartz-plugin/`, ready to
 * be the whole content of its own repository: `package.json` at the top and
 * the built entry point in `dist/`, as Quartz 5's installer and npm both
 * expect. See `scripts/lib/quartzPlugin.mjs` for what is in it, and
 * docs/internals-docs/20-build-test-release.md for how it is released.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildQuartzPlugin } from "./lib/quartzPlugin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "quartz-plugin");

const files = await buildQuartzPlugin(root);
rmSync(out, { recursive: true, force: true });
for (const [name, text] of Object.entries(files)) {
	const file = path.join(out, name);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, text, "utf8");
}

const kb = (text) => `${(Buffer.byteLength(text, "utf8") / 1024).toFixed(1)} KB`;
for (const [name, text] of Object.entries(files)) console.log(`  ${name.padEnd(20)} ${kb(text)}`);
console.log(`Quartz plugin written to ${path.relative(root, out)}/`);
