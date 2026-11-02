/**
 * tests/support/readingHarness.ts — scaffolding for the reading-view
 * post-processor suite.
 *
 * Not a `*.test.ts`, so `scripts/run-tests.mjs` never treats it as an entry
 * point; it is bundled into each suite that imports it.
 *
 * `createCalloutReadingPostProcessor` takes exactly two things: a rendered DOM
 * block, and a `MarkdownPostProcessorContext` whose only member it touches is
 * `getSectionInfo`. Both are modelled here and nothing else is.
 *
 * The section source is the interesting half. It is what makes the processor
 * refuse an escaped `\[!id]`, a `> # [!id]` line inside a callout, and a
 * `# [!id](url)` link — and it is deliberately *absent* in embeds and during PDF
 * export, which is a different code path rather than a degraded one. So
 * {@link ReadingHarness.run} takes it as an explicit argument: pass a string for
 * "this block's source", pass a full {@link SectionSource} to prove the
 * `lineStart`/`lineEnd` slice, and pass nothing at all for the no-source path.
 * Every call is counted, because "fetched at most once per block, and only when
 * a candidate makes it necessary" is a claim in the file's own header.
 */
// Listed first: importing it installs the DOM globals before anything under
// test loads (see tests/support/fakeDom.ts).
import { asEl, html, type FakeElement } from "./fakeDom";
import type { MarkdownPostProcessorContext } from "obsidian";
import { CalloutRegistry } from "../../src/manager/CalloutRegistry";
import { createCalloutReadingPostProcessor } from "../../src/reading/calloutPostProcessor";
import type { CalloutDefinition, PluginSettings } from "../../src/types";

type Registry = InstanceType<typeof CalloutRegistry>;

/** A `getSectionInfo` answer, as Obsidian shapes it: whole file + line range. */
export interface SectionSource {
	/** The WHOLE note, not the block — the processor slices it itself. */
	text: string;
	lineStart: number;
	lineEnd: number;
}

export interface ReadingHarness {
	registry: Registry;
	/** Live settings — `registry.settings`, the same object main.ts hands over. */
	settings: PluginSettings;
	/**
	 * Run the processor over `root`. `source` is what `getSectionInfo` answers:
	 * a string is treated as the block's own lines, and omitting it models the
	 * embed / PDF-export path where Obsidian answers `null`.
	 */
	run(root: FakeElement, source?: string | SectionSource): FakeElement;
	/** Parse `markup`, run the processor over it, and hand the root back. */
	render(markup: string, source?: string | SectionSource): FakeElement;
	/** How many times `getSectionInfo` was called across every `run`. */
	sectionReads(): number;
}

/** A registry seeded exactly as a first run seeds it, plus whatever a test adds. */
export function readingHarness(): ReadingHarness {
	const registry = new CalloutRegistry();
	registry.load(null);
	const host = { registry, settings: registry.settings };
	const process = createCalloutReadingPostProcessor(host);
	let sectionReads = 0;

	const run = (root: FakeElement, source?: string | SectionSource): FakeElement => {
		const ctx = {
			getSectionInfo: () => {
				sectionReads++;
				if (source === undefined) return null;
				if (typeof source !== "string") return source;
				return {
					text: source,
					lineStart: 0,
					lineEnd: source.split("\n").length - 1,
				};
			},
		} as unknown as MarkdownPostProcessorContext;
		process(asEl(root), ctx);
		return root;
	};

	return {
		registry,
		settings: registry.settings,
		run,
		render: (markup, source) => run(html(markup), source),
		sectionReads: () => sectionReads,
	};
}

/** One neutral user callout to vary from — Lucide, so no artwork is involved. */
export function addCallout(registry: Registry, over: Partial<CalloutDefinition> = {}): void {
	registry.add({
		id: "quiet",
		displayName: "Quiet",
		icon: { type: "lucide", value: "pencil" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	});
}
