import { Notice } from "obsidian";
import { t } from "../i18n";
import type { CalloutRegistry } from "./CalloutRegistry";
import type { DeviceLocalStore } from "./DeviceLocalStore";
import type { SettingsWriter } from "./SettingsWriter";
import {
	acknowledgeAutocompleteEnablement,
	hasAutocompleteEnablement,
} from "./autocompleteEnablementMigration";

interface AutocompleteEnablementHost {
	registry: CalloutRegistry;
	settingsWriter: SettingsWriter;
	localState: Pick<
		DeviceLocalStore,
		| "hasPendingAutocompleteNotice"
		| "queueAutocompleteNotice"
		| "markAutocompleteNoticeSeen"
	>;
	register(cleanup: () => void): void;
}

/**
 * Observe before settings load; release the notice only after locale setup and
 * a durable migration. The device-local marker preserves affected-user
 * evidence if the write lands just before unload, and suppresses repeats if an
 * older synced file later reintroduces the retired false value.
 */
export function trackAutocompleteEnablement(
	host: AutocompleteEnablementHost,
): () => void {
	let ready = false;
	let disposed = false;
	let unsubscribe = () => {};
	const stop = () => {
		if (disposed) return;
		disposed = true;
		unsubscribe();
	};
	const check = () => {
		const writer = host.settingsWriter;
		if (
			disposed ||
			writer.isDestroyed ||
			writer.isFrozen ||
			writer.status.reason
		) {
			return;
		}
		if (hasAutocompleteEnablement(host.registry)) {
			// Record affected-user evidence before the migration write completes.
			host.localState.queueAutocompleteNotice();
		}
		if (
			!hasAutocompleteEnablement(host.registry) &&
			!host.localState.hasPendingAutocompleteNotice
		) {
			if (ready) stop();
			return;
		}
		// A held, failed or stale save cannot announce a successful migration.
		if (
			!writer.matchesLastWrite(
				JSON.stringify(host.registry.toSaveData()),
				true,
			)
		) {
			return;
		}
		acknowledgeAutocompleteEnablement(host.registry);
		if (!ready || !host.localState.hasPendingAutocompleteNotice) return;
		new Notice(t("notice.autocompleteAlwaysEnabled"), 10000);
		host.localState.markAutocompleteNoticeSeen();
		stop();
	};
	unsubscribe = host.settingsWriter.status.subscribe(check);
	host.register(stop);
	return () => {
		ready = true;
		// No affected startup evidence: stop before a later synced legacy value
		// can turn this startup-only notice into a mid-session notification.
		if (
			!hasAutocompleteEnablement(host.registry) &&
			!host.localState.hasPendingAutocompleteNotice
		) {
			stop();
			return;
		}
		check();
	};
}
