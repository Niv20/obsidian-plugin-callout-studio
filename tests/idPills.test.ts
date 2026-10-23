/**
 * tests/idPills.test.ts — the callout editor's IDs are Obsidian's own pills
 * (finding S5-11, decision 16).
 *
 * Each ID under the field is drawn in the DOM Obsidian builds for a list
 * value in Properties (`multi-select-pill`), so app.css paints it: an outline
 * with round ends, muted text, a small x. Like Obsidian's, a pill is a Tab
 * stop and answers Backspace, the arrows and Escape. These tests drive the
 * pills through the fake DOM and read styles.css for what the plugin still
 * adds itself.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import { TagInput } from "../src/ui/TagInput";
import { t } from "../src/i18n";
import { readRepoFile } from "./support/sourceScan";

/** Mount a TagInput on a clean page and hand back what the tests poke at. */
function mount(opts: { tags: string[]; pinned?: string; readonly?: string[] }) {
	fakeDom.document.body.empty();
	// TagInput finds a pill by `CSS.escape`d id; the fake DOM has no `CSS`.
	(globalThis as unknown as { CSS: { escape(value: string): string } }).CSS = {
		escape: (value) => value,
	};
	const notices: string[] = [];
	(globalThis as { __CS_NOTICES__?: string[] }).__CS_NOTICES__ = notices;
	const changes: string[][] = [];
	const input = new TagInput(asEl(fakeDom.document.body), {
		initialTags: opts.tags,
		initialPinnedTag: opts.pinned,
		readonlyTags: opts.readonly,
		onChange: (tags) => changes.push(tags),
	});
	const root = fakeDom.document.body;
	const pill = (id: string): FakeElement => {
		const el = root.querySelector(`[data-tag="${id}"]`);
		assert.ok(el, `no pill for ${id}`);
		return el;
	};
	const field = root.querySelector(".cs-tag-input-field");
	assert.ok(field);
	/** Press `key` on `el`, the way a real keydown reaches its listener. */
	const press = (el: FakeElement, key: string): void => {
		el.fire("keydown", { type: "keydown", key, preventDefault: () => undefined });
	};
	const focused = (): unknown => fakeDom.document.activeElement;
	return { input, root, pill, field, press, focused, changes, notices };
}

describe("ID pills — Obsidian's multi-select pill", () => {
	it("are built in Obsidian's pill DOM, as Tab stops", () => {
		const { pill } = mount({ tags: ["idea", "spark"] });
		const el = pill("spark");
		assert.ok(el.hasClass("multi-select-pill"));
		assert.equal(el.getAttribute("tabindex"), "0");
		assert.equal(el.getAttribute("aria-label"), "spark");
		assert.equal(el.querySelector(".multi-select-pill-content")?.textContent, "spark");
		assert.ok(el.querySelector(".multi-select-pill-remove-button"), "an x to remove it");
	});

	it("gives a built-in's own IDs no x, and the pinned ID a lock in its place", () => {
		const { pill } = mount({ tags: ["note", "mine"], pinned: "note", readonly: ["note", "seealso"] });
		const pinned = pill("note");
		assert.ok(pinned.hasClass("is-pinned"));
		assert.equal(pinned.getAttribute("aria-label"), t("editor.idLinkedToName"));
		assert.ok(pinned.querySelector(".multi-select-pill-remove-button.cs-tag-chip-lock"));
		assert.equal(pinned.querySelector(".cs-tag-chip-remove"), null);

		const { pill: pillOf } = mount({ tags: ["seealso"], readonly: ["seealso"] });
		assert.equal(pillOf("seealso").querySelector(".multi-select-pill-remove-button"), null);
	});
});

describe("ID pills — the keyboard", () => {
	it("Backspace removes the pill and focuses the one before it", () => {
		const { pill, press, focused, input } = mount({ tags: ["a", "b", "c"] });
		press(pill("b"), "Backspace");
		assert.deepEqual(input.getTags(), ["a", "c"]);
		assert.equal(focused(), pill("a"));
	});

	it("Backspace on the only removable pill returns focus to the field", () => {
		const { pill, press, focused, field, input } = mount({ tags: ["a"] });
		press(pill("a"), "Delete");
		assert.deepEqual(input.getTags(), []);
		assert.equal(focused(), field);
	});

	it("the pinned pill explains instead of going; a built-in's own ID stays put", () => {
		const { pill, press, input, notices } = mount({ tags: ["note", "info"], pinned: "note", readonly: ["info"] });
		press(pill("note"), "Backspace");
		press(pill("info"), "Backspace");
		assert.deepEqual(input.getTags(), ["note", "info"]);
		assert.deepEqual(notices, [t("editor.idCannotDelete")]);
	});

	it("Backspace in the empty field steps onto the last pill", () => {
		const { pill, press, focused, field, input } = mount({ tags: ["a", "b"] });
		press(field, "Backspace");
		assert.equal(focused(), pill("b"));
		assert.deepEqual(input.getTags(), ["a", "b"], "stepping onto it removes nothing");
	});

	it("arrows move between pills; ↓ and Escape return to the field", () => {
		const { pill, press, focused, field } = mount({ tags: ["a", "b", "c"] });
		press(pill("a"), "ArrowRight");
		assert.equal(focused(), pill("b"));
		press(pill("b"), "ArrowLeft");
		assert.equal(focused(), pill("a"));
		press(pill("c"), "ArrowUp");
		assert.equal(focused(), pill("a"));
		press(pill("c"), "ArrowRight");
		assert.equal(focused(), field, "past the last pill is the field");
		press(pill("b"), "Escape");
		assert.equal(focused(), field);
		press(pill("b"), "ArrowDown");
		assert.equal(focused(), field);
	});

	it("in a right-to-left language → goes to the previous pill", () => {
		const view = fakeDom.window as unknown as { getComputedStyle?: unknown };
		const before = view.getComputedStyle;
		view.getComputedStyle = () => ({ direction: "rtl" });
		try {
			const { pill, press, focused } = mount({ tags: ["a", "b", "c"] });
			press(pill("b"), "ArrowRight");
			assert.equal(focused(), pill("a"));
			press(pill("a"), "ArrowLeft");
			assert.equal(focused(), pill("b"));
		} finally {
			view.getComputedStyle = before;
		}
	});
});

describe("ID pills — what styles.css adds", () => {
	const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
	/** The declarations of the one rule whose whole selector is `selector`. */
	const ruleBody = (selector: string): string | undefined => {
		const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
	};

	it("leaves the pill's face to Obsidian: no corners, fill or type of its own", () => {
		const body = ruleBody(".cs-tag-chip") ?? "";
		for (const property of ["border-radius", "background", "padding", "font-size", "font-style", "opacity"]) {
			assert.doesNotMatch(body, new RegExp(`(^|;)\\s*${property}\\s*:`), property);
		}
		assert.equal(ruleBody(".is-mobile .cs-tag-chip"), undefined, "no mobile-only corners any more");
		assert.equal(ruleBody(".cs-tag-chip.is-readonly"), undefined, "a built-in's ID is not italic");
	});

	it("puts Obsidian's focus ring on the pill's own border", () => {
		const body = ruleBody(".cs-tag-chip") ?? "";
		assert.match(body, /--pill-focus-width:\s*100%/);
		assert.match(body, /--pill-focus-left-adjust:\s*0/);
	});

	it("gives a pill without an x the same room at its end", () => {
		const body = ruleBody(".cs-tag-chip.is-readonly .multi-select-pill-content") ?? "";
		assert.match(body, /margin-inline-end:\s*var\(--pill-padding-x\)/);
	});

	it("keeps a long ID to one line with an ellipsis", () => {
		const body = ruleBody(".cs-tag-chip-text") ?? "";
		assert.match(body, /max-width:\s*140px/);
		assert.match(body, /text-overflow:\s*ellipsis/);
	});
});
