import assert from "node:assert/strict";
import { it } from "node:test";
import { IconGrid } from "../src/settings/iconpicker/IconGrid";
import { asEl, el, fakeDom } from "./support/fakeDom";

it("centers only an empty icon grid and clears that layout for entries and notices", () => {
	fakeDom.light();
	const body = el();
	const grid = new IconGrid(asEl(body), {
		renderCell: (cell, entry) => cell.setText(entry.name),
		isSelected: () => false,
		onSelect: () => {},
		labelFor: (entry) => entry.name,
		emptyText: "Empty collection",
		loadMoreText: "Load more",
	});
	const assertEmptyLayout = (expected: boolean) => {
		assert.equal(body.hasClass("icon-picker-grid-empty"), expected);
		assert.equal(body.querySelector(".icon-picker-empty") !== null, expected);
	};
	assertEmptyLayout(false);
	grid.setEntries([]);
	assertEmptyLayout(true);
	grid.setEntries([{ name: "star", categories: [], keywords: [] }]);
	assertEmptyLayout(false);
	assert.equal(body.querySelectorAll(".icon-picker-cell").length, 1);
	for (const message of ["No search results", "Loading", "Download failed"]) {
		grid.setEntries([]);
		assertEmptyLayout(true);
		grid.showMessage((notice) => notice.setText(message));
		assertEmptyLayout(false);
		assert.equal(body.querySelector(".icon-picker-notice")?.textContent, message);
	}
	grid.setEntries([]);
	assertEmptyLayout(true);
	assert.equal(body.querySelector(".icon-picker-notice"), null);
});
