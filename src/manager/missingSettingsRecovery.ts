import { isFromNewerBuild } from "./foreignFields";
import { canonical, content } from "./syncTree";
import type { PluginData } from "../types";
import { readSettledSettingsFile } from "./settingsSettledRead";
import type { ExternalReloadHost, SettingsAdoptionOptions } from "./settingsAdopt";
import { registryIsOwned } from "./registryOwnership";

const initialDisplays = new WeakMap<ExternalReloadHost, string>();

export function rememberMissingSettingsDisplay(host: ExternalReloadHost): void {
	initialDisplays.set(host, canonical(content(host.registry.toSaveData())));
}

/** Retry a failed boot-time checkpoint read without authorizing a new file. */
export async function retryMissingSettingsRecovery(host: ExternalReloadHost, options: SettingsAdoptionOptions): Promise<void> {
	const writer = host.settingsWriter;
	if (!initialDisplays.has(host) || !writer.isFrozen || writer.status.frozenReason !== "recovery-read") return;
	const held = () => writer.isDestroyed || (options.editor
		? writer.busy || host.registry.hasPreviewDefinition() : registryIsOwned(host));
	if (held()) return;
	const before = canonical(content(host.registry.toSaveData()));
	const saved = await writer.recoveryCopy() as Partial<PluginData> | null;
	const read = await readSettledSettingsFile(host, { isCancelled: held });
	if (held() || read.kind !== "absent" || canonical(content(host.registry.toSaveData())) !== before) return;
	if (isFromNewerBuild(saved)) { writer.freeze("newer-version"); return; }
	if (saved && options.canApply && !options.canApply(saved)) { writer.status.fail("sync-conflict"); return; }
	writer.freeze("missing");
	// Restore automatically only while this is still the empty display loaded
	// at boot. Later local changes stay visible; explicit creation backs up the
	// recovered settings before saving the current display.
	if (saved && before === initialDisplays.get(host)) {
		await writer.hold(async () => { host.registry.load(saved); });
	}
	initialDisplays.delete(host);
	host.refreshThemeAppearance(); host.customCommands.syncAll(); host.refreshCallouts();
	if (host.settingsTab?.containerEl.isConnected) host.settingsTab.display();
}
