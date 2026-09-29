/**
 * settings/hotkeyLink.ts — A command's shortcut: reading it, and jumping to it.
 *
 * Obsidian keeps hotkeys outside a plugin's reach: there is no public API for
 * reading what a command is bound to, nor for opening the pane that edits it.
 * Both halves here therefore go through internals, and both are guarded
 * structurally — an unreadable binding reads as unassigned instead of throwing,
 * and a deep link that cannot find the pane says so instead of doing nothing.
 */
import { Notice, Platform } from "obsidian";
import type { App } from "obsidian";
import { t } from "../i18n";
import type { StoredHotkey } from "../types";
import { autofocusOnDesktop } from "./modalAutofocus";

/** How Obsidian keys a plugin command: the plugin's id, then the short id. */
export function fullCommandId(pluginId: string, shortId: string): string {
	return `${pluginId}:${shortId}`;
}

/**
 * `app.setting` is declared as always present (src/types.ts), which is a claim
 * about an internal rather than a contract. Widening it back to what it really
 * is keeps the guards below honest instead of decorative.
 */
type SettingsPane = App["setting"] | undefined;

/**
 * The shortcut bound to a command, formatted the way Obsidian's hotkeys pane
 * formats it, or `""` when the command has none.
 *
 * Obsidian's own helper does the formatting rather than this file reading the
 * key tables, so a user's binding still takes precedence over a default one and
 * the modifier glyphs match the platform the vault is open on.
 */
export function printHotkeyForCommand(app: App, commandId: string): string {
	const manager = app.hotkeyManager;
	if (typeof manager?.printHotkeyForCommand !== "function") return "";
	try {
		return manager.printHotkeyForCommand(commandId) || "";
	} catch {
		return "";
	}
}

/**
 * Obsidian's own formatting tables, reproduced.
 *
 * They are duplicated here rather than delegated to because the helper that
 * owns them, `printHotkeyForCommand`, stringifies `hotkeys[0]` and stops —
 * a command bound to two shortcuts can only ever report one through it. Showing
 * every binding therefore means reading the key tables, which means formatting
 * them, which means matching Obsidian glyph for glyph so the same shortcut does
 * not read two ways in two windows. Anything "simplified" out of the four
 * constants below is a way for the two to drift.
 */
const MODIFIER_ORDER = ["Mod", "Ctrl", "Meta", "Alt", "Shift"] as const;

/**
 * `Mod` is ⌘ on macOS and Ctrl everywhere else — that is the whole point of it.
 *
 * Keyed by the union rather than by `string`, so declaring a modifier in the
 * order above without a glyph for it is a compile error.
 */
const MODIFIER_GLYPHS: Record<(typeof MODIFIER_ORDER)[number], string> =
	Platform.isMacOS
		? { Mod: "⌘", Ctrl: "⌃", Meta: "⌘", Alt: "⌥", Shift: "⇧" }
		: { Mod: "Ctrl", Ctrl: "Ctrl", Meta: "Win", Alt: "Alt", Shift: "Shift" };

/** Keys whose name is not what should be drawn. */
const SPECIAL_KEY_LABELS: Record<string, string> = {
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	ArrowDown: "↓",
	" ": "Space",
};

/** macOS stacks the glyphs; every other platform spells the chord out. */
const MODIFIER_JOINER = Platform.isMacOS ? " " : " + ";

/**
 * Every shortcut bound to a command, formatted as the hotkeys pane formats it.
 * Empty when the command has none.
 *
 * The resolution order is Obsidian's, and it is a replacement rather than a
 * merge: a custom binding list REPLACES the defaults outright, so an existing
 * but empty one means the user deliberately cleared every shortcut and must
 * read as unassigned. Hence `??` — `||` would fall through to the defaults the
 * user just removed and show shortcuts that do not work.
 */
export function hotkeysForCommand(app: App, commandId: string): string[] {
	const manager = app.hotkeyManager;

	// A build without the key tables still has the one-shortcut helper, and one
	// binding shown beats none.
	if (typeof manager?.getHotkeys !== "function") {
		const single = printHotkeyForCommand(app, commandId);
		return single ? [single] : [];
	}

	try {
		const custom = manager.getHotkeys(commandId);
		const bindings = custom ?? manager.getDefaultHotkeys?.(commandId) ?? [];
		return bindings.map(formatHotkey).filter((label) => label.length > 0);
	} catch {
		return [];
	}
}

function formatHotkey(hotkey: StoredHotkey): string {
	const parts: string[] = [];
	// Emitted in Obsidian's order, not the order they happen to be stored in,
	// so ⌘⇧K never renders as ⇧⌘K on one surface and ⌘⇧K on another.
	for (const modifier of MODIFIER_ORDER) {
		if (hotkey.modifiers?.includes(modifier)) {
			parts.push(MODIFIER_GLYPHS[modifier]);
		}
	}

	const key = hotkey.code ? stripKeyPrefix(hotkey.code) : hotkey.key;
	if (!key) return "";
	parts.push(labelForKey(key));

	return parts.join(MODIFIER_JOINER);
}

/**
 * `"KeyJ"` → `"J"`. The length test is Obsidian's own and is what keeps
 * `"Keypad…"`-style codes intact rather than shortening them to one letter.
 */
function stripKeyPrefix(code: string): string {
	return code.startsWith("Key") && code.length === 4 ? code.charAt(3) : code;
}

function labelForKey(key: string): string {
	const special = SPECIAL_KEY_LABELS[key];
	if (special !== undefined) return special;
	// "PageUp" → "Page Up", "a" → "A".
	const spaced = key.replace(/([A-Z])/g, " $1").trim();
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const HOTKEY_SEARCH_MAX_ATTEMPTS = 12;
const HOTKEY_SEARCH_RETRY_MS = 50;

/**
 * Open Obsidian's hotkeys pane with its search box already filled in.
 *
 * The pane exposes `setQuery`, which is exact and runs synchronously with the
 * tab switch. Everything below it is a fallback for builds without that method:
 * the search box is found in the DOM instead, retried because the tab may not
 * have mounted yet.
 */
export function openHotkeySettings(app: App, query: string): void {
	const pane: SettingsPane = app.setting;

	if (!pane?.openTabById) {
		new Notice(t("notice.openHotkeysFailed"));
		return;
	}

	try {
		pane.open?.();
		const tab = pane.openTabById("hotkeys");
		if (tab && typeof tab.setQuery === "function") {
			tab.setQuery(query);
			return;
		}
		filterHotkeys(query, 1);
	} catch {
		new Notice(t("notice.openHotkeysFailed"));
	}
}

function filterHotkeys(query: string, attempt: number): void {
	if (applyHotkeySearchFilter(query)) return;

	if (attempt >= HOTKEY_SEARCH_MAX_ATTEMPTS) {
		new Notice(t("notice.filterHotkeysFailed"));
		return;
	}

	window.setTimeout(() => {
		filterHotkeys(query, attempt + 1);
	}, HOTKEY_SEARCH_RETRY_MS);
}

function applyHotkeySearchFilter(query: string): boolean {
	const settingsModal = activeDocument.querySelector<HTMLElement>(
		".modal.mod-settings",
	);
	const searchRoot =
		settingsModal?.querySelector<HTMLElement>(
			".vertical-tab-content-container",
		) ?? settingsModal;

	if (!searchRoot) return false;

	const searchInput = findVisibleInput(searchRoot, [
		"input[type='search']",
		".search-input-container input",
		"input[placeholder]",
	]);

	if (!searchInput) return false;

	// Opening Hotkeys should not raise the soft keyboard on phones or tablets.
	autofocusOnDesktop(searchInput);
	searchInput.value = query;
	searchInput.dispatchEvent(new Event("input", { bubbles: true }));
	searchInput.dispatchEvent(new Event("change", { bubbles: true }));
	if (!Platform.isMobile) searchInput.select();
	return true;
}

function findVisibleInput(
	root: HTMLElement,
	selectors: string[],
): HTMLInputElement | null {
	for (const selector of selectors) {
		const inputs = Array.from(
			root.querySelectorAll<HTMLInputElement>(selector),
		);
		const visibleInput = inputs.find(
			(input) =>
				!input.disabled &&
				!input.readOnly &&
				input.getClientRects().length > 0,
		);

		if (visibleInput) return visibleInput;
	}

	return null;
}
