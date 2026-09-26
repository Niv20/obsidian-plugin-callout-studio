/**
 * settings/ExportFormatModal.ts — Chooser shown by the settings tab's Export
 * button: a Callout Studio backup, or a plain CSS snippet.
 *
 * The mirror image of {@link ImportSourceModal}, and deliberately so — Import
 * has been one row opening a chooser for a while, and a second top-level row
 * for one more export format would have left the two halves of "Import /
 * export" shaped differently for no reason the user could see.
 *
 * The two formats are not just two file extensions, which is why this is a
 * modal with a line of prose per row rather than a menu: the backup leaves the
 * vault through the browser's download dialog, while the snippet is written
 * *into* the vault. Both handlers live here, so "everything Export does" is one
 * file. Each format is one option box (settings/optionBox.ts) — the same box
 * Import's source chooser and the plugin import window draw.
 */
import { Modal, Notice } from "obsidian";
import { t } from "../i18n";
import { ConfirmModal } from "../utils/ConfirmModal";
import {
	exportCssSnippet,
	isSnippetEnabled,
	type SnippetExportOutcome,
} from "../manager/cssSnippetExport";
import { applyModalChrome } from "./modalChrome";
import { renderOptionBox, renderOptionList, type OptionBoxSpec } from "./optionBox";
import type { SettingsSectionContext } from "./sections/types";

export class ExportFormatModal extends Modal {
	constructor(private readonly ctx: SettingsSectionContext) {
		super(ctx.app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-export-format-modal");
		// No footer: every box here IS the action.
		applyModalChrome(this);
		this.setTitle(t("export.chooseFormat"));

		const list = renderOptionList(this.contentEl);

		const formats: OptionBoxSpec[] = [
			{
				icon: "paintbrush",
				title: t("export.formatJson"),
				desc: t("export.formatJsonDesc"),
				recommended: true,
				onActivate: () => {
					this.close();
					exportCalloutsJSON(this.ctx);
				},
			},
			{
				icon: "file-code",
				title: t("export.formatCss"),
				desc: t("export.formatCssDesc"),
				onActivate: () => {
					// Close first, like every other chooser box here — the
					// snippet path can raise a confirmation of its own, and
					// stacking it under a window on its way out steals focus.
					// A double-click's second click never gets here (the box
					// counts only the first), and a second export started any
					// other way is stopped one layer down, by cssSnippetExport's
					// in-flight guard.
					this.close();
					void exportCalloutsCSS(this.ctx);
				},
			},
		];

		for (const format of formats) renderOptionBox(list, format);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * The Callout Studio backup: callouts plus every plugin setting (menu config,
 * role toggles, palettes, user images), handed to the browser's download
 * dialog so it lands wherever the user keeps their files.
 */
function exportCalloutsJSON(ctx: SettingsSectionContext): void {
	const json = ctx.plugin.registry.exportToJSONv2();
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = createEl("a");
	a.href = url;
	a.download = "callout-studio-export.json";
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * The CSS snippet, written into the vault's snippets folder.
 *
 * Everything about *what* is written and *whether* to overwrite lives in
 * `cssSnippetExport`; this is only the part that has to talk to the user.
 */
async function exportCalloutsCSS(ctx: SettingsSectionContext): Promise<void> {
	const outcome = await exportCssSnippet(ctx.app, ctx.plugin, () =>
		new ConfirmModal(
			ctx.app,
			t("confirm.titleOverwriteSnippet"),
			t("confirm.overwriteSnippet"),
			t("confirm.overwriteSnippetOk"),
		).confirm(),
	);
	announce(ctx, outcome);
}

/**
 * One notice per outcome, and a second one when the snippet turns out to be
 * switched on in this vault — Callout Studio already styles these callouts
 * here, so the enabled copy can only ever hold an older version of them.
 */
function announce(
	ctx: SettingsSectionContext,
	outcome: SnippetExportOutcome,
): void {
	switch (outcome.status) {
		case "created":
			new Notice(t("notice.exportedCssCreated", { path: outcome.path }));
			break;
		case "updated":
			new Notice(t("notice.exportedCssUpdated", { path: outcome.path }));
			break;
		case "unchanged":
			new Notice(t("notice.exportedCssUnchanged"));
			break;
		case "empty":
			new Notice(t("notice.exportCssEmpty"));
			return;
		case "failed":
			new Notice(t("notice.exportCssFailed"));
			return;
		case "cancelled":
			// The confirmation dialog was the whole interaction; saying
			// "cancelled" afterwards only repeats what the user just chose.
			return;
	}
	if (isSnippetEnabled(ctx.app)) {
		new Notice(t("notice.exportCssEnabled"));
	}
}
