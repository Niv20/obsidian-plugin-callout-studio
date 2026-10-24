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
 */
import { t } from "../../i18n";
import { explainIfBlocked, paintBlocked } from "../../ui/blockedButton";
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
	buttonText: string;
	/** The button deletes something: Obsidian's red (`setDestructive().setCta()`). */
	destructive?: boolean;
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
			setting.addButton((button) => {
				button.setButtonText(spec.buttonText);
				if (spec.destructive) button.setDestructive().setCta();
				paintBlocked(button.buttonEl, reason());
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
