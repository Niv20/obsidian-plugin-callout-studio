/**
 * settings/editor/CalloutEditorValidation.ts — Validation helpers for the callout editor.
 *
 * Pure functions that check whether the current editor state is valid:
 * ID availability, alias conflicts, and whether saving would overwrite an
 * auto-generated fallback row. Also builds a state snapshot string used to
 * detect unsaved changes. Used exclusively by CalloutEditor.ts.
 */
import type { CalloutDefinition } from "../../types";

type ValidationLookup = {
	getById: (id: string) => CalloutDefinition | undefined;
	findByAlias: (id: string) => CalloutDefinition | undefined;
};

type ValidationBaseInput = ValidationLookup & {
	/** The new definition is being created for a token already present in a note. */
	createFromToken: boolean;
	existingId: string | null;
};

export type ValidationStateInput = ValidationBaseInput &
	AttrIdLookup & {
		isBuiltIn: boolean;
		displayName: string;
		calloutId: string;
		aliases: string[];
	};

export type SnapshotInput = {
	displayName: string;
	calloutId: string;
	icon: unknown;
	/**
	 * Part of the dirty check for the same reason `transparentBg` is: removing
	 * the icon changes nothing else in the form — `icon` deliberately keeps
	 * holding the drawing it would have shown — so leaving it out left Save
	 * disabled on the one edit the user had come to make.
	 */
	hideIcon: boolean;
	colorLight: string;
	colorDark: string;
	bgColorLight: string;
	bgColorDark: string;
	bgGradient?: CalloutDefinition["bgGradient"];
	/**
	 * Part of the dirty check because it is part of what gets saved, and because
	 * it is an axis of its own: switching a callout between "None" and Solid
	 * changes nothing else in the form, so leaving it out left Save disabled on
	 * the one edit the user had come to make.
	 */
	transparentBg: boolean;
	textColorLight: string;
	textColorDark: string;
	foldable: boolean;
	defaultFolded: boolean;
	/** Per-role icon adjustment; see `CalloutDefinition.iconAdjust`. */
	iconAdjust?: CalloutDefinition["iconAdjust"];
	iconOffsetX: number;
	iconOffsetY: number;
	iconSize: number;
	aliases: string[];
	/**
	 * Which palette the row is linked to — part of the dirty check because it
	 * is part of what gets saved, and because re-pointing a callout at another
	 * palette is a real change even when the two carry identical colours (the
	 * link is what decides whose later edits cascade onto this callout).
	 * Omitted by `styleSnapshot`, which compares appearance only.
	 */
	paletteId?: string;
};

export function buildStateSnapshot(input: SnapshotInput): string {
	return JSON.stringify(input);
}

export function hasStateChanges(
	initialSnapshot: string,
	currentSnapshot: string,
): boolean {
	return currentSnapshot !== initialSnapshot;
}

export function shouldSaveNewTokenCalloutAsFallback(
	input: ValidationBaseInput & { hasStyleChanges: boolean },
): boolean {
	return (
		input.createFromToken &&
		input.existingId === null &&
		!input.hasStyleChanges
	);
}

export function isOverwritingAutoFallbackRow(
	input: ValidationBaseInput & { id: string },
): boolean {
	if (!input.createFromToken) return false;
	if (input.existingId !== null) return false;
	if (!input.id) return false;
	const existing = input.getById(input.id);
	if (!existing) return false;
	return existing.source === "fallback" && existing.customized !== true;
}

export function canUseCalloutId(
	input: ValidationBaseInput & { id: string; role: "primary" | "alias" },
): boolean {
	if (!input.id) return false;
	const existing = input.getById(input.id);
	const allowedPlaceholder =
		input.role === "primary" && isOverwritingAutoFallbackRow(input);
	if (existing && existing.id !== input.existingId && !allowedPlaceholder) {
		return false;
	}

	const aliasOwner = input.findByAlias(input.id);
	if (aliasOwner && aliasOwner.id !== input.existingId) return false;
	return true;
}

/** Kept separate from ValidationLookup, which three other checks share and
 * none of them needs this lookup. */
type AttrIdLookup = {
	/**
	 * CalloutRegistry.findAttrIdConflict with the edited callout already
	 * excluded — the OTHER definition owning this ID's dasherized form.
	 */
	findAttrIdConflict: (id: string) => CalloutDefinition | undefined;
};

export type AttrIdCollisionInput = AttrIdLookup & {
	existingId: string | null;
	id: string;
};

/**
 * The ID of a DIFFERENT callout that would collide with `input.id` once
 * Obsidian dasherizes it into `data-callout`, or null when there is none.
 *
 * `my note` and `my-note` both render as `data-callout="my-note"`, so the two
 * would fight over a single CSS rule — the block callout could only ever show
 * one of them. That makes the pair unusable in practice, so this counts as a
 * duplicate ID and blocks saving (see isStateValid), exactly like an exact
 * clash. Heading callouts and inline callouts keep their own space-form
 * attribute and would stay distinct, but that is not worth shipping a
 * half-broken type over.
 *
 * Exact ID/alias clashes are NOT reported here — canUseCalloutId owns those,
 * and reporting both would show two different messages for one problem.
 */
export function findAttrIdCollision(input: AttrIdCollisionInput): string | null {
	if (!input.id) return null;
	const owner = input.findAttrIdConflict(input.id);
	if (!owner) return null;
	// The registry already excludes the edited definition; belt and braces so a
	// caller that wires the lookup without it can't make a callout fight itself.
	if (owner.id === input.existingId) return null;
	if (owner.id === input.id) return null; // exact → canUseCalloutId
	if (owner.aliases?.includes(input.id)) return null; // exact alias → same
	return owner.id;
}

export function isStateValid(input: ValidationStateInput): boolean {
	if (!input.calloutId) return false;
	const requireDisplayName =
		!input.createFromToken || input.existingId !== null;
	if (!input.isBuiltIn && requireDisplayName && !input.displayName.trim()) {
		return false;
	}
	if (!canUseCalloutId({ ...input, id: input.calloutId, role: "primary" })) {
		return false;
	}
	if (findAttrIdCollision({ ...input, id: input.calloutId })) return false;
	for (const alias of input.aliases) {
		if (!canUseCalloutId({ ...input, id: alias, role: "alias" })) {
			return false;
		}
		if (findAttrIdCollision({ ...input, id: alias })) return false;
	}
	return true;
}
