import { MAX_TAG_LENGTH, RESERVED_DEMO_IDS } from "../constants";
import type { CalloutDefinition } from "../types";
import { calloutIdentity, sanitizeCalloutIdInput } from "../utils/calloutId";
import { MAX_DISPLAY_NAME } from "../utils/importValidator";

/** Truncate by UTF-16 length, as the validators do, without splitting a code point. */
function truncate(value: string, maxLength: number): string {
	let result = "";
	for (const character of value) {
		if (result.length + character.length > maxLength) break;
		result += character;
	}
	return result.trimEnd();
}

function copyName(base: string, counter: number, maxLength: number): string {
	const suffix = counter === 1 ? " copy" : ` copy ${counter}`;
	const prefix = truncate(base, maxLength - suffix.length);
	if (!prefix) throw new Error("Cannot generate a valid duplicate name.");
	return prefix + suffix;
}

/** Display names may contain pipes, unlike callout IDs read from markdown. */
export function displayNameIdentity(name: string): string {
	return name.toLowerCase().replace(/[\s-]+/g, " ").trim();
}

function validBase(raw: string): string {
	const base = sanitizeCalloutIdInput(raw);
	if (!base) throw new Error("The callout has no valid identifier to duplicate.");
	return base;
}

/**
 * Clone committed custom state, changing only the identities that cannot be
 * shared by two definitions. Never run the clone through the editor or import
 * sanitizer: either would rebuild known fields and lose stored state such as a
 * deleted palette reference or a field written by a newer plugin version.
 */
export function createDuplicateCalloutDefinition(
	source: CalloutDefinition,
	existing: readonly CalloutDefinition[],
): CalloutDefinition {
	if (
		!source ||
		source.builtIn !== false ||
		!["user", "fallback", "plugin"].includes(source.source) ||
		typeof source.id !== "string" ||
		typeof source.displayName !== "string" ||
		!source.displayName.trim() ||
		(source.aliases !== undefined &&
			(!Array.isArray(source.aliases) ||
				source.aliases.some((alias) => typeof alias !== "string")))
	) {
		throw new Error("Only a valid custom callout can be duplicated.");
	}

	const base = validBase(source.id);
	const aliasBases = source.aliases?.map(validBase);
	const displayBase = source.displayName.trim();
	const ids = new Set([...RESERVED_DEMO_IDS].map(calloutIdentity));
	const names = new Set<string>();
	// Include the source even if a caller's snapshot omitted it: a duplicate
	// must never take one of its original aliases or its display name.
	for (const def of [...existing, source]) {
		ids.add(calloutIdentity(def.id));
		for (const alias of def.aliases ?? []) ids.add(calloutIdentity(alias));
		names.add(displayNameIdentity(def.displayName));
	}

	// Each occupied ID/name can block at most one numbered candidate. Trying
	// one more than their total therefore finds a free identity or fails with
	// an explicit error; no arbitrary retry ceiling or unbounded loop.
	const maxAttempts = ids.size + names.size + 1;
	for (let counter = 1; counter <= maxAttempts; counter++) {
		const id = copyName(base, counter, MAX_TAG_LENGTH);
		const displayName = copyName(displayBase, counter, MAX_DISPLAY_NAME);
		if (ids.has(calloutIdentity(id)) || names.has(displayNameIdentity(displayName))) {
			continue;
		}

		ids.add(calloutIdentity(id));
		const aliases = aliasBases?.map((aliasBase) => {
			// Prefer the primary suffix, then advance this alias independently.
			// Long aliases may truncate to the same prefix, so every generated
			// alias immediately reserves its identity for the following ones.
			const limit = counter + ids.size;
			for (let aliasCounter = counter; aliasCounter <= limit; aliasCounter++) {
				const alias = copyName(aliasBase, aliasCounter, MAX_TAG_LENGTH);
				const key = calloutIdentity(alias);
				if (ids.has(key)) continue;
				ids.add(key);
				return alias;
			}
			throw new Error("Cannot generate a unique duplicate alias.");
		});

		const duplicate = structuredClone(source);
		duplicate.id = id;
		duplicate.displayName = displayName;
		if (aliases !== undefined) duplicate.aliases = aliases;
		return duplicate;
	}
	throw new Error("Cannot generate a unique duplicate name.");
}
