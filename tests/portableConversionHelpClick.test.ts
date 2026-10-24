import assert from "node:assert/strict";
import { it } from "node:test";
import { PortableConversionHelpModal } from "../src/portable/PortableConversionHelpModal";
import { portableConversionViewHarness } from "./support/portableConversionViewHarness";
import { t } from "../src/i18n";
import type { FakeElement } from "./support/fakeDom";

it("opens conversion help from the sidebar without changing notes or review choices", async () => {
	const h = portableConversionViewHarness();
	const original = Object.getOwnPropertyDescriptor(PortableConversionHelpModal.prototype, "open");
	const opened: PortableConversionHelpModal[] = [];
	Object.defineProperty(PortableConversionHelpModal.prototype, "open", {
		configurable: true,
		value(this: PortableConversionHelpModal) { opened.push(this); },
	});
	try {
		await h.view.onOpen();
		h.choose(0, false);
		const choices = h.inputs().map(input => input.checked);
		// Help is the button in the view's nav header (finding S10-05).
		const help = (h.view.containerEl as unknown as FakeElement).querySelector(".nav-header .nav-action-button");
		assert.ok(help, "the nav header has the help button");
		assert.equal(help.getAttribute("aria-label"), t("portable.help"));
		assert.equal(help.getAttribute("aria-haspopup"), "dialog");
		help.fire("click");
		assert.equal(opened.length, 1);
		assert.deepEqual(h.inputs().map(input => input.checked), choices);
		assert.deepEqual(h.written, []);
		assert.deepEqual(h.confirmations, []);
	} finally {
		if (original) Object.defineProperty(PortableConversionHelpModal.prototype, "open", original);
		else Reflect.deleteProperty(PortableConversionHelpModal.prototype, "open");
		await h.destroy();
	}
});
