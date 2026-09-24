import assert from "node:assert";
import { describe, it } from "node:test";
import { buildPaletteBgStyleRow } from "../src/settings/paletteBgStyleRow";
import { t } from "../src/i18n";
import { asEl, el, fakeDom } from "./support/fakeDom";

describe("palette background style picker", () => {
	it("keeps a committed choice while opening and changes it by keyboard", () => {
		fakeDom.light();
		const host = el();
		const picked: string[] = [];
		const before = fakeDom.document.listeners.get("click")?.length ?? 0;
		const picker = buildPaletteBgStyleRow(
			asEl(host),
			"solid",
			(style) => picked.push(style),
		);
		try {
			const input = host.querySelector(".cs-combobox-input");
			assert.ok(input);
			assert.equal(input.readOnly, true);
			assert.equal(input.value, t("palette.bgSolid"));
			input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			const rows = host.querySelectorAll(".cs-combobox-option");
			assert.deepEqual(rows.map((row) => row.textContent), [
				t("palette.bgSolid"),
				t("palette.bgGradient"),
				t("palette.bgTransparent"),
			]);
			input.fire("keydown", { key: "ArrowDown", preventDefault: () => {}, stopPropagation: () => {} });
			input.fire("keydown", { key: "Enter", preventDefault: () => {}, stopPropagation: () => {} });
			assert.deepEqual(picked, ["gradient"]);
			assert.equal(input.value, t("palette.bgGradient"));
		} finally {
			picker.destroy();
		}
		assert.equal(fakeDom.document.listeners.get("click")?.length ?? 0, before);
	});
});
