/** Render the real UI parts, then compose the nine website images into assets/website/. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const step of ["render.mjs", "compose.mjs"]) {
	const result = spawnSync(process.execPath, [path.join(here, step)], { stdio: "inherit" });
	if (result.status !== 0) process.exit(result.status ?? 1);
}
