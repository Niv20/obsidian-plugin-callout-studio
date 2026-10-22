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

it("folds a pooled group with Obsidian's own collapse triangle", () => {
	// `.collapse-icon` + `right-triangle` is the file explorer's and search's
	// fold control; app.css sizes it and turns it by the reading direction, so
	// the grid only has to say which way it is.
	fakeDom.light();
	const body = el();
	const grid = new IconGrid(asEl(body), {
		renderCell: (cell, entry) => cell.setText(entry.name),
		isSelected: () => false,
		onSelect: () => {},
		labelFor: (entry) => entry.name,
		emptyText: "Empty collection",
		loadMoreText: "Load more",
		groupLabelFor: (entry, previous) =>
			previous?.categories[0] === entry.categories[0] ? undefined : entry.categories[0],
	});
	grid.setEntries([
		{ name: "star", categories: ["Lucide"], keywords: [] },
		{ name: "heart", categories: ["Lucide"], keywords: [] },
		{ name: "smile", categories: ["Emoji"], keywords: [] },
	]);
	const header = body.querySelector(".icon-picker-group-header")!;
	const fold = header.querySelector(".collapse-icon");
	assert.ok(fold, "the heading carries Obsidian's .collapse-icon");
	assert.equal(fold.hasClass("is-collapsed"), false);
	header.fire("click");
	assert.equal(fold.hasClass("is-collapsed"), true);
	assert.equal(header.getAttribute("aria-expanded"), "false");
	header.fire("click");
	assert.equal(fold.hasClass("is-collapsed"), false);
	assert.equal(header.getAttribute("aria-expanded"), "true");
});

it("moves along the reading direction with the left and right arrows", () => {
	// Obsidian marks a right-to-left interface with `.mod-rtl`, whose
	// `direction: rtl` the grid inherits; the cells then flow from the right.
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
	grid.setEntries(["a", "b", "c"].map((name) => ({ name, categories: [], keywords: [] })));
	const gridEl = body.querySelector(".icon-picker-grid")!;
	const cells = body.querySelectorAll(".icon-picker-cell");
	const press = (key: string) => gridEl.fire("keydown", { type: "keydown", key, preventDefault: () => {} });
	const win = fakeDom.window;
	for (const direction of ["ltr", "rtl"] as const) {
		Object.defineProperty(win, "getComputedStyle", { configurable: true, value: () => ({ direction }) });
		try {
			cells[1]!.focus();
			press("ArrowRight");
			assert.equal(fakeDom.document.activeElement, cells[direction === "ltr" ? 2 : 0], `${direction}: right arrow`);
			cells[1]!.focus();
			press("ArrowLeft");
			assert.equal(fakeDom.document.activeElement, cells[direction === "ltr" ? 0 : 2], `${direction}: left arrow`);
		} finally {
			Reflect.deleteProperty(win, "getComputedStyle");
		}
	}
});
