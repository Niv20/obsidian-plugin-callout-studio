import assert from "node:assert/strict";
import { it } from "node:test";
import { PortableConversionHelpModal } from "../src/portable/PortableConversionHelpModal";
import { portableConversionViewHarness } from "./support/portableConversionViewHarness";

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
		h.click("help");
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
