/**
 * settings/saveStatusCopy.ts — what the saving banner says while saving is
 * paused, and in what order.
 *
 * Whoever reads this banner has usually just seen the word "missing" next to
 * their settings and assumed the worst. So every paused state reads the same
 * way, in three short paragraphs rather than one long one: calm first (what is
 * safe, and why the page is read-only), then what happened, then what to do.
 *
 * Two rules keep the words honest:
 *
 * - **A comforting claim needs a fact behind it.** "Your callouts are still
 *   here" only when the writer holds a real setup (`hasRecoveryState`), never
 *   over a page of built-ins; "checks again every minute" only in the states the
 *   recheck timer covers (`rechecksWhilePaused`).
 * - **A sentence that names a button appears only with that button.** The
 *   guidance is chosen from the very answers the banner draws its buttons from
 *   ({@link PausedButtons}), and every "choose X" sentence is a key of its own,
 *   so the prose can never send the reader looking for a button that isn't
 *   there. `tests/saveStatusCopy.test.ts` checks this across every state.
 *
 * The one-off "Settings were not saved" failures are not paused states and keep
 * their single message; see `saveStatusBanner.ts`.
 */
import { t } from "../i18n";
import { rechecksWhilePaused } from "../manager/pausedRecheck";
import type { SettingsDiagnosis } from "../manager/settingsDiagnosis";
import { settingsSaveMessage } from "../manager/settingsSaveMessage";
import type { SettingsSaveReason } from "../manager/settingsSaveStatus";

/** Why an unreadable file cannot be used, in words; see manager/settingsDiagnosis.ts. */
const DIAGNOSES: Partial<Record<SettingsDiagnosis, string>> = {
	unavailable: "saveStatus.diagnosis.unavailable",
	empty: "saveStatus.diagnosis.empty",
	"merge-markers": "saveStatus.diagnosis.mergeMarkers",
	damaged: "saveStatus.diagnosis.damaged",
	combined: "saveStatus.diagnosis.combined",
	"invalid-entries": "saveStatus.diagnosis.invalidEntries",
};

/** The translation key describing a diagnosis, when there is one worth showing. */
export function diagnosisKey(diagnosis: SettingsDiagnosis | null): string | undefined {
	return diagnosis ? DIAGNOSES[diagnosis] : undefined;
}

/** The buttons the banner is drawing; the words may name only these. */
export interface PausedButtons {
	/** Missing-file restoration, by its label, or `null` when it isn't offered. */
	restore: "restore" | "create" | null;
	/** Retry, which reads Check again for a missing file. */
	retry: boolean;
	/** Check again leads, as the main button: a missing file nobody has checked for yet. */
	checkFirst: boolean;
	/** Replace settings file. */
	replace: boolean;
	/** Discard recovery copy. */
	discard: boolean;
	/** Go to backups. */
	backup: boolean;
}

export interface PausedCopyInput {
	/** `status.reason`, the latest failure or else why saving paused. Decides what happened. */
	reason: SettingsSaveReason;
	/** `status.frozenReason`, the state that decides the buttons. Decides what to do. */
	frozenReason: SettingsSaveReason | null;
	/** The settings page, which is read-only while paused, rather than the callout editor. */
	onSettingsPage: boolean;
	/** The setup on screen is the user's own rather than the built-ins (`hasRecoveryState`). */
	kept: boolean;
	/** A manual Check again has just found the file still missing. */
	stillMissing: boolean;
	/** Why an unreadable file cannot be used, once known. */
	diagnosis: SettingsDiagnosis | null;
	/** An action is running; its progress replaces what happened and what to do. */
	busy: boolean;
	buttons: PausedButtons;
}

/** The paused banner's paragraphs, in reading order: two or three, never empty. */
export function pausedCopy(input: PausedCopyInput): string[] {
	// The calm paragraph stays while an action runs, so the card does not
	// collapse to one line and grow back when the action finishes.
	if (input.busy) return [calm(input), t("saveStatus.working")];
	return [calm(input), whatHappened(input), whatToDo(input)].filter((text) => text.length > 0);
}

/** Sentences are whole keys, joined into one paragraph. */
function sentences(...keys: (string | false | undefined)[]): string {
	return keys.filter((key): key is string => typeof key === "string").map((key) => t(key)).join(" ");
}

function calm({ kept, onSettingsPage }: PausedCopyInput): string {
	return sentences(
		"saveStatus.calm.opening",
		kept ? "saveStatus.calm.kept" : "saveStatus.calm.safe",
		onSettingsPage ? "saveStatus.calm.pausedPage" : "saveStatus.calm.paused",
	);
}

function whatHappened({ reason, stillMissing }: PausedCopyInput): string {
	switch (reason) {
		// After a check came back empty, the more specific follow-up: the one
		// setting that most often keeps a synced file away, which the first
		// message leaves out so as not to open with homework.
		case "missing": return t(stillMissing ? "saveStatus.explain.stillMissing" : "saveStatus.explain.missing");
		case "unreadable": return t("saveStatus.explain.unreadable");
		case "recovery-read": return t("saveStatus.explain.recoveryRead");
		case "newer-version": return t("saveStatus.explain.newerVersion");
		// Its usual message names Try again, a button a paused banner may be
		// showing as Check again.
		case "changed": return t("saveStatus.explain.changed");
		// A failure while paused — a backup or a write that did not succeed
		// during a restore — is said plainly, as it is everywhere else.
		default: return settingsSaveMessage(reason);
	}
}

function whatToDo(input: PausedCopyInput): string {
	const { reason, frozenReason, onSettingsPage, stillMissing, buttons } = input;
	const rechecks = rechecksWhilePaused(frozenReason);
	// Back up only where an earlier version is a real way out: a file that is
	// gone or unreadable. A spare copy or a newer version is not fixed by one.
	const backup = buttons.backup && (frozenReason === "missing" || frozenReason === "unreadable");
	switch (frozenReason) {
		case "missing": return sentences(
			// Once a check has come back empty the follow-up has said so; lead
			// with the next step rather than the promise to keep looking.
			rechecks && !stillMissing && (buttons.checkFirst ? "saveStatus.guide.rechecksCheckNow" : "saveStatus.guide.rechecks"),
			// Not while the file that turned up is unreadable: restoring would
			// only stop again. Checking moves the banner on to that file.
			reason !== "unreadable" && buttons.restore === "restore" && "saveStatus.guide.restore",
			reason !== "unreadable" && buttons.restore === "create" && "saveStatus.guide.create",
			// The editor cannot restore; the settings page can.
			!onSettingsPage && "saveStatus.recoverInSettings",
			backup && "saveStatus.guide.versions",
		);
		case "unreadable": return sentences(
			// A known cause says what to do about it, and Replace settings file
			// is offered for exactly the causes it tells the reader to replace.
			diagnosisKey(input.diagnosis) ?? (rechecks && "saveStatus.guide.rechecks"),
			backup && "saveStatus.guide.versions",
		);
		case "recovery-read": return sentences(
			buttons.retry && "saveStatus.guide.recoveryRetry",
			buttons.discard && "saveStatus.guide.recoveryDiscard",
		);
		case "newer-version": return sentences("saveStatus.guide.newerVersion");
		default: return "";
	}
}
