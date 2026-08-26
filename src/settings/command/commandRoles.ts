/**
 * settings/command/commandRoles.ts — the *Callout format* control, and which
 * formats it is allowed to offer.
 *
 * The set is not fixed, because one callout does not always have three formats.
 * A callout the active theme supplies has exactly one — Block — since Heading
 * and Inline are Callout Studio's own syntax and it leaves them as literal text
 * for a theme callout (`editor/renderShared.ts`). Offering them would let the
 * user build a command that writes markdown nothing renders.
 *
 * The narrowing is temporary and reversible in both directions, which is why it
 * is derived on every sync rather than stamped anywhere: a command an existing
 * theme forbids becomes legal again the moment the theme is switched away from,
 * and `CustomCommandManager` re-registers it then, at the same id, so the user's
 * hotkey survives the round trip.
 *
 * The control lives here with the rule rather than in `CommandEditorModal`
 * because the two cannot be right separately: the options shown, the value
 * selected and the line explaining why two of them are missing are one answer.
 */
import { Setting } from "obsidian";
import type { DropdownComponent } from "obsidian";
import { t } from "../../i18n";
import type {
	CalloutDefinition,
	CalloutRenderRole,
	PluginSettings,
} from "../../types";

/** Format options in the order the user is shown them. */
const ROLE_ORDER: readonly CalloutRenderRole[] = [
	"heading",
	"inline",
	"regular",
];

const ROLE_LABEL_KEY: Record<CalloutRenderRole, string> = {
	heading: "commandBuilder.formatHeading",
	inline: "commandBuilder.formatInline",
	regular: "commandBuilder.formatBlock",
};

/** The slice of the registry this module consults. */
export interface RoleOwnershipLookup {
	get(id: string): CalloutDefinition | undefined;
	themeOwns(def: CalloutDefinition): boolean;
}

/**
 * The formats a callout can currently be written in.
 *
 * An unknown id keeps all three: the dropdown may be built before a callout is
 * chosen, and narrowing on "we could not find it" would hide two options for a
 * reason the user cannot see.
 */
export function offerableRoles(
	registry: RoleOwnershipLookup,
	calloutId: string,
): readonly CalloutRenderRole[] {
	const def = registry.get(calloutId);
	return def !== undefined && registry.themeOwns(def)
		? (["regular"] as const)
		: ROLE_ORDER;
}

/** The live *Callout format* row, kept in step by {@link FormatRow.sync}. */
export interface FormatRow {
	/**
	 * Refill the options for `calloutId` and settle on a role. Returns the role
	 * to use, which is `role` unless the theme has withdrawn it — a stored
	 * Heading command whose callout has since been taken over snaps to Block
	 * rather than sitting on an option that no longer exists.
	 */
	sync(
		registry: RoleOwnershipLookup,
		settings: PluginSettings,
		calloutId: string,
		role: CalloutRenderRole,
	): CalloutRenderRole;
}

export function buildFormatRow(
	parent: HTMLElement,
	onPick: (role: CalloutRenderRole) => void,
): FormatRow {
	const setting = new Setting(parent)
		.setName(t("commandBuilder.format"))
		.setDesc(t("commandBuilder.formatDesc"));
	let dd: DropdownComponent | undefined;
	// Options are filled by sync, not here: which formats exist depends on the
	// callout, and the callout can change while this window is open.
	setting.addDropdown((component) => {
		dd = component;
		component.onChange((raw) => onPick(raw as CalloutRenderRole));
	});
	const noticeEl = setting.descEl.createDiv({ cls: "cs-command-role-notice" });
	let applied = "";

	return {
		sync(registry, settings, calloutId, role) {
			const roles = offerableRoles(registry, calloutId);
			const narrowed = roles.length < ROLE_ORDER.length;
			const next = roles.includes(role) ? role : "regular";
			const key = roles.join(",");
			if (dd && key !== applied) {
				applied = key;
				dd.selectEl.empty();
				for (const r of roles) dd.addOption(r, t(ROLE_LABEL_KEY[r]));
			}
			dd?.setValue(next);

			// Two different absences, and the theme one has to say so: those
			// options did not grey out, they are gone, and a dropdown that
			// silently loses two entries reads as a bug rather than a rule.
			const off =
				(next === "heading" && !settings.headingCallouts.enabled) ||
				(next === "inline" && !settings.inlineCallouts.enabled);
			const notice = narrowed
				? t("commandBuilder.roleThemeOwned")
				: off
					? t("commandBuilder.roleDisabled")
					: "";
			noticeEl.setText(notice);
			noticeEl.toggleClass("is-visible", notice.length > 0);
			return next;
		},
	};
}
