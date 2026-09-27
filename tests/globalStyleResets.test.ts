import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";
import assert from "node:assert";
import { describe, it } from "node:test";
import type { EditorView } from "@codemirror/view";
import { createdSliders, createdToggles } from "./support/obsidianStub";
import { DEFAULT_SETTINGS } from "../src/constants";
import { GlobalStyleModal } from "../src/settings/GlobalStyleModal";
import type { SettingsTabPlugin } from "../src/settings/sections/types";
import type { CalloutRenderRole, PluginSettings } from "../src/types";
import { registerCalloutEditorView, unregisterCalloutEditorView } from "../src/editor/livepreview/refresh";
import { t } from "../src/i18n";

function build(role: CalloutRenderRole, change?: (settings: PluginSettings) => void) {
	fakeDom.window.flushFrames();
	fakeDom.document.body.empty();
	createdSliders.length = 0;
	createdToggles.length = 0;
	const settings = structuredClone(DEFAULT_SETTINGS);
	change?.(settings);
	const counts = { saves: 0, injects: 0, previews: 0 };
	const plugin = {
		settings,
		saveSettings: async () => { counts.saves++; },
		cssInjector: { inject: () => { counts.injects++; } },
	} as unknown as SettingsTabPlugin;
	const modal = Object.assign(Object.create(GlobalStyleModal.prototype) as object, {
		plugin,
		preview: { refresh: () => { counts.previews++; } },
	}) as unknown as {
		renderRegularControls(col: HTMLElement): void;
		renderHeadingControls(col: HTMLElement): void;
		renderInlineControls(col: HTMLElement): void;
	};
	const col = fakeDom.document.body.createDiv({});
	if (role === "regular") modal.renderRegularControls(asEl(col));
	else if (role === "heading") modal.renderHeadingControls(asEl(col));
	else modal.renderInlineControls(asEl(col));
	const group = (index: number): FakeElement => {
		const el = col.querySelectorAll(".cs-settings-group")[index];
		assert.ok(el);
		return el;
	};
	const button = (index: number): FakeElement => {
		const el = group(index).querySelector(".cs-header-reset");
		assert.ok(el);
		return el;
	};
	return { settings, counts, col, group, button };
}

async function reset(button: FakeElement): Promise<void> {
	button.fire("click");
	await Promise.resolve();
}

describe("global style group resets", () => {
	for (const [role, count] of [["regular", 4], ["heading", 4], ["inline", 3]] as const) {
		it(`offers a dormant reset in every ${role} option box without saving on render`, () => {
			const h = build(role);
			assert.equal(h.col.querySelectorAll(".cs-header-reset").length, count);
			for (let index = 0; index < count; index++) {
				assert.ok(h.button(index).hasClass("cs-hidden"));
				assert.ok(h.button(index).getAttribute("aria-label")?.startsWith(t("settings.resetAction")));
			}
			assert.deepEqual(h.counts, { saves: 0, injects: 0, previews: 0 });
		});

		it(`restores ${role} border buttons, width and visibility without changing its radius`, async () => {
			const h = build(role, (settings) => {
				const style = role === "regular" ? settings.globalStyle : settings.globalStyle[role];
				style.borderSides.top = true;
				style.borderWidth = 4;
				style.borderRadius = 9;
			});
			const style = role === "regular" ? h.settings.globalStyle : h.settings.globalStyle[role];
			const defaults = role === "regular" ? DEFAULT_SETTINGS.globalStyle : DEFAULT_SETTINGS.globalStyle[role];
			const sides = style.borderSides;
			await reset(h.button(0));
			assert.deepEqual(style.borderSides, defaults.borderSides);
			assert.equal(style.borderSides, sides, "keep existing settings references live");
			assert.notEqual(style.borderSides, defaults.borderSides, "never share the defaults object");
			assert.equal(style.borderWidth, defaults.borderWidth);
			assert.equal(createdSliders[0]?.getValue(), defaults.borderWidth);
			assert.equal(style.borderRadius, 9);
			assert.equal(h.group(0).querySelectorAll(".is-active").length, 0);
			const width = h.group(0).querySelector(".callout-studio-slider-row")?.parentElement;
			assert.ok(width?.hasClass("cs-hidden"));
			assert.ok(h.button(0).hasClass("cs-hidden"));
			assert.equal(h.counts.saves, 1);
			assert.equal(h.counts.injects, 1);
		});
	}

	it("shows reset during slider input, resets both regular font scales and cancels queued preview work", async () => {
		const h = build("regular");
		const slider = createdSliders[1];
		assert.ok(slider);
		const input = slider.sliderEl as unknown as FakeElement;
		input.value = "1.25";
		input.fire("input");
		h.settings.globalStyle.contentScale = 0.8;
		h.settings.globalStyle.heading.borderRadius = 18;
		assert.ok(!h.button(1).hasClass("cs-hidden"));
		await reset(h.button(1));
		fakeDom.window.flushFrames();
		assert.equal(h.settings.globalStyle.titleScale, 1);
		assert.equal(h.settings.globalStyle.contentScale, 1);
		assert.deepEqual(createdSliders.slice(1, 3).map((s) => s.getValue()), [1, 1]);
		assert.equal(h.settings.globalStyle.heading.borderRadius, 18);
		assert.deepEqual(h.counts, { saves: 1, injects: 1, previews: 0 });
	});

	it("updates the regular alignment toggle and hides its reset after restoring false", async () => {
		const h = build("regular");
		await createdToggles[0]?.commit(true);
		assert.ok(!h.button(3).hasClass("cs-hidden"));
		await reset(h.button(3));
		assert.equal(h.settings.globalStyle.alignContentWithTitle, false);
		assert.equal(createdToggles[0]?.getValue(), false);
		assert.ok(h.button(3).hasClass("cs-hidden"));
	});

	it("resets heading spacing including both paddings and rebuilds open editor decorations", async () => {
		const h = build("heading", (settings) => {
			Object.assign(settings.globalStyle.heading, { paddingTop: 0.8, paddingBottom: 0.3, marginTop: 2 });
		});
		let refreshes = 0;
		const view = { dispatch: () => { refreshes++; } } as unknown as EditorView;
		registerCalloutEditorView(view);
		try {
			await reset(h.button(2));
			const { paddingTop, paddingBottom, marginTop } = h.settings.globalStyle.heading;
			assert.deepEqual([paddingTop, paddingBottom, marginTop], [0.25, 0.25, 0.5]);
			assert.deepEqual(createdSliders.slice(2).map((s) => s.getValue()), [0.25, 0.5]);
			assert.equal(refreshes, 1);
			assert.equal(h.counts.previews, 1);
		} finally {
			unregisterCalloutEditorView(view);
		}
	});

	it("restores the fold arrow and refreshes the preview without changing other heading options", async () => {
		const h = build("heading", (settings) => {
			Object.assign(settings.headingCallouts, { showFoldArrow: false, refCleanTitles: false });
		});
		await reset(h.button(3));
		assert.equal(h.settings.headingCallouts.showFoldArrow, true);
		assert.equal(h.settings.headingCallouts.refCleanTitles, false);
		assert.equal(createdToggles[0]?.getValue(), true);
		assert.equal(h.counts.previews, 1);
	});

	it("uses the inline radius default and resets the text scale independently", async () => {
		const h = build("inline", (settings) => {
			settings.globalStyle.inline.borderRadius = 25;
			settings.globalStyle.inline.fontScale = 1.5;
		});
		await reset(h.button(2));
		assert.equal(h.settings.globalStyle.inline.borderRadius, 16);
		assert.equal(h.settings.globalStyle.inline.fontScale, 1.5);
		await reset(h.button(1));
		assert.equal(h.settings.globalStyle.inline.fontScale, 1);
		assert.deepEqual(createdSliders.slice(1).map((s) => s.getValue()), [1, 16]);
	});
});
