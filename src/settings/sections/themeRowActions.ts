/**
 * settings/sections/themeRowActions.ts — the controls a theme-owned row is
 * allowed to have.
 *
 * A row under *Callouts from your theme* is painted entirely by the theme, and
 * Callout Studio will not override it. So every control here has to pass one
 * test: does it do what it says? The two that failed have gone.
 *
 * - The **pencil** used to open the full editor, whose colour, icon, name and
 *   ID fields changed nothing that renders. It now opens
 *   {@link ThemeCalloutPreviewModal} instead — a window that shows what the
 *   callout looks like and says who owns it, and writes nothing at all.
 * - **Customize in Callout Studio** took the callout over. There is no taking
 *   over any more: while the theme names the id, the theme paints it. A user
 *   who wants a different design creates a new callout under a different ID,
 *   the ordinary way, from the section that is theirs.
 *
 * What is left is honest, and it is only about the vault: how much of it this
 * callout occupies, and the two ways to change that. Both vault-writing actions
 * drop the usage cache afterwards, because the number they just changed is the
 * one the menu will show next time it opens.
 */
import { Menu, setIcon, setTooltip } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { SettingsSectionContext } from "./types";
import {
	handleCalloutReplace,
	handleClearCalloutUsages,
} from "./calloutVaultActions";
import { invalidateThemeRowUsage, themeRowUsage } from "./themeRowUsage";
import { ThemeCalloutPreviewModal } from "../ThemeCalloutPreviewModal";

/** One 32×32 icon button, in the same shape the pencil and `⋯` already use. */
function addRowButton(
	host: HTMLElement,
	icon: string,
	label: string,
	onClick: () => void,
): void {
	const btn = host.createEl("button", { attr: { "aria-label": label } });
	setIcon(btn, icon);
	setTooltip(btn, label);
	btn.addEventListener("click", onClick);
}

/**
 * The `⋯` menu for a theme-owned row.
 *
 * Three items, none of which claims to change how the callout looks: what the
 * callout costs in the vault, and the two ways to spend less of it.
 *
 * This is also the only place the count appears. The row itself does not carry
 * one any more — a use count reads as something to act on, and on a row whose
 * appearance is not the user's to change it invited a click that leads nowhere.
 * In the menu it sits directly above the two actions it qualifies.
 *
 * Note the wording of the second: *Clear uses in your notes*, never *Delete*.
 * Delete is what the same slot says on a row this plugin owns, and it is true
 * there. Here nothing is deleted — the theme keeps supplying the type — and the
 * menu has to be true before the user clicks, not only in the confirmation
 * afterwards.
 */
export async function openThemeRowMenu(
	ctx: SettingsSectionContext,
	event: MouseEvent,
	def: CalloutDefinition,
): Promise<void> {
	const usage = themeRowUsage(def.id) ?? { fileCount: 0, totalCount: 0 };
	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle(
				t("settings.usageInfo", {
					count: usage.totalCount,
					files: usage.fileCount,
				}),
			)
			.setIcon("info")
			.setDisabled(true),
	);
	menu.addSeparator();

	if (usage.fileCount > 0) {
		menu.addItem((item) =>
			item
				.setTitle(t("settings.replaceAction"))
				.setIcon("arrow-left-right")
				.onClick(() => {
					void handleCalloutReplace(ctx, def).finally(
						invalidateThemeRowUsage,
					);
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("settings.clearUsesAction"))
				.setIcon("eraser")
				.onClick(() => {
					void handleClearCalloutUsages(ctx, def, usage).finally(
						invalidateThemeRowUsage,
					);
				}),
		);
	}

	menu.showAtMouseEvent(event);
	await Promise.resolve();
}

/**
 * Render the theme row's controls: the preview button and the `⋯`.
 *
 * A theme row is deliberately the plainest row in the tab — icon, name, the
 * `[!id]` spellings, two measured swatches, two buttons. It carries no label
 * and no use count, because every one of those was a fact about a callout the
 * user cannot change, sitting where the rows they *can* change put something
 * actionable. The count moved into the `⋯` menu, next to the two actions it is
 * actually about.
 *
 * The preview button keeps the pencil glyph the row has always had there, so
 * every row in the tab has the same two controls in the same two places and the
 * eye does not have to re-learn the list at each section boundary.
 */
export function renderThemeRowControls(
	ctx: SettingsSectionContext,
	buttonsEl: HTMLElement,
	def: CalloutDefinition,
): void {
	addRowButton(
		buttonsEl,
		"pencil",
		t("settings.themePreviewAria", { name: def.displayName }),
		() => {
			new ThemeCalloutPreviewModal(ctx.plugin, def).open();
		},
	);

	const moreBtn = buttonsEl.createEl("button", {
		cls: "callout-studio-more-btn",
		attr: {
			"aria-label": t("settings.moreRowActionsAria", {
				name: def.displayName,
			}),
		},
	});
	setIcon(moreBtn, "more-horizontal");
	moreBtn.addEventListener("click", (event) => {
		void openThemeRowMenu(ctx, event, def);
	});
}
