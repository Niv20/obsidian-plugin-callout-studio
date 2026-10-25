/**
 * settings/declarative/rowParts.ts — the row shapes the settings tree uses
 * again and again.
 *
 * Who calls it. The modules that build parts of the tree (mainPageGroups.ts
 * and the pages that follow).
 *
 * The main idea. Most settings rows are "a name, a sentence, and one button".
 * {@link buttonRow} builds that row the way the rest of the plugin builds a
 * button that may be blocked (ui/blockedButton.ts): while it cannot act, it is
 * dimmed, and a press says why instead of doing nothing. Obsidian's own
 * `disabled` would make the button silently dead, which the plugin avoids
 * everywhere else too.
 *
 * The icon buttons at a row's end (✎) work the same way, through
 * `addBlockableIconButton` (ui/blockedButton.ts).
 *
 * A row that holds a control of the plugin's own (a picker) uses
 * {@link addControlComponent}, so the row's `disabled` reaches that control
 * the way it reaches Obsidian's own toggles and buttons.
 */
import type { BaseComponent, ExtraButtonComponent, Setting, SettingGroup } from "obsidian";
import { t, type LocaleKey } from "../../i18n";
import { explainIfBlocked, paintBlocked } from "../../ui/blockedButton";
import { setButtonBusy } from "../../ui/busyButton";
import { settingGroupEl } from "../../ui/settingGroupEl";
import type { RowRegistry } from "./rowRegistry";
import { guardRender } from "./safeTree";
import type { CsGroup, CsRender } from "./types";

/** What {@link buttonRow} is told. */
export interface ButtonRowSpec {
	/** A key that never changes; also the name a jump to this row uses. */
	id: string;
	name: string;
	desc?: string;
	/** More words the settings search should find this row by. */
	aliases?: string[];
	/** Classes for the row's own look. */
	cls?: string;
	buttonText: string;
	/** The button deletes something: Obsidian's red (`setDestructive().setCta()`). */
	destructive?: boolean;
	/** The row's main action: Obsidian's accent button (`setCta()`). */
	cta?: boolean;
	/**
	 * Whether the button's work is running now (a download, say): Obsidian's
	 * spinner over its words, and the button cannot be pressed again. Asked at
	 * every draw, so a redraw in the middle keeps the spinner.
	 */
	busy?: () => boolean;
	/**
	 * Why the button cannot act now, or null when it can. Asked at every draw
	 * (to dim the button) and at every press (to explain instead of acting).
	 */
	blockedReason?: () => string | null;
	/** Register the row here, for jumps to it (the row's `id` is its name there). */
	registerIn?: RowRegistry;
	/**
	 * What a press does. A flow that returns its promise keeps Obsidian's
	 * spinner on the button until it finishes, as the old page's Reset did.
	 */
	onClick(): void | Promise<void>;
}

/** A row with one button at its end, the commonest row on the page. */
export function buttonRow(spec: ButtonRowSpec): CsRender {
	const reason = (): string | null => spec.blockedReason?.() ?? null;
	return {
		id: spec.id,
		name: spec.name,
		desc: spec.desc,
		aliases: spec.aliases,
		render: guardRender(spec.name, (setting) => {
			if (spec.cls) setting.setClass(spec.cls);
			setting.addButton((button) => {
				button.setButtonText(spec.buttonText);
				if (spec.destructive) button.setDestructive().setCta();
				else if (spec.cta) button.setCta();
				paintBlocked(button.buttonEl, reason());
				if (spec.busy) setButtonBusy(button.buttonEl, spec.busy());
				button.onClick(() => {
					if (explainIfBlocked(reason())) return;
					return spec.onClick();
				});
			});
			// The registry's own undo is the row's cleanup (see rowRegistry.ts).
			return spec.registerIn?.register(spec.id, setting.settingEl);
		}),
	};
}

/**
 * Why a change cannot be made now: saving is paused, and a change that cannot
 * be saved would look made and then vanish. Null while saving works.
 */
export function pausedReason(writer: { isFrozen: boolean }): string | null {
	return writer.isFrozen ? t("notice.blockedWhilePaused") : null;
}

/**
 * How many there are, for the end of the row that opens a page ("12 callouts",
 * "1 callout"), or nothing at none: the page says so itself.
 *
 * @param keys The sentence for one, and the one for more (with `{{count}}`).
 */
export function countValue(count: number, keys: { one: LocaleKey; many: LocaleKey }): string {
	if (count === 0) return "";
	return count === 1 ? t(keys.one) : t(keys.many, { count });
}

/* ---- A page's opening sentence ---- */

/** Marks the box of a page's opening sentence (styles.css). */
const PAGE_INTRO_CLASS = "cs-page-intro";

/**
 * The sentence that opens a page, drawn the way Obsidian opens its own list
 * pages: a `p.setting-page-desc` above the boxes, in no box of its own (the
 * theme's callouts page draws the same paragraph, calloutListPage.ts).
 *
 * Why a box with a drawing row: a page holds only boxes of rows, and Obsidian
 * leaves out a row that has nothing to draw (no name, no render, no control,
 * no action; `M4` in app.js), so a row with just a description never shows.
 * A render row is always drawn; the box's `cs-page-intro` class takes the
 * box's and the row's own look away (styles.css), leaving the paragraph.
 *
 * @param id The box's key, and the row's.
 */
export function pageIntroBox(id: string, text: string): CsGroup {
	return {
		type: "group",
		id,
		cls: PAGE_INTRO_CLASS,
		items: [{
			id,
			name: "",
			searchable: false,
			render: (setting) => {
				const intro = setting.settingEl.createEl("p", { cls: "setting-page-desc", text });
				// Obsidian keeps the row when it draws the page again, so the
				// paragraph goes before the next one is made.
				return () => intro.remove();
			},
		}],
	};
}

/* ---- ↺ in a box's heading ---- */

/** Marks a box's heading ↺, so the box's rows can find it to dim it. */
const BOX_RESET_CLASS = "cs-group-reset";

/**
 * A ↺ for a box's heading: an entry of the box's `extraButtons`. Obsidian
 * makes it once, when the box is first drawn, so `reset` must read everything
 * anew when pressed. While saving is paused, a press says why instead.
 */
export function boxResetButton(
	writer: { isFrozen: boolean },
	label: string,
	reset: () => void,
): (button: ExtraButtonComponent) => void {
	return (button) => {
		button.extraSettingsEl.addClass(BOX_RESET_CLASS);
		button
			.setIcon("rotate-ccw")
			.setTooltip(`${t("settings.resetAction")}: ${label}`)
			.onClick(() => {
				if (explainIfBlocked(pausedReason(writer))) return;
				reset();
			});
	};
}

/**
 * Dim a ↺ while there is nothing to reset. Obsidian draws an icon button
 * marked `aria-disabled` at 40%.
 */
export function paintResetIdle(resetEl: HTMLElement, idle: boolean): void {
	resetEl.setAttribute("aria-disabled", String(idle));
}

/**
 * Dim the ↺ in `group`'s heading while nothing in the box is changed. The
 * box's rows call it as they are drawn (`render` is given the box).
 */
export function paintBoxReset(group: SettingGroup, modified: boolean): void {
	const resetEl = settingGroupEl(group).querySelector<HTMLElement>(`.${BOX_RESET_CLASS}`);
	if (resetEl) paintResetIdle(resetEl, !modified);
}

/** A control of the plugin's own that can be switched off, such as a picker. */
export interface DisableableControl {
	setDisabled(disabled: boolean): unknown;
}

/**
 * Make `control` one of `setting`'s components. Obsidian disables a row by
 * calling `setDisabled` on each of its components, so the row's `disabled`
 * (for instance "while saving is paused") then reaches the control too.
 */
export function addControlComponent(setting: Setting, control: DisableableControl): void {
	setting.addComponent(() => new ControlComponent(control));
}

/**
 * A plugin control dressed as an Obsidian component. (`implements
 * BaseComponent` only makes TypeScript check that the shape matches what
 * `addComponent` asks for; none of Obsidian's code runs here.)
 */
class ControlComponent implements BaseComponent {
	disabled = false;

	constructor(private readonly control: DisableableControl) {}

	setDisabled(disabled: boolean): this {
		this.disabled = disabled;
		this.control.setDisabled(disabled);
		return this;
	}

	/**
	 * Every Obsidian component has `then`, for chaining calls. (It makes the
	 * object look like a promise to `await`, so never `await` a component.)
	 */
	then(callback: (component: this) => unknown): this {
		callback(this);
		return this;
	}
}
