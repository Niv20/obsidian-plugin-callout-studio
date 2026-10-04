import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { observeVersionRowLayout } from "../src/settings/versionRowLayout";
import { installFakeDom } from "./support/fakeDom";

describe("version summary follows the controls' actual line", () => {
	it("joins the counts only below the info box and follows resizing back", () => {
		const dom = installFakeDom();
		let resize = (): void => {};
		const observed: Element[] = [];
		let disconnected = false;
		class Observer {
			constructor(callback: () => void) { resize = callback; }
			observe(element: Element): void { observed.push(element); }
			disconnect(): void { disconnected = true; }
		}
		Object.assign(dom.window, { ResizeObserver: Observer });
		try {
			const list = dom.document.body.createDiv();
			const row = list.createDiv({ cls: "cs-recovery-row" });
			const info = row.createDiv({ cls: "setting-item-info" });
			const control = row.createDiv({ cls: "setting-item-control" });
			let top = 120;
			let height = 32;
			const rect = info.getBoundingClientRect();
			info.getBoundingClientRect = () => ({ ...rect, top: 100, bottom: 180, height: 80 });
			control.getBoundingClientRect = () => ({ ...rect, top, bottom: top + height, height });
			const stop = observeVersionRowLayout(list as unknown as HTMLElement);
			assert.equal(row.hasClass("cs-recovery-controls-wrapped"), false,
				"vertically centred beside taller text still means the same flex line");
			assert.equal(observed.length, 3, "row width, translated controls and text size are observed");
			top = 190; resize();
			assert.equal(row.hasClass("cs-recovery-controls-wrapped"), true);
			top = 120; resize();
			assert.equal(row.hasClass("cs-recovery-controls-wrapped"), false);
			top = 190; height = 0; resize();
			assert.equal(row.hasClass("cs-recovery-controls-wrapped"), false, "hidden controls don't count as wrapped");
			stop();
			assert.equal(disconnected, true);
		} finally { dom.restore(); }
	});

	it("keeps the ordinary layout usable without ResizeObserver", () => {
		const dom = installFakeDom();
		try {
			const list = dom.document.body.createDiv();
			const row = list.createDiv({ cls: "cs-recovery-row" });
			row.createDiv({ cls: "setting-item-info" });
			row.createDiv({ cls: "setting-item-control" });
			const stop = observeVersionRowLayout(list as unknown as HTMLElement);
			assert.equal(row.hasClass("cs-recovery-controls-wrapped"), false);
			assert.doesNotThrow(stop);
		} finally { dom.restore(); }
	});
});
