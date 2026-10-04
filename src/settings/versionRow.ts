/** The automatic names, local dates and timeline dots in Version history. */
import { getLocale, t } from "../i18n";
import type { BackupReason } from "../manager/settingsBackup";
import type { HistoryReason } from "../manager/settingsHistory";
import { versionCategory, type SetupVersion, type VersionCategory } from "../manager/setupVersions";

/** Generic names for versions with no recorded reason; storage stays internal. */
const CATEGORY_NAMES: Readonly<Record<VersionCategory, string>> = {
	automatic: "versions.category.automatic",
	"sync-copy": "versions.category.syncCopy",
};

/** Every recorded reason's name. Total over both unions, so a new reason fails to compile until it has one. */
const REASON_NAMES: Readonly<Record<HistoryReason | BackupReason, string>> = {
	edit: "versions.reason.edit",
	load: "versions.reason.load",
	restore: "versions.reason.restore",
	repair: "versions.reason.repair",
	"before-sync": "versions.reason.beforeSync",
	"before-restore": "versions.reason.beforeRestore",
	"before-reset": "versions.reason.beforeReset",
	"before-import": "versions.reason.beforeImport",
	"before-repair": "versions.reason.beforeRepair",
};

/** A version is named by why it was kept. */
export function automaticVersionName(version: SetupVersion): string {
	return recordedVersionReason(version.reason.reason) ?? t(CATEGORY_NAMES[versionCategory(version)]);
}

/** Resolve a known save reason without exposing an unknown internal identifier. */
export function recordedVersionReason(reason: string | null | undefined): string | null {
	return reason && Object.prototype.hasOwnProperty.call(REASON_NAMES, reason)
		? t(REASON_NAMES[reason as HistoryReason | BackupReason]) : null;
}

/** The same automatic title is used in the list and confirmations. */
export function versionName(version: SetupVersion): string {
	return automaticVersionName(version);
}

/** When a version was saved, for a person; the unknown-time line when nothing says. */
export function versionTime(time: number | null): string {
	return formatVersionTime(time, { dateStyle: "medium", timeStyle: "short" });
}

/** Calendar days follow the device's timezone, as the displayed dates do. */
export function versionDayKey(time: number | null): string {
	if (time === null) return "unknown";
	const date = new Date(time);
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Date first, with calendar-day age in parentheses; DST does not affect the age. */
export function versionDay(time: number | null, now: number = Date.now()): string {
	if (time === null) return t("recovery.details.unknownTime");
	const calendarDay = (value: number) => {
		const date = new Date(value);
		return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
	};
	const days = calendarDay(now) - calendarDay(time);
	const date = formatVersionTime(time, { dateStyle: "long" });
	if (days < 0) return date;
	const numeric = days <= 1 ? "auto" : "always";
	const relative = new Intl.RelativeTimeFormat(dateLocale(), { numeric }).format(-days, "day");
	return t("versions.dayWithDate", { date, relative });
}

/** The translation table uses zhTW; Intl expects a BCP 47 language tag. */
function dateLocale(): string {
	return getLocale() === "zhTW" ? "zh-TW" : getLocale();
}

/** Dates belong to the day heading; rows only need their time. */
export function versionClock(time: number | null): string {
	return formatVersionTime(time, { timeStyle: "short" });
}

function formatVersionTime(time: number | null, options: Intl.DateTimeFormatOptions): string {
	if (time === null) return t("recovery.details.unknownTime");
	try { return new Date(time).toLocaleString(dateLocale(), options); }
	catch { return new Date(time).toLocaleString(undefined, options); }
}

/** A plain title: versions cannot be renamed. */
export function renderVersionName(nameEl: HTMLElement, version: SetupVersion): void {
	nameEl.createSpan({ text: versionName(version), cls: "cs-version-name" });
}

/** A decorative dot connects every version to the timeline in the same way. */
export function renderVersionMarker(parent: HTMLElement): void {
	parent.createSpan({ cls: "cs-version-marker", attr: { "aria-hidden": "true" } });
}
