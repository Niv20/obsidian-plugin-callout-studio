/**
 * tests/themeAppearanceProbe.test.ts — the measuring half, and what it costs.
 *
 * The interpretation of a readout is pinned in `themeAppearance.test.ts`. What
 * is pinned here is everything around it, which is where this class can hurt
 * the user rather than merely be wrong:
 *
 * **It must not measure more often than the answers change.** A pass renders
 * every theme-owned callout through `MarkdownRenderer`, which is real work on a
 * slow mobile launch. The cache is keyed on the active styling plus the
 * light/dark mode plus the id set, so a repaint costs nothing and a theme
 * switch costs one pass.
 *
 * **A failure must not freeze the answers.** If a pass throws, the signature is
 * cleared so the next repaint retries — and until it succeeds every surface
 * falls to the neutral placeholder rather than to a stored Studio colour.
 *
 * **An id must never be misattributed.** The batch reads each rendered
 * callout's own `data-callout` rather than counting positions, because the
 * moment the rendered list and the requested list disagree — by one extra
 * callout, one missing, one reordered — position hands every id after that
 * point its neighbour's colour, and a wrong colour looks plausible enough that
 * nobody reports it. Ids that cannot render are still dropped up front.
 *
 * **A stale reading is worse than none.** `invalidate` drops the measurements
 * as well as the signature. The settings tab repaints during the gap (the
 * sweep's own `onChange`), so anything kept there is drawn as though it were
 * the incoming theme's.
 *
 * The `obsidian` module is a stub here and its `MarkdownRenderer.render`
 * produces no DOM, so a measured pass legitimately finds nothing. That is the
 * right shape for the scheduling assertions; the mapping ones install a
 * renderer that emits callouts, which is still bookkeeping — the cascade is
 * what no fake DOM can supply, and `themeAppearance.test.ts` pins that half.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { installFakeDom } from "./support/fakeDom";
import { ThemeAppearanceProbe } from "../src/manager/theme/ThemeAppearanceProbe";
import type { ComputedStyleReader } from "../src/manager/theme/ThemeAppearanceProbe";
import { MarkdownRenderer } from "obsidian";
import type { App } from "obsidian";

installFakeDom();

/** An app whose styling signature the test can move. */
function fakeApp(theme = "ITS Theme"): App {
	return {
		customCss: {
			theme,
			themes: { [theme]: { version: "1.0.0" } },
			snippets: [],
			enabledSnippets: new Set<string>(),
			styleEl: { textContent: "" },
			extraStyleEls: [],
		},
	} as unknown as App;
}

/** The same, but with a theme the test can switch under the probe's feet. */
function switchableApp(): { app: App; setTheme: (name: string) => void } {
	const customCss = {
		theme: "ITS Theme",
		themes: { "ITS Theme": { version: "1.0.0" }, Lumines: { version: "2.0.0" } },
		snippets: [],
		enabledSnippets: new Set<string>(),
		styleEl: { textContent: "" },
		extraStyleEls: [],
	};
	return {
		app: { customCss } as unknown as App,
		setTheme: (name: string) => {
			customCss.theme = name;
		},
	};
}

/** A computed-style reader that answers everything with fixed values. */
function reader() {
	let calls = 0;
	const read = () => {
		calls++;
		return { getPropertyValue: () => "" };
	};
	return { read, calls: () => calls };
}

describe("what a caller sees before anything is measured", () => {
	it("answers the unknown appearance, never a stored colour", () => {
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		const out = probe.get("recite");
		assert.strictEqual(out.accent, null);
		assert.strictEqual(out.background, null);
		assert.strictEqual(out.icon.kind, "unknown");
	});

	it("looks up by attribute form, whichever spelling it is asked for", () => {
		// A caller holds `my note`; the theme wrote `my-note`. One of the two
		// has to normalise, and doing it here means no caller can forget.
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		probe.results();
		assert.strictEqual(probe.get("my note").icon.kind, "unknown");
		assert.strictEqual(probe.get("my-note").icon.kind, "unknown");
	});
});

describe("how often it measures", () => {
	it("runs once for a signature, and not again", async () => {
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		let ready = 0;
		await probe.ensure(["recite"], () => ready++);
		assert.strictEqual(ready, 1);
		await probe.ensure(["recite"], () => ready++);
		assert.strictEqual(ready, 1, "the second call is a no-op");
	});

	it("runs again when the id set changes", async () => {
		// A newly minted theme row has to be measured even though the theme
		// itself did not change.
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		let ready = 0;
		await probe.ensure(["recite"], () => ready++);
		await probe.ensure(["recite", "infobox"], () => ready++);
		assert.strictEqual(ready, 2);
	});

	it("ignores the order the ids arrive in", async () => {
		// They come from `flatMap` over a list whose sort can shift; treating
		// that as a change would re-measure on every repaint.
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		let ready = 0;
		await probe.ensure(["a", "b"], () => ready++);
		await probe.ensure(["b", "a"], () => ready++);
		assert.strictEqual(ready, 1);
	});

	it("ignores a duplicate id", async () => {
		// `vaultIdFormsFor` yields the id and its aliases, and the attribute
		// form of two of them can collide.
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		let ready = 0;
		await probe.ensure(["my note", "my-note"], () => ready++);
		await probe.ensure(["my-note"], () => ready++);
		assert.strictEqual(ready, 1);
	});

	it("runs again after invalidate — the css-change path", async () => {
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		let ready = 0;
		await probe.ensure(["recite"], () => ready++);
		probe.invalidate();
		await probe.ensure(["recite"], () => ready++);
		assert.strictEqual(ready, 2);
	});

	it("clears its answers when there is nothing left to measure", async () => {
		// Switching to a theme that owns no callouts. Keeping the old map would
		// leave rows wearing the previous theme's colours.
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		await probe.ensure(["recite"], () => {});
		await probe.ensure([], () => {});
		assert.strictEqual(probe.results().size, 0);
	});
});

/**
 * Make the stubbed renderer emit one callout per id, in the order given, each
 * carrying a title whose "colour" is its own id. Returns the restore function.
 *
 * The order and the contents are the point: they are what a real renderer, a
 * theme's own nested markup, or an id that half-renders can make disagree with
 * the list that was asked for.
 */
function emitCallouts(order: readonly string[]): () => void {
	// Reached as a plain property rather than as a method: the stub's `render`
	// never touches `this`, and reading it as one trips `unbound-method`.
	const renderer = MarkdownRenderer as unknown as {
		render: (app: unknown, markdown: string, el: HTMLElement) => Promise<void>;
	};
	const original = renderer.render;
	renderer.render = (_app, _markdown, el) => {
		for (const id of order) {
			const callout = el.createDiv({
				cls: "callout",
				attr: { "data-callout": id },
			});
			callout.createDiv({
				cls: "callout-title",
				attr: { "data-probe": `color-${id}` },
			});
		}
		return Promise.resolve();
	};
	return () => {
		renderer.render = original;
	};
}

/** Answers `color` with whatever the element was labelled with. */
const labelReader: ComputedStyleReader = (el) => ({
	getPropertyValue: (prop: string) =>
		prop === "color" ? (el.getAttribute("data-probe") ?? "") : "",
});

describe("mapping rendered callouts back to ids", () => {
	it("reads each callout's own id, not its position", async () => {
		// The requested list is sorted (`bug`, `warning`); the renderer emits
		// them the other way round. By position both rows would wear the
		// other's colour, and both would look perfectly plausible.
		const restore = emitCallouts(["warning", "bug"]);
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), labelReader);
			await probe.ensure(["bug", "warning"], () => {});
			assert.strictEqual(probe.get("bug").accent, "color-bug");
			assert.strictEqual(probe.get("warning").accent, "color-warning");
		} finally {
			restore();
		}
	});

	it("keeps the rest right when one id renders nothing", async () => {
		// The failure this replaces: one short list shifted every id after it,
		// and the id that fell off the end lost its swatch entirely while its
		// neighbours quietly showed the wrong colour.
		const restore = emitCallouts(["abstract", "question", "warning"]);
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), labelReader);
			await probe.ensure(
				["abstract", "note", "question", "warning"],
				() => {},
			);
			assert.strictEqual(probe.get("note").accent, null, "unmeasured");
			assert.strictEqual(probe.get("question").accent, "color-question");
			assert.strictEqual(probe.get("warning").accent, "color-warning");
		} finally {
			restore();
		}
	});

	it("ignores a callout nobody asked about", async () => {
		// A theme's own markup can nest a callout inside the one being
		// measured; it must not claim a row.
		const restore = emitCallouts(["infobox", "bug"]);
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), labelReader);
			await probe.ensure(["bug"], () => {});
			assert.strictEqual(probe.get("bug").accent, "color-bug");
			assert.strictEqual(probe.results().size, 1);
		} finally {
			restore();
		}
	});
});

/**
 * A callout built the way the `--callout-title-color` / masked-`::before`
 * family really renders one: core's SVG present but switched off, the theme's
 * drawing on the pseudo-element, and `.callout-title` still wearing core's
 * colour while `.callout-title-inner` wears the theme's.
 *
 * Every value is carried on an attribute {@link attrReader} reads back, which
 * is how a fake DOM stands in for a cascade: the node a value sits on is the
 * whole assertion, because reading the *wrong* node is the bug.
 */
function emitThemedCallouts(ids: readonly string[], hue: string): () => void {
	const renderer = MarkdownRenderer as unknown as {
		render: (app: unknown, markdown: string, el: HTMLElement) => Promise<void>;
	};
	const original = renderer.render;
	renderer.render = (_app, _markdown, el) => {
		for (const id of ids) {
			const callout = el.createDiv({
				cls: "callout",
				attr: { "data-callout": id, "data-self-background-color": "none" },
			});
			const title = callout.createDiv({
				cls: "callout-title",
				attr: { "data-self-color": "core-blue" },
			});
			const icon = title.createDiv({
				cls: "callout-icon",
				attr: {
					"data-self-display": "flex",
					"data-before-content": '""',
					"data-before-mask-image": `mask-${id}`,
					"data-before-background-color": `${hue}-${id}`,
				},
			});
			// Present, and invisible. Core injected the drawing; the theme
			// switched it off. Its tag is immaterial — the probe reaches for
			// `firstElementChild`, whatever core put there.
			icon.createDiv({ attr: { "data-self-display": "none" } });
			title.createDiv({
				cls: "callout-title-inner",
				attr: { "data-self-color": `${hue}-title-${id}` },
			});
		}
		return Promise.resolve();
	};
	return () => {
		renderer.render = original;
	};
}

/**
 * A callout as the **Sanctum** family builds one: the stencil is on
 * `.callout-icon` *itself*, in the `-webkit-` spelling only, and core's drawing
 * is still in the slot and still **displayed** — because a mask on the element
 * clips its descendants, so the theme never had to switch the child off.
 *
 * That is what makes it the interesting DOM shape rather than a second copy of
 * {@link emitThemedCallouts}: every signal the ladder used to consult says
 * "core drew this" — the slot is laid out, the child is laid out, the markup is
 * real — and the only evidence to the contrary is which *node* the mask is on.
 */
function emitSanctumCallouts(ids: readonly string[]): () => void {
	const renderer = MarkdownRenderer as unknown as {
		render: (app: unknown, markdown: string, el: HTMLElement) => Promise<void>;
	};
	const original = renderer.render;
	renderer.render = (_app, _markdown, el) => {
		for (const id of ids) {
			const callout = el.createDiv({
				cls: "callout",
				attr: { "data-callout": id, "data-self-background-color": `bg-${id}` },
			});
			const title = callout.createDiv({
				cls: "callout-title",
				attr: { "data-self-color": `accent-${id}` },
			});
			const icon = title.createDiv({
				cls: "callout-icon",
				attr: {
					"data-self-display": "flex",
					// Sanctum writes only the prefixed spelling; Sanctum reborn
					// only the unprefixed one. `maskOf` asks for both.
					"data-self--webkit-mask-image": `stencil-${id}`,
					"data-self-background-color": `accent-${id}`,
					"data-before-content": "none",
				},
			});
			// Core's icon, present *and* drawn — the mask above is what disposes
			// of it, so the theme left it alone.
			icon.createDiv({ attr: { "data-self-display": "block" } });
			title.createDiv({
				cls: "callout-title-inner",
				attr: { "data-self-color": `accent-${id}` },
			});
		}
		return Promise.resolve();
	};
	return () => {
		renderer.render = original;
	};
}

/** Answers each property from the node it was declared on, pseudo included. */
const attrReader: ComputedStyleReader = (el, pseudo) => ({
	getPropertyValue: (prop: string) =>
		el.getAttribute(`data-${pseudo ? "before" : "self"}-${prop}`) ?? "",
});

describe("reading the nodes a theme actually paints", () => {
	it("reproduces the stencil, not the child it clips — Sanctum", async () => {
		// The reported failure end to end. Every earlier signal says core drew
		// this callout; only the node carrying the mask says otherwise, and
		// reading it wrong put `lucide-pencil` on all 47 rows of each theme.
		const restore = emitSanctumCallouts(["annotation"]);
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), attrReader);
			await probe.ensure(["annotation"], () => {});
			const icon = probe.get("annotation").icon;
			assert.strictEqual(icon.kind, "mask", "the stencil, not core's svg");
			assert.strictEqual(
				icon.kind === "mask" && icon.image,
				"stencil-annotation",
			);
		} finally {
			restore();
		}
	});

	it("still reads the accent off the title for a stencil on the slot", async () => {
		// `.callout-icon`'s paint is `currentColor` — core's, inherited — so it
		// must not be promoted to the accent the way a painted `::before` is.
		const restore = emitSanctumCallouts(["annotation"]);
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), attrReader);
			await probe.ensure(["annotation"], () => {});
			assert.strictEqual(probe.get("annotation").accent, "accent-annotation");
			assert.strictEqual(probe.get("annotation").background, "bg-annotation");
		} finally {
			restore();
		}
	});

	it("does not report artwork the theme switched off", async () => {
		// The reported failure end to end: `.callout-icon` is laid out, so the
		// probe used to record core's still-present SVG and every row drew the
		// default pencil. The slot's own `display` cannot see that.
		const restore = emitThemedCallouts(["bitcoin"], "red");
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), attrReader);
			await probe.ensure(["bitcoin"], () => {});
			const icon = probe.get("bitcoin").icon;
			assert.strictEqual(icon.kind, "mask", "the ::before, not the hidden svg");
			assert.strictEqual(icon.kind === "mask" && icon.image, "mask-bitcoin");
		} finally {
			restore();
		}
	});

	it("takes the accent off the ::before, not off .callout-title", async () => {
		const restore = emitThemedCallouts(["bitcoin"], "red");
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), attrReader);
			await probe.ensure(["bitcoin"], () => {});
			assert.strictEqual(probe.get("bitcoin").accent, "red-bitcoin");
			assert.notStrictEqual(probe.get("bitcoin").accent, "core-blue");
		} finally {
			restore();
		}
	});

	it("reads .callout-title-inner when core draws the icon", async () => {
		// The same theme family without the icon trick: the title hook alone.
		const renderer = MarkdownRenderer as unknown as {
			render: (app: unknown, md: string, el: HTMLElement) => Promise<void>;
		};
		const original = renderer.render;
		renderer.render = (_app, _md, el) => {
			const callout = el.createDiv({
				cls: "callout",
				attr: { "data-callout": "note" },
			});
			const title = callout.createDiv({
				cls: "callout-title",
				attr: { "data-self-color": "core-blue" },
			});
			title.createDiv({
				cls: "callout-title-inner",
				attr: { "data-self-color": "theme-violet" },
			});
			return Promise.resolve();
		};
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), attrReader);
			await probe.ensure(["note"], () => {});
			assert.strictEqual(probe.get("note").accent, "theme-violet");
		} finally {
			renderer.render = original;
		}
	});
});

describe("what survives an invalidate", () => {
	it("forgets the readings, not just the signature", async () => {
		// `css-change` means the answers may all have changed. The settings tab
		// repaints inside the gap before the next pass lands, so anything kept
		// here is drawn as if the incoming theme had produced it.
		const restore = emitCallouts(["bug"]);
		try {
			const probe = new ThemeAppearanceProbe(fakeApp(), labelReader);
			await probe.ensure(["bug"], () => {});
			assert.strictEqual(probe.get("bug").accent, "color-bug");
			probe.invalidate();
			assert.strictEqual(probe.get("bug").accent, null);
			assert.strictEqual(probe.results().size, 0);
		} finally {
			restore();
		}
	});
});

describe("ids it refuses to render", () => {
	it("drops one that would break the batch, and still reports ready", async () => {
		// `> [!a]b]` closes early and shifts every callout after it onto the
		// wrong id. A silently misattributed colour is worse than a missing one.
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		let ready = 0;
		await probe.ensure(["a]b", "ok\nid", "", "fine"], () => ready++);
		assert.strictEqual(ready, 1);
		assert.strictEqual(probe.get("a]b").icon.kind, "unknown");
	});
});

describe("a theme switch that lands mid-pass", () => {
	it("re-measures instead of keeping the outgoing theme's readings", async () => {
		// `registerThemeAppearance` does `invalidate()` then `probe()` on every
		// `css-change`. While a pass was in flight that second half used to be
		// dropped outright — and the running pass then wrote the *outgoing*
		// theme's colours into the cache it had just been cleared of, with
		// nothing scheduled to correct them. Every row wore the previous theme
		// until some unrelated `css-change` happened along.
		const { app, setTheme } = switchableApp();
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let hue = "outgoing";
		const renderer = MarkdownRenderer as unknown as {
			render: (app: unknown, md: string, el: HTMLElement) => Promise<void>;
		};
		const original = renderer.render;
		let held = true;
		renderer.render = async (_app, _md, el) => {
			// Only the first pass waits; the re-run must not deadlock on it.
			if (held) {
				held = false;
				await gate;
			}
			const callout = el.createDiv({
				cls: "callout",
				attr: { "data-callout": "bitcoin" },
			});
			callout
				.createDiv({ cls: "callout-title" })
				.createDiv({
					cls: "callout-title-inner",
					attr: { "data-self-color": `${hue}-hue` },
				});
		};
		try {
			const probe = new ThemeAppearanceProbe(app, attrReader);
			let settled: () => void = () => {};
			const done = new Promise<void>((resolve) => {
				settled = resolve;
			});

			const first = probe.ensure(["bitcoin"], () => {});
			// The theme changes while that pass is still rendering.
			setTheme("Lumines");
			hue = "incoming";
			probe.invalidate();
			await probe.ensure(["bitcoin"], settled);

			release();
			await first;
			await done;

			assert.strictEqual(
				probe.get("bitcoin").accent,
				"incoming-hue",
				"the readings describe the theme that is now on screen",
			);
		} finally {
			renderer.render = original;
		}
	});

	it("collapses a burst of requests into one extra pass", async () => {
		// One slot, not a queue: a theme switch can fire `css-change` several
		// times, and each held request would otherwise cost a whole render.
		const { app, setTheme } = switchableApp();
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const renderer = MarkdownRenderer as unknown as {
			render: (app: unknown, md: string, el: HTMLElement) => Promise<void>;
		};
		const original = renderer.render;
		let passes = 0;
		let held = true;
		renderer.render = async () => {
			passes++;
			if (held) {
				held = false;
				await gate;
			}
		};
		try {
			const probe = new ThemeAppearanceProbe(app, attrReader);
			let settled: () => void = () => {};
			const done = new Promise<void>((resolve) => {
				settled = resolve;
			});
			const first = probe.ensure(["bitcoin"], () => {});
			setTheme("Lumines");
			probe.invalidate();
			await probe.ensure(["bitcoin"], () => {});
			await probe.ensure(["bitcoin"], () => {});
			await probe.ensure(["bitcoin"], settled);
			release();
			await first;
			await done;
			assert.strictEqual(passes, 2, "the first, then one catch-up");
		} finally {
			renderer.render = original;
		}
	});
});

describe("teardown", () => {
	it("stops answering and stops working after destroy", async () => {
		const probe = new ThemeAppearanceProbe(fakeApp(), reader().read);
		await probe.ensure(["recite"], () => {});
		probe.destroy();
		let ready = 0;
		await probe.ensure(["other"], () => ready++);
		assert.strictEqual(ready, 0, "a destroyed probe does not call back");
		assert.strictEqual(probe.results().size, 0);
	});
});
