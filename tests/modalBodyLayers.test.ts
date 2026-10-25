/**
 * tests/modalBodyLayers.test.ts — 163, 164 and 165: three things inside a
 * window's scroll body that a well-meaning sweep gets wrong.
 *
 * All three are rules a *correct* general principle would break, which is why
 * they need pinning rather than documenting. Somebody converting every
 * `--background-primary` to the surface token, or giving every sticky layer a
 * comfortable little offset, is doing the obviously right thing — and is wrong
 * in exactly these places.
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
 * **165 — the scroller a layer sticks in has to start at the top.** `top: 0`
 * is only half the invariant. The offset is measured from the scroller's
 * *content* box, so a scroller carrying its own `padding-top` parks a `top: 0`
 * layer that far down regardless — the same strip of bare background, arrived
 * at from the other end. The Quick insert window is where it matters.
 *
 * Read from `styles.css` because none of them is observable at runtime here:
 * all three are questions about declarations.
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
			// The corner's shape, like its radius, frames the note; it styles nothing inside.
			"corner-shape",
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
			readRepoFile("src/settings/stylePreview.ts"),
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
	".cs-quick-insert-toolbar":
		"the quick-insert window's search + source filter, inside .modal-content",
	".cs-combobox-group-label":
		"a dropdown's group heading, inside the .cs-combobox-menu scrollport and bounded by its group",
	".cs-meta-suggestion-heading":
		"the metadata autocomplete's group heading, a sibling of the rows inside Obsidian's .suggestion scrollport",
	".cs-recovery-comparison > thead":
		"each section of the Setup details comparison — its title row and column headings as one block — " +
		"inside the details window's .modal-content (its top padding moved into the report) and bounded by the section's table",
	".setting-group.cs-style-preview-group":
		"a style page's preview box (declarative/stylePages.ts), inside the settings page's .vertical-tab-content, " +
		"pinned under Obsidian's own .setting-page-titlebar, which sticks at 0 in the same scroller",
};

/**
 * The layers that stick under another sticky layer of the same scroller, so
 * their `top` is that layer's height (measured by the code into a variable),
 * not 0. The rule below holds for every other layer: an offset meant to clear
 * a *static* rule above leaves a strip of bare background, but one that clears
 * a pinned bar is where the content stops.
 */
const BELOW_A_PINNED_BAR: Record<string, string> = {
	".setting-group.cs-style-preview-group": "var(--cs-sticky-top, 0)",
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
		assert.ok(stickyRules.length >= 5, `only ${stickyRules.length} found`);
	});

	it("are exactly the reviewed ones", () => {
		assert.deepStrictEqual(
			stickyRules.map((r) => r.selector).sort(),
			Object.keys(STICKY_LAYERS).sort(),
			"A new sticky layer has to be added to STICKY_LAYERS with the scroller it sticks inside — " +
				"the offset it needs depends on that scrollport and on nothing else.",
		);
	});

	it("keeps dropdown group headings opaque over their scrolling options", () => {
		// The heading sits on its menu's face, so it must paint exactly what the
		// menu paints — a different value is a stripe across the list, and a
		// translucent one lets the rows it is hiding show through.
		//
		// The menu's paint is shared with the Fold selector's list, in one rule
		// for both. On a phone or tablet the list itself turns 90% opaque, as
		// Obsidian's menus do; the heading keeps the opaque face on purpose, for
		// the reason above, so that one rule is not compared here.
		assert.strictEqual(
			paintOf(ruleFor(".cs-combobox-group-label")),
			"var(--cs-menu-face)",
		);
		assert.strictEqual(
			paintOf(ruleFor(".cs-combobox-group-label")),
			paintOf(ruleFor(".cs-combobox-menu, .cs-palette-menu")),
			"the heading and the menu it is pinned in must not disagree",
		);
		assert.strictEqual(
			valueOf(ruleFor(".cs-combobox-menu.cs-combobox-menu-grouped"), "padding-block-start"),
			"0",
			"the menu must not leave a strip above its sticky group heading",
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
			const belowBar = BELOW_A_PINNED_BAR[label];
			if (belowBar !== undefined) {
				assert.strictEqual(top, belowBar, `${label} sticks at the pinned bar's measured height`);
				return;
			}
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
		//
		// One layer is on a different ground: a dropdown's group heading sits
		// inside its list, which is painted Obsidian's menu ground rather than
		// the window's colour (see "Dropdown popups look like Obsidian's
		// menus"). It cannot `inherit` either — its parent is an unpainted group
		// wrapper, which would hand it `transparent` — so it names the list's
		// own token.
		//
		// And one is outside any window: a sidebar's file heading sits in a vault
		// sidebar, whose pane is `--background-secondary`. The surface pair's
		// raised fallback is Obsidian's settings box colour, which is wrong
		// there, and its wrappers are unpainted, so it names the pane's colour.
		const painted = stickyRules.filter((r) => paintOf(r));
		assert.ok(painted.length >= 2, "expected at least two painted layers");

		const own: Record<string, RegExp> = {
			".cs-combobox-group-label": /^var\(--cs-menu-face\)$/,
			// Straight under Obsidian's pinned page title bar, so it paints what
			// that bar paints and the two read as one band. (`inherit` would get
			// `transparent` from the unpainted page content it sits in.)
			".setting-group.cs-style-preview-group": /^var\(--settings-background\)$/,
		};
		for (const rule of painted) {
			assert.match(
				paintOf(rule) as string,
				own[rule.selector] ??
					/^(inherit|var\(--cs-surface, var\(--background-primary\)\)|var\(--cs-surface-raised, var\(--setting-items-background\)\))$/,
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

	it("the metadata autocomplete's heading has a painted list to inherit from", () => {
		// Same chain, one level shorter: the heading sits straight in
		// Obsidian's `.suggestion` list, which is unpainted — the popup around
		// it is — so the list has to carry the popup's paint down.
		assert.strictEqual(paintOf(ruleFor(".cs-meta-suggestion-heading")), "inherit");
		assert.strictEqual(paintOf(ruleFor(".suggestion.cs-meta-suggestion-list")), "inherit");
	});

	it("a row's colour circles don't outrank a bar they scroll under", () => {
		// `.cs-color-circle-l/-r/-r2` carry their own `z-index: 2/1/0` so the
		// three overlap correctly with each other. Nothing forces that stack to
		// stay scoped to the widget, though — without a stacking context of its
		// own, those values are compared directly against whatever else shares
		// the nearest real one, such as a page's pinned title bar. The front
		// circle would then outrank the bar it is supposed to disappear behind.
		// `isolation: isolate` (or an equivalent stacking-context trigger) on
		// the shared container keeps the 0/1/2 stack local.
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

});

/* -------------------------------------------------------------------------- */
/* A window's scroller starts at the top                                      */
/* -------------------------------------------------------------------------- */

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

describe("the quick-insert sticky toolbar's scrollport inset", () => {
	// Repeats the shell's classes, to outrank the window body's 4px ring room.
	const body = (): Rule =>
		ruleFor(".cs-quick-insert.cs-modal.mod-scrollable-content > .modal-content");
	const intro = (): Rule =>
		ruleFor(
			".cs-quick-insert.cs-modal > .modal-content > .setting-item-description:first-child",
		);
	const toolbar = (): Rule => ruleFor(".cs-quick-insert-toolbar");

	it("starts the scrollport at zero so rows cannot pass through a gap", () => {
		assert.strictEqual(topPaddingOf(body())?.value, "0");
	});

	it("moves the resting inset onto content that scrolls away", () => {
		// The same 4px every other window keeps in its body, so the intro sits
		// as far under the title as any first row does.
		assert.strictEqual(
			valueOf(intro(), "padding-top"),
			"var(--size-2-2)",
		);
	});

	it("keeps the search focus ring inside the toolbar's own opaque paint", () => {
		assert.strictEqual(valueOf(toolbar(), "padding-top"), "12px");
		assert.strictEqual(
			paintOf(toolbar()),
			"var(--cs-surface, var(--background-primary))",
		);
		assert.ok(valueOf(toolbar(), "z-index"));
	});
});
