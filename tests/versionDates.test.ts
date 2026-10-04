/** Calendar headings lead with the date and keep their localized age in parentheses. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLocale, registerLocale, setLocale, t } from "../src/i18n";
import { he } from "../src/i18n/he";
import { versionDay, versionDayKey } from "../src/settings/versionRow";

describe("version day headings", () => {
	it("puts the date before today, yesterday or the number of days ago, including older versions", () => {
		const previous = getLocale(); setLocale("en");
		const now = new Date(2026, 9, 3, 0, 1).getTime();
		const day = (offset: number) => new Date(2026, 9, 3 - offset, 23, 59).getTime();
		try {
			assert.equal(versionDay(now, now), "October 3, 2026 (today)");
			assert.equal(versionDay(day(1), now), "October 2, 2026 (yesterday)", "two minutes across midnight is yesterday");
			for (const days of [2, 6, 7, 365]) {
				const date = new Date(day(days)).toLocaleDateString("en", { dateStyle: "long" });
				assert.equal(versionDay(day(days), now), `${date} (${days} days ago)`);
			}
			assert.equal(versionDay(day(-1), now), new Date(day(-1)).toLocaleDateString("en", { dateStyle: "long" }));
			assert.equal(versionDay(null, now), t("recovery.details.unknownTime"));
			assert.equal(versionDayKey(null), "unknown");
		} finally { setLocale(previous); }
	});

	it("counts calendar days across daylight-saving changes", () => {
		const previous = getLocale(), previousZone = process.env.TZ;
		setLocale("en"); process.env.TZ = "America/New_York";
		try {
			// Spring-forward makes these consecutive midnights only 23 hours apart.
			const yesterday = new Date(2026, 2, 8, 0, 15).getTime();
			const now = new Date(2026, 2, 9, 0, 15).getTime();
			assert.equal(now - yesterday, 23 * 60 * 60 * 1000);
			assert.equal(versionDay(yesterday, now), "March 8, 2026 (yesterday)");
			assert.notEqual(versionDayKey(yesterday), versionDayKey(now));
		} finally {
			setLocale(previous);
			if (previousZone === undefined) delete process.env.TZ;
			else process.env.TZ = previousZone;
		}
	});

	it("uses the active language for relative words and the accompanying date", () => {
		const previous = getLocale(); registerLocale("he", he); setLocale("he");
		const now = new Date(2026, 9, 3, 12).getTime();
		try {
			for (const days of [0, 1, 2, 7, 365]) {
				const earlier = new Date(2026, 9, 3 - days, 12).getTime();
				const date = new Date(earlier).toLocaleDateString("he", { dateStyle: "long" });
				const relative = new Intl.RelativeTimeFormat("he", { numeric: days <= 1 ? "auto" : "always" }).format(-days, "day");
				assert.equal(versionDay(earlier, now), `${date} (${relative})`);
			}
		} finally { setLocale(previous); }
	});
});
