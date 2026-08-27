/**
 * tests/modalBodyLayers.test.ts — 163 and 164: two things inside a window's
 * scroll body that a well-meaning sweep gets wrong.
 *
 * Both are rules a *correct* general principle would break, which is why they
 * need pinning rather than documenting. Somebody converting every
 * `--background-primary` to the surface token, or giving every sticky layer a
 * comfortable little offset, is doing the obviously right thing in both cases —
 * and is wrong in exactly these places.
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
 * Read from `styles.css` because neither is observable at runtime here: both
 * are questions about declarations, and the one that actually regressed is
 * invisible on a desktop entirely.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
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
