/** Version history must be usable in every shipped language. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { LOCALE_TABLES } from "./support/localeTables";

// Generic version names and deletion scope are translated in every shipped locale.
const simplifiedKeys = [
	"versions.category.automatic",
	"versions.category.syncCopy",
	"versions.deleteAvailableBody",
	"versions.deleteSyncedFiles",
] as const;

// This pass covers these settled strings; future copy can still fall back to English.
const translatedKeys = [
	...simplifiedKeys,
	"recovery.details.changesTitle",
	"saveStatus.guide.versions",
	"saveStatus.goToVersions",
	"versions.title",
	"versions.intro",
	"versions.pausedHint",
	"versions.loading",
	"versions.empty",
	"versions.reason.edit",
	"versions.reason.load",
	"versions.reason.restore",
	"versions.reason.repair",
	"versions.reason.beforeSync",
	"versions.reason.beforeRestore",
	"versions.reason.beforeReset",
	"versions.reason.beforeImport",
	"versions.reason.beforeRepair",
	"versions.restoreTitle",
	"versions.restoreBody",
	"versions.restoreSame",
	"versions.restored",
	"versions.backupFailed",
	"versions.restoreFailed",
	"versions.deleteTitle",
	"versions.deleteFinal",
	"versions.deleted",
	"versions.deleteFailed",
	"versions.details.title",
	"notice.unsavedChangesKept",
	"settings.versionHistory",
	"settings.versions",
	"settings.versionsDesc",
	"settings.versionsButton",
] as const;

const retiredKeys = [
	"versions.category.automaticInfo",
	"versions.category.syncCopyInfo",
	"versions.deleteBody",
	"versions.deleteFromCopy",
	"versions.deleteFromDevice",
	"versions.deleteFromVault",
	"versions.details.places",
	"versions.place.copy",
	"versions.place.copyInfo",
	"versions.place.device",
	"versions.place.deviceInfo",
	"versions.place.vault",
	"versions.place.vaultInfo",
	"versions.reason.copy",
	"versions.reason.device",
	"versions.reason.vault",
	"versions.rename",
	"versions.nameLabel",
	"versions.renameFailed",
	"recovery.title",
	"recovery.intro",
	"recovery.pausedViewHint",
	"recovery.loading",
	"recovery.empty",
	"recovery.sectionHistory",
	"recovery.sectionBackups",
	"recovery.sectionCopies",
	"recovery.restoreSame",
	"recovery.confirmTitle",
	"recovery.confirmBody",
	"recovery.restored",
	"recovery.backupFailed",
	"recovery.failed",
	"recovery.deleteConfirmTitle",
	"recovery.deleteConfirmBody",
	"recovery.deleted",
	"recovery.deleteFailed",
	"recovery.details.title",
	"settings.backup",
	"settings.recovery",
	"settings.recoveryDesc",
	"settings.recoveryButton",
	"saveStatus.goToBackups",
	"saveStatus.guide.backup",
	"notice.unsavedChangesReplaced",
] as const;

describe("version history translations", () => {
	it("provides fallback version names and deletion scope in every shipped language", () => {
		for (const [fileId, table] of Object.entries({ en, ...LOCALE_TABLES })) {
			for (const key of simplifiedKeys) {
				assert.ok(table[key]?.trim(), `${fileId} has no text for ${key}`);
				assert.deepEqual(
					table[key]?.match(/\{\{\w+\}\}/g)?.sort() ?? [],
					en[key]?.match(/\{\{\w+\}\}/g)?.sort() ?? [],
					`${fileId} changes the interpolation fields for ${key}`,
				);
				if (fileId !== "en") assert.notEqual(table[key], en[key]);
			}
			assert.deepEqual(
				table["versions.deleteAvailableBody"]?.match(/\{\{\w+\}\}/g)?.sort(),
				["{{name}}", "{{when}}"],
			);
		}
	});

	it("uses the active language for the newly translated version-history copy", () => {
		const previous = getLocale();
		try {
			registerLocale("fr", LOCALE_TABLES.fr);
			setLocale("fr");
			assert.equal(t("versions.reason.edit"), LOCALE_TABLES.fr["versions.reason.edit"]);
			for (const key of [...simplifiedKeys, "recovery.details.changesTitle"]) {
				assert.equal(t(key), LOCALE_TABLES.fr[key]);
				assert.notEqual(t(key), en[key]);
			}
		} finally {
			setLocale(previous);
		}
	});

	it("puts the date first and relative day wording in parentheses in every shipped language", () => {
		for (const [fileId, table] of Object.entries({ en, ...LOCALE_TABLES })) {
			assert.deepEqual(
				table["versions.dayWithDate"]?.match(/\{\{\w+\}\}/g),
				["{{date}}", "{{relative}}"],
				`${fileId} changes the relative date heading fields or their order`,
			);
			assert.equal(table["versions.dayWithDate"], "{{date}} ({{relative}})");
		}
	});

	for (const [fileId, table] of Object.entries(LOCALE_TABLES)) {
		it(`${fileId} preserves the established version-history translations`, () => {
			for (const key of translatedKeys) {
				assert.equal(typeof table[key], "string", `${fileId} is missing ${key}`);
				assert.ok(table[key]?.trim(), `${fileId} has an empty ${key}`);
				assert.deepEqual(
					table[key]?.match(/\{\{\w+\}\}/g)?.sort() ?? [],
					en[key]?.match(/\{\{\w+\}\}/g)?.sort() ?? [],
					`${fileId} changes the interpolation fields for ${key}`,
				);
				assert.notEqual(table[key], en[key], `${fileId} still shows English for ${key}`);
			}
			assert.equal(table["settings.versionHistory"], table["versions.title"]);
		});
	}
});

describe("retired restore-window, version-naming, and storage-place translations", () => {
	for (const [fileId, table] of Object.entries({ en, ...LOCALE_TABLES })) {
		it(`${fileId} removes the ${retiredKeys.length} obsolete keys`, () => {
			for (const key of retiredKeys) {
				assert.ok(!(key in table), `${fileId} still carries ${key}`);
			}
		});
	}
});
