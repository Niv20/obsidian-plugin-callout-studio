/**
 * tests/modalBodyLayers.test.ts — 163, 164, 165 and 166: four things inside a
 * window's scroll body that a well-meaning sweep gets wrong.
 *
 * All four are rules a *correct* general principle would break, which is why
 * they need pinning rather than documenting. Somebody converting every
 * `--background-primary` to the surface token, giving every sticky layer a
 * comfortable little offset, taking an `!important` back out of a stylesheet
 * that says on every other page that it does not use them, or deleting a pair
 * of pseudo-elements that paint nothing anyone can see, is doing the obviously
 * right thing in all four cases — and is wrong in exactly these places.
 *
 * **163 — the two surfaces that must NOT follow the window.** `modalSurfaces`
 * says a surface meant to read as flush with the window paints
 * `var(--cs-surface, var(--background-primary))`, never the raw variable. These
 * two are the deliberate exceptions: `.cs-live-preview-body` and `.cs-gap-demo`
 * emulate a **note**, not a window, and a note really is painted
 * `--background-primary`. The live preview's entire promise is that a callout
 * renders in it exactly as it will in the user's note; painting it the modal's
 * colour would break that on the one platform the surface token exists for —
 * mobile dark, where `--modal-background` is repointed and the two stop being
 * the same colour. `modalSurfaces.test.ts` records them in a review list, which
 * says only that somebody looked; this file says *why*, and fails if the paint
 * is "fixed".
 *
 * **164 — a sticky layer sits at `top: 0`.** A sticky `top` is measured from
 * the **scrollport**, the scroller's padding box — not from the header rule
 * above it. So a positive offset parks an opaque layer that far *below* the
 * rule while the content is still sliding past underneath, and the strip in
 * between shows bare background with text scrolling through it. The window
 * looks like it is clipping early. `.callout-studio-preview-col` is where this
 * was found: at `top: 12px` the card holding every setting row's name and
 * description vanished 12px short of the line. The footer never had the problem
 * because nothing sticks upward from the bottom.
 *
 * **165 — the scroller that band sticks in has to start at the top.** `top: 0`
 * is only half the invariant. The offset is measured from the scroller's
 * *content* box, so a scroller carrying its own `padding-top` parks a `top: 0`
 * band that far down regardless — the same strip of bare background, arrived at
 * from the other end. The settings tab is the one scroller this plugin does not
 * own, and the reset that makes `top: 0` mean flush there has to survive a
 * theme.
 *
 * **166 — the band's paint needs a floor under it.** `background-color:
 * inherit` is only as opaque as the pane it copies, and on a good number of the
 * themes installed here the pane is see-through or the theme wins the
 * declaration outright. The `::before`/`::after` pair that answers it is invisible on every
 * theme where the band already works, which is most of them — so it reads as
 * dead weight and is not.
 *
 * Read from `styles.css` because none of them is observable at runtime here:
 * all four are questions about declarations, and the ones that actually
 * regressed are invisible on a desktop with no theme installed.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	compareSpecificity,
	specificityOf,
} from "../src/utils/cssSpecificity";
import { lineOf, readRepoFile } from "./support/sourceScan";

/* -------------------------------------------------------------------------- */
/* A very small stylesheet reader                                             */
/* -------------------------------------------------------------------------- */

interface Rule {
	selector: string;
	/** `["position: sticky", …]`, in source order, comments already gone. */
	decls: string[];
	/** Property names alone, in source order. */
	props: string[];
	/** Enclosing at-rule preludes, outermost first. */
	at: string[];
	/** 1-based line of the selector in the original file. */
	line: number;
}

const cssRaw = readRepoFile("styles.css");

/**
 * Every style rule in the file, flattened.
 *
 * `@media`/`@supports` blocks are descended into rather than treated as one
 * rule — a sticky layer nested in a responsive override is still a sticky
 * layer, and a reader that stopped at the at-rule would pass by not looking.
 * Comments are blanked rather than deleted so a line number still points at the
 * rule it names; `styles.css` explains itself at length and several of those
 * explanations contain the very declarations asserted about below.
 */
function parseRules(css: string): Rule[] {
	const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (m) =>
		m.replace(/[^\n]/g, " "),
	);
	const out: Rule[] = [];

	const walk = (text: string, offset: number, at: string[]): void => {
		let i = 0;
		let preludeStart = 0;
		let prelude = "";
		while (i < text.length) {
			if (text[i] !== "{") {
				if (prelude.trim() === "") preludeStart = i;
				prelude += text[i];
				i++;
				continue;
			}
			let depth = 1;
			let j = i + 1;
			while (j < text.length && depth > 0) {
				if (text[j] === "{") depth++;
				else if (text[j] === "}") depth--;
				j++;
			}
			const body = text.slice(i + 1, j - 1);
			const head = prelude.replace(/\s+/g, " ").trim();
			if (head.startsWith("@")) {
				walk(body, offset + i + 1, [...at, head]);
			} else {
				const decls = body
					.split(";")
					.map((d) => d.replace(/\s+/g, " ").trim())
					.filter((d) => d.length > 0);
				out.push({
					selector: head,
					decls,
					props: decls.map((d) => d.slice(0, d.indexOf(":")).trim()),
					at,
					line: lineOf(cssRaw, offset + preludeStart),
				});
			}
			prelude = "";
			i = j;
		}
	};

	walk(blanked, 0, []);
	return out;
}

const rules = parseRules(cssRaw);

/** The one rule with exactly this selector, or a thrown assertion. */
function ruleFor(selector: string): Rule {
	const found = rules.filter((r) => r.selector === selector);
	assert.strictEqual(found.length, 1, `expected one rule for \`${selector}\``);
	return found[0] as Rule;
}

/** The declared value of `prop` in `rule`, or undefined. */
function valueOf(rule: Rule, prop: string): string | undefined {
	const decl = rule.decls.find((d) => d.startsWith(`${prop}:`));
	return decl?.slice(prop.length + 1).trim();
}

describe("the stylesheet reader itself", () => {
	// Guards everything below: a parser that found nothing would make this file
	// vacuously green, which is the one outcome worse than a failure.
	it("found a substantial number of rules", () => {
		assert.ok(rules.length > 500, `only ${rules.length} rules parsed`);
	});

	it("descends into at-rules rather than stopping at them", () => {
		assert.ok(rules.some((r) => r.at.length > 0));
		assert.strictEqual(
			rules.some((r) => r.selector.startsWith("@")),
			false,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 163 — the two surfaces that emulate a note                                 */
/* -------------------------------------------------------------------------- */

/**
 * The exceptions, and what each one is standing in for.
 *
 * Every entry paints the raw variable **on purpose**. The list is closed: a
 * third surface claiming the exemption has to be added here, with the note that
 * says which Obsidian surface it is imitating.
 */
const NOTE_SURFACES = [
	{
		selector: ".cs-live-preview-body",
		/** Frame only — see the rule's own comment. */
		allowedProps: [
			"min-height",
			"max-height",
			"overflow",
			"background",
			"border-radius",
		],
		why: "hosts a real embedded Obsidian editor (or a MarkdownRenderer fallback); it IS a note",
	},
	{
		selector: ".cs-gap-demo",
		allowedProps: [
			"display",
			"min-height",
			"max-height",
			"overflow",
			"padding",
			"background",
		],
		why: "the heading-gap drag demo, stacked reading-view headings inside the same card",
	},
] as const;

describe("the surfaces that emulate a note keep painting --background-primary", () => {
	for (const surface of NOTE_SURFACES) {
		const rule = (): Rule => ruleFor(surface.selector);

		it(`${surface.selector} paints the raw variable — ${surface.why}`, () => {
			assert.strictEqual(
				valueOf(rule(), "background"),
				"var(--background-primary)",
				`${surface.selector} emulates a note, not the window. ` +
					"Following --cs-surface here would repaint it on mobile dark, " +
					"where --modal-background is not --background-primary — and the " +
					"preview would stop matching the note it is previewing.",
			);
		});

		it(`${surface.selector} does not reach for the surface token`, () => {
			// The failure this file is really for: a sweep that converts every
			// raw paint in the file, with no way to tell these two apart.
			assert.strictEqual(
				rule().decls.some((d) => d.includes("--cs-surface")),
				false,
			);
		});

		it(`${surface.selector} is not scoped to a window, so no scoped rule contradicts it`, () => {
			// `modalSurfaces.test.ts` bans the raw variables outright inside any
			// selector naming `.cs-modal`. These two are reachable from inside a
			// window but never say so in their selector, which is exactly why
			// that ban and this exemption can both be true.
			assert.strictEqual(rule().selector.includes("cs-modal"), false);
		});

		it(`${surface.selector} declares nothing that would change how content renders`, () => {
			// The promise is 1:1 with a note. A colour, a font or a padding on
			// the *content* would break it silently — it would still look fine,
			// just not like the note.
			const extra = rule().props.filter(
				(p) => !(surface.allowedProps as readonly string[]).includes(p),
			);
			assert.deepStrictEqual(
				extra,
				[],
				`${surface.selector} is a frame. Anything beyond ${surface.allowedProps.join(", ")} ` +
					"styles the note inside it, and the preview stops being 1:1.",
			);
		});
	}

	it("both are built as real reading-view surfaces in the code, not just painted like one", () => {
		// The paint is only half of it: both elements carry Obsidian's own
		// `markdown-preview-view`, which is what makes core's reading-view CSS
		// and the injected per-callout rules resolve as they do in a note.
		assert.match(
			readRepoFile("src/settings/GlobalStyleModal.ts"),
			/cs-gap-demo markdown-preview-view/,
		);
		assert.match(
			readRepoFile("src/settings/LiveCalloutPreview.ts"),
			/markdown-preview-view/,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 164 — every sticky layer sits flush                                        */
/* -------------------------------------------------------------------------- */

/**
 * Every sticky layer this plugin has, and the scroller each one sticks inside.
 *
 * Frozen so the next one cannot appear without somebody answering the question
 * this file is about. Nothing here is grandfathered — every one is at `top: 0`,
 * and the list exists to keep the next one there too.
 */
const STICKY_LAYERS: Record<string, string> = {
	".callout-studio-preview-col":
		"the callout / palette / style editors' preview column, inside .modal-content",
	".icon-picker-toolbar":
		"the icon picker's per-source search bar, inside .icon-picker-content",
	".callout-studio-vault-stats .cs-vault-stats-header":
		"the vault-statistics table header, inside .cs-vault-stats-list",
	".cs-quick-insert-toolbar":
		"the quick-insert window's search + source filter, inside .modal-content",
	".callout-studio-settings .cs-sticky-heading.setting-item":
		"the three callout-list section headings, inside .vertical-tab-content — " +
		"the settings tab is its own scroller, and the plugin renders straight into it",
};

/**
 * What a layer paints itself with, under either spelling.
 *
 * `background` and `background-color` are the same answer to the same question,
 * and a check that read only the shorthand would let a layer written the other
 * way past every assertion below without failing one — which for this file is
 * worse than a wrong answer, because it looks like a right one.
 */
function paintOf(rule: Rule): string | undefined {
	return valueOf(rule, "background") ?? valueOf(rule, "background-color");
}

const stickyRules = rules.filter((r) =>
	r.decls.some((d) => /^position:\s*(-webkit-)?sticky$/.test(d)),
);

describe("sticky layers", () => {
	it("found them", () => {
		assert.ok(stickyRules.length >= 4, `only ${stickyRules.length} found`);
	});

	it("are exactly the reviewed ones", () => {
		assert.deepStrictEqual(
			stickyRules.map((r) => r.selector).sort(),
			Object.keys(STICKY_LAYERS).sort(),
			"A new sticky layer has to be added to STICKY_LAYERS with the scroller it sticks inside — " +
				"the offset it needs depends on that scrollport and on nothing else.",
		);
	});

	for (const rule of stickyRules) {
		const label = rule.selector;

		it(`${label} sits flush at the top of its scrollport`, () => {
			// `top: 0` and no other spelling of it: the value is measured from
			// the scroller's padding box, so any positive offset leaves a strip
			// of bare background with content scrolling through it, below the
			// header rule the offset was probably meant to clear.
			const top = valueOf(rule, "top");
			assert.ok(
				top !== undefined,
				`${label} is sticky with no \`top\` — it never sticks at all (styles.css:${rule.line})`,
			);
			assert.match(
				top,
				/^0(px|%|rem|em)?$/,
				`${label} must stick at 0, not \`${top}\` (styles.css:${rule.line}). ` +
					"A sticky offset is measured from the scrollport, not from the header rule above it.",
			);
		});

		it(`${label} is not offset by a physical-property alias either`, () => {
			// `inset-block-start` is the same property under another name, and
			// `inset` sets all four at once. Either would slip past a check that
			// only reads `top`.
			for (const alias of ["inset-block-start", "inset"]) {
				const value = valueOf(rule, alias);
				if (value === undefined) continue;
				assert.match(
					value,
					/(^|\s)0(px|%|rem|em)?(\s|$)/,
					`${label} offsets its sticky edge through \`${alias}: ${value}\``,
				);
			}
		});
	}

	it("whichever ones paint a background paint it through the surface pair", () => {
		// A sticky layer is opaque by necessity — rows scroll under it — which
		// makes it precisely the kind of band `modalSurfaces` is about: on
		// mobile dark a raw `--background-primary` comes out as a black stripe
		// and a raw `--background-secondary` disappears into the window.
		//
		// `inherit` is the third sanctioned answer and the only one outside a
		// window. The surface pair is defined inside `.cs-modal` and nowhere
		// else, so on the settings tab it resolves to its own fallback — and
		// `--background-primary` is what Obsidian paints that pane on the
		// desktop *only*: `--settings-background` under `.is-mobile`,
		// `--modal-background` on a dark tablet. A band there has to match a
		// colour this stylesheet does not choose, which is exactly what
		// `inherit` is: it cannot disagree with the pane, on any platform,
		// because it is the pane's own computed colour.
		const painted = stickyRules.filter((r) => paintOf(r));
		assert.ok(painted.length >= 2, "expected at least two painted layers");

		for (const rule of painted) {
			assert.match(
				paintOf(rule) as string,
				/^(inherit|var\(--cs-surface(-raised)?, var\(--background-(primary|secondary)\)\))$/,
				`${rule.selector} (styles.css:${rule.line})`,
			);
		}
	});

	it("whichever ones paint a background also lift above the content", () => {
		// Painting alone is not enough: without a stacking order the rows that
		// scroll under an opaque band can still paint over it.
		for (const rule of stickyRules.filter((r) => paintOf(r))) {
			assert.ok(
				valueOf(rule, "z-index") !== undefined,
				`${rule.selector} is opaque and sticky but has no z-index (styles.css:${rule.line})`,
			);
		}
	});

	it("the one that inherits has something to inherit from", () => {
		// `background-color` is not an inherited property, so `inherit` on the
		// band is only half the chain: it takes the *wrapper's* computed colour,
		// and the wrapper's own initial value is `transparent`. Drop the
		// wrapper's declaration and the band silently stops being opaque —
		// nothing else in this file would notice, and rows would scroll through
		// a heading that still looks correctly positioned.
		const inheriting = stickyRules.filter((r) => paintOf(r) === "inherit");
		if (inheriting.length === 0) return;
		const wrapper = ruleFor(".callout-studio-settings .cs-sticky-section");
		assert.strictEqual(
			paintOf(wrapper),
			"inherit",
			`the sticky band inherits its paint, so ${wrapper.selector} has to carry it down ` +
				`from the pane (styles.css:${wrapper.line})`,
		);
	});

	it("nothing between the band and the scroller makes a new scrollport", () => {
		// A sticky box sticks inside its nearest scrolling ancestor. Give the
		// wrapper an `overflow` — or a `transform`, `filter`, `contain` or
		// `perspective`, which capture it a different way — and the heading
		// starts sticking to the wrapper it was supposed to be pinned *across*,
		// which looks like nothing happening at all.
		const wrapper = ruleFor(".callout-studio-settings .cs-sticky-section");
		for (const prop of [
			"overflow",
			"overflow-x",
			"overflow-y",
			"transform",
			"filter",
			"backdrop-filter",
			"contain",
			"perspective",
		]) {
			assert.strictEqual(
				valueOf(wrapper, prop),
				undefined,
				`${prop} on the section wrapper would capture the heading it is meant to ` +
					`let float (styles.css:${wrapper.line})`,
			);
		}
	});

	it("a row's colour circles don't outrank the band they scroll under", () => {
		// `.cs-color-circle-l/-r/-r2` carry their own `z-index: 2/1/0` so the
		// three overlap correctly with each other. Nothing forces that stack to
		// stay scoped to the widget, though — without a stacking context of its
		// own, those values are compared directly against whatever else shares
		// the nearest real one, which for a row inside these three sections is
		// the pinned heading's `z-index: 1`. The front circle would then outrank
		// the header it is supposed to disappear behind. `isolation: isolate`
		// (or an equivalent stacking-context trigger) on the shared container
		// keeps the 0/1/2 stack local.
		const circles = ruleFor(".cs-color-circles");
		assert.ok(
			valueOf(circles, "isolation") === "isolate" ||
				(valueOf(circles, "position") !== undefined &&
					valueOf(circles, "z-index") !== undefined),
			`${circles.selector} has no stacking context of its own, so its ` +
				`circles' z-index leaks past the widget and can outrank a sticky ` +
				`heading elsewhere on the page (styles.css:${circles.line})`,
		);
	});

	it("a folded heading is spaced the same above and below", () => {
		// Folded, `.cs-section-body` is `display: none` — there is no row left
		// to lend the bottom of the band its own visual weight, so the next
		// thing down is either another folded heading's divider or, for the
		// last section, an unrelated one. Either way the bottom now faces
		// exactly what the top padding was made larger for: a hairline with
		// nothing else beside it. `.is-collapsed` overrides padding-bottom to
		// match the top value so the title stays centred between the two
		// dividers instead of drifting toward the bottom one — asserted
		// against the shared variable, not a resolved pixel amount, so the two
		// stay locked together through a future re-tuning of either.
		const base = ruleFor(".callout-studio-settings .cs-sticky-heading.setting-item");
		const padBlock = valueOf(base, "padding-block");
		assert.ok(
			padBlock,
			`expected padding-block on ${base.selector} (styles.css:${base.line})`,
		);
		const [top] = padBlock.split(/\s+/);
		const collapsed = ruleFor(
			".callout-studio-settings .cs-sticky-heading.is-collapsed",
		);
		assert.strictEqual(
			valueOf(collapsed, "padding-bottom"),
			top,
			`folded heading's bottom padding should match its top padding (${top}) so it ` +
				`sits centred between the dividers above and below it (styles.css:${collapsed.line})`,
		);
	});
});

/* -------------------------------------------------------------------------- */
/* 165 — the scroller a band sticks in starts at the top                      */
/* -------------------------------------------------------------------------- */

/**
 * The settings pane is the one scrollport this plugin renders into rather than
 * builds, and `SettingsTab.display()` puts `callout-studio-settings` on the
 * scroller itself — `containerEl` IS `.vertical-tab-content`. Obsidian ships
 * that element with `padding-top: var(--size-4-12)`, and a sticky offset is
 * measured from the content box, so `styles.css` zeroes the padding and hands
 * the space to `.cs-header-row`'s margin instead. Obsidian does the identical
 * thing for its own pinned settings header one line away
 * (`.setting-page.vertical-tab-content { padding-top: 0 }`).
 *
 * That reset is a *precondition* of all four sticky headings in the tab, and it
 * used to be written at `(0,1,0)` — beating core only by source order, and
 * losing to any theme rule of equal weight, because a theme sheet loads after
 * this plugin's. ITS Theme's `.vertical-tab-content { padding: 35px }` is
 * exactly that: same weight, later sheet. Every heading then pinned 35px below
 * the top of the pane, with rows scrolling visibly through the strip above it.
 *
 * Not one theme's bug. Measured over the 257 themes installed in this vault, 26
 * declare padding on that element and 20 put a non-zero top inset back, at
 * weights from `(0,1,0)` (ITS Theme, NotSwift, Kakano, Terminal, Sandstorm,
 * Subtlegold, TerraFlow, Cybertron, Ono Sendai, Suddha, Pine Forest Berry)
 * through `(0,7,1)` (Maple) — one of them, Elegance, with `!important`.
 *
 * So the question is a cascade question and these checks resolve a cascade,
 * with the same `specificityOf` the theme report ships, against selectors
 * copied verbatim out of those themes. A tidy-up that drops the `!important` or
 * thins the selector fails here, naming the theme it would break, rather than
 * in a bug report about a pane that looks like it is clipping early.
 */

/** Which sheet a declaration is in. Later sheets win ties; themes load last. */
type Sheet = "core" | "plugin" | "theme";

const SHEET_ORDER: Record<Sheet, number> = { core: 0, plugin: 1, theme: 2 };

interface Declaration {
	/** A single complex selector — no commas; callers split the list first. */
	selector: string;
	important: boolean;
	sheet: Sheet;
}

/**
 * Whether `a` beats `b` for the same property on the same element.
 *
 * The whole cascade this question needs and no more: importance first, then
 * specificity, then sheet order. Origin never varies here — every declaration
 * in play is an author one.
 */
function winsOver(a: Declaration, b: Declaration): boolean {
	if (a.important !== b.important) return a.important;
	const bySpecificity = compareSpecificity(
		specificityOf(a.selector),
		specificityOf(b.selector),
	);
	if (bySpecificity !== 0) return bySpecificity > 0;
	return SHEET_ORDER[a.sheet] >= SHEET_ORDER[b.sheet];
}

/**
 * The top padding a rule declares, under any of the four spellings that reach
 * it. `padding-block-start` is one of them — flexcyon writes it that way, and
 * logical and physical longhands cascade in the same slot, so a check that read
 * only `padding-top` would call a real collision a miss.
 */
function topPaddingOf(
	rule: Rule,
): { value: string; important: boolean } | undefined {
	let found: { value: string; important: boolean } | undefined;
	for (const decl of rule.decls) {
		const match =
			/^(padding|padding-top|padding-block|padding-block-start)\s*:\s*(.+)$/.exec(
				decl,
			);
		if (!match) continue;
		const raw = match[2] as string;
		const important = /!important\s*$/.test(raw);
		const value = raw.replace(/!important\s*$/, "").trim();
		// The first component of the shorthand is the top edge.
		found = { value: firstComponent(value), important };
	}
	return found;
}

/** The first space-separated component of a value, `var(a b)` kept whole. */
function firstComponent(value: string): string {
	let depth = 0;
	for (let i = 0; i < value.length; i++) {
		const ch = value[i] as string;
		if (ch === "(") depth++;
		else if (ch === ")") depth--;
		else if (depth === 0 && /\s/.test(ch)) return value.slice(0, i);
	}
	return value;
}

/** Every rule written with exactly this selector — several are written twice. */
function rulesFor(selector: string): Rule[] {
	const found = rules.filter((r) => r.selector === selector);
	assert.ok(found.length > 0, `no rule for \`${selector}\``);
	return found;
}

/** A complex selector's subject — the rightmost compound it actually styles. */
function subjectOf(selector: string): string {
	const parts = selector.split(/\s*[>+~]\s*|\s+/).filter((p) => p.length > 0);
	return parts[parts.length - 1] ?? selector;
}

/**
 * Theme rules copied verbatim from the vault, each the reason its theme is
 * listed. Frozen: they are evidence, not examples, and re-deriving them means
 * re-reading 257 stylesheets.
 */
const PANE_PADDING_IN_THE_WILD: {
	theme: string;
	selector: string;
	declaration: string;
	important?: true;
}[] = [
	{
		theme: "Obsidian core",
		selector: ".vertical-tab-content",
		declaration: "padding-top: var(--size-4-12)",
	},
	{
		theme: "ITS Theme",
		selector: ".vertical-tab-content",
		declaration: "padding: 35px",
	},
	{
		theme: "NotSwift",
		selector: ".vertical-tab-content",
		declaration: "padding-top: 60px",
	},
	{
		theme: "Elegance",
		selector: ".vertical-tab-content",
		declaration: "padding-top: 20px !important",
		important: true,
	},
	{
		theme: "Willemstad",
		selector: ".modal .vertical-tab-content",
		declaration: "padding-top: var(--padding-tab-content-T)",
	},
	{
		theme: "Notation 2",
		selector: ".mod-settings div.vertical-tab-content",
		declaration: "padding: 36px 60px",
	},
	{
		theme: "LYT Mode",
		selector: ".modal .modal-content .vertical-tab-content",
		declaration: "padding: var(--size-4-8) var(--size-4-5) …",
	},
	{
		theme: "Velocity",
		selector: ".modal-container.mod-dim .vertical-tab-content",
		declaration: "padding: 32px",
	},
	{
		theme: "Elegance",
		selector:
			".modal.mod-settings .vertical-tab-content-container .vertical-tab-content",
		declaration: "padding-top: 30px",
	},
	{
		theme: "flexcyon",
		selector:
			"body.flexcyon-ascii-icon-set.flexcyon-ensure-plugin-icon:not([class*=iconic]) .modal.mod-settings .vertical-tab-content",
		declaration: "padding-block-start: 48px",
	},
	{
		theme: "Maple",
		selector:
			"body.modal-setting-header:not(.is-mobile):not(.is-popout-modal) .mod-settings .modal-content .vertical-tab-content-container .vertical-tab-content",
		declaration: "padding-top: var(--size-4-6)",
	},
];

/** Every rule that resets a top padding on the pane element itself. */
const paneResets = rules.filter(
	(r) =>
		subjectOf(r.selector).includes(".callout-studio-settings") &&
		topPaddingOf(r) !== undefined,
);

describe("the settings pane's own padding-top", () => {
	it("is reset in exactly one place", () => {
		assert.strictEqual(
			paneResets.length,
			1,
			"the reset that makes `top: 0` mean flush in the settings tab has to be " +
				"one rule, or the winner depends on which one a theme happens to outrank: " +
				paneResets.map((r) => `${r.selector} (styles.css:${r.line})`).join(", "),
		);
	});

	const reset = (): Rule => paneResets[0] as Rule;

	it("is zero, and spends the space it takes on the title row instead", () => {
		assert.strictEqual(topPaddingOf(reset())?.value, "0");
		// The pane is not simply flattened: the gap moves to `.cs-header-row`,
		// which is what keeps the tab starting where it always did. Two rules
		// share that selector — the row's own dressing and the gap — so this
		// asks whether any of them carries it, not which.
		const header = rulesFor(
			".callout-studio-settings .cs-header-row.setting-item",
		);
		assert.ok(
			header.some((r) => valueOf(r, "margin-top") !== undefined),
			"zeroing the pane's padding without a replacement gap on the title row " +
				"puts the plugin's name against the top edge",
		);
	});

	it("carries !important, because one theme's does", () => {
		// Elegance writes `padding-top: 20px !important` at (0,1,0). Nothing but
		// another `!important` outranks that, at any specificity — this is the
		// documented exception to the file's "specificity, not !important" house
		// style, not an oversight in it.
		assert.strictEqual(
			topPaddingOf(reset())?.important,
			true,
			`the pane reset loses to Elegance's own !important without one ` +
				`(styles.css:${reset().line})`,
		);
	});

	it("leaves a phone alone, and says so in the selector", () => {
		// Not an accident of weight any more: with `!important` the reset would
		// otherwise beat Obsidian's (0,5,0) phone rule, whose padding is
		// reserving the top of the screen for the floating back and close
		// buttons. Nothing pins there in the first place.
		assert.match(
			reset().selector,
			/:not\([^)]*\.is-phone[^)]*\)/,
			`the pane reset must exclude the phone explicitly (styles.css:${reset().line})`,
		);
		const phone = rulesFor(
			".is-phone .callout-studio-settings .cs-sticky-heading.setting-item",
		);
		assert.ok(phone.some((r) => valueOf(r, "position") === "static"));
		const phoneHeader = rulesFor(
			".is-phone .callout-studio-settings .cs-header-row.setting-item",
		);
		assert.ok(phoneHeader.some((r) => valueOf(r, "margin-top") === "0"));
	});
});

describe("the pane reset outranks the themes that put the padding back", () => {
	const ours = (): Declaration => ({
		selector: (paneResets[0] as Rule).selector,
		important: topPaddingOf(paneResets[0] as Rule)?.important === true,
		sheet: "plugin",
	});

	it("and the comparison is not vacuous — the shape that regressed still loses", () => {
		// The old reset, verbatim: same property, same element, `(0,1,0)`. If
		// this passed, every assertion below would pass for the wrong reason.
		const asItWas: Declaration = {
			selector: ".callout-studio-settings",
			important: false,
			sheet: "plugin",
		};
		const its: Declaration = {
			selector: ".vertical-tab-content",
			important: false,
			sheet: "theme",
		};
		assert.strictEqual(winsOver(asItWas, its), false);
	});

	for (const theme of PANE_PADDING_IN_THE_WILD) {
		it(`${theme.theme} — ${theme.declaration}`, () => {
			const theirs: Declaration = {
				selector: theme.selector,
				important: theme.important === true,
				sheet: theme.theme === "Obsidian core" ? "core" : "theme",
			};
			assert.ok(
				winsOver(ours(), theirs),
				`\`${theme.declaration}\` on \`${theme.selector}\` ` +
					`${specificityOf(theme.selector).join(",")}` +
					`${theirs.important ? " !important" : ""} would win, and every sticky ` +
					`heading in the settings tab would pin that far below the top of the pane ` +
					`with rows scrolling through the strip above it (styles.css:${(paneResets[0] as Rule).line})`,
			);
		});
	}
});

/* -------------------------------------------------------------------------- */
/* 166 — the floor under the band's paint                                     */
/* -------------------------------------------------------------------------- */

/**
 * `background-color: inherit` is exactly as opaque as the thing it copies, and
 * what it copies is a surface this plugin does not own. Replayed through a
 * headless Chrome against the real `app.css`, this stylesheet and one theme at
 * a time — the 257 installed in the development vault, in both colour schemes —
 * the band computes **transparent under a good many of them**, in two ways that
 * look nothing alike and break identically:
 *
 * - **Most of them leave the pane itself see-through**, so the chain has
 *   nothing opaque to carry down. Sodalite paints `.vertical-tab-content`
 *   `transparent` and puts the surface on the container behind it; TerraFlow's
 *   dark pane is glass; Velocity's whole window is, `--modal-background`
 *   included, at `oklch(… / 0.625)`.
 * - **Three win the band's own declaration**, listed verbatim below.
 *
 * The answer is a floor rather than a fight: a `::before` painting the theme's
 * own surface tokens *under* the band, and an `::after` repainting the band's
 * whole background over that. It reaches all but a few; the ones left are
 * themes that name no opaque surface at all (Blur, Transparent, Transient,
 * Rose Red), where the only thing left would be a colour invented here — see
 * the rules' own comment for why that is where it stops. Every part of the
 * arrangement is load-bearing
 * and none of it is obvious, which is what the checks below are for — drop the
 * `::after` and every theme's heading paint disappears under the floor; swap
 * the two and the same thing happens; drop `z-index: -1` and the pair covers
 * the title it is supposed to sit behind; give the floor one layer instead of
 * three and Velocity's glass window makes it see-through again; let it reach the
 * phone, where the band is `position: static` and so not a containing block,
 * and `inset: 0` sizes both pseudo-elements to the viewport.
 *
 * The obvious fix — `!important` on the band's own paint — is the wrong one,
 * and this is the file that can say why rather than assert it: Lagom's
 * declaration is already at the band rule's own `(0,3,0)` **and** important, so
 * an `!important` here would tie it and lose on sheet order. The last test
 * resolves that.
 */

const BAND = ".callout-studio-settings .cs-sticky-heading.setting-item";
const FLOOR_BEFORE = `body:not(.is-phone) ${BAND}::before`;
const FLOOR_AFTER = `body:not(.is-phone) ${BAND}::after`;

/**
 * The theme rules that beat the band's own `background-color`, copied verbatim
 * from the vault. Frozen: they are evidence, not examples. Lagom's is written
 * nested under `.mod-settings, .mod-narrow, .mod-confirmation`, and `&` carries
 * the most specific of that list — flattened here to the single selector it
 * cascades as, because that is the part the arithmetic needs.
 */
const BAND_PAINT_IN_THE_WILD: {
	theme: string;
	selector: string;
	declaration: string;
	important?: true;
	/** What the band computes to once this wins. */
	effect: string;
}[] = [
	{
		theme: "Elegance",
		selector: ".setting-item.setting-item-heading",
		declaration: "background-color: transparent !important",
		important: true,
		effect: "transparent, over an opaque pane",
	},
	{
		theme: "Lagom",
		selector: ".mod-settings .setting-item.setting-item-heading",
		declaration: "background-color: transparent !important",
		important: true,
		effect: "transparent, over an opaque pane",
	},
	{
		theme: "Micro Mike",
		selector:
			".modal.mod-settings :is(h1, h2, h3, h4, h5, h6, .setting-item-heading)",
		declaration: "background: var(--settingsHeaderGradient)",
		effect:
			"a gradient that is `rgba(…, 0.2)` at one end and transparent at the other",
	},
];

describe("the band's paint has a floor under it", () => {
	const shared = (): Rule => ruleFor(`${FLOOR_BEFORE}, ${FLOOR_AFTER}`);
	const before = (): Rule => ruleFor(FLOOR_BEFORE);
	const after = (): Rule => ruleFor(FLOOR_AFTER);

	it("is two pseudo-elements, boxed over the band and nothing else", () => {
		assert.strictEqual(valueOf(shared(), "content"), '""');
		assert.strictEqual(valueOf(shared(), "position"), "absolute");
		assert.strictEqual(valueOf(shared(), "inset"), "0");
	});

	it("sits behind the title rather than over it", () => {
		// The band is sticky *with* a `z-index`, so it is a stacking context of
		// its own: a negative-z child paints above its background and below its
		// content. At `auto` the two would be positioned descendants instead,
		// painted after the title — a band with its own name hidden behind it.
		assert.strictEqual(valueOf(shared(), "z-index"), "-1");
	});

	it("the floor is layered, so a glass window cannot see through it", () => {
		// `--settings-background` on top because it is the token core paints
		// this pane *with* — literally, under `.is-mobile`, and by definition on
		// the desktop, where it resolves through `--modal-background` to
		// `--background-primary` and the desktop rule paints that. Measured with
		// no theme, on desktop, tablet and phone in both schemes, the floor
		// comes out the pane's own colour every time; `--modal-background` alone
		// did not, because on a dark tablet core points the two at different
		// tokens. It stays as the fallback for a core too old to define the
		// newer name — `minAppVersion` is 1.7.2. `--background-primary`
		// underneath both, because a theme is free to make the settings surface
		// glass (Velocity's window is, at `oklch(… / 0.625)`) and a translucent
		// floor is no floor. All three are the theme's own surface tokens; a
		// colour invented here would be the stripe `modalSurfaces` prevents.
		assert.strictEqual(
			valueOf(before(), "--cs-band-floor"),
			"var(--settings-background, var(--modal-background))",
			`the floor takes the settings surface, not a guess at it (styles.css:${before().line})`,
		);
		assert.match(
			valueOf(before(), "background-image") ?? "",
			/^linear-gradient\(\s*var\(--cs-band-floor\),\s*var\(--cs-band-floor\)\s*\)$/,
			`painted as an image layer, so it sits over the last one (styles.css:${before().line})`,
		);
		assert.strictEqual(
			valueOf(before(), "background-color"),
			"var(--background-primary)",
			`the floor's last layer has to be one a theme is unlikely to make glass ` +
				`(styles.css:${before().line})`,
		);
	});

	it("the ::after carries the band's whole background, not just its colour", () => {
		// `background: inherit`, not `background-color: inherit`: the shorthand
		// takes the image with it, so a theme that paints the heading a gradient
		// (Micro Mike) still paints it — over the floor now instead of over the
		// rows. With the longhand the floor would flatten every such theme to a
		// colour, which is the failure this rule is meant to avoid, not cause.
		assert.strictEqual(
			valueOf(after(), "background"),
			"inherit",
			`(styles.css:${after().line})`,
		);
		assert.strictEqual(valueOf(after(), "background-color"), undefined);
		// And the band still has to *have* a background for it to inherit.
		assert.strictEqual(paintOf(ruleFor(BAND)), "inherit");
	});

	it("stays off the phone, where the band is not a containing block", () => {
		// `.is-phone` sends the band to `position: static`, which is no
		// containing block at all: `inset: 0` would then resolve against the
		// initial containing block and paint a viewport-sized rectangle behind
		// the settings pane. Nothing pins on a phone, so there is nothing for
		// the floor to be under.
		for (const rule of [shared(), before(), after()]) {
			assert.match(
				rule.selector,
				/^body:not\(\.is-phone\)/,
				`(styles.css:${rule.line})`,
			);
		}
	});

	it("contests no cascade — none of the three carries !important", () => {
		// The point of the floor is that it never argues with a theme. A theme
		// that wins the band's own `background-color` wins the `::after` along
		// with it and simply leaves more of the floor showing, and of the 257
		// themes measured not one paints or positions a pseudo-element on a
		// settings heading. An `!important` added here would be a fight this arrangement
		// exists to avoid — and one it would lose, see below.
		for (const rule of [shared(), before(), after(), ruleFor(BAND)]) {
			assert.strictEqual(
				rule.decls.some((d) => /!important/.test(d)),
				false,
				`(styles.css:${rule.line})`,
			);
		}
	});
});

describe("the themes that beat the band's own paint", () => {
	const ours = (): Declaration => ({
		selector: BAND,
		important: false,
		sheet: "plugin",
	});

	for (const theme of BAND_PAINT_IN_THE_WILD) {
		it(`${theme.theme} — ${theme.declaration}`, () => {
			// Not a regression to fix by out-weighing: these win, the floor
			// under them is what keeps the band opaque anyway, and this asserts
			// the first half so the second half is never mistaken for
			// belt-and-braces.
			const theirs: Declaration = {
				selector: theme.selector,
				important: theme.important === true,
				sheet: "theme",
			};
			assert.ok(
				winsOver(theirs, ours()),
				`${theme.theme} no longer beats the band's own paint — if that is because ` +
					`this plugin now out-weighs it, the floor is still what carries every ` +
					`theme whose pane is see-through, and must stay`,
			);
		});
	}

	it("and an !important on the band would still lose to Lagom", () => {
		// The reason the fix is a floor and not the obvious one. Elegance's
		// declaration is (0,2,0), which an important (0,3,0) would beat — but
		// Lagom's is (0,3,0) important already, so the plugin would have to
		// out-specify it, and then out-specify whatever a theme writes next, on
		// a property where guessing wrong paints a stripe across the pane.
		const lagom = BAND_PAINT_IN_THE_WILD.find((t) => t.theme === "Lagom");
		assert.ok(lagom);
		assert.strictEqual(
			winsOver(
				{ selector: BAND, important: true, sheet: "plugin" },
				{ selector: lagom.selector, important: true, sheet: "theme" },
			),
			false,
		);
	});
});
