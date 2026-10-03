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

it("marks the grid while a message stands in for its cells, and only then", () => {
	// A library's panel centres the download prompt by growing the grid that
	// holds it; cells must never be stretched that way.
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
	const gridEl = body.querySelector(".icon-picker-grid")!;
	assert.equal(gridEl.hasClass("has-message"), false);
	grid.showMessage((notice) => notice.setText("Not downloaded yet"));
	assert.equal(gridEl.hasClass("has-message"), true);
	grid.setEntries([{ name: "star", categories: [], keywords: [] }]);
	assert.equal(gridEl.hasClass("has-message"), false, "icons back, so the grid sizes to them again");
	grid.showMessage((notice) => notice.setText("Downloading"));
	grid.setEntries([]);
	assert.equal(gridEl.hasClass("has-message"), false, "the empty state is not a message");
});
