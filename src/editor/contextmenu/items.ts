/**
 * editor/contextmenu/items.ts — Config-driven right-click menu assembly.
 *
 * Each render role has a registry of item builders keyed by ContextMenuItemId.
 * addItems walks the user's per-role configuration (order + enabled flags from
 * settings.contextMenu.items) and invokes the matching builders. Item ids that
 * a role has no builder for are simply skipped, so the same config shape can
 * carry ids that only apply to some roles.
 */
import type { Editor, Menu } from "obsidian";
import type CalloutStudioPlugin from "../../main";
import type { CalloutRenderRole, ContextMenuItemId } from "../../types";
import { t } from "../../i18n";
import { openCalloutEditorFor } from "../../settings/openCalloutEditor";
import { resolveCalloutDef } from "../renderShared";
import {
	CALLOUT_FOLD_MARK_REGEX,
	type CalloutInfo,
	type ResolvedCalloutContext,
} from "./resolve";
import {
	copyHeadingSection,
	captureSectionTarget,
	cutHeadingSection,
	deleteHeadingSection,
	getHeadingSectionRange,
} from "./sectionOps";

const MENU_SECTION = "callout-studio";

type ItemBuilder = (
	plugin: CalloutStudioPlugin,
	menu: Menu,
	context: ResolvedCalloutContext,
) => void;

// ─── Shared item builders ────────────────────────────────────────────────────

const buildEdit: ItemBuilder = (plugin, menu, context) => {
	// The same resolution the renderer uses, so the menu offers "edit" for
	// exactly the tokens that render as a known callout — including `[!a-b]`
	// written for the callout `a b`, which an exact id/alias lookup misses.
	// `unknown` keeps genuinely unrecognized ids from offering to edit the
	// fallback definition they merely borrow their looks from.
	const { def, unknown } = resolveCalloutDef(plugin.registry, context.id);
	if (!def || unknown) return;
	menu.addItem((item) => {
		item.setTitle(t("contextMenu.editCallout"))
			.setIcon("pencil")
			.setSection(MENU_SECTION)
			.onClick(() => {
				void openCalloutEditorFor(plugin, def);
			});
	});
};

const buildOpenSettings: ItemBuilder = (plugin, menu) => {
	menu.addItem((item) => {
		item.setTitle(t("contextMenu.openSettings"))
			.setIcon("settings")
			.setSection(MENU_SECTION)
			.onClick(() => openPluginSettings(plugin));
	});
};

// ─── Regular-callout item builders ───────────────────────────────────────────

const buildCopyMarkdown: ItemBuilder = (_plugin, menu, context) => {
	if (context.role !== "regular") return;
	const { editor, callout } = context;
	menu.addItem((item) => {
		item.setTitle(t("contextMenu.copyMarkdown"))
			.setIcon("clipboard-copy")
			.setSection(MENU_SECTION)
			.onClick(() => copyCalloutMarkdown(editor, callout));
	});
};

const buildRegularFoldDefaults: ItemBuilder = (_plugin, menu, context) => {
	if (context.role !== "regular") return;
	const { editor, callout } = context;
	const headerText = editor.getLine(callout.headerLine);
	const currentMark = (headerText.match(CALLOUT_FOLD_MARK_REGEX)?.[3] ??
		"") as "" | "+" | "-";
	for (const option of foldOptions()) {
		if (option.mark === currentMark) continue;
		menu.addItem((item) => {
			item.setTitle(option.title)
				.setIcon(option.icon)
				.setSection(MENU_SECTION)
				.onClick(() =>
					setRegularFoldMark(editor, callout, option.mark),
				);
		});
	}
};

// ─── Heading-callout item builders ───────────────────────────────────────────

const buildCutSection: ItemBuilder = (plugin, menu, context) => {
	if (context.role !== "heading") return;
	const canDelete = captureSectionTarget(plugin.app, context.view, context.editor);
	menu.addItem((item) => {
		item.setTitle(t("contextMenu.cutSection"))
			.setIcon("scissors")
			.setSection(MENU_SECTION)
			.onClick(() => {
				if (!canDelete()) return;
				const range = getHeadingSectionRange(
					context.editor,
					context.headingLine,
					context.headingLevel,
				);
				void cutHeadingSection(context.editor, range, canDelete);
			});
	});
};

const buildCopySection: ItemBuilder = (_plugin, menu, context) => {
	if (context.role !== "heading") return;
	menu.addItem((item) => {
		item.setTitle(t("contextMenu.copySection"))
			.setIcon("clipboard-copy")
			.setSection(MENU_SECTION)
			.onClick(() => {
				const range = getHeadingSectionRange(
					context.editor,
					context.headingLine,
					context.headingLevel,
				);
				void copyHeadingSection(range);
			});
	});
};

const buildDeleteSection: ItemBuilder = (_plugin, menu, context) => {
	if (context.role !== "heading") return;
	menu.addItem((item) => {
		item.setTitle(t("contextMenu.deleteSection"))
			.setIcon("trash-2")
			.setSection(MENU_SECTION)
			.onClick(() => {
				const range = getHeadingSectionRange(
					context.editor,
					context.headingLine,
					context.headingLevel,
				);
				deleteHeadingSection(context.editor, range);
			});
	});
};

// ─── Builder registry ────────────────────────────────────────────────────────

const BUILDERS: Record<
	CalloutRenderRole,
	Partial<Record<ContextMenuItemId, ItemBuilder>>
> = {
	regular: {
		edit: buildEdit,
		openSettings: buildOpenSettings,
		copyMarkdown: buildCopyMarkdown,
		foldDefaults: buildRegularFoldDefaults,
	},
	heading: {
		edit: buildEdit,
		openSettings: buildOpenSettings,
		cutSection: buildCutSection,
		copySection: buildCopySection,
		deleteSection: buildDeleteSection,
	},
	inline: {
		edit: buildEdit,
		openSettings: buildOpenSettings,
	},
};

/**
 * Add the configured, enabled menu items for the resolved context's role,
 * in the user's saved order.
 */
export function addItems(
	plugin: CalloutStudioPlugin,
	menu: Menu,
	context: ResolvedCalloutContext,
): void {
	const configured = plugin.settings.contextMenu.items[context.role];
	const builders = BUILDERS[context.role];
	for (const { id, enabled } of configured) {
		if (!enabled) continue;
		builders[id]?.(plugin, menu, context);
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function foldOptions(): Array<{
	mark: "" | "+" | "-";
	title: string;
	icon: string;
}> {
	return [
		{ mark: "-", title: t("contextMenu.setFoldClosed"), icon: "minus" },
		{ mark: "+", title: t("contextMenu.setFoldOpen"), icon: "plus" },
		{ mark: "", title: t("contextMenu.setFoldNone"), icon: "ban" },
	];
}

function copyCalloutMarkdown(editor: Editor, info: CalloutInfo): void {
	const lines: string[] = [];
	const totalLines = editor.lineCount();

	for (let line = info.headerLine; line < totalLines; line++) {
		const text = editor.getLine(line);
		if (line > info.headerLine && !/^\s*>/.test(text)) break;
		lines.push(text);
	}

	void navigator.clipboard.writeText(lines.join("\n"));
}

function setRegularFoldMark(
	editor: Editor,
	info: CalloutInfo,
	mark: "" | "+" | "-",
): void {
	const line = editor.getLine(info.headerLine);
	const nextLine = line.replace(
		CALLOUT_FOLD_MARK_REGEX,
		(_match, prefix: string, id: string) => `${prefix}[!${id}]${mark}`,
	);
	if (nextLine === line) return;
	editor.replaceRange(
		nextLine,
		{ line: info.headerLine, ch: 0 },
		{ line: info.headerLine, ch: line.length },
	);
}

function openPluginSettings(plugin: CalloutStudioPlugin): void {
	plugin.app.setting.open();
	plugin.app.setting.openTabById(plugin.manifest.id);
}
