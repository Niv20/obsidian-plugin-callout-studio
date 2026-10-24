/**
 * utils/ImportReportModal.ts — Validation issue report shown before import.
 *
 * Displayed after importValidator finds errors or warnings in the user's
 * JSON file. Groups issues per entry, shows a count of valid vs. total, and
 * lets the user either cancel the import or proceed with only the valid rows.
 * A fatal error (unparseable JSON or wrong root type) leaves no import button
 * at all; a report with no valid entry keeps it, dimmed, and pressing it says why.
 *
 * The layout (finding S9-08). Each entry with a problem is one of Obsidian's
 * setting groups: "Entry 3 — idea" as the heading, and one row per problem in
 * its rounded box, divided by Obsidian's thin lines. Problems with the file as
 * a whole come first, in a box with no heading. The window body is the only
 * thing that scrolls. (It used to be a grey box with a scrollbar of its own
 * inside the scrolling window, with dashed lines between the entries.)
 */
import { Modal, SettingGroup } from "obsidian";
import type { App, Setting } from "obsidian";
import { t } from "../i18n";
import { explainIfBlocked, paintBlocked } from "../ui/blockedButton";
import type { ValidationIssue } from "./importValidator";
import { addCancelButton, applyModalChrome } from "../settings/modalChrome";

export type ImportReportChoice = "cancel" | "importValid";

const MAX_VISIBLE_ISSUES = 200;
const reportText = (value: string): string => value.length > 500 ? `${value.slice(0, 500)}…` : value;

/**
 * Centered modal that lists every validation issue found in an imported JSON
 * file, grouped per entry. Lets the user cancel or import only the entries
 * that were fully valid.
 */
export class ImportReportModal extends Modal {
	private resolved = false;
	private resolve: (value: ImportReportChoice) => void = () => {};

	constructor(
		app: App,
		private issues: ValidationIssue[],
		private validCount: number,
		private totalCount: number,
		private fatal: boolean,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("callout-studio-import-report-modal");
		contentEl.addClass("callout-studio-import-report");

		this.setTitle(t("import.title"));

		const lead = this.fatal
			? t("import.reportLeadInFatal")
			: t("import.reportLeadIn");
		contentEl.createEl("p", { text: lead, cls: "cs-import-report-lead" });

		// Group issues by entry index. -1 means top-level.
		const grouped = new Map<number, ValidationIssue[]>();
		const labels = new Map<number, string>();
		for (const issue of this.issues.slice(0, MAX_VISIBLE_ISSUES)) {
			const arr = grouped.get(issue.index) ?? [];
			arr.push(issue);
			grouped.set(issue.index, arr);
			if (issue.entryLabel) labels.set(issue.index, reportText(issue.entryLabel));
		}

		// The groups, in one wrapper that sets them off from the text above
		// and below. `mod-list` is Obsidian's list layout: rows a little tighter.
		const listEl = contentEl.createDiv({ cls: "cs-import-report-list" });
		const sortedKeys = [...grouped.keys()].sort((a, b) => a - b);
		for (const key of sortedKeys) {
			const group = new SettingGroup(listEl).addClass("mod-list", "cs-import-report-group");
			if (key >= 0) {
				group.setHeading(t("import.entryHeading", {
					index: key + 1,
					label: labels.get(key) ?? `#${key + 1}`,
				}));
			}
			for (const issue of grouped.get(key) ?? []) {
				group.addSetting((row) => this.renderIssue(row, issue));
			}
		}
		if (this.issues.length > MAX_VISIBLE_ISSUES) {
			contentEl.createEl("p", { text: t("import.reportTruncated", {
				shown: MAX_VISIBLE_ISSUES, total: this.issues.length,
			}) });
		}

		// Summary line
		const summaryEl = contentEl.createEl("p", {
			cls: "cs-import-report-summary",
		});
		summaryEl.setText(
			t("import.summary", {
				valid: this.validCount,
				total: this.totalCount,
				issues: this.issues.length,
			}),
		);

		// Footer buttons
		const btnContainer = applyModalChrome(this, { footer: true });

		addCancelButton(btnContainer, t("import.btnCancel"), () => this.finish("cancel"));

		if (!this.fatal) {
			const importBtn = btnContainer.createEl("button", {
				text: t("import.btnImportValid", { count: this.validCount }),
				cls: "mod-cta",
			});
			// With nothing valid there is nothing to import. Dimmed rather than
			// disabled, so pressing it says why instead of going quiet.
			const blockedReason = this.validCount === 0 ? t("import.nothingValid") : null;
			paintBlocked(importBtn, blockedReason);
			importBtn.addEventListener("click", () => {
				if (explainIfBlocked(blockedReason)) return;
				this.finish("importValid");
			});
		}
	}

	/**
	 * One problem as a row: the message as the row's name, in the error or
	 * warning colour (Obsidian's `--setting-item-name-color`, set in
	 * styles.css by the `cs-import-issue-<level>` class), and under it the field
	 * the problem is about, as `code`, which a setting's description draws in
	 * Obsidian's small monospace.
	 */
	private renderIssue(row: Setting, issue: ValidationIssue): void {
		row.settingEl.addClass("cs-import-issue", `cs-import-issue-${issue.level}`);
		// Long values in the message are shortened, as the field is.
		const params = issue.params && Object.fromEntries(Object.entries(issue.params)
			.map(([key, value]) => [key, typeof value === "string" ? reportText(value) : value]));
		row.setName(t(issue.messageKey, params));
		if (issue.field) {
			row.descEl.createEl("code", { cls: "cs-import-issue-field", text: reportText(issue.field) });
		}
	}

	private finish(choice: ImportReportChoice): void {
		this.resolved = true;
		this.resolve(choice);
		this.close();
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolve("cancel");
		}
		this.contentEl.empty();
	}

	prompt(): Promise<ImportReportChoice> {
		return new Promise<ImportReportChoice>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
