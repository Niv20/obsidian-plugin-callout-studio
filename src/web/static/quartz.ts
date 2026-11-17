/**
 * web/static/quartz.ts — the Callout Studio Quartz plugin's transformer: the
 * one plugin every Quartz site installs, with nobody's callouts in it.
 *
 * Quartz turns each note into HTML in Node and lets a transformer plugin edit
 * the tree on the way. Drawing the callouts there, rather than in the reader's
 * browser, is what makes them part of the page itself: Quartz computes the
 * search index, the RSS description and the link-preview text from that same
 * tree, so they come out clean, and a reader with JavaScript off sees what
 * everyone else sees. The site loads no script of ours at all.
 *
 * **Where the callouts come from.** The plugin is the same file for everyone
 * (`scripts/lib/quartzPlugin.mjs` builds it, and Quartz installs it from its
 * own repository), so the callouts come from the site: the note Callout
 * Studio writes in the vault, which reaches the content folder however the
 * user's notes do (`web/static/quartzNote.ts`). It is looked for in the
 * content folder the build was given (`ctx.argv.directory`) each time Quartz
 * asks the plugin for its rehype plugins or its resources — once per worker
 * and once for the pages, not once per note: a file named
 * `callout-studio-quartz.md` first, anywhere in the folder, and only where
 * there is none, every note for its code block. A note written by a later
 * Callout Studio, or changed by hand, is not drawn from: the site keeps
 * `[!tip]` as text and the build log says why. Nothing here throws into the
 * build, and a site with the plugin and no note builds as it did without the
 * plugin.
 *
 * **Keeping the note off the site.** The note says `draft: true` itself; here
 * it is also marked a draft and not for publishing, and given its property
 * back, as it passes through the transformer, which covers a tool that dropped
 * its properties on the way and a Quartz 4 site that publishes only
 * `publish: true`. The same object is a filter too (`shouldPublish`), which
 * Quartz 5 uses because the manifest says `["transformer", "filter"]`: it
 * drops the note even on a site that publishes its drafts on purpose. See
 * `quartzNote.ts` for why three ways.
 *
 * The same object serves Quartz 4 and Quartz 5. Both call the factory and read
 * `htmlPlugins` and `externalResources` off what it returns, and both pass the
 * build's context to each; they differ only in how a site names the plugin (an
 * `import` in `quartz.config.ts`, or a `source` in `quartz.config.yaml`), which
 * is the panel's and the user guide's business, not this file's.
 *
 * **Where it sits in the pipeline matters, and the site sets it.** After the
 * plugin that gives headings their ids, so `#tip-title` is still derived from
 * the text the author wrote and links to the heading keep working. Before the
 * one that computes the description and the search text, so both are read off
 * the finished callouts. Quartz 5 takes the place from the plugin's manifest
 * (`defaultOrder`); on Quartz 4 it is the line the user adds. When it finds
 * that text already computed, it says so in the build log instead of quietly
 * leaving `[!tip]` in the search index.
 *
 * Two things Quartz keeps outside the tree are handled by hand:
 *
 * - the table of contents is built earlier, from the Markdown, into
 *   `file.data.toc`; each entry's text is cleaned in place and its link left
 *   alone;
 * - the stylesheet goes out through `externalResources`, as a `<style>` in
 *   every page's head — see {@link styleElement} for why not as a `css`
 *   resource. Its dark rules are already written against `saved-theme`,
 *   Quartz's own attribute (see `manager/web/targets.ts`), so dark mode needs
 *   no script either.
 *
 * Node is handed in rather than imported (`fs`, `path`, `crypto`): this file
 * is bundled for no platform, and the tests run the same code on a pretend
 * site. The plugin's `index.js` passes the real modules.
 */
import type * as Core from "../core";
import type { WebBundleData } from "../webBundleData";
import { fromHast, hastHasText, toHast, type HastNode } from "./hastBridge";
import { parseIconNodes } from "./htmlFragment";
import { QUARTZ_NOTE_KEY, QUARTZ_NOTE_NAME } from "./quartzNote";
import { noteFenceRe, readNoteBody, splitFrontmatter } from "./webNote";

type CoreApi = typeof Core;

/** One entry of a folder, as `fs.readdirSync(folder, { withFileTypes: true })` gives it. */
export interface QuartzDirent {
	name: string;
	isDirectory(): boolean;
	isFile(): boolean;
	isSymbolicLink(): boolean;
}

/** As much of Node as the plugin uses. The plugin's `index.js` passes the real modules. */
export interface QuartzNode {
	fs: {
		readFileSync(file: string, encoding: "utf8"): string;
		readdirSync(folder: string, options: { withFileTypes: true }): QuartzDirent[];
		statSync(file: string): { isDirectory(): boolean; isFile(): boolean };
		realpathSync(file: string): string;
	};
	path: { join(...parts: string[]): string; relative(from: string, to: string): string };
	crypto: {
		createHash(algorithm: "sha256"): {
			update(text: string, encoding: "utf8"): { digest(encoding: "hex"): string };
		};
	};
}

/** The slice of Quartz's build context the plugin reads: the content folder it was given. */
export interface QuartzBuildCtx {
	argv?: { directory?: string };
}

/** The slice of a Quartz `VFile` this host reads and writes. */
export interface QuartzFile {
	path?: unknown;
	data?: {
		toc?: unknown;
		text?: unknown;
		frontmatter?: unknown;
		relativePath?: unknown;
		filePath?: unknown;
	};
}

/** One plugin instance, as Quartz 4 and 5 both shape a transformer, and Quartz 5 a filter. */
export interface QuartzTransformer {
	name: string;
	htmlPlugins(ctx?: QuartzBuildCtx): Array<() => (tree: HastNode, file?: QuartzFile) => void>;
	externalResources(ctx?: QuartzBuildCtx): { css: unknown[]; js: unknown[]; additionalHead: unknown[] };
	shouldPublish(ctx: unknown, content: [unknown, QuartzFile | undefined]): boolean;
}

/** What one look at the site found. */
export interface QuartzLoad {
	/** The callouts to draw, or `null` when there is no note this plugin can read. */
	data: WebBundleData | null;
	/** The note the data came from, from the top of the content folder; the folder where there is none. */
	file: string;
	/** Every note that carries our code block, from the top of the content folder: all kept off the site. */
	notes: ReadonlySet<string>;
	/** What the build log is told. Empty when all is well. */
	warnings: string[];
}

/** The content folder Quartz builds from when it is given none. */
const DEFAULT_DIRECTORY = "content";

/** The newest format of the data this plugin reads (`WebBundleData.version`). */
const FORMAT = 1;

const WHERE = "Settings → Callout Studio → Publish to the web → Quartz";

/**
 * The stylesheet as an element for Quartz's `additionalHead`.
 *
 * Quartz does take inline CSS as a resource, but it renders it as the text of
 * a `<style>` element, and its renderer (Preact) escapes text: every `"` and
 * `&` in the sheet reaches the browser as `&quot;` and `&amp;`, which inside
 * `<style>` are not entities but garbage. Attribute selectors and nesting are
 * most of this stylesheet, so that route is closed.
 *
 * `additionalHead` takes an element instead, and an element can carry its
 * content raw. Building one normally means importing Preact, which this file
 * cannot: it is bundled ahead of time and runs wherever a site keeps its
 * plugins. So the element is written out by hand, in the one shape Preact's
 * renderer asks of any element — a `type`, `props`, and an own `constructor`
 * of `undefined`, the marker it uses to tell an element from untrusted JSON.
 *
 * `</` is written `<\/`, which CSS reads as the same two characters, so
 * nothing in the sheet can close the element early.
 */
function styleElement(css: string): unknown {
	return {
		type: "style",
		props: { dangerouslySetInnerHTML: { __html: css.replace(/<\//g, "<\\/") } },
		key: null,
		ref: null,
		constructor: undefined,
	};
}

/** A note found in the content folder: where it is, from the top, and its path on disk. */
interface FoundNote {
	rel: string;
	file: string;
}

/**
 * Every note under `root`, as Quartz sees the folder: names that start with a
 * period are skipped (Quartz does not build them either), and so is
 * `node_modules`. A folder that is a link is followed, once.
 */
function listNotes(node: QuartzNode, root: string): FoundNote[] {
	const notes: FoundNote[] = [];
	const seen = new Set<string>();
	const walk = (folder: string, rel: string): void => {
		try {
			const real = node.fs.realpathSync(folder);
			if (seen.has(real)) return;
			seen.add(real);
		} catch {
			return;
		}
		let entries: QuartzDirent[];
		try {
			entries = node.fs.readdirSync(folder, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
			const file = node.path.join(folder, entry.name);
			const path = rel ? `${rel}/${entry.name}` : entry.name;
			let folderHere = entry.isDirectory();
			let fileHere = entry.isFile();
			if (entry.isSymbolicLink()) {
				try {
					const stat = node.fs.statSync(file);
					folderHere = stat.isDirectory();
					fileHere = stat.isFile();
				} catch {
					continue;
				}
			}
			if (folderHere) walk(file, path);
			else if (fileHere && /\.md$/i.test(entry.name)) notes.push({ rel: path, file });
		}
	};
	walk(root, "");
	return notes;
}

/** The file name a note's path ends in, compared as a file system without case would. */
const nameOf = (rel: string): string => (rel.split("/").pop() ?? rel).toLowerCase();

/** The usual place first, then by path: the order Obsidian's side picks the note it keeps current in. */
const byPreference = (a: string, b: string): number =>
	a === QUARTZ_NOTE_NAME ? -1 : b === QUARTZ_NOTE_NAME ? 1 : a < b ? -1 : a > b ? 1 : 0;

/** Whether `text` is a note with our code block in its body. */
const carriesData = (text: string): boolean => {
	if (!text.includes(QUARTZ_NOTE_KEY)) return false;
	const opener = noteFenceRe(QUARTZ_NOTE_KEY);
	return splitFrontmatter(text)
		.body.split(/\r?\n/)
		.some((line) => opener.test(line));
};

/** The plugin, with Node handed in — what the plugin's `index.js` exports as `CalloutStudio`. */
export function quartz(core: CoreApi, node: QuartzNode): (options?: unknown) => QuartzTransformer {
	/** The notes that carry our code block: those named for it if any do, else every note's. Never throws. */
	const findNotes = (directory: string): Array<FoundNote & { text: string }> => {
		const all = listNotes(node, directory);
		const read = (note: FoundNote): (FoundNote & { text: string }) | null => {
			try {
				return { ...note, text: node.fs.readFileSync(note.file, "utf8") };
			} catch {
				return null;
			}
		};
		const named = all.filter((note) => nameOf(note.rel) === QUARTZ_NOTE_NAME);
		const keep = (notes: FoundNote[]): Array<FoundNote & { text: string }> =>
			notes
				.map(read)
				.filter((note): note is FoundNote & { text: string } => note !== null && carriesData(note.text));
		const byName = keep(named);
		const found = byName.length > 0 ? byName : keep(all.filter((note) => !named.includes(note)));
		return found.sort((a, b) => byPreference(a.rel, b.rel));
	};

	/** Find the note in the content folder the build was given, and read it. Never throws. */
	const load = (ctx?: QuartzBuildCtx): QuartzLoad => {
		const directory = (ctx?.argv?.directory || DEFAULT_DIRECTORY).replace(/[\\/]+$/, "");
		const found = findNotes(directory);
		const notes = new Set(found.map((note) => note.rel));
		const [first, ...others] = found;
		const asText = (file: string, why: string, more: string[] = []): QuartzLoad => ({
			data: null,
			file,
			notes,
			warnings: [`${why} Heading and inline callouts stay as text.`, ...more],
		});
		if (!first) {
			return asText(
				directory,
				`No note with Callout Studio's callouts was found in ${directory}. In Obsidian, create it from ${WHERE}, then publish it as you do your other notes.`,
			);
		}
		const file = `${directory}/${first.rel}`;
		const twice =
			others.length > 0
				? [
						`More than one note carries Callout Studio's callouts. Using ${file}; delete ${others.map((note) => `${directory}/${note.rel}`).join(", ")}.`,
					]
				: [];
		const edited = `${file} was changed by hand and cannot be read. In Obsidian, select Update now in ${WHERE}, then publish the note again if a plugin publishes your notes.`;
		const block = readNoteBody(QUARTZ_NOTE_KEY, splitFrontmatter(first.text).body);
		if (!block) return asText(file, edited, twice);
		const fingerprint = node.crypto.createHash("sha256").update(block.json, "utf8").digest("hex");
		if (fingerprint !== block.fingerprint) return asText(file, edited, twice);
		let data: Partial<WebBundleData>;
		try {
			data = JSON.parse(block.json) as Partial<WebBundleData>;
		} catch {
			return asText(file, edited, twice);
		}
		if (typeof data.version === "number" && data.version > FORMAT) {
			return asText(
				file,
				`${file} was written by a newer Callout Studio. Update the Callout Studio Quartz plugin.`,
				twice,
			);
		}
		if (data.version !== FORMAT || !Array.isArray(data.defs)) return asText(file, edited, twice);
		return { data: data as WebBundleData, file, notes, warnings: twice };
	};

	const safely = (ctx?: QuartzBuildCtx): QuartzLoad => {
		try {
			return load(ctx);
		} catch (error) {
			const file = ctx?.argv?.directory || DEFAULT_DIRECTORY;
			return { data: null, file, notes: new Set(), warnings: [`Could not start (${String(error)}).`] };
		}
	};

	/** A page's path from the top of the content folder, as Quartz gives it or as its path on disk says. */
	const relOf = (file: QuartzFile | undefined, ctx?: QuartzBuildCtx): string | null => {
		const data = file?.data;
		if (typeof data?.relativePath === "string") return data.relativePath.replace(/\\/g, "/");
		const onDisk =
			typeof data?.filePath === "string" ? data.filePath : typeof file?.path === "string" ? file.path : null;
		if (onDisk === null) return null;
		return node.path.relative(ctx?.argv?.directory || DEFAULT_DIRECTORY, onDisk).replace(/\\/g, "/");
	};

	/**
	 * The note on its way through the transformer: a draft, not for
	 * publishing, and carrying its property, whatever happened to its
	 * properties before it reached the site.
	 */
	const keepOff = (file: QuartzFile): void => {
		const data = (file.data ??= {});
		const frontmatter =
			data.frontmatter && typeof data.frontmatter === "object"
				? (data.frontmatter as Record<string, unknown>)
				: (data.frontmatter = {} as Record<string, unknown>);
		frontmatter.draft = true;
		frontmatter.publish = false;
		frontmatter[QUARTZ_NOTE_KEY] ??= FORMAT;
	};

	const transformWith = (data: WebBundleData): ((tree: HastNode, file?: QuartzFile) => void) => {
		const renderer = core.createWebRenderer(data, {
			parseIcon: (markup) => parseIconNodes(markup) as unknown as Node[],
		});
		let warned = false;
		return (tree, file) => {
			const toc = file?.data?.toc;
			if (Array.isArray(toc)) {
				for (const entry of toc as Array<{ text?: unknown }>) {
					if (typeof entry.text !== "string") continue;
					const cleaned = renderer.outlineTitle(entry.text);
					if (cleaned !== null) entry.text = cleaned;
				}
			}

			if (!hastHasText(tree, "[!")) return;
			if (!warned && typeof file?.data?.text === "string") {
				warned = true;
				console.warn(
					"[Callout Studio] runs after the Description plugin, so search and RSS text still show [!id]. " +
						"Move it before Description (Quartz 4: earlier in `transformers`; Quartz 5: a lower `order`).",
				);
			}
			const root = fromHast(tree);
			renderer.process(root as unknown as HTMLElement);
			toHast(root, tree);
		};
	};

	return () => ({
		name: "CalloutStudio",
		// Quiet: it runs in every worker. The build log hears it once, from
		// `externalResources`, which Quartz asks once for the pages.
		htmlPlugins: (ctx) => {
			const { data, notes } = safely(ctx);
			const draw = data ? transformWith(data) : null;
			return [
				() => (tree, file) => {
					const rel = relOf(file, ctx);
					if (file && rel !== null && notes.has(rel)) {
						keepOff(file);
						return;
					}
					draw?.(tree, file);
				},
			];
		},
		externalResources: (ctx) => {
			const { data, warnings } = safely(ctx);
			for (const warning of warnings) console.warn(`[Callout Studio] ${warning}`);
			return {
				css: [],
				js: [],
				additionalHead: data?.css ? [styleElement(data.css)] : [],
			};
		},
		// Quartz 5 only: the transformer above has marked the note by its property.
		shouldPublish: (_ctx, [, file]) => {
			const frontmatter = file?.data?.frontmatter;
			return !(frontmatter && typeof frontmatter === "object" && QUARTZ_NOTE_KEY in frontmatter);
		},
	});
}
