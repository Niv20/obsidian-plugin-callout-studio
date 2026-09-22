/** Built-in IDs protect shipped aliases, not aliases the user added later. */
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import { Setting } from "obsidian";
import { TagInput } from "../src/ui/TagInput";
import { DEFAULT_CALLOUTS } from "../src/defaultCallouts";
import {
	addBuiltInIdReset,
	builtInDefaultIds,
} from "../src/settings/editor/builtInIdReset";

function chip(parent: FakeElement, id: string): FakeElement {
	const found = parent.querySelector(`[data-tag="${id}"]`);
	assert.ok(found, `missing ID chip ${id}`);
	return found;
}

describe("TagInput — built-in ID ownership", () => {
	it("keeps shipped IDs fixed while a saved custom alias stays removable", () => {
		fakeDom.document.body.empty();
		(globalThis as unknown as { CSS: { escape(value: string): string } }).CSS = {
			escape: (value) => value,
		};
		const changes: string[][] = [];
		const input = new TagInput(asEl(fakeDom.document.body), {
			initialTags: ["abstract", "mine"],
			// `summary` and `tldr` are absent from the customized row but still
			// belong to the shipped definition the reset action can restore.
			readonlyTags: ["abstract", "summary", "tldr"],
			onChange: (tags) => changes.push(tags),
		});
		const root = fakeDom.document.body;

		assert.ok(chip(root, "abstract").hasClass("is-readonly"));
		assert.strictEqual(
			chip(root, "abstract").querySelector(".cs-tag-chip-remove"),
			null,
		);
		const removeMine = chip(root, "mine").querySelector(
			".cs-tag-chip-remove",
		);
		assert.ok(removeMine, "custom alias should have a remove action");
		removeMine.fire("click", { stopPropagation: () => undefined });
		assert.deepStrictEqual(input.getTags(), ["abstract"]);
		assert.deepStrictEqual(changes, [["abstract"]]);

		// Programmatic field reset restores the exact shipped list. Because the
		// readonly set was seeded from that list, even aliases absent on open are
		// protected when they reappear.
		input.setTags(["abstract", "summary", "tldr"]);
		for (const id of ["abstract", "summary", "tldr"]) {
			assert.ok(chip(root, id).hasClass("is-readonly"), id);
			assert.strictEqual(
				chip(root, id).querySelector(".cs-tag-chip-remove"),
				null,
				id,
			);
		}
		assert.deepStrictEqual(changes, [["abstract"]]);
	});

	it("wires the row reset back to the shipped IDs and refreshes the draft", () => {
		fakeDom.document.body.empty();
		const original = DEFAULT_CALLOUTS.find((def) => def.id === "abstract");
		assert.ok(original);
		const defaults = builtInDefaultIds(original);
		const setting = new Setting(asEl(fakeDom.document.body));
		const tagInput = new TagInput(setting.controlEl, {
			initialTags: ["abstract", "mine"],
			readonlyTags: defaults,
			onChange: () => undefined,
		});
		let draft = { calloutId: "abstract", aliases: ["mine"] };
		let refreshes = 0;

		addBuiltInIdReset({
			setting,
			tagInput,
			defaultDef: original,
			read: () => draft,
			write: (next) => { draft = next; },
			onReset: () => refreshes++,
		});
		const [reset] = (setting as unknown as {
			extraButtons: Array<{
				extraSettingsEl: FakeElement;
				press(): void;
			}>;
		}).extraButtons;
		assert.ok(reset, "expected the Callout IDs reset button");
		const button = reset.extraSettingsEl;
		assert.ok(!button.hasClass("cs-hidden"));

		reset.press();
		assert.deepStrictEqual(draft, {
			calloutId: "abstract",
			aliases: ["summary", "tldr"],
		});
		assert.deepStrictEqual(tagInput.getTags(), defaults);
		assert.strictEqual(refreshes, 1);
		assert.ok(button.hasClass("cs-hidden"));
	});

	it("leaves the draft intact when a shipped alias is already claimed", () => {
		fakeDom.document.body.empty();
		const original = DEFAULT_CALLOUTS.find((def) => def.id === "abstract");
		assert.ok(original);
		const setting = new Setting(asEl(fakeDom.document.body));
		const tagInput = new TagInput(setting.controlEl, {
			initialTags: ["abstract", "mine"],
			readonlyTags: builtInDefaultIds(original),
			onChange: () => undefined,
		});
		let draft = { calloutId: "abstract", aliases: ["mine"] };
		let blocked = "";

		addBuiltInIdReset({
			setting,
			tagInput,
			defaultDef: original,
			read: () => draft,
			write: (next) => { draft = next; },
			onReset: () => assert.fail("a conflicting reset must not refresh"),
			validate: (id) => id === "summary" ? "ID conflict" : null,
			onBlocked: (message) => { blocked = message; },
		});
		const [reset] = (setting as unknown as {
			extraButtons: Array<{ press(): void }>;
		}).extraButtons;
		assert.ok(reset);

		reset.press();
		assert.deepStrictEqual(draft, {
			calloutId: "abstract",
			aliases: ["mine"],
		});
		assert.deepStrictEqual(tagInput.getTags(), ["abstract", "mine"]);
		assert.strictEqual(blocked, "ID conflict");
	});
});
