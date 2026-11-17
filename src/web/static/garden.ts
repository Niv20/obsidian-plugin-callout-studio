/**
 * web/static/garden.ts — the Callout Studio garden plugin's hooks: the one
 * plugin every garden installs, with nobody's callouts in it.
 *
 * The plugin is the same file for everyone (`scripts/lib/gardenPlugin.mjs`
 * builds it), so the callouts have to come from the garden itself. They come
 * in the note Callout Studio writes and the user publishes
 * (`web/static/gardenNote.ts`). At config time — before Eleventy reads a
 * single note — this host walks the garden's notes for the ones with the
 * `callout-studio-web` property, picks one, checks it, and then:
 *
 * - `setupMarkdown` draws the heading and inline callouts with its data, the
 *   same way the per-vault plugin did (`eleventy.ts`);
 * - `setupEleventy` keeps every such note off the site — it is data, not a
 *   page — and serves the stylesheet it carries at
 *   {@link GARDEN_STYLESHEET_URL}, which the plugin's `head.njk` links.
 *
 * Which note: the one at the path Callout Studio writes first, else the first
 * by path — the same order Obsidian's side picks the note it keeps current
 * (`manager/web/webNoteLocation.ts`). A note written by a later Callout
 * Studio, or changed by hand, is not read: the site keeps `[!tip]` as text
 * and the build log says why. Nothing here throws into the build.
 *
 * Node is handed in rather than required (`fs`, `path`, `crypto`, the working
 * directory): this file is bundled for no platform, and the tests run the
 * same code on a pretend garden.
 */
import type * as Core from "../core";
import type { WebBundleData } from "../webBundleData";
import { eleventy, type MarkdownIt } from "./eleventy";
import {
	GARDEN_NOTE_FORMAT,
	GARDEN_NOTE_KEY,
	GARDEN_NOTE_PATH,
	GARDEN_STYLESHEET_URL,
	gardenNoteFormat,
	readGardenNoteBody,
	splitFrontmatter,
} from "./gardenNote";

type CoreApi = typeof Core;

/** As much of Node as the hooks use. The garden plugin's last line passes the real modules. */
export interface GardenNode {
	fs: {
		readdirSync(
			dir: string,
			options: { withFileTypes: true },
		): ReadonlyArray<{
			name: string;
			isDirectory(): boolean;
			isFile(): boolean;
		}>;
		readFileSync(file: string, encoding: "utf8"): string;
	};
	path: {
		join(...parts: string[]): string;
		resolve(...parts: string[]): string;
		relative(from: string, to: string): string;
		sep: string;
	};
	crypto: {
		createHash(algorithm: "sha256"): {
			update(text: string, encoding: "utf8"): { digest(encoding: "hex"): string };
		};
	};
	cwd(): string;
}

/** What the garden's plugin loader passes each hook. */
export interface GardenHookContext {
	pluginDir?: string;
}

/** As much of Eleventy's configuration API as `setupEleventy` uses. */
export interface EleventyConfig {
	ignores?: { add(path: string): unknown };
	addGlobalData?(name: string, value: unknown): unknown;
	addTemplate?(virtualPath: string, content: string, data: Record<string, unknown>): unknown;
}

/** What one look at the garden found. */
export interface GardenLoad {
	/** The callouts to draw, or `null` when there is no note this plugin can read. */
	data: WebBundleData | null;
	/** Every note with the property, relative to the garden's root, for Eleventy to skip. */
	ignore: string[];
	/** The note the data came from, relative to the notes folder. */
	source: string | null;
	/** What the build log is told, once. */
	warnings: string[];
}

export interface GardenHooks {
	setupMarkdown(md: MarkdownIt, context?: GardenHookContext): void;
	setupEleventy(config: EleventyConfig, context?: GardenHookContext): void;
	/** The look itself, for the tests. Done once per build and remembered. */
	load(context?: GardenHookContext): GardenLoad;
}

/** Global data the stylesheet template and `head.njk` read. */
export const GARDEN_GLOBAL = "calloutStudio";

const WHERE = "Settings → Callout Studio → Publish to the web → Digital Garden";

interface Candidate {
	/** Relative to the notes folder, with forward slashes. */
	rel: string;
	file: string;
	text: string;
	format: number;
}

/** The data, if `value` is a snapshot this version can draw. */
function asBundle(value: unknown): WebBundleData | null {
	if (!value || typeof value !== "object") return null;
	const data = value as Partial<WebBundleData>;
	return data.version === 1 && Array.isArray(data.defs) ? (data as WebBundleData) : null;
}

export function garden(core: CoreApi, node: GardenNode): GardenHooks {
	const { fs, path } = node;
	let found: GardenLoad | null = null;
	let warned = false;

	const posix = (p: string): string => p.split(path.sep).join("/");

	const walk = (dir: string, into: string[]): void => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full, into);
			else if (entry.isFile() && entry.name.endsWith(".md")) into.push(full);
		}
	};

	const look = (context?: GardenHookContext): GardenLoad => {
		const root = context?.pluginDir ? path.resolve(context.pluginDir, "..", "..", "..") : node.cwd();
		const notes = path.join(root, "src", "site", "notes");
		const files: string[] = [];
		try {
			walk(notes, files);
		} catch {
			// No notes folder: nothing published yet.
		}

		const candidates: Candidate[] = [];
		for (const file of files) {
			const text = fs.readFileSync(file, "utf8");
			// Most notes never mention it; only those are parsed.
			if (text.indexOf(GARDEN_NOTE_KEY) === -1) continue;
			const format = gardenNoteFormat(splitFrontmatter(text).frontmatter);
			if (format === null) continue;
			candidates.push({ rel: posix(path.relative(notes, file)), file, text, format });
		}
		candidates.sort((a, b) =>
			a.rel === GARDEN_NOTE_PATH
				? -1
				: b.rel === GARDEN_NOTE_PATH
					? 1
					: a.rel < b.rel
						? -1
						: a.rel > b.rel
							? 1
							: 0,
		);

		const ignore = candidates.map((candidate) => posix(path.relative(node.cwd(), candidate.file)));
		const warnings: string[] = [];
		if (candidates.length === 0) {
			warnings.push(
				`No note with the ${GARDEN_NOTE_KEY} property was found, so heading and inline callouts stay as text. ` +
					`In Obsidian, write it from ${WHERE}, then publish it.`,
			);
			return { data: null, ignore, source: null, warnings };
		}

		const problems: string[] = [];
		for (const candidate of candidates) {
			if (candidate.format > GARDEN_NOTE_FORMAT) {
				problems.push(
					`${candidate.rel} was written by a newer Callout Studio. Update the Callout Studio garden plugin.`,
				);
				continue;
			}
			const block = readGardenNoteBody(splitFrontmatter(candidate.text).body);
			const fingerprint = block
				? node.crypto.createHash("sha256").update(block.json, "utf8").digest("hex")
				: null;
			let data: WebBundleData | null = null;
			if (block && fingerprint === block.fingerprint) {
				try {
					data = asBundle(JSON.parse(block.json));
				} catch {
					data = null;
				}
			}
			if (!data) {
				problems.push(
					`${candidate.rel} was changed by hand and cannot be read. In Obsidian, select Update now in ${WHERE}, then publish the note again.`,
				);
				continue;
			}
			if (candidates.length > 1) {
				const others = candidates.filter((other) => other !== candidate).map((other) => other.rel);
				warnings.push(
					`More than one note has the ${GARDEN_NOTE_KEY} property. Using ${candidate.rel}; delete ${others.join(", ")}.`,
				);
			}
			return { data, ignore, source: candidate.rel, warnings };
		}
		warnings.push(...problems, "Heading and inline callouts stay as text.");
		return { data: null, ignore, source: null, warnings };
	};

	const load = (context?: GardenHookContext): GardenLoad => {
		if (found) return found;
		try {
			found = look(context);
		} catch (error) {
			found = {
				data: null,
				ignore: [],
				source: null,
				warnings: [
					`Could not read the garden's notes (${String(error)}). Heading and inline callouts stay as text.`,
				],
			};
		}
		if (!warned) {
			warned = true;
			for (const warning of found.warnings) console.warn(`[Callout Studio] ${warning}`);
		}
		return found;
	};

	return {
		load,
		setupMarkdown(md, context) {
			const { data } = load(context);
			if (!data) return;
			const drawn: WebBundleData = { ...data };
			delete drawn.css;
			eleventy(core, drawn).setupMarkdown(md);
		},
		setupEleventy(config, context) {
			const { data, ignore } = load(context);
			for (const file of ignore) config.ignores?.add(file);
			if (!data?.css) return;
			config.addGlobalData?.(GARDEN_GLOBAL, { stylesheet: GARDEN_STYLESHEET_URL, css: data.css });
			// A template of its own, whose only output is the stylesheet: the
			// rules are data here, so Nunjucks never parses a byte of them.
			config.addTemplate?.("callout-studio-stylesheet.njk", `{{ ${GARDEN_GLOBAL}.css | safe }}`, {
				permalink: GARDEN_STYLESHEET_URL,
				eleventyExcludeFromCollections: true,
				layout: false,
			});
		},
	};
}
