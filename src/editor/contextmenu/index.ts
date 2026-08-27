/**
 * editor/contextmenu/index.ts — Right-click context menu integration.
 *
 * Patches Obsidian's Menu class (via monkey-around) and listens on the
 * "editor-menu" workspace event to inject callout-specific actions when the
 * user right-clicks a callout in source view, live preview, or reading view.
 *
 * The injection machinery here is role-agnostic; role detection lives in
 * resolve.ts and the actual items in items.ts (config-driven per role).
 */
import { around, dedupe } from "monkey-around";
import { MarkdownView, Menu, type MenuPositionDef } from "obsidian";
import type CalloutStudioPlugin from "../../main";
import {
	findMarkdownViewForTarget,
	resolveContext,
	type PointerContext,
} from "./resolve";
import { addItems } from "./items";
import { isReadOnlyPreviewTarget, stripEditingItems } from "./readOnlyPreview";

const MENU_MOUSE_PATCH_KEY =
	"callout-studio-context-menu.show-at-mouse-event@obsidian-plugin-callout-studio";
const MENU_POSITION_PATCH_KEY =
	"callout-studio-context-menu.show-at-position@obsidian-plugin-callout-studio";
const MENU_TRIGGER_MAX_AGE_MS = 750;
const MENU_TRIGGER_POSITION_TOLERANCE_PX = 12;

export function registerContextMenu(plugin: CalloutStudioPlugin): void {
	const injectedMenus = new WeakSet<Menu>();
	let lastTrigger: PointerContext | null = null;

	// Capture-phase listener keeps lastTrigger fresh for all three paths below.
	plugin.registerDomEvent(
		activeDocument,
		"contextmenu",
		(event) => {
			lastTrigger = capturePointerContext(event);
		},
		{ capture: true },
	);

	// Primary path: Obsidian fires "editor-menu" for Source and Live Preview
	// right-clicks. Most reliable for editor surfaces.
	plugin.registerEvent(
		plugin.app.workspace.on("editor-menu", (menu, _editor, info) => {
			const view =
				info instanceof MarkdownView
					? info
					: lastTrigger
						? findMarkdownViewForTarget(
								plugin,
								lastTrigger.targetEl,
							)
						: null;
			if (!view) return;
			const trigger = getRecentTriggerForView(lastTrigger, view);
			if (!trigger) return;
			maybeAddItems(plugin, menu, trigger, injectedMenus);
		}),
	);

	// Backup path A: patch showAtMouseEvent to catch menus opened outside the
	// workspace event (e.g. reading view, third-party code paths). Also
	// refreshes lastTrigger so path B can use the same snapshot.
	// Backup path B: patch showAtPosition for touch/keyboard-opened menus;
	// matched against lastTrigger by position tolerance + timestamp.
	const uninstallPatch = around(Menu.prototype, {
		showAtMouseEvent(old) {
			return dedupe(
				MENU_MOUSE_PATCH_KEY,
				old,
				function (this: Menu, event: MouseEvent) {
					const trigger = capturePointerContext(event);
					if (trigger) {
						lastTrigger = trigger;
						maybeAddItems(plugin, this, trigger, injectedMenus);
					}
					return old?.apply(this, [event]) ?? this;
				},
			);
		},
		showAtPosition(old) {
			return dedupe(
				MENU_POSITION_PATCH_KEY,
				old,
				function (
					this: Menu,
					position: MenuPositionDef,
					doc?: Document,
				) {
					const trigger = getMatchingRecentTrigger(
						lastTrigger,
						position,
						doc,
					);
					if (trigger) {
						maybeAddItems(plugin, this, trigger, injectedMenus);
					}
					return old?.apply(this, [position, doc]) ?? this;
				},
			);
		},
	});

	// plugin.register ensures the patch is removed when the plugin unloads.
	plugin.register(uninstallPatch);
}

// Guard: skip if the menu was already injected (deduplicate across the three
// injection paths) or if the feature is disabled in settings.
function maybeAddItems(
	plugin: CalloutStudioPlugin,
	menu: Menu,
	trigger: PointerContext,
	injectedMenus: WeakSet<Menu>,
): void {
	if (injectedMenus.has(menu)) return;

	// Ahead of the settings gate, deliberately. A user who turned this
	// plugin's context menu off still gets a preview that cannot be edited —
	// the two are unrelated questions, and answering them in the other order
	// would make immutability a feature you can accidentally switch off.
	if (isReadOnlyPreviewTarget(trigger.targetEl)) {
		stripEditingItems(menu);
		injectedMenus.add(menu);
		menu.onHide(() => injectedMenus.delete(menu));
		// No items of our own either: the fold-marker and cut/delete-section
		// builders write through `context.editor`, which in a preview is the
		// preview's own editor. The block-callout resolver reaches inside one
		// regardless of `view` (see resolve.ts's widget path), so this is a
		// real path, not a hypothetical one.
		return;
	}

	if (!plugin.settings.contextMenu.enabled) return;

	const context = resolveContext(plugin, trigger);
	if (!context) return;

	injectedMenus.add(menu);
	menu.onHide(() => injectedMenus.delete(menu));
	addItems(plugin, menu, context);
}

function capturePointerContext(event: MouseEvent): PointerContext | null {
	const { target } = event;
	const targetEl =
		target instanceof Element
			? target
			: target instanceof Node
				? target.parentElement
				: null;
	if (!targetEl) return null;

	return {
		targetEl,
		clientX: event.clientX,
		clientY: event.clientY,
		timestamp: Date.now(),
		ownerDocument: targetEl.ownerDocument,
	};
}

function getRecentTriggerForView(
	trigger: PointerContext | null,
	view: MarkdownView,
): PointerContext | null {
	if (!trigger) return null;
	if (Date.now() - trigger.timestamp > MENU_TRIGGER_MAX_AGE_MS) return null;
	if (!view.containerEl.contains(trigger.targetEl)) return null;
	return trigger;
}

function getMatchingRecentTrigger(
	trigger: PointerContext | null,
	position: MenuPositionDef,
	doc?: Document,
): PointerContext | null {
	if (!trigger) return null;
	if (Date.now() - trigger.timestamp > MENU_TRIGGER_MAX_AGE_MS) return null;
	if (doc && trigger.ownerDocument !== doc) return null;
	if (
		Math.abs(trigger.clientX - position.x) >
			MENU_TRIGGER_POSITION_TOLERANCE_PX ||
		Math.abs(trigger.clientY - position.y) >
			MENU_TRIGGER_POSITION_TOLERANCE_PX
	) {
		return null;
	}
	return trigger;
}
