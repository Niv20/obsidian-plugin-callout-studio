/** Where render.mjs leaves the exported UI parts for compose.mjs to place. */
import { tmpdir } from "node:os";
import path from "node:path";

export const partsDir = () => process.env.WEBSITE_PARTS || path.join(tmpdir(), "callout-studio-website-parts");
