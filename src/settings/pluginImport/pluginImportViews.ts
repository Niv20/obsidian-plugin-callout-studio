/**
 * settings/pluginImport/pluginImportViews.ts — the plugin import window's three
 * options, drawn from state.
 *
 * Builders only: no state, and above all no Import button. The window's one
 * Import lives in its footer (PluginImportModal), and nothing here may grow a
 * second — a box either chooses its option or fills it, and none of them is
 * labelled "Import".
 *
 * Each option is one option box (settings/optionBox.ts), the same box Import's
 * source chooser and Export's format chooser draw, here as a radio. No button
 * sits on it, so a click anywhere on its face is the whole interaction, and
 * what that click means (choose, fill, fill again) is the window's to decide.
 * Which box is active is not drawn here: PluginImportModal toggles it without a
 * redraw (see `markActive`), so a click that only changes the choice leaves
 * focus where it was.
 */
import { t } from "../../i18n";
import {
	optionBoxId,
	renderOptionBox,
	renderOptionList,
	type OptionBox,
} from "../optionBox";
import {
	vaultUnavailable,
	type ImportOption,
	type ProbeState,
} from "./pluginImportFlow";
import type { PluginImportCopy } from "./pluginImportSource";

export interface OptionsState {
	probe: ProbeState;
	vaultCount: number;
	fileName: string | null;
	pasted: boolean;
	/** i18n key: why the last clipboard read brought nothing back, if it did. */
	pasteError: string | null;
}

export interface OptionsHandlers {
	/** The box was clicked or pressed; the window decides what that means. */
	onActivate: (option: ImportOption) => void;
}

/** Each option's box, and its title and status lines for Import to cite. */
export type OptionsRefs = Record<ImportOption, OptionBox>;

/**
 * `label` names the group — the window's title. Referenced rather than copied
 * into an `aria-label`, because Obsidian shows any `aria-label` as a tooltip,
 * and the group's would pop up over whichever box the pointer is on.
 */
export function renderOptions(
	parent: HTMLElement,
	label: HTMLElement,
	copy: PluginImportCopy,
	state: OptionsState,
	handlers: OptionsHandlers,
): OptionsRefs {
	if (!label.id) label.id = optionBoxId("group");
	const group = renderOptionList(parent, {
		role: "radiogroup",
		"aria-labelledby": label.id,
	});
	return {
		vault: renderVault(group, copy, state, handlers),
		file: renderFile(group, copy, state, handlers),
		paste: renderPaste(group, copy, state, handlers),
	};
}

/** Flip which box is active, in place. */
export function markActive(refs: OptionsRefs, active: ImportOption | null): void {
	for (const [option, { el }] of Object.entries(refs)) {
		const on = option === active;
		el.toggleClass("is-selected", on);
		el.setAttribute("aria-checked", on ? "true" : "false");
	}
}

/**
 * What the vault box's status line says. The window announces the same words
 * once the probe settles, so the two can never disagree.
 */
export function vaultStatus(
	copy: PluginImportCopy,
	probe: ProbeState,
	count: number,
): string {
	switch (probe) {
		case "checking":
			return t(copy.vaultChecking);
		case "found":
			return t(copy.vaultFound, { count });
		case "empty":
			return t(copy.vaultEmpty);
		case "notInstalled":
			return t(copy.vaultNotInstalled);
		case "unreadable":
			return t(copy.vaultUnreadable);
	}
}

/**
 * "This vault": the other plugin's data, where it lives. Recommended once
 * found, because it is the one route that carries everything. Once the probe
 * settles on nothing it stays on screen, greyed out and saying which of three
 * things it found: the plugin isn't installed here, it is but holds nothing to
 * import, or its settings file can't be read.
 */
function renderVault(
	group: HTMLElement,
	copy: PluginImportCopy,
	state: OptionsState,
	handlers: OptionsHandlers,
): OptionBox {
	const { probe } = state;
	const found = probe === "found";
	const box = renderOptionBox(group, {
		role: "radio",
		icon: "vault",
		title: t(copy.fromVault),
		desc: vaultStatus(copy, probe, state.vaultCount),
		warning: probe === "unreadable",
		recommended: found,
		availability: found
			? "enabled"
			: vaultUnavailable(probe)
				? "disabled"
				: "pending",
		onActivate: () => handlers.onActivate("vault"),
	});
	// A fast probe should never flash "Looking for…" — see styles.css.
	box.el.toggleClass("is-checking", probe === "checking");
	return box;
}

/** A file, staged until Import is pressed and read only then. */
function renderFile(
	group: HTMLElement,
	copy: PluginImportCopy,
	state: OptionsState,
	handlers: OptionsHandlers,
): OptionBox {
	const staged = state.fileName !== null;
	const box = renderOptionBox(group, {
		role: "radio",
		icon: staged ? "file-check" : "file-json",
		title: state.fileName ?? t(copy.fromFile),
		titleIsName: staged,
		desc: t(staged ? "import.fileReady" : copy.fromFileDesc),
		onActivate: () => handlers.onActivate("file"),
	});
	// Holds something Import could act on; the icon and both lines show it.
	box.el.toggleClass("is-filled", staged);
	return box;
}

/** Whatever is on the clipboard, read when the box is clicked. */
function renderPaste(
	group: HTMLElement,
	copy: PluginImportCopy,
	state: OptionsState,
	handlers: OptionsHandlers,
): OptionBox {
	const { pasted, pasteError } = state;
	const box = renderOptionBox(group, {
		role: "radio",
		icon: pasted ? "clipboard-check" : "clipboard-paste",
		title: t(pasted ? "import.pasted" : copy.fromPaste),
		desc: t(pasted ? "import.fileReady" : (pasteError ?? copy.fromPasteDesc)),
		warning: !pasted && pasteError !== null,
		onActivate: () => handlers.onActivate("paste"),
	});
	box.el.toggleClass("is-filled", pasted);
	return box;
}
