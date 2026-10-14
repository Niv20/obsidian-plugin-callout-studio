/**
 * tests/calloutIdLimit.test.ts — how many IDs one callout can have.
 *
 * `MAX_TAGS_COUNT` is the one place the number lives. Every test here reads it
 * rather than restating it, so changing the constant needs no test edit unless
 * it breaks one of the invariants below:
 *
 * - **Built-ins.** The cap has to sit above the largest shipped ID set, or a
 *   built-in could not take a single alias of the user's own.
 * - **The editor's IDs field** stops at the cap, from typing, pasting and the
 *   name-linked primary alike, and says so with the cap in the message. A
 *   callout that already has more (a backup merged into an existing callout
 *   keeps both sides' spellings) keeps every ID; it only refuses another.
 * - **Import** accepts exactly the cap and rejects one more, counting the
 *   primary ID with the aliases, so whatever the editor can save, an export of
 *   it can bring back.
 * - **The stylesheet** writes a callout's artwork once, however many IDs it
 *   has. An uploaded picture can be 256 KB, and the per-alias copy it used to
 *   get is what made more IDs expensive.
 */
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import { MAX_TAGS_COUNT } from "../src/constants";
import { DEFAULT_CALLOUTS } from "../src/defaultCallouts";
import { t } from "../src/i18n";
import { TagInput } from "../src/ui/TagInput";
import { validateImportPayload } from "../src/utils/importValidator";
import type { CalloutRegistry } from "../src/manager/CalloutRegistry";
import {
	emojiOverrideCSS,
	iconMaskOverrideCSS,
	imageOverrideCSS,
} from "../src/manager/css/iconOverrides";
import { calloutSel } from "../src/utils/calloutSelector";
import { splitSelectorList } from "../src/utils/selectorText";
import type { UserImageIcon } from "../src/types";
import {
	definition,
	harness,
	parseRules,
	type CssRule,
} from "./support/cssInjectorHarness";

/**
 * `count` distinct IDs: `id1`, `id2`, … No dash, since the field turns a typed
 * dash into a space and the tests compare what they typed.
 */
const ids = (count: number, prefix = "id"): string[] =>
	Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

const maxMessage = (): string => t("editor.maxIds", { max: MAX_TAGS_COUNT });

describe("MAX_TAGS_COUNT", () => {
	it("is a whole number", () => {
		assert.ok(Number.isInteger(MAX_TAGS_COUNT), String(MAX_TAGS_COUNT));
	});

	it("leaves every built-in room for an alias of the user's own", () => {
		for (const def of DEFAULT_CALLOUTS) {
			const shipped = 1 + (def.aliases?.length ?? 0);
			assert.ok(
				shipped < MAX_TAGS_COUNT,
				`${def.id} ships ${shipped} IDs; the cap is ${MAX_TAGS_COUNT}`,
			);
		}
	});
});

/* ------------------------------------------------------------------ *
 * The editor's IDs field
 * ------------------------------------------------------------------ */

function field(
	opts: Partial<ConstructorParameters<typeof TagInput>[1]> = {},
) {
	fakeDom.document.body.empty();
	(globalThis as unknown as { CSS: { escape(value: string): string } }).CSS = {
		escape: (value) => value,
	};
	const changes: string[][] = [];
	const tags = new TagInput(asEl(fakeDom.document.body), {
		onChange: (next) => changes.push(next),
		...opts,
	});
	const root = fakeDom.document.body;
	const input = root.querySelector("input");
	const button = root.querySelector(".cs-tag-add-btn");
	const error = root.querySelector(".cs-tag-error");
	assert.ok(input && button && error);
	const type = (value: string): void => {
		input.value = value;
		input.fire("input");
		input.fire("keydown", { key: "Enter", preventDefault: () => undefined });
	};
	const paste = (text: string): void => {
		input.fire("paste", {
			preventDefault: () => undefined,
			clipboardData: { getData: () => text },
		});
	};
	const remove = (id: string): void => {
		const chip = root.querySelector(`[data-tag="${id}"]`);
		const x = chip?.querySelector(".cs-tag-chip-remove");
		assert.ok(x, `no remove action on ${id}`);
		x.fire("click", { stopPropagation: () => undefined });
	};
	const chips = (): string[] =>
		root
			.querySelectorAll(".cs-tag-chip")
			.map((chip: FakeElement) => chip.getAttribute("data-tag") ?? "");
	return { tags, input, button, error, changes, type, paste, remove, chips };
}

describe("TagInput — the IDs field stops at MAX_TAGS_COUNT", () => {
	it("defaults to the shared cap, not a number of its own", () => {
		const f = field();
		for (const id of ids(MAX_TAGS_COUNT - 1)) f.type(id);
		assert.strictEqual(f.input.disabled, false, "one short of the cap");
		f.type(`id${MAX_TAGS_COUNT}`);
		assert.deepStrictEqual(f.tags.getTags(), ids(MAX_TAGS_COUNT));
		assert.ok(f.input.disabled && f.button.disabled);
	});

	it("names the cap in the message it shows when full", () => {
		const f = field({ initialTags: ids(MAX_TAGS_COUNT) });
		assert.strictEqual(f.error.textContent, maxMessage());
		assert.ok(f.error.textContent.includes(String(MAX_TAGS_COUNT)));
		assert.ok(f.error.hasClass("is-visible"));
	});

	it("takes nothing past the cap, however it arrives", () => {
		const f = field({ initialTags: ids(MAX_TAGS_COUNT) });
		f.type("onemore");
		f.paste("twomore, threemore");
		assert.deepStrictEqual(f.tags.getTags(), ids(MAX_TAGS_COUNT));
		assert.deepStrictEqual(f.changes, []);
	});

	it("fills a paste up to the cap and drops the rest", () => {
		const f = field({ initialTags: ["first"] });
		f.paste(ids(MAX_TAGS_COUNT + 3, "pasted").join(", "));
		assert.deepStrictEqual(f.tags.getTags(), [
			"first",
			...ids(MAX_TAGS_COUNT - 1, "pasted"),
		]);
		assert.ok(f.input.disabled);
		assert.strictEqual(f.error.textContent, maxMessage());
	});

	it("re-opens the field once an ID is deleted", () => {
		const f = field({ initialTags: ids(MAX_TAGS_COUNT) });
		f.remove("id2");
		assert.strictEqual(f.input.disabled, false);
		assert.ok(!f.error.hasClass("is-visible"));
		f.type("again");
		assert.strictEqual(f.tags.getTags().length, MAX_TAGS_COUNT);
		assert.ok(f.input.disabled);
	});

	it("keeps every ID of a callout that already has more than the cap", () => {
		// A restored backup merges into the existing callout and keeps both
		// sides' spellings, so a saved callout can legitimately be over the cap.
		// Its IDs are never trimmed; the field only refuses another one.
		const over = ids(MAX_TAGS_COUNT + 2);
		const f = field({ initialTags: over });
		assert.deepStrictEqual(f.chips(), over);
		assert.ok(f.input.disabled);
		f.remove("id1");
		assert.strictEqual(f.tags.getTags().length, MAX_TAGS_COUNT + 1);
		assert.ok(f.input.disabled, "still over the cap after one delete");
		f.remove("id2");
		f.remove("id3");
		assert.strictEqual(f.input.disabled, false);
	});

	it("swaps the name-linked ID in place without going over", () => {
		// Typing a new display name replaces the pinned primary rather than
		// adding one, so a full field stays exactly full.
		const f = field({
			initialPinnedTag: "name",
			initialTags: ["name", ...ids(MAX_TAGS_COUNT - 1)],
		});
		assert.ok(f.input.disabled);
		f.tags.setPinnedTag("renamed");
		assert.deepStrictEqual(f.tags.getTags(), [
			"renamed",
			...ids(MAX_TAGS_COUNT - 1),
		]);
		assert.ok(f.input.disabled);
	});

	it("still honours an explicit smaller cap", () => {
		const f = field({ maxTags: 2 });
		f.type("a");
		f.type("b");
		f.type("c");
		assert.deepStrictEqual(f.tags.getTags(), ["a", "b"]);
		assert.strictEqual(f.error.textContent, t("editor.maxIds", { max: 2 }));
	});
});

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

function fakeRegistry(): CalloutRegistry {
	return {
		getUserImages: () => [],
		findByAlias: () => undefined,
		findByIdentity: () => undefined,
		get: () => undefined,
		settings: {},
	} as unknown as CalloutRegistry;
}

function entry(aliases: string[]): Record<string, unknown> {
	return {
		id: "primary",
		displayName: "Primary",
		aliases,
		icon: { type: "lucide", value: "star" },
		colorLight: "#ff0000",
		colorDark: "#ff0000",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	};
}

describe("validateImportPayload — the same cap, primary ID included", () => {
	it("accepts a callout with exactly MAX_TAGS_COUNT IDs", async () => {
		const aliases = ids(MAX_TAGS_COUNT - 1);
		const result = await validateImportPayload([entry(aliases)], fakeRegistry());
		assert.deepStrictEqual(
			result.issues.filter((issue) => issue.level === "error"),
			[],
		);
		assert.deepStrictEqual(result.validDefs[0]?.aliases, aliases);
	});

	it("rejects one more, and reports both numbers", async () => {
		const result = await validateImportPayload(
			[entry(ids(MAX_TAGS_COUNT)), { ...entry([]), id: "other" }],
			fakeRegistry(),
		);
		// Only the oversized entry is dropped; the rest of the file imports.
		assert.deepStrictEqual(result.validDefs.map((def) => def.id), ["other"]);
		const issue = result.issues.find(
			(i) => i.messageKey === "import.err.tooManyIds",
		);
		assert.ok(issue, JSON.stringify(result.issues));
		assert.strictEqual(issue.level, "error");
		assert.deepStrictEqual(issue.params, {
			count: MAX_TAGS_COUNT + 1,
			max: MAX_TAGS_COUNT,
		});
	});

	it("counts what is left after duplicates are refused", async () => {
		// A duplicate is its own error, not a second strike against the count.
		const result = await validateImportPayload(
			[entry([...ids(MAX_TAGS_COUNT - 1), "id1"])],
			fakeRegistry(),
		);
		const keys = result.issues.map((issue) => issue.messageKey);
		assert.ok(keys.includes("import.err.aliasDup"), keys.join());
		assert.ok(!keys.includes("import.err.tooManyIds"), keys.join());
	});
});

/* ------------------------------------------------------------------ *
 * The stylesheet
 * ------------------------------------------------------------------ */

const SVG =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';

function picture(over: Partial<UserImageIcon> = {}): UserImageIcon {
	return {
		id: "pic",
		name: "logo.svg",
		format: "svg",
		svg: SVG,
		width: 24,
		height: 24,
		monochrome: false,
		rev: 1,
		addedAt: 0,
		...over,
	};
}

const AFTER = " > .callout-title > .callout-icon::after";
const SVG_CHILD = " > .callout-title > .callout-icon > svg";

/** The rules whose selector list names `selector` exactly. */
function rulesNaming(css: string, selector: string): CssRule[] {
	return parseRules(css).filter((rule) =>
		splitSelectorList(rule.selector)
			.map((part) => part.trim())
			.includes(selector),
	);
}

/** How often `needle` occurs in `text`. */
const occurrences = (text: string, needle: string): number =>
	text.split(needle).length - 1;

describe("generateCalloutCSS — the artwork is written once per callout", () => {
	const names = ["primary", ...ids(MAX_TAGS_COUNT - 1)];

	it("one picture rule covers the ID and every alias", () => {
		const { registry, css } = harness();
		registry.setUserImages([picture()]);
		const def = definition({
			id: "primary",
			aliases: names.slice(1),
			icon: { type: "image", value: "pic" },
		});
		registry.add(def);
		const out = css.generateCalloutCSS(def);

		assert.strictEqual(occurrences(out, "background-image: url("), 1);
		for (const name of names) {
			const base = calloutSel(name);
			const painted = rulesNaming(out, `${base}${AFTER}`);
			assert.strictEqual(painted.length, 1, name);
			assert.ok(painted[0]?.at.includes("@media screen"), name);
			assert.strictEqual(rulesNaming(out, `${base}${SVG_CHILD}`).length, 1, name);
		}
	});

	it("one mask rule covers them too, for a stencilled icon", () => {
		// A recoloured picture takes the same mask path as a library glyph.
		const { registry, css } = harness();
		registry.setUserImages([picture({ monochrome: true })]);
		const def = definition({
			id: "primary",
			aliases: names.slice(1),
			icon: { type: "image", value: "pic", recolor: true },
		});
		registry.add(def);
		const out = css.generateCalloutCSS(def);
		assert.strictEqual(occurrences(out, "--cs-icon-mask: url("), 1);
		for (const name of names) {
			assert.strictEqual(
				rulesNaming(out, `${calloutSel(name)}${AFTER}`).length,
				1,
				name,
			);
		}
	});

	it("one emoji rule covers them", () => {
		const { css } = harness();
		const out = css.generateCalloutCSS(
			definition({
				id: "primary",
				aliases: names.slice(1),
				icon: { type: "emoji", value: "🌟" },
			}),
		);
		assert.strictEqual(occurrences(out, 'content: "🌟"'), 1);
		for (const name of names) {
			assert.strictEqual(
				rulesNaming(out, `${calloutSel(name)}${AFTER}`).length,
				1,
				name,
			);
		}
	});

	it("leaves a name the theme draws out of the shared rule", () => {
		const { registry, css } = harness();
		const def = definition({
			id: "primary",
			aliases: ["mine", "theirs"],
			icon: { type: "emoji", value: "🌟" },
		});
		registry.add(def);
		registry.setThemeOwnedIds(new Set(["theirs"]));
		const out = css.generateCalloutCSS(def);
		const shared = rulesNaming(out, `${calloutSel("primary")}${AFTER}`);
		assert.strictEqual(shared.length, 1);
		const parts = splitSelectorList(shared[0]?.selector ?? "").map((p) => p.trim());
		assert.ok(parts.includes(`${calloutSel("mine")}${AFTER}`));
		assert.strictEqual(rulesNaming(out, `${calloutSel("theirs")}${AFTER}`).length, 0);
	});

	it("still paints the aliases when the theme draws the primary ID", () => {
		const { registry, css } = harness();
		const def = definition({
			id: "primary",
			aliases: ["mine"],
			icon: { type: "emoji", value: "🌟" },
		});
		registry.add(def);
		registry.setThemeOwnedIds(new Set(["primary"]));
		const out = css.generateCalloutCSS(def);
		assert.strictEqual(rulesNaming(out, `${calloutSel("primary")}${AFTER}`).length, 0);
		assert.strictEqual(rulesNaming(out, `${calloutSel("mine")}${AFTER}`).length, 1);
	});
});

describe("icon override builders — one selector or many", () => {
	const one = calloutSel("quiet");

	it("write the same text for a selector and a list of just that selector", () => {
		assert.strictEqual(iconMaskOverrideCSS([one], SVG), iconMaskOverrideCSS(one, SVG));
		assert.strictEqual(
			imageOverrideCSS([one], SVG, picture()),
			imageOverrideCSS(one, SVG, picture()),
		);
		assert.strictEqual(emojiOverrideCSS([one], "🌟"), emojiOverrideCSS(one, "🌟"));
	});

	it("write nothing for an empty list rather than a rule with no selector", () => {
		assert.strictEqual(iconMaskOverrideCSS([], SVG), "");
		assert.strictEqual(imageOverrideCSS([], SVG, picture()), "");
		assert.strictEqual(emojiOverrideCSS([], "🌟"), "");
	});
});
