/**
 * settings/ThemeCalloutPreviewModal.ts — what a theme-owned callout looks like,
 * and why there is nothing here to change.
 *
 * Opened by the view button on a row under *Callouts from your theme*. It replaces
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
 * What is left is one concise explanation and a live rendering:
 *
 * - **Who owns it and what read-only means.** The active theme paints it;
 *   colour, icon and ID are unavailable here, as are Heading and Inline.
 * - **What to do instead.** Create a new callout under a different ID.
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
		private readonly plugin: CalloutEditorPlugin,
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

		contentEl.createEl("p", {
			cls: "cs-theme-preview-note",
			text: t("themePreview.summary", { theme: themeName }),
		});

		const sample = t("themePreview.blockSample", {
			id: this.def.id,
			name: this.def.displayName,
		});

		this.preview = new LiveCalloutPreview(this.app, contentEl, {
			title: t("themePreview.previewTitle"),
			initialText: sample,
			// Keep the document's final line so the parked caret remains safely
			// outside the callout; only collapse that line visually for a callout
			// the active theme actually owns.
			collapseTrailingBlankLine: this.plugin.registry.themeOwns(this.def),
		});

		new Setting(footer).addButton((btn) =>
			btn
				.setButtonText(t("editor.themePreviewClose"))
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
