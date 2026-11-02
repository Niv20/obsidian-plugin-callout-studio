/**
 * tests/paletteBgStylePicker.test.ts — the palette editor's background style
 * (Solid, Gradient, Transparent) is a plain choice that opens Obsidian's menu.
 *
 * The keyboard inside an open menu is Obsidian's own (its arrows and Enter),
 * so here the keyboard only has to open the menu; the pick is a click on the
 * stub menu's item, as `support/selectDropdown.ts` does it.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { buildPaletteBgStyleRow } from "../src/settings/paletteBgStyleRow";
import { t } from "../src/i18n";
import { asEl, el, fakeDom } from "./support/fakeDom";
import { createdMenus } from "./support/obsidianStub";
import { dropdownButton, dropdownValue } from "./support/selectDropdown";

describe("palette background style picker", () => {
	it("keeps the committed choice, opens from the keyboard, and reports a new pick", () => {
		fakeDom.light();
		const host = el();
		const picked: string[] = [];
		const picker = buildPaletteBgStyleRow(asEl(host), "solid", (style) => picked.push(style));
		try {
			assert.equal(dropdownValue(asEl(host)), t("palette.bgSolid"));
			dropdownButton(asEl(host)).fire("keydown", { key: "ArrowDown", preventDefault: () => {} });
			const menu = createdMenus[createdMenus.length - 1]!;
			assert.ok(menu.shown, "↓ opens the menu");
			assert.deepEqual(
				menu.items.map((item) => item.title),
				[t("palette.bgSolid"), t("palette.bgGradient"), t("palette.bgTransparent")],
			);
			assert.deepEqual(
				menu.items.map((item) => item.checked),
				[true, false, false],
			);
			menu.clickItem(t("palette.bgGradient"));
			assert.deepEqual(picked, ["gradient"]);
			assert.equal(dropdownValue(asEl(host)), t("palette.bgGradient"));
		} finally {
			picker.destroy();
		}
	});
});
