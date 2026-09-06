import { readSettingsFile, type SettingsFileHost, type SettingsRead } from "./settingsFile";
import { stableKeyOrder } from "../utils/stableJson";

interface SettledReadOptions {
	initial?: SettingsRead;
	isCancelled?: () => boolean;
	wait?: () => Promise<void>;
}

function sameRead(a: SettingsRead, b: SettingsRead): boolean {
	if (a.kind === "absent" && b.kind === "absent") return true;
	return a.kind === "loaded" && b.kind === "loaded" &&
		JSON.stringify(stableKeyOrder(a.data)) === JSON.stringify(stableKeyOrder(b.data));
}

/**
 * Require two matching content reads before adopting a sync snapshot. Metadata
 * cannot detect same-size writes on coarse clocks. This is a bounded settling
 * window, not proof that a sync provider has finished or a cross-device lock.
 * The writer still performs its own immediate freshness check before saving.
 */
export async function readSettledSettingsFile(
	host: SettingsFileHost, options: SettledReadOptions = {},
): Promise<SettingsRead> {
	const cancelled = options.isCancelled ?? (() => false);
	const wait = options.wait ?? (() => new Promise<void>(resolve => { setTimeout(resolve, 150); }));
	if (cancelled()) return { kind: "unreadable" };
	let previous = options.initial ?? await readSettingsFile(host);
	let observedFile = previous.kind !== "absent";
	for (let attempt = 0; attempt < 3; attempt++) {
		if (cancelled()) return { kind: "unreadable" };
		await wait();
		if (cancelled()) return { kind: "unreadable" };
		const current = await readSettingsFile(host);
		if (cancelled()) return { kind: "unreadable" };
		observedFile ||= current.kind !== "absent";
		// A file that vanishes during replacement is not a new installation.
		if (sameRead(previous, current) && !(observedFile && current.kind === "absent")) return current;
		previous = current;
	}
	// Repeated malformed reads and continuously changing valid JSON are equally
	// unsuitable as a baseline. Keep existing state and let the queue retry.
	return { kind: "unreadable" };
}
