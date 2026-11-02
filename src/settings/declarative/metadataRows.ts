/**
 * settings/declarative/metadataRows.ts — the rows about callout metadata: the
 * colours a callout takes from its own metadata (`[!note|red]`), and the list
 * that opens after `|`.
 *
 * Who calls it. The Autocomplete and metadata page (autocompletePage.ts), for
 * its second box.
 *
 * The main idea. Four rows:
 *
 *   Metadata colors                 metadataColors.enabled
 *   Metadata autocomplete           suggestions.metadata
 *   Include your theme's words      suggestions.themeMetadata
 *   Your words                      suggestions.metadataWords
 *
 * The switches are Obsidian's own (`control` rows, rowParts.ts `toggleRow`). A
 * row that would change nothing right now is hidden (`visible`): the rows
 * under Metadata autocomplete while it is off, and the theme's switch while
 * the theme reacts to no word. A theme switch the user turned off stays in
 * sight, so it can be turned back on after a theme change. Metadata colors
 * always shows: it is about how notes look, not about the list.
 *
 * Your words is the callout editor's IDs field (ui/TagInput.ts): type a word,
 * Enter, and it becomes one of Obsidian's pills. It is kept through redraws
 * (persistentParts.ts), and kept *beside* the row's controls, which a redraw
 * empties: there it never moves, so a pill or the field keeps the focus while
 * the page is drawn again around it.
 */
import { MAX_METADATA_WORD_LENGTH, MAX_METADATA_WORDS } from "../../constants";
import { t } from "../../i18n";
import { TagInput } from "../../ui/TagInput";
import { METADATA_WORD_SEPARATORS, sanitizeMetadataWordInput } from "../../utils/metadataWordInput";
import { disabledWhilePaused, refuseWhilePaused } from "./pausedGuards";
import type { PersistentPart } from "./persistentParts";
import { toggleRow } from "./rowParts";
import { guardRender } from "./safeTree";
import type { CsRender, CsSetting, TreeContext } from "./types";

/** The rows' ids: they key the rows, so they never change. */
export const METADATA_ROWS = {
	colors: "metadata-colors",
	autocomplete: "metadata-autocomplete",
	themeWords: "suggest-theme-metadata",
	words: "metadata-words",
} as const;

export function metadataRows(ctx: TreeContext): CsSetting[] {
	const suggestions = () => ctx.plugin.settings.suggestions;
	const writer = ctx.plugin.settingsWriter;
	const listOpens = (): boolean => suggestions().metadata;
	return [
		toggleRow({
			id: METADATA_ROWS.colors,
			name: "settings.metadataColors",
			desc: "settings.metadataColorsDesc",
			key: "metadataColors.enabled",
			writer,
		}),
		toggleRow({
			id: METADATA_ROWS.autocomplete,
			name: "settings.metadataAutocomplete",
			desc: "settings.metadataAutocompleteDesc",
			key: "suggestions.metadata",
			writer,
		}),
		toggleRow({
			id: METADATA_ROWS.themeWords,
			name: "settings.suggestThemeMetadata",
			desc: "settings.suggestThemeMetadataDesc",
			key: "suggestions.themeMetadata",
			writer,
			visible: () => listOpens() && (themeHasWords(ctx) || !suggestions().themeMetadata),
		}),
		{ ...metadataWordsRow(ctx), visible: listOpens },
	];
}

/** Whether the active theme reacts to any metadata word. */
function themeHasWords(ctx: TreeContext): boolean {
	return ctx.plugin.cssInjector.metadataCatalog.sourcesNow().some((source) => source.origin === "theme");
}

/* ---- Your words ---- */

/** The name the words field is kept under in the parts store. */
const WORDS_FIELD = "metadata-words-field";

/** The kept field: its element and the field itself. */
interface WordsFieldPart extends PersistentPart {
	field: TagInput;
}

/** Your words: the pills, and the field to add one. */
function metadataWordsRow(ctx: TreeContext): CsRender {
	return {
		id: METADATA_ROWS.words,
		name: t("settings.metadataWords"),
		desc: t("settings.metadataWordsDesc"),
		disabled: disabledWhilePaused(ctx.plugin.settingsWriter),
		render: guardRender("metadata words", (setting) => {
			setting.setClass("cs-metadata-words-setting");
			const { field } = ctx.parts.mount(WORDS_FIELD, setting.settingEl, (parent) => buildWordsField(ctx, parent));
			// Another device's settings may have changed the list since the
			// last draw. Only a real difference redraws the pills, which would
			// take the focus off one.
			const saved = ctx.plugin.settings.suggestions.metadataWords;
			if (!sameWords(field.getTags(), saved)) field.setTags(saved);
			return () => ctx.parts.releaseLater(WORDS_FIELD);
		}),
	};
}

/** Build the field once; every draw puts the same one back. */
function buildWordsField(ctx: TreeContext, parent: HTMLElement): WordsFieldPart {
	const save = (words: string[]): void => {
		ctx.plugin.settings.suggestions.metadataWords = words;
		// Its change round saves and draws the page again.
		ctx.plugin.registry.settingsChanged();
	};
	// Refused while paused: the saved list goes back into the field.
	const putBack = (): void => field.setTags(ctx.plugin.settings.suggestions.metadataWords);
	const field: TagInput = new TagInput(parent, {
		initialTags: ctx.plugin.settings.suggestions.metadataWords,
		placeholder: t("settings.metadataWordsPlaceholder"),
		onChange: refuseWhilePaused(ctx.plugin.settingsWriter, save, putBack),
		sanitize: sanitizeMetadataWordInput,
		separators: METADATA_WORD_SEPARATORS,
		maxLength: MAX_METADATA_WORD_LENGTH,
		maxTags: MAX_METADATA_WORDS,
		messages: {
			add: t("settings.addMetadataWord"),
			duplicate: t("settings.metadataWordAlreadyHere"),
			tooLong: (max) => t("settings.metadataWordTooLong", { max }),
			full: (max) => t("settings.maxMetadataWords", { max }),
		},
	});
	return { el: field.el, field, dispose: () => field.el.remove() };
}

/** Whether two word lists hold the same words in the same order. */
function sameWords(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((word, i) => word === b[i]);
}
