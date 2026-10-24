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
import type { BaseComponent, Setting } from "obsidian";
import { t, type LocaleKey } from "../../i18n";
import { explainIfBlocked, paintBlocked } from "../../ui/blockedButton";
import { setButtonBusy } from "../../ui/busyButton";
import type { RowRegistry } from "./rowRegistry";
import { guardRender } from "./safeTree";
import type { CsRender } from "./types";

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
