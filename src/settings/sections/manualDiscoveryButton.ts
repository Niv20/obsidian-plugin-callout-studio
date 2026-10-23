/** The single explicit discovery action, kept alive across settings redraws. */
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

export function addManualDiscoveryButton(
	ctx: SettingsSectionContext,
	controlEl: HTMLElement,
): void {
	let state = states.get(ctx.plugin);
	if (!state) {
		state = { running: false, listeners: new Set() };
		states.set(ctx.plugin, state);
	}
	const shared = state;
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
	const notify = (): void => {
		for (const listener of shared.listeners) listener();
	};
	const run = async (): Promise<void> => {
		if (!active || shared.running || ctx.plugin.settingsWriter.isFrozen) return;
		shared.running = true;
		notify();
		try {
			const added = await ctx.plugin.runVaultScan();
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
	};
	const onClick = (): void => { void run(); };
	button.addEventListener("click", onClick);
	shared.listeners.add(paint);
	ctx.registerDisposer(() => {
		active = false;
		shared.listeners.delete(paint);
		button.removeEventListener("click", onClick);
	});
	paint();
}
