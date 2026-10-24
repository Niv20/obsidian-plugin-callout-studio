/**
 * The shared option box (settings/optionBox.ts): a card that takes no click,
 * key or focus of its own; the windows that draw it add what is theirs (a
 * radio dot, a button). Import's and Export's choosers no longer use it; they
 * are tested in choiceRows.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderOptionBox, renderOptionList } from "../src/settings/optionBox";
import { fakeDom, type FakeElement } from "./support/fakeDom";

function press(box: FakeElement, key: string, repeat = false): boolean {
	let prevented = false;
	box.fire("keydown", {
		type: "keydown",
		key,
		repeat,
		preventDefault: () => { prevented = true; },
	});
	return prevented;
}

function mountBox(): { box: FakeElement; describedBy: string; destroy: () => void } {
	const host = fakeDom.document.body.createDiv();
	const { el, describedBy } = renderOptionBox(renderOptionList(host as unknown as HTMLElement), {
		icon: "file-json",
		title: "Choose a file",
		desc: "Choose a JSON backup.",
	});
	return {
		box: el as unknown as FakeElement,
		describedBy,
		destroy: () => host.remove(),
	};
}

describe("shared option box", () => {
	it("is a card: it takes no click, no key and no focus", () => {
		const h = mountBox();
		try {
			for (const attr of ["role", "tabindex", "aria-labelledby", "aria-describedby", "aria-label"]) {
				assert.equal(h.box.hasAttribute(attr), false, attr);
			}
			assert.equal(h.box.querySelector(".cs-option-box-mark"), null, "no chevron: nothing opens");
			h.box.fire("click", { type: "click", detail: 1 });
			assert.equal(press(h.box, "Enter"), false);
			assert.equal(press(h.box, " "), false, "Space is left to the window");
			// Its two lines are still there for whatever acts on it to cite.
			const [titleId, statusId] = h.describedBy.split(" ");
			assert.equal(h.box.querySelector(`#${titleId}`)?.textContent, "Choose a file");
			assert.equal(h.box.querySelector(`#${statusId}`)?.textContent, "Choose a JSON backup.");
		} finally {
			h.destroy();
		}
	});
});
