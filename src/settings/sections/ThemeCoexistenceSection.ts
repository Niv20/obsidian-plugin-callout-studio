/**
 * settings/sections/ThemeCoexistenceSection.ts — "your theme also styles these".
 *
 * The plugin used to tell users nothing about this, and the resulting bug
 * report is always the same shape: *some* of a callout's styling applies and
 * some does not, which reads as the plugin being broken rather than as two
 * stylesheets disagreeing. This section is the smallest thing that makes the
 * disagreement visible, and it says plainly which side is winning.
 *
 * Renders **nothing at all** when there is no conflict, so a vault on the
 * default theme never grows a section it has no use for.
 */
import { Setting } from "obsidian";
import { t } from "../../i18n";
import { activeThemeName } from "../../manager/theme/customCssApi";
import type { ThemeConflict } from "../../manager/theme/ThemeConflictStore";
import { ThemeConflictStore } from "../../manager/theme/ThemeConflictStore";
import type { SettingsSectionContext } from "./types";

/**
 * One store per settings tab, created on first render.
 *
 * Deliberately not owned by `main.ts`: scanning ITS Theme is ~850 KB of text,
 * and the only place the answer is ever shown is right here. A vault whose
 * owner never opens settings pays nothing.
 */
let store: ThemeConflictStore | null = null;

/** Test seam and teardown: drop the cached scan. */
export function resetThemeConflictStore(): void {
	store = null;
}

export function renderThemeCoexistenceSection(
	ctx: SettingsSectionContext,
	containerEl: HTMLElement,
): void {
	store ??= new ThemeConflictStore(ctx.app);
	// A theme switch while the tab is open changes the answer, and the tab
	// already re-renders on `css-change` (see SettingsTab). The signature check
	// inside `refresh()` makes the repeat call free when nothing moved.
	const themeName = activeThemeName(ctx.app);
	const conflicts = store.conflicts(ctx.plugin.registry.getAll());
	if (conflicts.length === 0) return;

	new Setting(containerEl)
		.setName(t("settings.themeCoexistence"))
		.setHeading();

	const losing = conflicts.filter((c) => c.themeWins);
	new Setting(containerEl)
		.setName(
			t("settings.themeConflictRow", {
				theme: themeName ?? t("settings.themeConflictDefaultTheme"),
				count: conflicts.length,
			}),
		)
		.setDesc(
			losing.length > 0
				? t("settings.themeConflictLosing", { count: losing.length })
				: t("settings.themeConflictWinning"),
		);

	const list = containerEl.createDiv({ cls: "cs-theme-conflict-list" });
	for (const conflict of conflicts) {
		renderConflictRow(list, conflict);
	}
}

function renderConflictRow(listEl: HTMLElement, conflict: ThemeConflict): void {
	const row = listEl.createDiv({ cls: "cs-theme-conflict-row" });
	const line = row.createDiv({ cls: "cs-theme-conflict-name-line" });
	line.createSpan({
		cls: "cs-theme-conflict-name",
		text: conflict.displayName,
	});
	line.createSpan({
		cls: "cs-theme-conflict-id",
		text: `[!${conflict.id}]`,
	});
	if (conflict.themeWins) {
		line.createSpan({
			cls: "cs-fallback-tag",
			text: t("settings.themeConflictThemeWins"),
		});
	}

	// The subtractive read: naming the properties is what turns "something is
	// off" into a specific thing the user can look at. Sorted so the same theme
	// always reads the same way, and capped because a theme that sets thirty
	// properties has said everything it needs to say in the first few.
	const props = [...conflict.claim.props].sort().slice(0, 6);
	if (props.length > 0) {
		row.createDiv({
			cls: "cs-theme-conflict-props",
			text: t("settings.themeConflictSets", { props: props.join(", ") }),
		});
	}

	// The one case force genuinely cannot fix, said out loud rather than left
	// for the user to discover by trying it.
	if (conflict.unbeatable.length > 0) {
		row.createDiv({
			cls: "cs-theme-conflict-warning",
			text: t("settings.themeConflictImportant", {
				props: conflict.unbeatable.join(", "),
			}),
		});
	}
}
