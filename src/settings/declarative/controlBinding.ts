/**
 * settings/declarative/controlBinding.ts — where a declarative control (a
 * toggle or a slider Obsidian draws from the settings tree) reads its value
 * and saves a change.
 *
 * Who calls it. The settings tab's `getControlValue` and `setControlValue`
 * overrides (SettingsTab.ts), which Obsidian calls for every `control` row.
 *
 * The main idea. Obsidian's own `setControlValue` writes `plugin.settings[key]`
 * and then calls `plugin.saveData(plugin.settings)`. In this plugin that would
 * be a disaster: `data.json` holds much more than the settings (every callout,
 * the sync stamps), and it is written only through `saveSettings()` and the
 * settings writer. One control row left on Obsidian's default would replace the
 * file with the settings object alone. So every control goes through here:
 *
 * 1. While saving is paused, the change is refused, with the usual notice,
 *    because it could not be kept (settings/pausedGuard.ts).
 * 2. Otherwise the value is written into the live settings object,
 * 3. the change is painted (the caller's `afterWrite`, e.g. re-injecting the
 *    generated CSS) — paint first, so the screen never waits on the disk —
 * 4. and saved with `saveSettings()`. Never `saveData`.
 *
 * Keys are paths with dots, because the settings are nested:
 * `"globalStyle.block.alignContentWithTitle"` is
 * `settings.globalStyle.block.alignContentWithTitle`.
 */
import { blockedWhilePaused } from "../pausedGuard";

/** What the binding needs from the plugin. */
export interface ControlBindingHost {
	/**
	 * The live settings object. Read every time, never kept: another device's
	 * settings arriving replaces the whole object, and a kept reference would
	 * write into the old one, which is then thrown away.
	 */
	readonly settings: object;
	readonly settingsWriter: { isFrozen: boolean };
	saveSettings(): Promise<void>;
}

/** What to do around a write. */
export interface ControlWriteHooks {
	/** Paint the change (after the value is in the settings, before the save). */
	afterWrite(key: string): void;
	/** The change was refused (saving is paused): put the control back. */
	onRefused(key: string): void;
}

/**
 * The value at a dotted path, or `undefined` when any step is missing.
 *
 * @example readSettingAt({ a: { b: 3 } }, "a.b") // 3
 */
export function readSettingAt(settings: object, key: string): unknown {
	let current: unknown = settings;
	for (const part of key.split(".")) {
		if (!isRecord(current)) return undefined;
		current = current[part];
	}
	return current;
}

/**
 * Set the value at a dotted path. Returns false, and changes nothing, when the
 * path does not lead into an existing object: a key the settings do not have
 * is a mistake in the tree, not a setting to invent.
 */
export function writeSettingAt(settings: object, key: string, value: unknown): boolean {
	const parts = key.split(".");
	// The last part names the field; the parts before it lead to its object.
	const last = parts.pop();
	if (last === undefined) return false;
	const target = parts.length === 0 ? settings : readSettingAt(settings, parts.join("."));
	if (!isRecord(target) || !(last in target)) return false;
	target[last] = value;
	return true;
}

/**
 * Save one control's new value, the safe way (see the module comment).
 * Resolves once the save has finished (or was refused or skipped).
 */
export async function writeControlValue(
	host: ControlBindingHost,
	key: string,
	value: unknown,
	hooks: ControlWriteHooks,
): Promise<void> {
	if (blockedWhilePaused(host.settingsWriter)) {
		hooks.onRefused(key);
		return;
	}
	if (!writeSettingAt(host.settings, key, value)) {
		console.warn(`Callout Studio: no setting "${key}" to change; nothing saved.`);
		return;
	}
	hooks.afterWrite(key);
	await host.saveSettings();
}

/**
 * Whether `value` is a plain object whose fields can be read and written by
 * name. (A TypeScript "type guard": when it returns true, TypeScript treats
 * `value` as that record type in the code that follows.)
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
