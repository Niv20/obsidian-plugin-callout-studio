/**
 * The palette editor's Save is dimmed, not disabled, while the name or the
 * colors duplicate another palette — and pressing it says which. And where
 * the editor says a name is taken, or a colour is hard to read: under the
 * field, through Obsidian's `setErrorMessage` (finding S7-06), or in a line
 * under it (S6-12).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Setting, type App } from "obsidian";
import { t } from "../src/i18n";
import { PaletteEditorModal } from "../src/settings/PaletteEditorModal";
import type { CustomPalette } from "../src/types";
import { bakePaletteColors, findPresetByPaletteId } from "../src/utils/colorPalettes";
import { el, type FakeElement } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

type Options = ConstructorParameters<typeof PaletteEditorModal>[1];
type Internals = {
	saveBtnEl: unknown;
	name: string;
	baseColor: string;
	colorClash: { name: string } | null;
	currentColorPalette(): Omit<CustomPalette, "id" | "name">;
	updateValidity(): void;
	saveBlockedReason(): string | null;
	nameSetting: Setting | null;
	colorCardEl: HTMLElement | null;
	colorErrorEl: HTMLElement | null;
	applyDerived(): void;
};

function editor(options: Options = {}) {
	const modal = new PaletteEditorModal({ app: {} as App } as ConstructorParameters<typeof PaletteEditorModal>[0], options);
	const internals = modal as unknown as Internals;
	const save = el();
	internals.saveBtnEl = save;
	return { internals, save };
}

/** A saved palette wearing exactly the colors a fresh form derives. */
function twinOf(seedName: string): CustomPalette {
	const colors = editor({ seedName }).internals.currentColorPalette();
	return { ...colors, id: "cp-twin", name: "Twin" };
}

describe("the palette editor's Save", () => {
	it("is live for a palette that duplicates nothing", () => {
		const { internals, save } = editor({ seedName: "Sunrise" });
		internals.updateValidity();
		assert.equal(save.getAttribute("aria-disabled"), "false");
		assert.equal(internals.saveBlockedReason(), null);
	});

	it("is dimmed, not disabled, for a name another palette already has, and says to pick another", () => {
		const { internals, save } = editor({ seedName: "Sunrise", takenNames: ["sunrise"] });
		internals.updateValidity();
		assert.equal(save.getAttribute("aria-disabled"), "true");
		assert.equal(save.hasClass("cs-btn-disabled"), true);
		assert.notEqual((save as unknown as { disabled?: boolean }).disabled, true, "a disabled button would swallow the press");
		assert.equal(internals.saveBlockedReason(), t("palette.saveBlockedName"));
	});

	it("is dimmed for colors another palette already has, naming that palette", () => {
		// A seed keeps its colors (they are a real callout's look, not a default
		// to move off), so it is the way to open the form on a duplicate.
		const twin = twinOf("Sunrise");
		const { internals, save } = editor({ seedName: "Sunrise", seed: twin, takenColors: [twin] });
		internals.updateValidity();
		assert.equal(save.getAttribute("aria-disabled"), "true");
		assert.equal(internals.saveBlockedReason(), t("palette.colorExists", { name: "Twin" }));
	});

	it("reports the name first when both are duplicated, as its error does on screen", () => {
		const twin = twinOf("Sunrise");
		const { internals } = editor({ seedName: "Sunrise", seed: twin, takenNames: ["Sunrise"], takenColors: [twin] });
		assert.equal(internals.saveBlockedReason(), t("palette.saveBlockedName"));
	});

	it("lights up again once the name no longer collides", () => {
		const { internals, save } = editor({ seedName: "Sunrise", takenNames: ["Sunrise"] });
		internals.updateValidity();
		assert.equal(save.getAttribute("aria-disabled"), "true");
		internals.name = "Sunrise 2";
		internals.updateValidity();
		assert.equal(save.getAttribute("aria-disabled"), "false");
		assert.equal(save.hasClass("cs-btn-disabled"), false);
	});
});

describe("a palette saved before a preset took its name or colours", () => {
	// Purple, Pink and Yellow became preset names after users had already
	// saved palettes called that. Upgrading must not lock them out of editing.
	const saved = (name: string, over: Partial<CustomPalette> = {}): CustomPalette => ({
		...twinOf(name),
		id: `cp-${name}`,
		name,
		...over,
	});

	for (const name of ["Pink", "Purple", "Yellow"]) {
		it(`still saves an existing palette called "${name}"`, () => {
			const { internals, save } = editor({ existing: saved(name) });
			internals.updateValidity();
			assert.equal(save.getAttribute("aria-disabled"), "false");
			assert.equal(internals.saveBlockedReason(), null);
		});

		it(`still refuses "${name}" for a new palette`, () => {
			const { internals } = editor({ seedName: name });
			assert.equal(internals.saveBlockedReason(), t("palette.saveBlockedName"));
		});
	}

	it("still refuses renaming another palette to a preset's name", () => {
		const { internals } = editor({ existing: saved("Rose petal") });
		internals.name = "Pink";
		assert.equal(internals.saveBlockedReason(), t("palette.saveBlockedName"));
	});

	it("still refuses a name another saved palette has, even its old one", () => {
		const { internals } = editor({ existing: saved("Pink"), takenNames: ["Pink"] });
		assert.equal(internals.saveBlockedReason(), t("palette.saveBlockedName"));
	});

	// Advanced mode stores the six colours verbatim, so the form opens on
	// exactly what was saved.
	const yellow = findPresetByPaletteId("yellow");
	assert.ok(yellow);
	const yellowColors = { ...bakePaletteColors(yellow), colorMode: "advanced" as const };

	it("still saves an existing palette wearing a new preset's exact colours", () => {
		const existing = saved("Sun", yellowColors as Partial<CustomPalette>);
		const { internals, save } = editor({ existing });
		internals.updateValidity();
		assert.equal(internals.colorClash, null);
		assert.equal(save.getAttribute("aria-disabled"), "false");
	});

	it("still refuses those colours for a new palette, naming the preset", () => {
		const seed = saved("Sun", yellowColors as Partial<CustomPalette>);
		const { internals } = editor({ seedName: "Sun", seed });
		assert.equal(internals.saveBlockedReason(), t("palette.colorExists", { name: yellow.name }));
	});
});

describe("two saved palettes that already share a metadata word", () => {
	// Legal names before metadata words existed, and still legal as names —
	// they only kebab-case alike. Blocking them would lock the user out of
	// editing either palette, even its colours.
	const saved = (name: string): CustomPalette => ({ ...twinOf(name), id: `cp-${name}`, name });
	for (const [mine, theirs] of [["Note dark", "Note (dark)"], ["🔥 Fire", "Fire 🔥"], ["Blue 2", "blue_2"]] as const) {
		it(`"${mine}" still saves beside "${theirs}", with a warning instead`, () => {
			const { internals, save } = editor({ existing: saved(mine), takenNames: [theirs] });
			internals.updateValidity();
			assert.equal(internals.saveBlockedReason(), null);
			assert.equal(save.getAttribute("aria-disabled"), "false");
		});
	}

	it("still refuses giving a palette another's word now", () => {
		const { internals } = editor({ existing: saved("Sunrise"), takenNames: ["Note (dark)"] });
		internals.name = "Note dark";
		assert.equal(internals.saveBlockedReason(), t("palette.metadataNameExists", { key: "note-dark" }));
	});
});

describe("a brand-new palette's starting color", () => {
	it("is the default when no saved palette wears it", () => {
		const { internals } = editor({ seedName: "Sunrise" });
		assert.equal(internals.baseColor, "#448aff");
	});

	it("moves off the default when a saved palette already wears it, so no error greets the user", () => {
		const twin = twinOf("Sunrise");
		const { internals, save } = editor({ seedName: "Sunrise", takenColors: [twin] });
		internals.updateValidity();
		assert.notEqual(internals.baseColor, "#448aff");
		assert.equal(internals.colorClash, null);
		assert.equal(internals.saveBlockedReason(), null);
		assert.equal(save.getAttribute("aria-disabled"), "false");
	});

	it("does not move an existing palette off its own colors", () => {
		const twin = twinOf("Sunrise");
		const { internals } = editor({ existing: twin, takenColors: [] });
		assert.equal(internals.baseColor, twin.baseColor ?? twin.colorLight);
	});
});

describe("where the palette editor says what is wrong", () => {
	it("says a taken name under the Name field, and takes it away once the name is free", () => {
		const { internals } = editor({ seedName: "Sunrise", takenNames: ["sunrise"] });
		// The Name row, as onOpen builds it: a real (stub) Setting.
		const nameSetting = new Setting(el() as unknown as HTMLElement);
		internals.nameSetting = nameSetting;
		internals.updateValidity();
		const row = nameSetting.settingEl as unknown as FakeElement;
		assert.equal(row.hasClass("is-invalid"), true);
		assert.equal((nameSetting.errorEl as unknown as FakeElement).textContent, t("palette.nameExists"));
		internals.name = "Sunrise 2";
		internals.updateValidity();
		assert.equal(row.hasClass("is-invalid"), false);
	});

	it("writes a low-contrast colour as a line under it, not a badge on the swatch", () => {
		// A full-width line of its own (paletteContrastLine.ts, tested in
		// paletteColorView.test.ts); the row's setErrorMessage gave it half a row.
		const source = readRepoFile("src/settings/PaletteEditorModal.ts");
		assert.match(source, /contrastLineAfter\(textRow,/);
		assert.doesNotMatch(source, /SHOW_TEXT_COLOR_CHANNEL/, "the Text color row is no longer behind a flag");
		assert.doesNotMatch(source, /accentRow\.setErrorMessage|warnEl/);
		const css = readRepoFile("styles.css");
		assert.ok(!css.includes(".cs-contrast-warning"), "the corner badge is gone");
		assert.ok(!css.includes("cs-input-invalid"), "no red edge of our own on a field");
	});
});

describe("the palette editor's groups (S7-05)", () => {
	it("builds Palette and Colors as Obsidian setting groups with the editors' row inset", () => {
		const source = readRepoFile("src/settings/PaletteEditorModal.ts");
		assert.match(source, /new SettingGroup\(adjustCol\)\s*\.setHeading\(t\("palette\.groupPalette"\)\)\s*\.addClass\("cs-editor-group"\)/);
		assert.match(source, /\.setHeading\(t\("palette\.advancedColors"\)\)\s*\.addClass\("cs-editor-group"\)/);
		assert.doesNotMatch(source, /createControlGroup|createSliderRow/, "no plugin-drawn card left");
		assert.match(source, /\.setName\(t\("palette\.bgIntensity"\)\)\s*\.setClass\("cs-stacked-slider"\)/);
	});

	it("puts the duplicate-colour line first in the Colors box, and takes it out when the clash goes", () => {
		const twin = twinOf("Sunrise");
		const { internals } = editor({ seedName: "Sunrise", seed: twin, takenColors: [twin] });
		const box = el();
		box.createDiv({ cls: "setting-item" });
		internals.colorCardEl = box as unknown as HTMLElement;
		internals.colorErrorEl = el({ cls: "cs-palette-color-error" }) as unknown as HTMLElement;
		internals.updateValidity();
		assert.equal(box.children[0], internals.colorErrorEl, "the first line of the box");
		assert.match((internals.colorErrorEl as unknown as FakeElement).textContent, /Twin/);
		internals.baseColor = "#123456";
		internals.applyDerived();
		internals.updateValidity();
		assert.equal(box.children.includes(internals.colorErrorEl as unknown as FakeElement), false, "out of the box, not hidden in it");
	});
});
