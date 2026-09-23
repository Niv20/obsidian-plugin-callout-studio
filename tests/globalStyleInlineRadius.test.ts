import assert from "node:assert";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../src/constants";
import { GlobalStyleModal } from "../src/settings/GlobalStyleModal";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import { asEl, fakeDom } from "./support/fakeDom";
import { createdSliders } from "./support/obsidianStub";

describe("inline global style corner rounding", () => {
	it("keeps the default radius available and saves a pill radius at 1.5× text", async () => {
		createdSliders.length = 0;
		fakeDom.document.body.empty();

		const settings = structuredClone(DEFAULT_SETTINGS);
		settings.globalStyle.inline.fontScale = 1.5;
		let saves = 0;
		const plugin = {
			settings,
			cssInjector: { inject: () => {} },
			saveSettings: async () => {
				saves++;
			},
		} as unknown as SettingsTabPlugin;

		// This control is independent of the Modal shell and preview renderer.
		const modal = Object.assign(Object.create(GlobalStyleModal.prototype) as object, {
			plugin,
		}) as unknown as GlobalStyleModal;
		const renderInlineControls = (
			modal as unknown as { renderInlineControls: (col: HTMLElement) => void }
		).renderInlineControls;
		renderInlineControls.call(modal, asEl(fakeDom.document.body.createDiv({})));

		const scale = createdSliders.at(-2);
		const radius = createdSliders.at(-1);
		assert.ok(scale);
		assert.ok(radius);
		assert.equal(scale.getValue(), 1.5);
		assert.equal(radius.min, 0);
		assert.equal(radius.max, 25);
		assert.equal(radius.getValue(), 16);

		await radius.commit(25);
		assert.equal(settings.globalStyle.inline.borderRadius, 25);
		assert.equal(saves, 1);
	});
});
