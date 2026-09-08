/**
 * utils/customCommands.ts — Shape helpers for user-built commands.
 *
 * Holds the id generator, the load-time sanitizer, the duplicate signature and
 * the name renderer. Deliberately free of Obsidian imports (only `t`) so both
 * the settings loader and the command manager can use it without a cycle.
 */
import { t } from "../i18n";
import {
	CALLOUT_RENDER_ROLES,
	type CalloutDefinition,
	type CalloutRenderRole,
	type CustomCommand,
	type CustomCommandAction,
	type CustomCommandFold,
} from "../types";

/** Heading levels a heading-callout command may target. */
export const HEADING_LEVELS: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Level used when a heading command doesn't name one (or names a bad one). */
export const DEFAULT_HEADING_LEVEL = 2;

/**
 * Prefix on the Obsidian command id of every user-built command.
 *
 * Doubles as the marker the manager uses to recognize its own registrations,
 * and no fixed command id starts with it. No second colon: the
 * full id Obsidian builds is `callout-studio:custom-cc-…`.
 */
const CUSTOM_COMMAND_ID_PREFIX = "custom-";

/**
 * Unique id for a new custom command.
 *
 * This is *identity*, not a description — the Obsidian command id is built from
 * it and the user's hotkey hangs off that, so it must survive the command being
 * edited. Mirrors `generatePaletteId`'s shape.
 */
export function generateCommandId(): string {
	return `cc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The Obsidian command id for a custom command, before Obsidian prefixes it
 * with the plugin id. Takes the identity alone, so unregistering a command
 * whose stored entry is already gone doesn't need the entry back.
 */
export function obsidianCommandId(commandId: string): string {
	return `${CUSTOM_COMMAND_ID_PREFIX}${commandId}`;
}

/**
 * What makes two custom commands the same command, ignoring identity.
 *
 * Used only to stop the user creating a visible duplicate — never as a command
 * id, because it changes whenever the command is edited.
 */
export function commandSignature(
	command: Pick<
		CustomCommand,
		"role" | "calloutId" | "headingLevel" | "action" | "fold"
	>,
): string {
	const level = command.role === "heading" ? resolveHeadingLevel(command) : "";
	const action = command.role === "regular" ? resolveAction(command) : "";
	// Fold belongs here because it reaches the palette: "Wrap in Note block
	// callout" and "…(expanded)" are two entries a user can want at once, and
	// leaving it out would grey the save button on the second as a duplicate.
	const fold = command.role === "regular" ? resolveFold(command) : "";
	return `${command.role}|${command.calloutId}|${action}|${level}|${fold}`;
}

/** The heading level a command targets, with the stored value clamped. */
export function resolveHeadingLevel(
	command: Pick<CustomCommand, "headingLevel">,
): number {
	const level = command.headingLevel;
	if (typeof level !== "number" || !Number.isInteger(level)) {
		return DEFAULT_HEADING_LEVEL;
	}
	if (level < 1 || level > 6) return DEFAULT_HEADING_LEVEL;
	return level;
}

/** The action a block command performs; the other roles always insert. */
export function resolveAction(
	command: Pick<CustomCommand, "action">,
): CustomCommandAction {
	return command.action === "wrap" ? "wrap" : "insert";
}

/**
 * The fold state a block command writes, defaulting to a plain header.
 *
 * The default is the backward-compatibility guarantee in one line: a command
 * saved before this field existed has no `fold`, resolves to `"none"`, and goes
 * on writing `> [!id] Title` under the name it already had.
 *
 * That default is also a deliberate break with what the *definition* says. The
 * mark used to come from `def.foldable`/`def.defaultFolded` alone, and the two
 * legacy importers (`applyCalloutManagerImport`, `applyAdmonitionImport`) stamp
 * `foldable: true` on every callout they create — so a command aimed at one of
 * those wrote `+` that nobody chose, from a setting whose UI is hidden. The
 * command now owns its own answer, which is what makes the dropdown honest.
 */
export function resolveFold(
	command: Pick<CustomCommand, "fold">,
): CustomCommandFold {
	return command.fold === "expanded" || command.fold === "collapsed"
		? command.fold
		: "none";
}

/** The header marker each fold state writes after the `]`. */
export const FOLD_MARK: Record<CustomCommandFold, "" | "+" | "-"> = {
	none: "",
	expanded: "+",
	collapsed: "-",
};

/** The slice of the registry {@link isSuspendedByTheme} consults. */
export interface CommandOwnershipLookup {
	get(id: string): CalloutDefinition | undefined;
	themeOwns(def: CalloutDefinition): boolean;
}

/**
 * Is this command temporarily unusable because the active theme has taken over
 * its callout?
 *
 * A theme callout has one format, Block, so a *heading* or *inline* command
 * aimed at one would write syntax that Callout Studio then leaves as literal
 * text — a command that visibly does the wrong thing. It is unregistered from
 * the palette for as long as that lasts and never deleted: ownership is a fact
 * about the vault's current theme, and the command has to work again the moment
 * that changes. Block commands are unaffected — the theme draws those itself.
 *
 * Asked in three places, which is why it is here rather than in the sweep: the
 * sync that registers commands, the builder that lists them, and the editor
 * that offers the roles.
 */
export function isSuspendedByTheme(
	registry: CommandOwnershipLookup,
	command: Pick<CustomCommand, "calloutId" | "role">,
): boolean {
	if (command.role !== "heading" && command.role !== "inline") return false;
	const def = registry.get(command.calloutId);
	return def !== undefined && registry.themeOwns(def);
}

/**
 * The command's name as Obsidian shows it, built from the callout's *current*
 * display name.
 *
 * Obsidian prefixes "Callout Studio: " itself, so these must not repeat it.
 * Re-deriving the name on every sync is what keeps the palette label accurate
 * after a callout is renamed.
 */
export function describeCommand(
	command: Omit<CustomCommand, "id">,
	def: CalloutDefinition,
): string {
	const name = def.displayName;
	if (command.role === "heading") {
		return t("cmd.customInsertHeading", {
			name,
			level: resolveHeadingLevel(command),
		});
	}
	if (command.role === "inline") {
		return t("cmd.customInsertInline", { name });
	}
	const keys = resolveAction(command) === "wrap" ? WRAP_KEYS : INSERT_KEYS;
	return t(keys[resolveFold(command)], { name });
}

/**
 * Palette names for a block command, by fold state.
 *
 * Whole sentences per state rather than a word appended in code: a suffix
 * concatenated onto a translated name has nowhere to go in a language that puts
 * it elsewhere, and reads as debris in an RTL one. `"none"` keeps the exact
 * string it has always had, so a stored command's registration is untouched —
 * `syncAll` re-registers only when the rendered name changes.
 */
const WRAP_KEYS: Record<CustomCommandFold, string> = {
	none: "cmd.customWrapBlock",
	expanded: "cmd.customWrapBlockExpanded",
	collapsed: "cmd.customWrapBlockCollapsed",
};

const INSERT_KEYS: Record<CustomCommandFold, string> = {
	none: "cmd.customInsertBlock",
	expanded: "cmd.customInsertBlockExpanded",
	collapsed: "cmd.customInsertBlockCollapsed",
};

const isRenderRole = (value: unknown): value is CalloutRenderRole =>
	typeof value === "string" &&
	(CALLOUT_RENDER_ROLES as readonly string[]).includes(value);

/**
 * Validates untrusted saved/imported command data: keeps only entries with a
 * non-empty string id + calloutId and a known render role, deduped by id (first
 * wins). Invalid entries are dropped silently, matching the tolerance of the
 * rest of the settings loader — one corrupt entry must not stop every other
 * command from registering.
 *
 * A bad heading level, action or fold state degrades to the default rather than
 * dropping the entry: the role and callout are the parts that carry the
 * meaning.
 */
export function sanitizeCustomCommands(raw: unknown): CustomCommand[] {
	if (!Array.isArray(raw)) return [];
	const result: CustomCommand[] = [];
	const seenIds = new Set<string>();
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const c = entry as Partial<CustomCommand>;
		if (typeof c.id !== "string" || c.id.length === 0) continue;
		if (typeof c.calloutId !== "string" || c.calloutId.length === 0) continue;
		if (!isRenderRole(c.role)) continue;
		if (seenIds.has(c.id)) continue;
		seenIds.add(c.id);
		result.push({
			id: c.id,
			calloutId: c.calloutId,
			role: c.role,
			...(c.role === "heading"
				? { headingLevel: resolveHeadingLevel(c) }
				: {}),
			...(c.role === "regular" ? { action: resolveAction(c) } : {}),
			// Written only when it says something. `"none"` is what absence
			// already means, so stamping it would rewrite every command in
			// every existing `data.json` — a file that syncs between devices —
			// to record a default. `tests/upgradeFromAutoDiscovery.test.ts`
			// holds this to the stronger promise: a command saved by a released
			// version must load back identical, not merely equivalent.
			...(c.role === "regular" && resolveFold(c) !== "none"
				? { fold: resolveFold(c) }
				: {}),
		});
	}
	return result;
}
