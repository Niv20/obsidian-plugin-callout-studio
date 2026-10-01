/**
 * The palette editor's Save is dimmed, not disabled, while the name or the
 * colors duplicate another palette — and pressing it says which.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { t } from "../src/i18n";
import { PaletteEditorModal } from "../src/settings/PaletteEditorModal";
import type { CustomPalette } from "../src/types";
import { el } from "./support/fakeDom";

type Options = ConstructorParameters<typeof PaletteEditorModal>[1];
type Internals = {
	saveBtnEl: unknown;
	name: string;
	currentColorPalette(): Omit<CustomPalette, "id" | "name">;
	updateValidity(): void;
	saveBlockedReason(): string | null;
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
		// Whatever the form currently derives is, by construction, a palette the user already has.
		const twin = twinOf("Sunrise");
		const { internals, save } = editor({ seedName: "Sunrise", takenColors: [twin] });
		internals.updateValidity();
		assert.equal(save.getAttribute("aria-disabled"), "true");
		assert.equal(internals.saveBlockedReason(), t("palette.colorExists", { name: "Twin" }));
	});

	it("reports the name first when both are duplicated, as its error does on screen", () => {
		const twin = twinOf("Sunrise");
		const { internals } = editor({ seedName: "Sunrise", takenNames: ["Sunrise"], takenColors: [twin] });
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
