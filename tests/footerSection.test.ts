import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderFooterSection } from "../src/settings/sections/FooterSection";
import type { SettingsSectionContext } from "../src/settings/sections/types";
import { compareSpecificity, specificityOf } from "../src/utils/cssSpecificity";
import { installFakeDom } from "./support/fakeDom";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();

const REPOSITORY_URL =
	"https://github.com/Niv20/obsidian-plugin-callout-studio";

function renderFooter(): {
	host: HTMLElement;
	disposers: Array<() => void>;
} {
	const disposers: Array<() => void> = [];
	const ctx = {
		app: {},
		plugin: { manifest: { version: "2.14.1" } },
		display: () => {},
		registerDisposer: (dispose: () => void) => disposers.push(dispose),
	} as unknown as SettingsSectionContext;
	const host = createDiv();
	renderFooterSection(ctx, host);
	return { host, disposers };
}

function linksIn(host: HTMLElement): HTMLAnchorElement[] {
	return Array.from(host.querySelectorAll<HTMLAnchorElement>("a"));
}

describe("the settings footer", () => {
	it("offers one friendly issue route and an email alternative", () => {
		const { host } = renderFooter();
		const contact = host.querySelector<HTMLElement>(
			".callout-studio-footer-contact",
		);
		assert.equal(
			contact?.textContent,
			"Questions, bugs, or ideas? I'd love to hear from you! Open a GitHub issue or send me an email.",
		);
		assert.equal(contact?.querySelectorAll("br").length, 0);
		assert.ok(
			contact?.querySelector(".callout-studio-footer-contact-links"),
		);
		assert.equal(host.querySelector(".callout-studio-footer-actions"), null);

		const links = linksIn(host);
		const issueLinks = links.filter(
			(link) =>
				link.getAttribute("href") === `${REPOSITORY_URL}/issues/new/choose`,
		);
		assert.equal(issueLinks.length, 1);
		assert.equal(issueLinks[0]?.textContent, "Open a GitHub issue");

		const email = links.find((link) =>
			link.getAttribute("href")?.startsWith("mailto:"),
		);
		assert.ok(email);
		assert.equal(email.textContent, "send me an email");

		assert.equal(
			host.querySelector(".callout-studio-footer-contact-icon"),
			null,
		);
	});

	it("keeps project metadata compact, complete, and safely linked", () => {
		const { host } = renderFooter();
		const links = linksIn(host);
		const expectedMetadata = new Map([
			["Source code", REPOSITORY_URL],
			["Contribute", `${REPOSITORY_URL}/blob/master/docs/CONTRIBUTING.md`],
			["Plugin license", `${REPOSITORY_URL}/blob/master/LICENSE`],
			["v2.14.1", `${REPOSITORY_URL}/releases/tag/2.14.1`],
		]);

		for (const [label, href] of expectedMetadata) {
			const link = links.find((candidate) => candidate.textContent === label);
			assert.ok(link, `missing footer link: ${label}`);
			assert.equal(link.getAttribute("href"), href);
		}

		const httpLinks = links.filter((link) =>
			/^https?:\/\//.test(link.getAttribute("href") ?? ""),
		);
		assert.equal(httpLinks.length, 5);
		for (const link of httpLinks) {
			assert.equal(link.getAttribute("target"), "_blank");
			assert.equal(link.getAttribute("rel"), "noopener noreferrer");
		}

		const credits = host.querySelector<HTMLButtonElement>(
			"button.callout-studio-footer-meta-link",
		);
		assert.ok(credits);
		assert.equal(credits.textContent, "Icon licenses");
		assert.equal(credits.getAttribute("type"), "button");
		const separators = Array.from(
			host.querySelectorAll<HTMLElement>(
				".callout-studio-footer-meta-separator",
			),
		);
		assert.equal(separators.length, 4);
		for (const separator of separators) {
			assert.equal(separator.textContent, "·");
			assert.equal(separator.getAttribute("aria-hidden"), "true");
		}
		const footerText = host.textContent ?? "";
		assert.match(footerText, /v2\.14\.1/);
		assert.doesNotMatch(footerText, /Made by Niv/i);
	});

	it("registers cleanup for the credits trigger", () => {
		const { disposers } = renderFooter();
		assert.equal(disposers.length, 1);
		assert.equal(typeof disposers[0], "function");
	});

	it("keeps the footer links' padding above Obsidian's tablet button rule", () => {
		// Obsidian's `.is-tablet button:not(.clickable-icon)` gives every button
		// 4px 20px. The licences trigger is the one <button> in a row of links,
		// so on an iPad (and nowhere else) it came out ~38px wider than its
		// neighbours. The fake DOM has no layout; the cascade shape is what is
		// guarded, measured in WebKit against Obsidian 1.14.4's app.css.
		const tablet = specificityOf(".is-tablet button:not(.clickable-icon)");
		const css = readRepoFile("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
		const rule = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).find(
			(m) =>
				!(m[1] ?? "").includes(",") &&
				!(m[1] ?? "").includes(":") &&
				(m[1] ?? "").includes("callout-studio-footer-meta-link") &&
				/padding\s*:\s*0 1px/.test(m[2] ?? ""),
		);
		assert.ok(rule, "the footer link padding rule is missing");
		const selector = (rule[1] ?? "").replace(/\s+/g, " ").trim();
		assert.ok(
			compareSpecificity(specificityOf(selector), tablet) > 0,
			`${selector} must outrank Obsidian's tablet button padding`,
		);
	});
});
