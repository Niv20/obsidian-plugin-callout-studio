/**
 * utils/importValidator.ts — Validates JSON callout data before import.
 *
 * Parses and sanitizes a raw JSON value against the CalloutDefinition schema:
 * checks required fields, color format, icon type/style/weight ranges, tag
 * length limits, and alias uniqueness. Returns valid definitions alongside a
 * structured list of issues (errors + warnings) so the ImportReportModal can
 * show the user exactly what was wrong before committing anything.
 */
import type {
	CalloutDefinition,
	CalloutIcon,
	CalloutRenderRole,
	IconAdjust,
	PluginSettings,
} from "../types";
import { CALLOUT_RENDER_ROLES } from "../types";
import { ICON_ADJUST_LIMITS } from "./iconAdjust";
import type { CalloutRegistry } from "../manager/CalloutRegistry";
import { EXPORT_FORMAT_ID } from "../manager/CalloutRegistry";
import {
	applyImportedStyleMode,
	styleModeImportIssue,
} from "./importStyleMode";
import { FALLBACK_ICON, MAX_TAG_LENGTH, MAX_TAGS_COUNT } from "../constants";
import { createIconNameCheck } from "../icons/nameCheck";
import { ICON_PACK_IDS } from "../icons/registry";
import { normalizeCalloutId } from "./calloutId";
import {
	KNOWN_FIELDS,
	KNOWN_ICON_FIELDS,
	RETIRED_FIELDS,
} from "./importFields";
import { sanitizeBgGradient } from "./colorUtils";
import { sanitizeImportedSettings } from "./settingsValidator";

/** Severity used by the report modal to style each row. */
export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
	/** Zero-based index of the entry in the source array; -1 for top-level issues. */
	index: number;
	/** Best-effort label for the offending entry (id / displayName / "#index"). */
	entryLabel: string;
	/** Optional dotted field path (e.g. "icon.weight"). */
	field?: string;
	level: IssueLevel;
	/** i18n key from the `import.err.*` / `import.warn.*` namespace. */
	messageKey: string;
	/** i18n interpolation params. */
	params?: Record<string, string | number>;
}

export interface ValidationResult {
	/** Sanitized, safe-to-import callout definitions (only fully valid entries). */
	validDefs: CalloutDefinition[];
	/** All issues across the file (errors AND warnings). */
	issues: ValidationIssue[];
	/** True when the top-level structure is unusable (e.g. not an array). */
	fatal: boolean;
	/**
	 * Sanitized plugin settings from a v2 export envelope, if present.
	 * `undefined` for legacy flat-array files (which carry no settings).
	 */
	settings?: PluginSettings;
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// IDs may contain normal spaces (multi-word labels). Still reject pipes,
// brackets, and non-space whitespace (tabs / line breaks).
const ID_BAD_CHAR_RE = /[|\][\t\n\r]/;
// Derived from the pack registry rather than written out, so adding a pack can
// never leave the validator rejecting icons the plugin itself produces.
const VALID_ICON_TYPES = new Set<string>(ICON_PACK_IDS);
const VALID_MATERIAL_STYLES = new Set([
	"outlined",
	"filled",
	"rounded",
	"sharp",
]);
/** Exported for the Admonition importer, which caps an imported title to it. */
export const MAX_DISPLAY_NAME = 80;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** Safe value formatter for issue messages — never invokes default `[object Object]` toString. */
function fmt(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "string") return value;
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value);
	}
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return typeof value;
	}
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function deriveLabel(
	raw: Record<string, unknown> | null,
	index: number,
): string {
	if (raw) {
		const id = typeof raw.id === "string" ? raw.id.trim() : "";
		if (id) return id;
		const name =
			typeof raw.displayName === "string" ? raw.displayName.trim() : "";
		if (name) return name;
	}
	return `#${index + 1}`;
}

/**
 * The id rules, shared with the Admonition importer rather than restated there:
 * a type name from another plugin has to clear exactly the same bar as one from
 * our own export file, and two copies of these limits would drift.
 *
 * `raw` is the value as the file spelled it, before normalizeCalloutId ran. The
 * character checks need it: normalization drops `|metadata` and folds tabs and
 * line breaks into spaces, so running them on the canonical form would pass
 * anything. Defaults to `id` for callers that never had a separate raw value.
 *
 * A `|` is rejected rather than accepted-and-stripped on purpose. `note|purple`
 * is the `note` callout carrying metadata, so importing that entry as `note`
 * would repaint the reader's real `note` with a style they never chose — and
 * every metadata value in the file would collide on the same base id. Skipping
 * the entry is what the importer already did before the pipe was understood.
 */
export function validateIdString(
	id: string,
	push: (issue: Omit<ValidationIssue, "index" | "entryLabel">) => void,
	field: string,
	raw: string = id,
): boolean {
	let ok = true;
	if (id.length === 0) {
		push({ field, level: "error", messageKey: "import.err.idEmpty" });
		return false;
	}
	if (id.length > MAX_TAG_LENGTH) {
		push({
			field,
			level: "error",
			messageKey: "import.err.idTooLong",
			params: { value: id, max: MAX_TAG_LENGTH, length: id.length },
		});
		ok = false;
	}
	if (raw.includes("|")) {
		push({
			field,
			level: "error",
			messageKey: "import.err.idMetadata",
			params: { value: raw, id },
		});
		ok = false;
	} else if (ID_BAD_CHAR_RE.test(raw)) {
		push({
			field,
			level: "error",
			messageKey: "import.err.idBadChar",
			params: { value: raw },
		});
		ok = false;
	}
	return ok;
}

function validateIcon(
	icon: unknown,
	push: (issue: Omit<ValidationIssue, "index" | "entryLabel">) => void,
): icon is CalloutIcon {
	if (!isPlainObject(icon)) {
		push({
			field: "icon",
			level: "error",
			messageKey: "import.err.iconNotObject",
		});
		return false;
	}
	let ok = true;
	const type = icon.type;
	if (typeof type !== "string" || !VALID_ICON_TYPES.has(type)) {
		push({
			field: "icon.type",
			level: "error",
			messageKey: "import.err.iconTypeInvalid",
			params: { value: fmt(type), types: ICON_PACK_IDS.join(", ") },
		});
		ok = false;
	}
	const value = icon.value;
	if (typeof value !== "string" || value.trim().length === 0) {
		push({
			field: "icon.value",
			level: "error",
			messageKey: "import.err.iconValueEmpty",
		});
		ok = false;
	} else if (value.length > 200) {
		push({
			field: "icon.value",
			level: "error",
			messageKey: "import.err.iconValueTooLong",
			params: { length: value.length },
		});
		ok = false;
	}
	// `style` and `weight` describe Material Symbols and nothing else. On any
	// other pack they are inert leftovers — worth reporting, but not worth
	// failing an otherwise valid import over.
	const isMaterial = type === "material";
	if (icon.style !== undefined) {
		if (!isMaterial) {
			push({
				field: "icon.style",
				level: "warning",
				messageKey: "import.warn.iconFieldIgnored",
				params: { field: "style", type: fmt(type) },
			});
		} else if (
			typeof icon.style !== "string" ||
			!VALID_MATERIAL_STYLES.has(icon.style)
		) {
			push({
				field: "icon.style",
				level: "error",
				messageKey: "import.err.materialStyle",
				params: { value: fmt(icon.style) },
			});
			ok = false;
		}
	}
	if (icon.weight !== undefined) {
		const w = icon.weight;
		if (!isMaterial) {
			push({
				field: "icon.weight",
				level: "warning",
				messageKey: "import.warn.iconFieldIgnored",
				params: { field: "weight", type: fmt(type) },
			});
		} else if (
			!isFiniteNumber(w) ||
			!Number.isInteger(w) ||
			w < 100 ||
			w > 700 ||
			w % 100 !== 0
		) {
			push({
				field: "icon.weight",
				level: "error",
				messageKey: "import.err.materialWeight",
				params: { value: fmt(w) },
			});
			ok = false;
		}
	}
	// `recolor` is the same shape of leftover for every pack but "image": inert
	// where it does not belong, so worth saying, not worth failing over.
	if (icon.recolor !== undefined) {
		if (type !== "image") {
			push({
				field: "icon.recolor",
				level: "warning",
				messageKey: "import.warn.iconRecolorIgnored",
				params: { type: fmt(type) },
			});
		} else if (typeof icon.recolor !== "boolean") {
			push({
				field: "icon.recolor",
				level: "error",
				messageKey: "import.err.iconRecolorInvalid",
				params: { value: fmt(icon.recolor) },
			});
			ok = false;
		}
	}
	const unknown = Object.keys(icon).filter((k) => !KNOWN_ICON_FIELDS.has(k));
	if (unknown.length > 0) {
		push({
			field: "icon",
			level: "warning",
			messageKey: "import.warn.unknownFields",
			params: { fields: unknown.join(", ") },
		});
	}
	return ok;
}

function validateColor(
	value: unknown,
	field: string,
	push: (issue: Omit<ValidationIssue, "index" | "entryLabel">) => void,
	required: boolean,
): boolean {
	if (value === undefined || value === null) {
		if (required) {
			push({
				field,
				level: "error",
				messageKey: "import.err.requiredMissing",
				params: { field },
			});
			return false;
		}
		return true;
	}
	if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
		push({
			field,
			level: "error",
			messageKey: "import.err.colorInvalid",
			params: { field, value: fmt(value) },
		});
		return false;
	}
	return true;
}

function validateNumberRange(
	value: unknown,
	field: string,
	min: number,
	max: number,
	push: (issue: Omit<ValidationIssue, "index" | "entryLabel">) => void,
	messageKey: string,
): boolean {
	if (!isFiniteNumber(value) || value < min || value > max) {
		push({
			field,
			level: "error",
			messageKey,
			params: { field, value: fmt(value), min, max },
		});
		return false;
	}
	return true;
}

/**
 * Validate the per-role `iconAdjust` map into a sanitized value.
 *
 * Ranges come from `ICON_ADJUST_LIMITS` — the same constant the editor's
 * sliders are built from — so an imported file can never carry a value the UI
 * has no way to represent or undo. Issues name the exact control
 * (`iconAdjust.heading.offsetX`), and an unrecognized role is dropped with the
 * same "unknown field ignored" warning the top-level field check uses, rather
 * than failing the whole entry over a key a future version may well define.
 *
 * Absent fields are left absent: `resolveIconAdjust` falls those back to the
 * flat legacy trio, which is what makes a partial entry meaningful.
 */
function validateIconAdjust(
	value: unknown,
	push: (issue: Omit<ValidationIssue, "index" | "entryLabel">) => void,
): { ok: boolean; value: CalloutDefinition["iconAdjust"] } {
	if (!isPlainObject(value)) {
		push({
			field: "iconAdjust",
			level: "error",
			messageKey: "import.err.iconAdjustShape",
		});
		return { ok: false, value: undefined };
	}

	const { offset, size } = ICON_ADJUST_LIMITS;
	const numericFields: {
		key: keyof IconAdjust;
		min: number;
		max: number;
		messageKey: string;
	}[] = [
		{
			key: "offsetX",
			min: offset.min,
			max: offset.max,
			messageKey: "import.err.numberRange",
		},
		{
			key: "offsetY",
			min: offset.min,
			max: offset.max,
			messageKey: "import.err.numberRange",
		},
		{
			key: "size",
			min: size.min,
			max: size.max,
			messageKey: "import.err.iconSizeRange",
		},
	];

	const out: Partial<Record<CalloutRenderRole, IconAdjust>> = {};
	let ok = true;

	for (const [role, raw] of Object.entries(value)) {
		if (!CALLOUT_RENDER_ROLES.includes(role as CalloutRenderRole)) {
			push({
				field: "iconAdjust",
				level: "warning",
				messageKey: "import.warn.unknownFields",
				params: { fields: `iconAdjust.${role}` },
			});
			continue;
		}
		if (!isPlainObject(raw)) {
			push({
				field: `iconAdjust.${role}`,
				level: "error",
				messageKey: "import.err.iconAdjustShape",
			});
			ok = false;
			continue;
		}

		const clean: IconAdjust = {};
		for (const { key, min, max, messageKey } of numericFields) {
			const field = raw[key];
			if (field === undefined) continue;
			if (
				!validateNumberRange(
					field,
					`iconAdjust.${role}.${key}`,
					min,
					max,
					push,
					messageKey,
				)
			) {
				ok = false;
				continue;
			}
			clean[key] = field as number;
		}
		if (Object.keys(clean).length > 0) {
			out[role as CalloutRenderRole] = clean;
		}
	}

	return {
		ok,
		value: Object.keys(out).length > 0 ? out : undefined,
	};
}

function validateMetadata(
	value: unknown,
	push: (issue: Omit<ValidationIssue, "index" | "entryLabel">) => void,
): boolean {
	if (!isPlainObject(value)) {
		push({
			field: "metadata",
			level: "error",
			messageKey: "import.err.metadataShape",
		});
		return false;
	}
	for (const [k, v] of Object.entries(value)) {
		if (typeof v !== "string") {
			push({
				field: `metadata.${k}`,
				level: "error",
				messageKey: "import.err.metadataShape",
			});
			return false;
		}
	}
	return true;
}

/**
 * Validate a parsed JSON payload against the `CalloutDefinition[]` contract.
 * Collects every issue encountered (does not bail early) so the report modal
 * can show the user the full picture in one pass.
 */
/**
 * Validate an import payload. Accepts BOTH shapes:
 * - Legacy: a flat `CalloutDefinition[]` array (callouts only).
 * - v2: an object envelope `{ format, formatVersion, callouts, settings }`
 *   carrying callouts AND full plugin settings.
 */
export async function validateImportPayload(
	raw: unknown,
	registry: CalloutRegistry,
): Promise<ValidationResult> {
	// v2 object envelope.
	if (isPlainObject(raw) && !Array.isArray(raw)) {
		const looksLikeV2 =
			raw.format === EXPORT_FORMAT_ID ||
			typeof raw.formatVersion === "number" ||
			Array.isArray(raw.callouts);
		if (!looksLikeV2) {
			return {
				validDefs: [],
				issues: [
					{
						index: -1,
						entryLabel: "",
						level: "error",
						messageKey: "import.err.notRecognized",
					},
				],
				fatal: true,
			};
		}
		const calloutsRaw = raw.callouts;
		const base = Array.isArray(calloutsRaw)
			? validateCalloutArray(calloutsRaw, registry)
			: { validDefs: [], issues: [] };
		const settingsResult = sanitizeImportedSettings(raw.settings);
		return {
			validDefs: base.validDefs,
			issues: [
				...base.issues,
				...settingsResult.issues,
				...missingImageIssues(
					base.validDefs,
					settingsResult.settings,
					registry,
				),
				...(await unknownIconNameIssues(base.validDefs)),
			],
			fatal: false,
			settings: settingsResult.settings ?? undefined,
		};
	}

	// Legacy flat array.
	if (!Array.isArray(raw)) {
		return {
			validDefs: [],
			issues: [
				{
					index: -1,
					entryLabel: "",
					level: "error",
					messageKey: "import.err.notRecognized",
				},
			],
			fatal: true,
		};
	}

	const base = validateCalloutArray(raw, registry);
	return {
		...base,
		issues: [...base.issues, ...(await unknownIconNameIssues(base.validDefs))],
		fatal: false,
	};
}

/**
 * Replace icons whose name exists in no pack, and say so.
 *
 * A name is not checked while the entry is validated because the check is
 * async — the packs' search indexes are decoded on demand — and it is not worth
 * failing an entry over: every other property of the callout is fine, so the
 * repair is to draw *something* and tell the user which name was wrong, rather
 * than to refuse the import or to store a name that renders as an empty square.
 *
 * Mutates the already-sanitized defs in place; they exist only to be handed to
 * the registry, and the modal that shows these issues can still cancel.
 */
async function unknownIconNameIssues(
	defs: CalloutDefinition[],
): Promise<ValidationIssue[]> {
	if (defs.length === 0) return [];
	const nameExists = await createIconNameCheck(defs.map((def) => def.icon));

	const issues: ValidationIssue[] = [];
	defs.forEach((def, index) => {
		if (nameExists(def.icon)) return;
		issues.push({
			index,
			entryLabel: def.displayName || def.id,
			field: "icon.value",
			level: "warning",
			messageKey: "import.warn.iconNameUnknown",
			params: { value: def.icon.value, type: def.icon.type },
		});
		def.icon = { ...FALLBACK_ICON };
	});
	return issues;
}

/**
 * Warn about callouts whose picture did not travel with them.
 *
 * An export carries the user's pictures inside its settings, so this normally
 * finds nothing. It fires when someone hand-edits a file, or exports the
 * callouts of one vault and pastes them beside another vault's settings — and
 * without it those callouts would simply arrive blank with no explanation.
 *
 * A picture this vault already holds is fine: the id is all that is needed, and
 * re-importing a callout onto the device that first made the picture is the
 * ordinary case.
 */
function missingImageIssues(
	defs: readonly CalloutDefinition[],
	imported: PluginSettings | null | undefined,
	registry: CalloutRegistry,
): ValidationIssue[] {
	const available = new Set<string>([
		...(imported?.userImages ?? []).map((image) => image.id),
		...registry.getUserImages().map((image) => image.id),
	]);

	const issues: ValidationIssue[] = [];
	defs.forEach((def, index) => {
		if (def.icon.type !== "image") return;
		if (available.has(def.icon.value)) return;
		issues.push({
			index,
			entryLabel: def.displayName || def.id,
			field: "icon.value",
			level: "warning",
			messageKey: "import.warn.imageMissing",
		});
	});
	return issues;
}

/**
 * Validate a flat array of raw callout entries into safe CalloutDefinitions,
 * collecting every issue (never bailing early) so the report modal can show
 * the full picture in one pass.
 */
function validateCalloutArray(
	raw: unknown[],
	registry: CalloutRegistry,
): { validDefs: CalloutDefinition[]; issues: ValidationIssue[] } {
	const issues: ValidationIssue[] = [];
	const validDefs: CalloutDefinition[] = [];

	// Track ids/aliases declared inside the file (case-insensitive).
	const seenInFile = new Map<string, number>();

	raw.forEach((entry, index) => {
		const isObj = isPlainObject(entry);
		const label = deriveLabel(isObj ? entry : null, index);
		const entryIssues: ValidationIssue[] = [];
		const push = (
			issue: Omit<ValidationIssue, "index" | "entryLabel">,
		): void => {
			entryIssues.push({ ...issue, index, entryLabel: label });
		};

		if (!isObj) {
			push({
				level: "error",
				messageKey: "import.err.entryNotObject",
			});
			issues.push(...entryIssues);
			return;
		}

		let entryOk = true;

		// ── Required primitive fields ────────────────────────────
		if (typeof entry.id !== "string") {
			push({
				field: "id",
				level: "error",
				messageKey: "import.err.requiredMissing",
				params: { field: "id" },
			});
			entryOk = false;
		}
		if (typeof entry.displayName !== "string") {
			push({
				field: "displayName",
				level: "error",
				messageKey: "import.err.requiredMissing",
				params: { field: "displayName" },
			});
			entryOk = false;
		}
		if (typeof entry.foldable !== "boolean") {
			push({
				field: "foldable",
				level: "error",
				messageKey: "import.err.boolField",
				params: { field: "foldable" },
			});
			entryOk = false;
		}
		if (typeof entry.defaultFolded !== "boolean") {
			push({
				field: "defaultFolded",
				level: "error",
				messageKey: "import.err.boolField",
				params: { field: "defaultFolded" },
			});
			entryOk = false;
		}

		// ── id ─────────────────────────────────────────────────
		// Canonicalize (trim, collapse whitespace, lowercase) so imported IDs
		// match the form the editor produces and the vault scanner expects.
		const idRaw =
			typeof entry.id === "string" ? normalizeCalloutId(entry.id) : "";
		if (typeof entry.id === "string") {
			if (!validateIdString(idRaw, push, "id", entry.id)) entryOk = false;
		}

		// ── displayName ─────────────────────────────────────────
		const displayNameRaw =
			typeof entry.displayName === "string"
				? entry.displayName.trim()
				: "";
		if (typeof entry.displayName === "string") {
			if (displayNameRaw.length === 0) {
				push({
					field: "displayName",
					level: "error",
					messageKey: "import.err.displayNameEmpty",
				});
				entryOk = false;
			} else if (displayNameRaw.length > MAX_DISPLAY_NAME) {
				push({
					field: "displayName",
					level: "error",
					messageKey: "import.err.displayNameTooLong",
					params: {
						length: displayNameRaw.length,
						max: MAX_DISPLAY_NAME,
					},
				});
				entryOk = false;
			}
		}

		// ── icon ──────────────────────────────────────────────
		let iconOk = false;
		if (entry.icon === undefined) {
			push({
				field: "icon",
				level: "error",
				messageKey: "import.err.requiredMissing",
				params: { field: "icon" },
			});
			entryOk = false;
		} else {
			iconOk = validateIcon(entry.icon, push);
			if (!iconOk) entryOk = false;
		}

		// ── colors ────────────────────────────────────────────
		if (!validateColor(entry.colorLight, "colorLight", push, true))
			entryOk = false;
		if (!validateColor(entry.colorDark, "colorDark", push, true))
			entryOk = false;
		if (!validateColor(entry.bgColorLight, "bgColorLight", push, false))
			entryOk = false;
		if (!validateColor(entry.bgColorDark, "bgColorDark", push, false))
			entryOk = false;
		if (!validateColor(entry.textColorLight, "textColorLight", push, false))
			entryOk = false;
		if (!validateColor(entry.textColorDark, "textColorDark", push, false))
			entryOk = false;

		// ── background gradient (optional) ───────────────────
		// Warning-level only: a broken gradient degrades the entry to a solid
		// background instead of blocking the import.
		if (
			entry.bgGradient !== undefined &&
			sanitizeBgGradient(entry.bgGradient) === null
		) {
			push({
				field: "bgGradient",
				level: "warning",
				messageKey: "import.warn.invalidGradient",
			});
		}

		// ── optional numeric fields ──────────────────────────
		if (entry.iconOffsetX !== undefined) {
			if (
				!validateNumberRange(
					entry.iconOffsetX,
					"iconOffsetX",
					-10,
					10,
					push,
					"import.err.numberRange",
				)
			)
				entryOk = false;
		}
		if (entry.iconOffsetY !== undefined) {
			if (
				!validateNumberRange(
					entry.iconOffsetY,
					"iconOffsetY",
					-10,
					10,
					push,
					"import.err.numberRange",
				)
			)
				entryOk = false;
		}
		if (entry.iconSize !== undefined) {
			if (
				!validateNumberRange(
					entry.iconSize,
					"iconSize",
					0.5,
					1.5,
					push,
					"import.err.iconSizeRange",
				)
			)
				entryOk = false;
		}

		// ── per-role icon adjustment ─────────────────────────
		let iconAdjustClean: CalloutDefinition["iconAdjust"];
		if (entry.iconAdjust !== undefined) {
			const result = validateIconAdjust(entry.iconAdjust, push);
			if (!result.ok) entryOk = false;
			iconAdjustClean = result.value;
		}

		// ── aliases ──────────────────────────────────────────
		const aliasesClean: string[] = [];
		if (entry.aliases !== undefined) {
			if (!Array.isArray(entry.aliases)) {
				push({
					field: "aliases",
					level: "error",
					messageKey: "import.err.aliasesNotArray",
				});
				entryOk = false;
			} else {
				const seenAlias = new Set<string>();
				if (idRaw) seenAlias.add(idRaw.toLowerCase());
				entry.aliases.forEach((alias, ai) => {
					if (typeof alias !== "string") {
						push({
							field: `aliases[${ai}]`,
							level: "error",
							messageKey: "import.err.aliasNotString",
						});
						entryOk = false;
						return;
					}
					const trimmed = normalizeCalloutId(alias);
					if (
						!validateIdString(trimmed, push, `aliases[${ai}]`, alias)
					) {
						entryOk = false;
						return;
					}
					const key = trimmed.toLowerCase();
					if (seenAlias.has(key)) {
						push({
							field: `aliases[${ai}]`,
							level: "error",
							messageKey: "import.err.aliasDup",
							params: { value: trimmed },
						});
						entryOk = false;
						return;
					}
					seenAlias.add(key);
					aliasesClean.push(trimmed);
				});
				const totalIds = (idRaw ? 1 : 0) + aliasesClean.length;
				if (totalIds > MAX_TAGS_COUNT) {
					push({
						field: "aliases",
						level: "error",
						messageKey: "import.err.tooManyIds",
						params: {
							count: totalIds,
							max: MAX_TAGS_COUNT,
						},
					});
					entryOk = false;
				}
			}
		}

		// ── palette link (optional) ──────────────────────────
		// Shape only. An id naming a palette this vault does not have is NOT an
		// issue: the colors are baked into the entry, so the link is inert until
		// that palette exists — exactly the state `paletteId`'s doc describes for
		// a palette the user deleted. It usually arrives in the same file's
		// `settings.customPalettes` anyway.
		if (entry.paletteId !== undefined) {
			const paletteId =
				typeof entry.paletteId === "string" ? entry.paletteId.trim() : "";
			if (paletteId.length === 0 || paletteId.length > MAX_TAG_LENGTH) {
				push({
					field: "paletteId",
					level: "error",
					messageKey: "import.err.paletteIdInvalid",
					params: { value: fmt(entry.paletteId) },
				});
				entryOk = false;
			}
		}

		// ── customized flag (optional) ───────────────────────
		if (entry.customized !== undefined && typeof entry.customized !== "boolean") {
			push({
				field: "customized",
				level: "error",
				messageKey: "import.err.boolField",
				params: { field: "customized" },
			});
			entryOk = false;
		}

		// ── transparent background flag (optional) ───────────
		// Same shape as `customized` above: a malformed value is an error like
		// every other typed field, while a well-formed `false` passes here and is
		// normalized to an absent key on the rebuild below.
		if (
			entry.transparentBg !== undefined &&
			typeof entry.transparentBg !== "boolean"
		) {
			push({
				field: "transparentBg",
				level: "error",
				messageKey: "import.err.boolField",
				params: { field: "transparentBg" },
			});
			entryOk = false;
		}

		// ── no-icon flag (optional) ──────────────────────────
		// Same shape again. `icon` stays required and is validated as usual: a
		// no-icon callout still carries the drawing it would show, so the flag
		// never excuses a missing or malformed one.
		if (entry.hideIcon !== undefined && typeof entry.hideIcon !== "boolean") {
			push({
				field: "hideIcon",
				level: "error",
				messageKey: "import.err.boolField",
				params: { field: "hideIcon" },
			});
			entryOk = false;
		}

		// ── style mode: the externalStyle / styleMode pair (optional) ──
		const modeIssue = styleModeImportIssue(entry);
		if (modeIssue) {
			push(modeIssue);
			if (modeIssue.fatal) entryOk = false;
		}

		// ── metadata ─────────────────────────────────────────
		if (entry.metadata !== undefined) {
			if (!validateMetadata(entry.metadata, push)) entryOk = false;
		}

		// ── unknown fields (warning, non-fatal) ──────────────
		const unknown = Object.keys(entry).filter(
			(k) => !KNOWN_FIELDS.has(k) && !RETIRED_FIELDS.has(k),
		);
		if (unknown.length > 0) {
			push({
				level: "warning",
				messageKey: "import.warn.unknownFields",
				params: { fields: unknown.join(", ") },
			});
		}

		// ── auto-fix: defaultFolded only meaningful when foldable ──
		let autoDefaultFolded: boolean | undefined;
		if (entry.foldable === false && entry.defaultFolded === true) {
			push({
				level: "warning",
				field: "defaultFolded",
				messageKey: "import.warn.defaultFoldedAutofix",
			});
			autoDefaultFolded = false;
		}

		// ── in-file uniqueness (id + aliases) ────────────────
		if (entryOk && idRaw) {
			const allIds = [idRaw, ...aliasesClean];
			let dupHit = false;
			for (const candidate of allIds) {
				const key = candidate.toLowerCase();
				const previousIndex = seenInFile.get(key);
				if (previousIndex !== undefined) {
					push({
						field: candidate === idRaw ? "id" : "aliases",
						level: "error",
						messageKey: "import.err.duplicateInFile",
						params: {
							value: candidate,
							first: previousIndex + 1,
						},
					});
					entryOk = false;
					dupHit = true;
				}
			}
			if (!dupHit) {
				for (const candidate of allIds) {
					seenInFile.set(candidate.toLowerCase(), index);
				}
			}
		}

		// ── cross-registry alias conflict ────────────────────
		if (entryOk && idRaw) {
			for (const alias of aliasesClean) {
				const conflict = registry.findByAlias(alias);
				if (conflict && conflict.id !== idRaw) {
					push({
						field: "aliases",
						level: "error",
						messageKey: "import.err.aliasConflict",
						params: {
							value: alias,
							other: conflict.id,
						},
					});
					entryOk = false;
				}
				const idMatch = registry.get(alias);
				if (idMatch && idMatch.id !== idRaw) {
					push({
						field: "aliases",
						level: "error",
						messageKey: "import.err.aliasConflict",
						params: {
							value: alias,
							other: idMatch.id,
						},
					});
					entryOk = false;
				}
			}
		}

		issues.push(...entryIssues);

		// ── Build sanitized def if entry passed ───────────────
		if (entryOk && iconOk) {
			const iconRaw = entry.icon as Record<string, unknown>;
			const cleanIcon: CalloutIcon = {
				type: iconRaw.type as CalloutIcon["type"],
				value: (iconRaw.value as string).trim(),
			};
			if (typeof iconRaw.style === "string") {
				cleanIcon.style = iconRaw.style as CalloutIcon["style"];
			}
			if (typeof iconRaw.weight === "number") {
				cleanIcon.weight = iconRaw.weight;
			}
			// Only for "image": the flag is the *callout's* choice about the
			// user's own picture, and validateIcon already warned that it means
			// nothing on any other pack.
			if (
				cleanIcon.type === "image" &&
				typeof iconRaw.recolor === "boolean"
			) {
				cleanIcon.recolor = iconRaw.recolor;
			}

			// A file can carry a customized built-in (see
			// `getExportableDefinitions`). Landing that as a new user callout
			// would leave the real built-in untouched and put a duplicate row
			// beside it, so keep the identity the registry already has.
			const target = registry.get(idRaw);
			const isBuiltIn = target?.builtIn === true;

			const def: CalloutDefinition = {
				id: idRaw,
				displayName: displayNameRaw,
				icon: cleanIcon,
				colorLight: entry.colorLight as string,
				colorDark: entry.colorDark as string,
				foldable: entry.foldable as boolean,
				defaultFolded:
					autoDefaultFolded ?? (entry.defaultFolded as boolean),
				builtIn: isBuiltIn,
				source: isBuiltIn ? "builtin" : "user",
			};
			// The whole background block is spelled out — `undefined` included —
			// rather than attached only when the file carries a value. An import
			// onto an id that already exists lands through
			// `registry.update(def.id, def)` (see DataManagementSection), which
			// merges `{ ...existing, ...partial }`, and a key that isn't there
			// clears nothing. Attaching conditionally meant importing a
			// transparent callout over a coloured one left the old hexes
			// standing beside the new flag — the same contradictory row
			// `CalloutRegistry.dropStaleTransparencyFlags` exists to repair, and
			// one where the flag is the NEWER intent, so that pass would have
			// undone the import on the next launch.
			//
			// Safe for the built-in concern below: `isModified` compares
			// `JSON.stringify(value ?? null)`, so an explicit `undefined` still
			// reads as equal to an absent key and cannot make a built-in nobody
			// edited look customized, and `JSON.stringify` drops it on save.
			const bgGradientClean = sanitizeBgGradient(entry.bgGradient);
			// Transparency short-circuits the background here exactly as it does
			// in `performCalloutEditorSave` and `bakePaletteColors`: the flag IS
			// the background, so a self-contradictory entry (hand-edited, or
			// exported from a vault damaged by the bug above) is normalized at
			// the boundary instead of being carried inward. Keeping the importer
			// unable to emit both is what leaves that migration facing only rows
			// damaged by the old merge, where deleting the flag is right.
			const importTransparent = entry.transparentBg === true;
			def.bgColorLight =
				!importTransparent && typeof entry.bgColorLight === "string"
					? entry.bgColorLight
					: undefined;
			def.bgColorDark =
				!importTransparent && typeof entry.bgColorDark === "string"
					? entry.bgColorDark
					: undefined;
			def.bgGradient = importTransparent
				? undefined
				: (bgGradientClean ?? undefined);
			// Only `true` survives: the field is `?: true` on a definition, where
			// "off" is an absent key rather than `false` (an explicit `false`
			// would read as a difference in `CalloutRegistry.isModified` and
			// persist a built-in nobody edited). `undefined` is not `false` — it
			// is what lets the merge above clear a flag the target row still has.
			def.transparentBg = importTransparent ? true : undefined;
			// Same `true`-only rule, and `undefined` for the same reason: it is
			// what lets an import that turns the icon back on clear the flag on a
			// row that still has it.
			def.hideIcon = entry.hideIcon === true ? true : undefined;
			if (typeof entry.textColorLight === "string")
				def.textColorLight = entry.textColorLight;
			if (typeof entry.textColorDark === "string")
				def.textColorDark = entry.textColorDark;
			if (iconAdjustClean) def.iconAdjust = iconAdjustClean;
			if (isFiniteNumber(entry.iconOffsetX))
				def.iconOffsetX = entry.iconOffsetX;
			if (isFiniteNumber(entry.iconOffsetY))
				def.iconOffsetY = entry.iconOffsetY;
			if (isFiniteNumber(entry.iconSize)) def.iconSize = entry.iconSize;
			if (aliasesClean.length > 0) def.aliases = aliasesClean;
			if (typeof entry.paletteId === "string") {
				def.paletteId = entry.paletteId.trim();
			}
			// Built-ins never carry it (they are not auto-prunable), matching
			// what the editor writes — see CalloutEditorSave's `customized`.
			if (!isBuiltIn && entry.customized === true) {
				def.customized = true;
			}
			// Same `true`-only rule. Unlike `customized` this one *does* apply to
			// a built-in: handing `[!note]` to the reader's theme is exactly the
			// kind of thing a shared file is worth carrying.
			applyImportedStyleMode(def, entry);
			if (isPlainObject(entry.metadata)) {
				const meta: Record<string, string> = {};
				for (const [k, v] of Object.entries(entry.metadata)) {
					if (typeof v === "string") meta[k] = v;
				}
				def.metadata = meta;
			}
			validDefs.push(def);
		}
	});

	return { validDefs, issues };
}
