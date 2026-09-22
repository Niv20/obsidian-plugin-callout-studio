/** Built-in ID reset: one tested controller for the row and its draft state. */
import type { Setting } from "obsidian";
import { t } from "../../i18n";
import type { CalloutDefinition } from "../../types";
import type { TagInput } from "../../ui/TagInput";
import { addFieldResetButton } from "./fieldResetButton";

type IdDraft = {
	calloutId: string;
	aliases: readonly string[];
};

export function builtInDefaultIds(def: CalloutDefinition): string[] {
	return [def.id, ...(def.aliases ?? [])];
}

/**
 * Add the conditional return arrow and keep its four owners in lockstep: form
 * state, TagInput chips, dirty/save state, and the live preview.
 */
export function addBuiltInIdReset(input: {
	setting: Setting;
	tagInput: Pick<TagInput, "setTags">;
	defaultDef: CalloutDefinition;
	read: () => IdDraft;
	write: (draft: { calloutId: string; aliases: string[] }) => void;
	onReset: () => void;
	validate?: (id: string, role: "primary" | "alias") => string | null;
	onBlocked?: (message: string) => void;
}): () => void {
	const defaultIds = builtInDefaultIds(input.defaultDef);
	const matchesDefault = (): boolean => {
		const current = input.read();
		return current.calloutId === input.defaultDef.id &&
			current.aliases.length === defaultIds.length - 1 &&
			current.aliases.every((id, index) => id === defaultIds[index + 1]);
	};

	return addFieldResetButton(
		input.setting,
		`${t("settings.resetAction")}: ${t("editor.calloutIds")}`,
		matchesDefault,
		() => {
			for (const [index, id] of defaultIds.entries()) {
				const error = input.validate?.(id, index === 0 ? "primary" : "alias");
				if (error) {
					input.onBlocked?.(error);
					return;
				}
			}
			input.write({
				calloutId: input.defaultDef.id,
				aliases: [...(input.defaultDef.aliases ?? [])],
			});
			input.tagInput.setTags(defaultIds);
			input.onReset();
		},
	);
}
