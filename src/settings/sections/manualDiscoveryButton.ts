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
	const button = controlEl.createEl("button", {
		cls: "cs-settings-neutral-btn cs-discover-callouts-btn",
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
		button.setText(label);
		// A tooltip must not replace the visible name in the accessibility tree.
		button.setAttribute("aria-label", label);
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
