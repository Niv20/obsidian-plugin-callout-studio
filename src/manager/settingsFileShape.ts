import { validSyncEnvelope } from "./settingsSync";
/** Reject stored shapes that cannot safely reach the registry or renderers. */
import { DEFAULT_CALLOUTS } from "../constants";

const builtInIds = new Set(DEFAULT_CALLOUTS.map(row => row.id));

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(row: Record<string, unknown>, key: string): boolean {
	return row[key] === undefined || typeof row[key] === "string";
}

function safeRow(value: unknown): boolean {
	if (!object(value) || typeof value.id !== "string" || !value.id.trim()) return false;
	const seeded = builtInIds.has(value.id);
	if (!(seeded && value.displayName === undefined) && typeof value.displayName !== "string") return false;
	if (!(seeded && value.icon === undefined) &&
		(!object(value.icon) || typeof value.icon.type !== "string" || typeof value.icon.value !== "string")) return false;
	if (value.aliases !== undefined &&
		(!Array.isArray(value.aliases) || !value.aliases.every(alias => typeof alias === "string"))) return false;
	if (value.metadata !== undefined && (!object(value.metadata) ||
		!Object.values(value.metadata).every(entry => typeof entry === "string"))) return false;
	if (value.bgGradient !== undefined && (!object(value.bgGradient) ||
		typeof value.bgGradient.angleDeg !== "number" || !Number.isFinite(value.bgGradient.angleDeg) ||
		typeof value.bgGradient.toColorLight !== "string" || typeof value.bgGradient.toColorDark !== "string" ||
		!optionalString(value.bgGradient, "textToColorLight") || !optionalString(value.bgGradient, "textToColorDark"))) return false;
	return ["bgColorLight", "bgColorDark", "textColorLight", "textColorDark", "paletteId"]
		.every(key => optionalString(value, key));
}

function safeCache(value: unknown, legacy: boolean): boolean {
	if (!Array.isArray(value)) return false;
	return value.every(entry => object(entry) && typeof entry.name === "string" &&
		typeof entry.svg === "string" && (legacy || typeof entry.pack === "string") &&
		optionalString(entry, "variant") && optionalString(entry, "style"));
}

/**
 * Keep partial legacy data and unknown future fields intact. This gate does not
 * repair or drop user rows: malformed content remains on disk for recovery,
 * instead of crashing halfway through a load and later saving a partial map.
 */
export function hasSafeSettingsFileShape(data: Record<string, unknown>): boolean {
	// Migrations compare this numerically. An object here can throw during a
	// rebuild; absent legacy versions and finite future versions remain valid.
	if (!validSyncEnvelope(data)) return false;
	if (data.version !== undefined && (typeof data.version !== "number" || !Number.isFinite(data.version))) return false;
	if (data.callouts !== undefined && (!Array.isArray(data.callouts) || !data.callouts.every(safeRow))) return false;
	if (Array.isArray(data.callouts)) {
		// The registry is keyed by exact ID; accepting duplicates would silently
		// discard one row before the next save could overwrite the source file.
		const ids = data.callouts.map((row: { id: string }) => row.id);
		if (new Set(ids).size !== ids.length) return false;
	}
	if (data.settings !== undefined && (!object(data.settings) || !optionalString(data.settings, "fallbackCalloutId"))) return false;
	if (data.iconSvgCache !== undefined && !safeCache(data.iconSvgCache, false)) return false;
	if (data.materialSvgCache !== undefined && !safeCache(data.materialSvgCache, true)) return false;
	return true;
}
