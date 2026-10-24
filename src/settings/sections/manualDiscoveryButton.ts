/**
 * The single explicit discovery action, kept alive across settings redraws.
 *
 * {@link runManualScan} and {@link scanRunning} are the scan itself, shared by
 * the old page's button below and the declarative page's Scan row, so both
 * show the same scan.
 */
import { Notice, setTooltip } from "obsidian";
import { t } from "../../i18n";
import type { SettingsSectionContext, SettingsTabPlugin } from "./types";

type DiscoveryButtonState = {
	running: boolean;
	listeners: Set<() => void>;
};

// A display/reopen can replace the button while the vault read is pending.
// Share only transient UI state; no storage, timer, or automatic scan.
const states = new WeakMap<SettingsTabPlugin, DiscoveryButtonState>();

/** This plugin's scan state, made on first use. */
function stateOf(plugin: SettingsTabPlugin): DiscoveryButtonState {
	let state = states.get(plugin);
	if (!state) {
		state = { running: false, listeners: new Set() };
		states.set(plugin, state);
	}
	return state;
}

/** Whether a scan started from the settings is running now. */
export function scanRunning(plugin: SettingsTabPlugin): boolean {
	return states.get(plugin)?.running ?? false;
}

/**
 * Scan the vault for callout types, unless a scan is already running or
 * saving is paused, and say how many were added. Every Scan button on screen
 * is told when it starts and when it ends.
 */
export async function runManualScan(plugin: SettingsTabPlugin): Promise<void> {
	const shared = stateOf(plugin);
	if (shared.running || plugin.settingsWriter.isFrozen) return;
	const notify = (): void => {
		for (const listener of shared.listeners) listener();
	};
	shared.running = true;
	notify();
	try {
		const added = await plugin.runVaultScan();
		new Notice(t("settings.rescanComplete", { count: String(added) }));
		// Registry subscriptions refresh the rows. Rebuilding the settings
		// page here would discard focus and interfere with scrolling.
	} catch (error) {
		console.error("[callout-studio] manual discovery failed", error);
		new Notice(t("manualDiscovery.failed"), 10000);
	} finally {
		shared.running = false;
		notify();
	}
}

export function addManualDiscoveryButton(
	ctx: SettingsSectionContext,
	controlEl: HTMLElement,
): void {
	const shared = stateOf(ctx.plugin);
	// Obsidian's own grey button, a step below the accent CTA beside it, like
	// every other secondary button in the tab (decision 14 of the native-look
	// plan: Obsidian paints them, no face of the plugin's own).
	//
	// On a phone that grey (`--background-secondary`) is also the colour of the
	// settings pane these rows sit on today, so the button reads flat there
	// until the tab moves into Obsidian's setting boxes (white on a phone), the
	// way Obsidian's own buttons sit.
	const button = controlEl.createEl("button", {
		cls: "cs-discover-callouts-btn",
		attr: { type: "button" },
	});
	setTooltip(button, t("settings.rescanVaultDesc"));
	button.setAttribute("aria-description", t("settings.rescanVaultDesc"));
	let active = true;
	const paint = (): void => {
		button.disabled = shared.running || ctx.plugin.settingsWriter.isFrozen;
		button.setAttribute("aria-busy", String(shared.running));
		const label = t(shared.running
			? "manualDiscovery.scanning"
			: "settings.rescanVaultHintAction");
		// The button's text is its accessible name; no aria-label, which would
		// otherwise shadow the descriptive tooltip set above.
		button.setText(label);
	};
	const onClick = (): void => {
		if (active) void runManualScan(ctx.plugin);
	};
	button.addEventListener("click", onClick);
	shared.listeners.add(paint);
	ctx.registerDisposer(() => {
		active = false;
		shared.listeners.delete(paint);
		button.removeEventListener("click", onClick);
	});
	paint();
}
