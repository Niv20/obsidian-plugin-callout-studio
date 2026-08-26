/**
 * settings/ThemeCalloutPreviewModal.ts — what a theme-owned callout looks like,
 * and why there is nothing here to change.
 *
 * Opened by the pencil on a row under *Callouts from your theme*. It replaces
 * the full editor, which used to open there and was a trap: every control in it
 * — colour, icon, name, ID — wrote a value the plugin had stopped emitting, so
 * the user could change six things, press Save, and see nothing happen.
 *
 * So this window has no colour picker, no icon picker, no name field and no ID
 * field. It also, now, has no sliders: it briefly offered an icon-position nudge
 * for the Heading and Inline roles, on the argument that `.cs-*` DOM is the
 * plugin's own and overriding nothing. Those two roles are gone for a theme
 * callout (see `editor/renderShared.ts`), so the nudge had nothing left to move.
 *
 * **The window writes nothing.** No `persist`, no `customized` stamp, no save.
 * That is worth stating because it is what makes the theme row an ephemeral
 * overlay rather than a row with a hidden way to become permanent.
 *
 * What is left is three statements and a live rendering:
 *
 * - **Who owns it.** Which theme paints this callout, and that Callout Studio
 *   will not override it.
 * - **That its appearance is not editable here**, and what to do instead.
 * - **That Block is its only format** — because a user who has been writing
 *   `## [!recite]` needs to know why it stopped rendering, and a user who has
 *   not needs to know not to start.
 * - **A live preview** of the Block callout, rendered by Obsidian itself through
 *   `LiveCalloutPreview`, so it is drawn by the theme's own CSS rather than by
 *   an imitation of it.
 */
import { Modal, Setting } from "obsidian";
import { t } from "../i18n";
import { applyModalChrome } from "./modalChrome";
import { LiveCalloutPreview } from "./LiveCalloutPreview";
import { activeThemeName } from "../manager/theme/customCssApi";
import type { CalloutDefinition } from "../types";
import type { CalloutEditorPlugin } from "./editor/types";

export class ThemeCalloutPreviewModal extends Modal {
	private preview: LiveCalloutPreview | null = null;

	constructor(
		plugin: CalloutEditorPlugin,
		private readonly def: CalloutDefinition,
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const themeName =
			activeThemeName(this.app) ?? t("settings.themeCalloutsDefaultTheme");
		this.setTitle(t("themePreview.title", { name: this.def.displayName }));
		const footer = applyModalChrome(this, { footer: true, wide: true });
		const { contentEl } = this;

		for (const key of [
			"themePreview.owned",
			"themePreview.readOnly",
			"themePreview.blockOnly",
		] as const) {
			contentEl.createEl("p", {
				cls: "cs-theme-preview-note",
				text: t(key, { name: this.def.displayName, theme: themeName }),
			});
		}

		this.preview = new LiveCalloutPreview(this.app, contentEl, {
			title: t("themePreview.previewTitle"),
			initialText: t("themePreview.blockSample", {
				id: this.def.id,
				name: this.def.displayName,
			}),
		});

		new Setting(footer).addButton((btn) =>
			btn
				.setButtonText(t("editor.externalStyleClose"))
				.setCta()
				.onClick(() => {
					this.close();
				}),
		);
	}

	onClose(): void {
		this.preview?.destroy();
		this.preview = null;
		this.contentEl.empty();
	}
}
