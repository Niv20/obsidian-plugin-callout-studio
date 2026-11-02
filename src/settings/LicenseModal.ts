/**
 * settings/LicenseModal.ts — the License window: a promise that the plugin is
 * open source, with a link to its license, and the licenses and attribution of
 * the icons it uses.
 *
 * Who opens it. The footer's License tile (declarative/footerGroup.ts). The
 * footer only needs one compact tile; everything about licenses stays easy to
 * reach without taking over the bottom of the settings page.
 *
 * The main idea. One sentence under the title: the plugin is open source and
 * will stay that way, and its last word is the link to the license on GitHub.
 * Then the box that lists the icon libraries, generated from the icon-source
 * registry so every source still exposes its creator, license, scope,
 * modifications and any source-specific notice.
 *
 * The libraries are one Obsidian setting group (`SettingGroup`, finding
 * S8-17): one rounded box with a row per library, the way Obsidian's Installed
 * plugins lists its plugins — the name (here a link to the library) followed
 * by its version in Obsidian's small muted type, and the licence lines under
 * it as the row's description. They used to be seven separate cards.
 */
import { Modal, SettingGroup, type App, type Setting } from "obsidian";
import { ICON_SOURCE_IDS, getSource } from "../icons/registry";
import type { IconPack } from "../icons/types";
import { t } from "../i18n";
import { applyModalChrome, removeModalChrome } from "./modalChrome";
import { LICENSE_URL, REPOSITORY_URL } from "./aboutLinks";

const NOTICES_URL = `${REPOSITORY_URL}/blob/master/docs/THIRD-PARTY-NOTICES.md`;
const EXTERNAL_LINK_ATTRS = {
	target: "_blank",
	rel: "noopener noreferrer",
} as const;

export class LicenseModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-credits-modal");
		this.setTitle(t("license.title"));
		applyModalChrome(this);

		const { contentEl } = this;
		// The plugin's own license: the promise, ending in a link to the file on
		// GitHub. Split like the icons' paragraph below: the words before the link,
		// the link's own words, then the full stop.
		const promise = contentEl.createEl("p", {
			cls: "callout-studio-credits-intro",
		});
		promise.createSpan({ text: t("license.openSourceBeforeLink") });
		promise.createEl("a", {
			text: t("license.openSourceLink"),
			href: LICENSE_URL,
			attr: EXTERNAL_LINK_ATTRS,
		});
		promise.createSpan({ text: "." });

		// The icons' licenses. The window's own text, at Obsidian's dialog size.
		const intro = contentEl.createEl("p", {
			cls: "callout-studio-credits-intro",
		});
		intro.createSpan({ text: t("credits.introBeforeNotices") });
		intro.createEl("a", {
			text: t("credits.fullNoticesInline"),
			href: NOTICES_URL,
			attr: EXTERNAL_LINK_ATTRS,
		});
		intro.createSpan({ text: "." });

		const group = new SettingGroup(contentEl);
		// Read out as a list, as the cards were.
		group.listEl.setAttribute("role", "list");
		for (const id of ICON_SOURCE_IDS) {
			const pack = getSource(id);
			// A user's own images have no third-party artwork to attribute.
			if (pack.attribution.licenses.length === 0) continue;
			group.addSetting((setting) => renderPackCredit(setting, pack));
		}
	}

	onClose(): void {
		removeModalChrome(this);
		this.modalEl.removeClass("callout-studio-credits-modal");
		this.contentEl.empty();
	}
}

/**
 * One library's row: its name as a link to its homepage, its version beside
 * it, then a line per licence (holder, licence link, what it covers), and the
 * library's note on how its artwork was changed and any notice it needs.
 */
function renderPackCredit(setting: Setting, pack: IconPack): void {
	const { attribution } = pack;
	setting.settingEl.setAttribute("role", "listitem");

	const name = createFragment();
	name.createEl("a", {
		text: attribution.title,
		href: attribution.homepage,
		attr: EXTERNAL_LINK_ATTRS,
	});
	name.appendText(" ");
	// Obsidian's own utility classes: Installed plugins prints a version so.
	name.createSpan({ text: attribution.version, cls: "u-muted u-small u-numeric" });
	setting.setName(name);

	const desc = createFragment();
	for (const license of attribution.licenses) {
		const line = desc.createDiv();
		line.appendText(`© ${license.holder} — `);
		line.createEl("a", {
			text: license.name,
			href: license.url,
			attr: EXTERNAL_LINK_ATTRS,
		});
		if (license.scope) line.appendText(` (${license.scope})`);
	}
	if (attribution.modifications) desc.createDiv({ text: attribution.modifications });
	if (attribution.noticeKey) desc.createDiv({ text: t(attribution.noticeKey) });
	setting.setDesc(desc);
}
