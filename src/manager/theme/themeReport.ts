/**
 * manager/theme/themeReport.ts — what one theme does to callouts, as facts a
 * person can test.
 *
 * Feeds `scripts/generate-theme-report.mjs`, which writes a compatibility
 * matrix over every theme installed in a vault. Nothing here is imported by
 * `src/main.ts`, so esbuild never bundles it; it lives under `src/` rather than
 * beside the script so it is typechecked and unit-tested like everything else,
 * the same arrangement `scripts/generate-icon-packs.mjs` uses for
 * `icons/data/codec.ts`.
 *
 * ## Why it reuses the plugin's own scanner
 *
 * The point of the document is to predict what a tester will *see*, and what
 * they see is decided by `scanCalloutClaims` — its `:not()` handling, its
 * comment stripping, its rule that `~=` names an id and `*=` does not. A
 * second, simpler parser written for the report would disagree with the
 * plugin somewhere and the disagreement would read as a plugin bug. So the
 * *Callout types it adds* column is literally the set the settings tab will
 * list, not an approximation of it.
 *
 * Comment stripping in particular is not optional: 117 of the 257 themes in
 * the dev vault embed a Style Settings `@settings` YAML block inside a CSS
 * comment, and that prose parses as selectors. Measured against the raw text,
 * the heaviest-selector column reported 260 class units for a theme whose real
 * maximum is one.
 *
 * ## What is deliberately not here
 *
 * Whether the plugin's override actually wins. That is a live-cascade question
 * and no static read answers it — `!important` counts and class-unit counts
 * are the inputs to a tester's judgement, not a substitute for it. Likewise
 * the 37 themes whose callouts are configured at runtime by Style Settings,
 * and flexcyon's `--callout-icon: attr(data-callout)`, whose id space is
 * unbounded. Each of those gets flagged in {@link ThemeReport.checks} so the
 * tester knows the row needs a human.
 */
import { classCountOf } from "../../utils/cssSpecificity";
import { splitSelectorList } from "../../utils/selectorText";
import { DEFAULT_CALLOUTS } from "../../defaultCallouts";
import { obsidianCalloutAttrId } from "../../utils/calloutId";
import { eachBlock, scanCalloutClaims, stripComments } from "./themeCalloutScan";
import { buildChecks } from "./themeReportChecks";

/** Every id Obsidian answers to out of the box, primary names and aliases. */
export const BUILT_IN_ATTR_IDS: ReadonlySet<string> = new Set(
	DEFAULT_CALLOUTS.flatMap((def) => [def.id, ...(def.aliases ?? [])]).map(
		(id) => obsidianCalloutAttrId(id),
	),
);

/** How far into callouts a theme goes. Lets a tester skip half the corpus. */
export type CalloutInvolvement = "none" | "generic" | "per-id";

/** How a theme puts an icon on a callout — or takes it away. */
export type IconMechanism = "none" | "var" | "mask" | "hidden";

export interface ThemeInput {
	name: string;
	version?: string;
	author?: string;
	minAppVersion?: string;
	css: string;
}

export interface ThemeReport {
	name: string;
	version: string;
	involvement: CalloutInvolvement;
	/** Callout types the settings tab will list for this theme, sorted. */
	addedIds: string[];
	/** Obsidian's own ids this theme repaints by name. */
	builtInsRestyled: number;
	/** Family selectors, as `*=column` strings — what may capture a user's id. */
	fuzzy: string[];
	icons: IconMechanism;
	/** Layout properties found on callout rules, sorted; empty when none. */
	layout: string[];
	/** Callout declarations carrying `!important`. */
	importantCount: number;
	/** Heaviest class-unit count on any callout selector. */
	maxClasses: number;
	/**
	 * The theme has a `:has()` callout rule, so how a callout looks depends on
	 * what is written *inside* it — the same id renders two ways.
	 */
	contentSensitive: boolean;
	/** Style Settings body classes that change callouts, if any. */
	styleSettings: string[];
	/** Generated, judgement-free test instructions. */
	checks: string[];
}

const LAYOUT_PROPS = [
	"display",
	"float",
	"position",
	"width",
	"max-width",
	"min-width",
	"grid-template-columns",
	"columns",
	"column-count",
	"transform",
];

/** `display: grid` is layout; `display: none` on an icon is not. */
function isLayoutDeclaration(name: string, value: string): boolean {
	if (!LAYOUT_PROPS.includes(name)) return false;
	if (name === "display") return /grid|flex/.test(value);
	if (name === "position") return /absolute|fixed/.test(value);
	return true;
}

interface RawFacts {
	hasCalloutRule: boolean;
	contentSensitive: boolean;
	importantCount: number;
	maxClasses: number;
	layout: Set<string>;
	iconVar: boolean;
	iconMask: boolean;
	iconHidden: boolean;
}

function gatherRawFacts(css: string): RawFacts {
	const facts: RawFacts = {
		hasCalloutRule: false,
		contentSensitive: false,
		importantCount: 0,
		maxClasses: 0,
		layout: new Set(),
		iconVar: false,
		iconMask: false,
		iconHidden: false,
	};

	eachBlock(stripComments(css), (prelude, body) => {
		if (!/callout/i.test(prelude)) return;
		facts.hasCalloutRule = true;
		const onIcon = /\.callout-icon/i.test(prelude);

		for (const part of splitSelectorList(prelude)) {
			if (!/callout/i.test(part)) continue;
			if (/:has\s*\(/i.test(part)) facts.contentSensitive = true;
			// Measured on the selector exactly as written, which is what
			// `scanCalloutClaims` does and what the cascade does. Blanking
			// `:not()` first — tempting, since the scanner blanks it before
			// reading *claims* out of the same string — would be a different
			// question answered wrongly: an anti-claim still carries its
			// argument's specificity, and Elegance's real 11-unit selector
			// gets six of those units from three `:not()` chains alone.
			//
			// `classCountOf` handles `:is()`, `:not()` and `:has()` the way the
			// spec does, taking each one's single most specific argument rather
			// than every class token inside it. A regex that counted the tokens
			// verbatim over-stated 38 of this vault's themes; that is the bug
			// `utils/cssSpecificity.ts` was split out to fix.
			const classes = classCountOf(part);
			if (classes > facts.maxClasses) facts.maxClasses = classes;
		}

		for (const piece of body.split(";")) {
			const colon = piece.indexOf(":");
			if (colon < 0) continue;
			const name = piece.slice(0, colon).trim().toLowerCase();
			const value = piece.slice(colon + 1).toLowerCase();
			if (name.length === 0 || /[{}]/.test(name)) continue;
			if (/!\s*important/.test(value)) facts.importantCount++;
			if (name === "--callout-icon") facts.iconVar = true;
			if (name.endsWith("mask-image") && onIcon) facts.iconMask = true;
			if (name === "display" && /none/.test(value) && onIcon) {
				facts.iconHidden = true;
			}
			if (isLayoutDeclaration(name, value)) facts.layout.add(name);
		}
	});

	return facts;
}

/**
 * Style Settings classes that touch callouts.
 *
 * Read from the **raw** text, unlike everything else here: the `@settings`
 * block lives inside a CSS comment, so the stripped copy the rest of this
 * module works from does not contain it. What is extracted is the body-class
 * switches themselves — `body:not(.pt-disable-callout-styling)` and friends —
 * because the class name is the actionable part: it is what a tester toggles
 * to isolate the theme's callout styling from the plugin's.
 */
function styleSettingsClasses(css: string): string[] {
	if (!/@settings/i.test(css)) return [];
	const found = new Set<string>();
	const re = /body(?:\.|:not\(\.)([A-Za-z0-9_-]*callout[A-Za-z0-9_-]*)/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(css)) !== null) {
		const cls = m[1];
		if (cls !== undefined && cls.length > 0) found.add(cls);
	}
	return [...found].sort();
}

/** Read every fact this report can state about one theme. */
export function analyzeTheme(input: ThemeInput): ThemeReport {
	const scan = scanCalloutClaims(input.css);
	const raw = gatherRawFacts(input.css);

	const named = [...scan.byId.keys()];
	const addedIds = named.filter((id) => !BUILT_IN_ATTR_IDS.has(id)).sort();
	const builtInsRestyled = named.filter((id) =>
		BUILT_IN_ATTR_IDS.has(id),
	).length;
	const fuzzy = [
		...new Set(scan.patterns.map(({ op, value }) => `${op}=${value}`)),
	].sort();

	const involvement: CalloutInvolvement =
		named.length > 0 || scan.patterns.length > 0
			? "per-id"
			: raw.hasCalloutRule
				? "generic"
				: "none";

	// Order matters: a mask paints over whatever `--callout-icon` produced, and
	// `display: none` beats both. The strongest wins, because that is the one
	// a tester will actually be looking at.
	const icons: IconMechanism = raw.iconHidden
		? "hidden"
		: raw.iconMask
			? "mask"
			: raw.iconVar
				? "var"
				: "none";

	const report: ThemeReport = {
		name: input.name,
		version: input.version ?? "",
		involvement,
		addedIds,
		builtInsRestyled,
		fuzzy,
		icons,
		contentSensitive: raw.contentSensitive,
		layout: [...raw.layout].sort(),
		importantCount: raw.importantCount,
		maxClasses: raw.maxClasses,
		styleSettings: styleSettingsClasses(input.css),
		checks: [],
	};
	report.checks = buildChecks(report);
	return report;
}

/**
 * Alphabetical by name, and specifically the alphabetical a person expects:
 * case-insensitive and diacritic-insensitive, so `iA Writer` files under I and
 * `Rosé Pine` next to `Rose Red` rather than after Z. Ten of the dev vault's
 * themes start lowercase and three carry diacritics or a typographic
 * apostrophe, so a plain `sort()` puts a visibly wrong tail on the document.
 *
 * Ties break on the raw name so the order is total, and therefore stable
 * across runs.
 */
export function sortThemeReports<T extends { name: string }>(rows: T[]): T[] {
	const collator = new Intl.Collator("en", {
		sensitivity: "base",
		numeric: true,
	});
	return [...rows].sort(
		(a, b) =>
			collator.compare(a.name, b.name) ||
			(a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
	);
}
