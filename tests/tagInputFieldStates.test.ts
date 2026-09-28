/** The IDs field and its adjacent overlay share native input state in CSS. */
import { asEl, fakeDom } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import { TagInput } from "../src/ui/TagInput";

function setup() {
	fakeDom.document.body.empty();
	const tags = new TagInput(asEl(fakeDom.document.body), {
		maxTags: 1,
		onChange: () => undefined,
	});
	const row = fakeDom.document.body.querySelector(".cs-tag-input-row");
	const input = row?.querySelector("input");
	const slot = row?.querySelector(".cs-tag-add-slot");
	const button = slot?.querySelector("button");
	assert.ok(row && input && slot && button);
	return { tags, row, input, slot, button };
}

describe("TagInput — shared field state", () => {
	it("keeps the overlay immediately after the input when IDs are replaced", () => {
		const { tags, row, input, slot, button } = setup();
		for (const ids of [["one"], [], ["two"], []]) {
			tags.setTags(ids);
			// The state selectors use a direct child and adjacent sibling: adding
			// or replacing chips must never put another element between these.
			assert.deepStrictEqual(row.children, [input, slot]);
			assert.strictEqual(input.disabled, ids.length === 1);
			assert.strictEqual(button.disabled, input.disabled);
		}
	});

	it("hides the overlay at the limit and restores it after re-enabling", () => {
		const { tags, input, slot, button } = setup();
		input.value = "one";
		input.fire("input");
		assert.ok(slot.hasClass("is-visible"));

		input.fire("keydown", { key: "Enter", preventDefault: () => undefined });
		assert.deepStrictEqual(tags.getTags(), ["one"]);
		assert.ok(input.disabled && button.disabled);
		assert.ok(!slot.hasClass("is-visible"));

		tags.setTags([]);
		assert.ok(!input.disabled && !button.disabled);
		input.value = "two";
		input.fire("input");
		assert.ok(slot.hasClass("is-visible"));

		// A programmatic update can disable a filled, visible field before
		// its pending text is committed; native state still gates both pieces.
		tags.setTags(["full"]);
		assert.ok(input.disabled && button.disabled);
		assert.ok(!slot.hasClass("is-visible"));
		tags.setTags([]);
		assert.ok(!input.disabled && !button.disabled);
		assert.ok(slot.hasClass("is-visible"));
	});
});
