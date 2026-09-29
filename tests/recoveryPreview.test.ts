import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Component } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import { findUserImage, setUserImages } from "../src/icons/packs/userImages";
import { recoveryIconResolver, renderRecoveryImage, renderRecoveryPreview } from "../src/settings/recoveryPreview";
import type { CalloutDefinition, PluginData, UserImageIcon } from "../src/types";
import { definition } from "./support/discoveryHarness";
import { asEl, fakeDom, type FakeElement } from "./support/fakeDom";

function picture(svg = '<svg viewBox="0 0 24 24"><path d="M0 0h24v24z"/></svg>'): UserImageIcon {
	return { id: "img-shared", name: "saved.svg", svg, format: "svg", width: 24, height: 24,
		monochrome: true, rev: 1, addedAt: 1 };
}

function render(data: Partial<PluginData>, def: CalloutDefinition, dark = false) {
	if (dark) fakeDom.dark(); else fakeDom.light();
	const root = fakeDom.document.body.createDiv();
	const component = new Component(); component.load();
	renderRecoveryPreview(asEl(root), data, def, component);
	return { root, component, destroy: () => { component.unload(); root.remove(); } };
}

function select(root: FakeElement, selector: string): FakeElement {
	const result = root.querySelector(selector);
	assert.ok(result, selector);
	return result;
}

describe("isolated recovery previews", () => {
	it("keeps same-name cached artwork separate between setups and never borrows a missing cache", () => {
		const icon = { type: "tabler-outline" as const, value: "star" };
		const old = { iconSvgCache: [{ pack: icon.type, name: icon.value, variant: "", svg: "old-artwork" }] };
		const current = { iconSvgCache: [{ pack: icon.type, name: icon.value, variant: "", svg: "current-artwork" }] };
		assert.equal(recoveryIconResolver(old).resolveSvg(icon, "regular"), "old-artwork");
		assert.equal(recoveryIconResolver(current).resolveSvg(icon, "regular"), "current-artwork");
		assert.equal(recoveryIconResolver({}).resolveSvg(icon, "regular"), null);
		assert.equal(recoveryIconResolver(old).resolveSvg({ ...icon, value: "missing" }, "regular"), null);
	});

	it("matches Material variants and supports the legacy saved cache without migrating it", () => {
		const saved: Partial<PluginData> = { materialSvgCache: [
			{ name: "star", style: "outlined", weight: 400, svg: "old-400" },
			{ name: "star", style: "rounded", weight: 500, svg: "old-500" },
		], iconSvgCache: [{ pack: "material", name: "star", variant: "rounded|500", svg: "new-500" }] };
		const before = JSON.stringify(saved);
		const resolver = recoveryIconResolver(saved);
		assert.equal(resolver.resolveSvg({ type: "material", value: "star" }, "regular"), "old-400");
		assert.equal(resolver.resolveSvg({ type: "material", value: "star", style: "rounded", weight: 500 }, "regular"), "new-500");
		assert.equal(resolver.resolveSvg({ type: "material", value: "star", weight: 700 }, "regular"), null);
		assert.equal(JSON.stringify(saved), before);
	});

	it("uses each setup's own colors and frame without matching live callout selectors", () => {
		const firstData = { settings: { ...structuredClone(DEFAULT_SETTINGS), globalStyle: {
			...structuredClone(DEFAULT_SETTINGS.globalStyle), borderWidth: 3, borderRadius: 12, titleScale: 1.2,
			borderSides: { top: false, right: false, bottom: false, left: true },
		} } };
		const before = JSON.stringify(firstData);
		const first = render(firstData, definition({ colorLight: "#113355", bgColorLight: "#ddeeff", hideIcon: true }));
		const second = render({}, definition({ colorLight: "#994411", hideIcon: true }));
		try {
			const old = select(first.root, ".cs-recovery-preview");
			assert.equal(old.style.getPropertyValue("--cs-recovery-accent"), "#113355");
			assert.equal(old.style.getPropertyValue("--cs-recovery-radius"), "12px");
			assert.equal(old.style.getPropertyValue("--cs-recovery-border-width"), "0px 0px 0px 3px");
			assert.match(old.getAttribute("style") ?? "", /background-color:/);
			assert.equal(select(second.root, ".cs-recovery-preview").style.getPropertyValue("--cs-recovery-accent"), "#994411");
			assert.equal(first.root.querySelector(".callout"), null);
			assert.equal(first.root.querySelector("[data-callout]"), null);
			assert.equal(first.root.querySelector("style"), null);
			assert.equal(JSON.stringify(firstData), before);
		} finally { first.destroy(); second.destroy(); }
	});

	it("selects dark colors and ignores injected color or gradient declarations", () => {
		const hostile = "#fff; background-image:url(https://example.invalid/track)";
		const h = render({}, definition({ colorDark: "#abcdef", bgColorDark: hostile, textColorDark: hostile,
			bgGradient: { angleDeg: 90, toColorLight: hostile, toColorDark: "#123456" }, hideIcon: true }), true);
		try {
			const preview = select(h.root, ".cs-recovery-preview");
			assert.equal(preview.style.getPropertyValue("--cs-recovery-accent"), "#abcdef");
			assert.equal(preview.getAttribute("style"), "");
			assert.equal(select(h.root, ".cs-recovery-preview-content").style.getPropertyValue("--cs-recovery-content-color"), "var(--text-normal)");
			assert.equal(h.root.querySelector(".is-gradient"), null);
			assert.equal(h.root.querySelector("img"), null);
		} finally { h.destroy(); }
	});

	it("keeps titles and emoji literal even when the setup contains markup", () => {
		const hostile = '<img src="https://example.invalid/track">';
		const h = render({}, definition({ displayName: hostile, icon: { type: "emoji", value: hostile } }));
		try {
			assert.equal(select(h.root, ".cs-recovery-preview-title-text").textContent, hostile);
			assert.equal(select(h.root, ".cs-recovery-preview-icon").textContent, hostile);
			assert.equal(h.root.querySelector("img"), null);
		} finally { h.destroy(); }
	});

	it("keeps fold interaction local and removes its listener with the owning component", () => {
		const def = definition({ foldable: true, defaultFolded: true, hideIcon: true });
		const h = render({}, def);
		try {
			const fold = select(h.root, ".cs-recovery-preview-fold");
			const body = select(h.root, ".cs-recovery-preview-content");
			assert.equal(fold.getAttribute("aria-expanded"), "false");
			assert.equal(body.style.getPropertyValue("display"), "none");
			fold.fire("click");
			assert.equal(fold.getAttribute("aria-expanded"), "true");
			assert.equal(body.style.getPropertyValue("display"), "");
			h.component.unload();
			fold.fire("click");
			assert.equal(fold.getAttribute("aria-expanded"), "true");
			assert.equal(def.defaultFolded, true);
		} finally { h.destroy(); }
	});

	it("never changes the live image pack and fails closed when artwork cannot be sanitized", () => {
		const live = picture();
		const saved = picture('<svg><script>dangerous()</script></svg>');
		setUserImages([live]);
		const h = render({ settings: { ...structuredClone(DEFAULT_SETTINGS), userImages: [saved] } },
			definition({ icon: { type: "image", value: live.id, recolor: true } }));
		try {
			// Node has no DOMParser: unchecked saved markup must become a fallback.
			renderRecoveryImage(asEl(h.root), saved);
			assert.equal(findUserImage(live.id), live);
			assert.equal(recoveryIconResolver({}).resolveSvg({ type: "image", value: live.id }, "regular"), null);
			assert.equal(h.root.querySelector("img"), null);
			assert.equal(h.root.querySelector("svg"), null);
			assert.equal(h.root.querySelector("script"), null);
			assert.ok(h.root.querySelector(".cs-recovery-preview-unavailable"));
		} finally { h.destroy(); setUserImages([]); }
	});
});
