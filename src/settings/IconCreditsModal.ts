/**
 * settings/IconCreditsModal.ts — Icon licenses and attribution in a modal.
 *
 * The settings footer only needs a compact link; the full attribution remains
 * easy to reach without taking over the bottom of the settings page. The rows
 * are generated from the icon-source registry so every source still exposes
 * its creator, license, scope, modifications and any source-specific notice.
 */
import { Modal, type App } from "obsidian";
import { ICON_SOURCE_IDS, getSource } from "../icons/registry";
import type { IconPack } from "../icons/types";
import { t } from "../i18n";
import { applyModalChrome, removeModalChrome } from "./modalChrome";

const REPOSITORY_URL =
	"https://github.com/Niv20/obsidian-plugin-callout-studio/blob/master";
const NOTICES_URL = `${REPOSITORY_URL}/docs/THIRD-PARTY-NOTICES.md`;
const EXTERNAL_LINK_ATTRS = {
	target: "_blank",
	rel: "noopener noreferrer",
} as const;

export class IconCreditsModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("callout-studio-credits-modal");
		this.setTitle(t("credits.title"));
		applyModalChrome(this);

		const { contentEl } = this;
		contentEl.addClass("callout-studio-credits-content");
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

		const creditsList = contentEl.createDiv();
		creditsList.setAttribute("role", "list");
		for (const id of ICON_SOURCE_IDS) {
			const pack = getSource(id);
			// A user's own images have no third-party artwork to attribute.
			if (pack.attribution.licenses.length === 0) continue;
			renderPackCredit(creditsList, pack);
		}

	}

	onClose(): void {
		removeModalChrome(this);
		this.modalEl.removeClass("callout-studio-credits-modal");
		this.contentEl.empty();
	}
}

function renderPackCredit(parent: HTMLElement, pack: IconPack): void {
	const { attribution } = pack;
	const row = parent.createDiv({ cls: "callout-studio-credit" });
	row.setAttribute("role", "listitem");

	const heading = row.createEl("h3", {
		cls: "callout-studio-credit-name",
	});
	heading.createEl("a", {
		text: attribution.title,
		href: attribution.homepage,
		attr: EXTERNAL_LINK_ATTRS,
	});
	heading.createSpan({
		text: ` ${attribution.version}`,
		cls: "callout-studio-credit-version",
	});

	for (const license of attribution.licenses) {
		const line = row.createDiv({ cls: "callout-studio-credit-license" });
		line.createSpan({ text: `© ${license.holder} — ` });
		line.createEl("a", {
			text: license.name,
			href: license.url,
			attr: EXTERNAL_LINK_ATTRS,
		});
		if (license.scope) {
			line.createSpan({
				text: ` (${license.scope})`,
				cls: "callout-studio-credit-scope",
			});
		}
	}

	if (attribution.modifications) {
		row.createDiv({
			text: attribution.modifications,
			cls: "callout-studio-credit-modifications",
		});
	}

	if (attribution.noticeKey) {
		row.createDiv({
			text: t(attribution.noticeKey),
			cls: "callout-studio-credit-notice",
		});
	}
}
