/**
 * tests/paletteColorView.test.ts — how the palette editor's Colors group says
 * what it has to say without a paragraph.
 *
 * - **The way to the separate colors is a button in the group's heading**, not
 *   a sentence with a link under Base color; the same button is the way back.
 *   It is there only under Solid, the one style that has separate colors.
 * - **Base color keeps one short line**, under Solid only.
 * - **The Text color row** is the third of the separate colors, and what it
 *   holds is what the palette saves.
 * - **The low-contrast warning is said twice**: a triangle beside each color
 *   that falls short (which one), and one full-width line of its own under the
 *   three colors (why), with a divider of its own so it is not read as the
 *   caption of the Text row. Not a row's `setErrorMessage`, which left it half
 *   a row.
 * - **The palette's metadata word is not shown under the name**, only the
 *   warning that another saved palette has it too.
 * - **Light and dark mode each keep their own separate colors**: an edit
 *   changes only the mode on screen, and the sun/moon button shows all of
 *   Obsidian in the other mode until the editor closes.
 *
 * The CSS is read as text, because the fake DOM these tests run in has no
 * cascade.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SettingGroup, type App } from "obsidian";
import { t } from "../src/i18n";
import { PaletteEditorModal } from "../src/settings/PaletteEditorModal";
import type { CalloutDefinition, CustomPalette } from "../src/types";
import { sanitizeCustomPalettes } from "../src/utils/paletteSanitize";
import { installFakeDom, type FakeElement } from "./support/fakeDom";
import type { ButtonLike } from "./support/obsidianStub";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

type Internals = {
	colorCardEl: HTMLElement | null;
	colorGroup: SettingGroup | null;
	colorCardRows: HTMLElement[];
	colors: Record<string, string>;
	advancedColors: boolean;
	bgStyle: "solid" | "gradient" | "none";
	paintColorViewButton: ((view: "simple" | "advanced" | "none") => void) | null;
	paintModeButton: ((dark: boolean) => void) | null;
	shownDark: boolean;
	appDark: boolean;
	metadataKeyEl: HTMLElement | null;
	name: string;
	renderColorSection(): void;
	switchColorView(): void;
	switchMode(): void;
	updateValidity(): void;
	buildAdvancedColorRows(parent: HTMLElement): void;
};

/** An editor whose Colors group is built the way onOpen builds it. */
function open(options: ConstructorParameters<typeof PaletteEditorModal>[1] = {}, app = {} as App) {
	const modal = new PaletteEditorModal({ app } as ConstructorParameters<typeof PaletteEditorModal>[0], options);
	const internals = modal as unknown as Internals;
	const group = new SettingGroup(createDiv()).setHeading(t("palette.advancedColors"));
	internals.colorCardEl = group.listEl;
	internals.colorGroup = group;
	return { modal, internals, group, box: group.listEl as unknown as FakeElement };
}

/** The Colors group with its heading button attached, as onOpen leaves it. */
async function openWithButton(options: ConstructorParameters<typeof PaletteEditorModal>[1] = {}) {
	const { addColorViewButton } = await import("../src/settings/paletteColorViewButton");
	const made = open(options);
	made.internals.paintColorViewButton = addColorViewButton(made.group, () => made.internals.switchColorView());
	made.internals.renderColorSection();
	// The stub's group keeps the buttons it was given, so a test can press one.
	const button = (made.group as unknown as { extraButtons: ButtonLike[] }).extraButtons[0] as ButtonLike;
	return { ...made, button };
}

const hidden = (el: unknown): boolean => (el as FakeElement).hasClass("cs-hidden");
const tooltip = (el: unknown): string | undefined => (el as FakeElement).dataset?.csTooltip;

describe("the button at the end of the Colors heading", () => {
	it("opens the separate colors, and is the way back", async () => {
		const { internals, button } = await openWithButton();
		assert.equal(hidden(button.extraSettingsEl), false);
		assert.equal(tooltip(button.extraSettingsEl), t("palette.colorViewAdvanced"));
		assert.equal(internals.advancedColors, false);

		button.press();
		assert.equal(internals.advancedColors, true);
		assert.equal(tooltip(button.extraSettingsEl), t("palette.colorViewSimple"));

		button.press();
		assert.equal(internals.advancedColors, false);
		assert.equal(tooltip(button.extraSettingsEl), t("palette.colorViewAdvanced"));
	});

	it("goes away under Gradient and Transparent, which have no separate colors", async () => {
		const { internals, button } = await openWithButton();
		for (const style of ["gradient", "none"] as const) {
			internals.bgStyle = style;
			internals.renderColorSection();
			assert.equal(hidden(button.extraSettingsEl), true, style);
		}
		internals.bgStyle = "solid";
		internals.renderColorSection();
		assert.equal(hidden(button.extraSettingsEl), false);
	});

	it("is the only way in: no sentence with a link is left under Base color or in the note", async () => {
		const { internals, box } = await openWithButton();
		assert.equal(box.querySelector(".cs-link-btn"), null);
		internals.switchColorView();
		assert.equal(box.querySelector(".cs-link-btn"), null);
		const source = readRepoFile("src/settings/PaletteEditorModal.ts");
		assert.doesNotMatch(source, /palette\.baseColorHint|palette\.revertHint/);
	});
});

describe("the Base color row", () => {
	it("is a bare swatch: no description line under Solid or Gradient", async () => {
		const { internals, box } = await openWithButton();
		const desc = (): string => box.querySelector(".setting-item-description")?.textContent ?? "";
		assert.equal(desc(), "");
		internals.bgStyle = "gradient";
		internals.renderColorSection();
		assert.equal(desc(), "");
	});
});

/** The keys of the colors the advanced grid edits, for the mode the editor shows. */
function modeKeys(internals: Internals) {
	const isDark = internals.shownDark;
	return {
		accent: isDark ? "colorDark" : "colorLight",
		bg: isDark ? "bgColorDark" : "bgColorLight",
		text: isDark ? "textColorDark" : "textColorLight",
	};
}

describe("the Text color row", () => {
	// The note naming the mode is a Setting too, but it has no name of its own.
	const names = (box: FakeElement): string[] =>
		box.querySelectorAll(".setting-item-name").map((n) => n.textContent).filter((name) => name !== "");

	it("is the third color of the separate colors, after Accent and Background", async () => {
		const { internals, box } = await openWithButton();
		assert.ok(!names(box).includes(t("palette.textColorChannel")), "not on the single base color");
		internals.switchColorView();
		assert.deepEqual(names(box), [
			t("palette.accentColor"),
			t("palette.backgroundColorChannel"),
			t("palette.textColorChannel"),
		]);
	});

	it("is a hand-picked color that the palette saves, and the sanitizer and the preview keep", async () => {
		const { modal, internals } = await openWithButton();
		internals.switchColorView();
		const { text } = modeKeys(internals);
		internals.colors[text] = "#123456";

		const result = (modal as unknown as { buildResult(): Omit<CustomPalette, "id"> }).buildResult();
		assert.equal(result[text as "textColorLight"], "#123456");
		assert.equal(result.colorMode, "advanced");

		// What the settings file does with it on the way in: the load path that
		// import shares (see paletteBaseColor.test.ts).
		const [kept] = sanitizeCustomPalettes([{ id: "cp-1", ...result }]);
		assert.equal(kept?.[text as "textColorLight"], "#123456");

		const preview = (modal as unknown as { buildPreviewDefinition(): CalloutDefinition }).buildPreviewDefinition();
		assert.equal(preview[text as "textColorLight"], "#123456");
	});
});

describe("the low-contrast warning", () => {
	const lines = (box: FakeElement): FakeElement[] => box.querySelectorAll(".cs-palette-contrast-line");

	/** Separate colors for the current mode, every one clear of its limit. */
	async function readableColors() {
		const made = await openWithButton();
		made.internals.switchColorView();
		const keys = modeKeys(made.internals);
		made.internals.colors[keys.bg] = "#ffffcc";
		made.internals.colors[keys.accent] = "#000000";
		made.internals.colors[keys.text] = "#000000";
		made.internals.renderColorSection();
		assert.equal(lines(made.box).length, 0);
		return { ...made, keys };
	}

	it("is one line of its own under the three colors, and goes when they are fixed", async () => {
		const { internals, box, keys } = await readableColors();
		// Yellow on its own pale tint: far under the 3:1 a title has to clear.
		internals.colors[keys.accent] = "#ffff00";
		internals.renderColorSection();

		assert.equal(lines(box).length, 1);
		const line = lines(box)[0] as FakeElement;
		assert.equal(line.textContent, t("editor.contrastWarning"));
		const row = line.previousSibling as FakeElement;
		assert.equal(
			row.querySelector(".setting-item-name")?.textContent,
			t("palette.textColorChannel"),
			"after the last of the three rows, not under the Accent row",
		);
		assert.equal(box.querySelector(".is-invalid"), null, "not the row's own error line");

		internals.colors[keys.accent] = "#000000";
		internals.renderColorSection();
		assert.equal(lines(box).length, 0);
	});

	it("also appears for the Text color alone", async () => {
		const { internals, box, keys } = await readableColors();
		internals.colors[keys.text] = "#ffff99";
		internals.renderColorSection();
		assert.equal(lines(box).length, 1);
		assert.equal((lines(box)[0] as FakeElement).textContent, t("editor.contrastWarning"));
	});

	it("is said once when the Accent and the Text both fall short", async () => {
		const { internals, box, keys } = await readableColors();
		internals.colors[keys.accent] = "#ffff00";
		internals.colors[keys.text] = "#ffff99";
		internals.renderColorSection();
		assert.equal(lines(box).length, 1);
	});

	it("is taken out with the rows when the Colors card is rebuilt", async () => {
		const { internals, box } = await openWithButton();
		internals.switchColorView();
		internals.colors.colorLight = "#ffff00";
		internals.colors.colorDark = "#ffff00";
		internals.colors.bgColorLight = "#ffffcc";
		internals.colors.bgColorDark = "#ffffcc";
		internals.renderColorSection();
		assert.equal(lines(box).length, 1);
		internals.switchColorView();
		assert.equal(lines(box).length, 0, "back on the single base color");
	});

	it("stands apart from the rows: a divider of its own, not the caption of the Text row", () => {
		const css = readRepoFile("styles.css");
		const rule = css.match(/\.cs-palette-contrast-line\s*\{([^}]*)\}/);
		const body = rule?.[1] ?? "";
		assert.ok(rule, "the line has a rule");
		assert.match(body, /color:\s*var\(--text-warning\)/);
		assert.match(body, /padding:\s*var\(--size-4-3\) var\(--setting-items-padding-x\)/, "padded on top as well as below, and inset like a row");
		const divider = css.match(/\.cs-palette-contrast-line::before\s*\{([^}]*)\}/);
		assert.ok(divider, "the hairline Obsidian draws above a row");
		assert.match(divider?.[1] ?? "", /border-top:\s*1px solid var\(--background-modifier-border\)/);
		assert.ok(!css.includes("cs-row-inline.cs-row-inline.cs-row-inline.is-invalid"), "no leftover half-row rule");
	});

	describe("the triangle", () => {
		const badgeOf = (row: FakeElement | null): FakeElement | null => row?.querySelector(".cs-contrast-badge") ?? null;
		const rowNamed = (box: FakeElement, name: string): FakeElement | null =>
			box.querySelectorAll(".setting-item").find((r) => r.querySelector(".setting-item-name")?.textContent === name) ?? null;
		const shown = (el: FakeElement | null): boolean => el !== null && !el.hasClass("cs-hidden");

		it("is on the color that falls short, and only on that one", async () => {
			const { internals, box, keys } = await readableColors();
			const accent = rowNamed(box, t("palette.accentColor"));
			const text = rowNamed(box, t("palette.textColorChannel"));
			assert.ok(badgeOf(accent) && badgeOf(text), "both rows carry one");
			assert.equal(shown(badgeOf(accent)) || shown(badgeOf(text)), false, "hidden while readable");

			internals.colors[keys.accent] = "#ffff00";
			internals.renderColorSection();
			assert.equal(shown(badgeOf(rowNamed(box, t("palette.accentColor")))), true);
			assert.equal(shown(badgeOf(rowNamed(box, t("palette.textColorChannel")))), false);

			internals.colors[keys.accent] = "#000000";
			internals.colors[keys.text] = "#ffff99";
			internals.renderColorSection();
			assert.equal(shown(badgeOf(rowNamed(box, t("palette.accentColor")))), false);
			assert.equal(shown(badgeOf(rowNamed(box, t("palette.textColorChannel")))), true);
		});

		it("says the problem in its tooltip, as a labelled image for a screen reader", async () => {
			const { internals, box, keys } = await readableColors();
			internals.colors[keys.accent] = "#ffff00";
			internals.renderColorSection();
			const badge = badgeOf(rowNamed(box, t("palette.accentColor")));
			assert.equal(badge?.getAttribute("aria-label"), t("editor.contrastWarning"));
			assert.equal(badge?.getAttribute("role"), "img");
		});

		it("sits before the swatch, so the swatch does not move when it comes", async () => {
			const { internals, box, keys } = await readableColors();
			internals.colors[keys.accent] = "#ffff00";
			internals.renderColorSection();
			const control = rowNamed(box, t("palette.accentColor"))?.querySelector(".setting-item-control");
			const kids = control?.children ?? [];
			assert.equal((kids[0] as FakeElement).hasClass("cs-contrast-badge"), true);
			assert.equal((kids[kids.length - 1] as FakeElement).tagName.toLowerCase(), "input");
		});

		it("follows every move inside the picker, while the line waits for the settled pick", async () => {
			const { box } = await readableColors();
			const accentRow = rowNamed(box, t("palette.accentColor"));
			const swatch = accentRow?.querySelector("input") as (FakeElement & { value: string }) | null;
			assert.ok(swatch);
			assert.equal(shown(badgeOf(accentRow)), false);

			swatch.value = "#ffff00";
			swatch.fire("input");
			assert.equal(shown(badgeOf(accentRow)), true, "the triangle is there mid-drag");
			assert.equal(lines(box).length, 0, "the line is not: it would move the window under the cursor");

			swatch.fire("change");
			assert.equal(lines(box).length, 1, "it comes with the settled pick");

			swatch.value = "#000000";
			swatch.fire("input");
			assert.equal(shown(badgeOf(accentRow)), false);
			swatch.fire("change");
			assert.equal(lines(box).length, 0);
		});
	});
});

describe("the metadata word under the Name field", () => {
	const saved = (name: string): CustomPalette => ({
		id: `cp-${name}`,
		name,
		colorLight: "#448aff",
		colorDark: "#448aff",
	} as CustomPalette);

	it("is not written out for an ordinary name", () => {
		const { internals } = open({ seedName: "Blue 2" });
		internals.metadataKeyEl = createDiv();
		internals.updateValidity();
		assert.equal(internals.metadataKeyEl.textContent, "");
	});

	it("still warns when a palette saved before words existed shares its word", () => {
		const { internals } = open({ existing: saved("Note dark"), takenNames: ["Note (dark)"] });
		internals.metadataKeyEl = createDiv();
		internals.updateValidity();
		assert.equal(internals.metadataKeyEl.textContent, t("palette.metadataNameShared", { key: "note-dark" }));
	});
});

/** A row of the Colors box, by its name. */
function rowNamed(box: FakeElement, name: string): FakeElement {
	const row = box.querySelectorAll(".setting-item").find((r) => r.querySelector(".setting-item-name")?.textContent === name);
	assert.ok(row, `a "${name}" row`);
	return row;
}

describe("light and dark mode each keep their own separate colors", () => {
	it("an edit changes only the mode on screen", async () => {
		for (const dark of [false, true]) {
			const { internals, box } = await openWithButton();
			internals.shownDark = dark;
			internals.switchColorView();
			const before = { ...internals.colors };
			const swatch = rowNamed(box, t("palette.backgroundColorChannel")).querySelector("input") as FakeElement & { value: string };
			// White used to come back as black in the other mode: its lightness
			// was mirrored, and the mirror overwrote whatever that mode had.
			swatch.value = "#ffffff";
			swatch.fire("input");
			const [mine, other] = dark ? ["bgColorDark", "bgColorLight"] : ["bgColorLight", "bgColorDark"];
			assert.equal(internals.colors[mine], "#ffffff", dark ? "dark" : "light");
			assert.equal(internals.colors[other], before[other], "the other mode keeps its own");
		}
	});

	it("says which mode the rows are for, and names the button that switches it", async () => {
		const { internals, box } = await openWithButton();
		internals.switchColorView();
		const note = (): string => box.querySelector(".cs-palette-mode-note .setting-item-description")?.textContent ?? "";
		// Light on screen: only the moon is there, and it brings dark.
		assert.ok(note().includes("light mode only"), note());
		assert.ok(note().includes("moon") && !note().includes("sun"), note());
		internals.shownDark = true;
		internals.renderColorSection();
		assert.ok(note().includes("dark mode only"), note());
		assert.ok(note().includes("sun") && !note().includes("moon"), note());
	});

	it("titles the card with the mode while the separate colors show, and with Colors otherwise", async () => {
		const { internals, group, button } = await openWithButton();
		const title = (): string =>
			(group as unknown as { groupEl: FakeElement }).groupEl.querySelector(".setting-item-heading .setting-item-name")?.textContent ?? "";
		assert.equal(title(), t("palette.advancedColors"));

		button.press();
		assert.equal(title(), t("palette.lightModeColors"));
		// What the sun/moon button does to the rows (it also flips Obsidian's
		// theme, which this suite's stand-in app has no body for).
		internals.shownDark = true;
		internals.renderColorSection();
		assert.equal(title(), t("palette.darkModeColors"));
		internals.shownDark = false;
		internals.renderColorSection();
		assert.equal(title(), t("palette.lightModeColors"));

		button.press();
		assert.equal(title(), t("palette.advancedColors"), "back on the single Base color, the mode is not the card's business");
	});
});

describe("the sun/moon button at the end of the Colors heading", () => {
	/** The part of Obsidian the button reads and writes: the main window's body. */
	function appShowing(dark: boolean): App {
		const body = activeDocument.body;
		body.toggleClass("theme-dark", dark);
		body.toggleClass("theme-light", !dark);
		return {
			isDarkMode: () => body.hasClass("theme-dark"),
			workspace: { containerEl: body.createDiv(), on: () => ({}), offref: () => undefined },
		} as unknown as App;
	}

	/** The editor with both heading buttons, as onOpen builds them. */
	async function withModeButton(dark: boolean) {
		const { addModeButton } = await import("../src/settings/paletteModeButton");
		const made = open({}, appShowing(dark));
		made.internals.appDark = made.internals.shownDark = dark;
		made.internals.paintModeButton = addModeButton(made.group, () => made.internals.switchMode());
		made.internals.renderColorSection();
		const button = (made.group as unknown as { extraButtons: ButtonLike[] }).extraButtons[0] as ButtonLike;
		// What onClose takes apart besides the rows.
		Object.assign(made.modal, { containerEl: createDiv(), modalEl: createDiv(), contentEl: createDiv() });
		return { ...made, button };
	}

	const bodyMode = (): string =>
		[activeDocument.body.hasClass("theme-dark") ? "dark" : "", activeDocument.body.hasClass("theme-light") ? "light" : ""].join(" ").trim();

	it("shows all of Obsidian in the other mode, and puts it back when the editor closes", async () => {
		try {
			const { modal, internals, button } = await withModeButton(false);
			assert.equal(tooltip(button.extraSettingsEl), t("palette.showDarkMode"));

			button.press();
			assert.equal(bodyMode(), "dark");
			assert.equal(internals.shownDark, true);
			assert.equal(tooltip(button.extraSettingsEl), t("palette.showLightMode"));

			modal.onClose();
			assert.equal(bodyMode(), "light", "back to the mode it opened in");
		} finally {
			appShowing(false);
		}
	});

	it("leaves the mode alone on close when it was not switched", async () => {
		try {
			const { modal } = await withModeButton(true);
			modal.onClose();
			assert.equal(bodyMode(), "dark");
		} finally {
			appShowing(false);
		}
	});

	it("is there under every style, where the view button is not", async () => {
		try {
			const { internals, button } = await withModeButton(false);
			for (const style of ["solid", "gradient", "none"] as const) {
				internals.bgStyle = style;
				internals.renderColorSection();
				assert.equal(hidden(button.extraSettingsEl), false, style);
			}
		} finally {
			appShowing(false);
		}
	});
});
