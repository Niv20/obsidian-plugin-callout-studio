/**
 * settings/WelcomeModal.ts — First-run welcome / splash screen.
 *
 * A friendly two-column intro to the plugin. Shown automatically once, on first
 * load for a fresh install only (gated by the `welcomeSeen` setting); a user who
 * merely updates into this version never sees it. Also reopenable any time from
 * the info icon next to the "Callout Studio" title in settings.
 *
 * Left column: the plugin name and a one-line slogan, centered. Right
 * column: a real {@link LiveCalloutPreview} rendering a short sample whose copy
 * itself explains the three callout roles (heading, inline, regular) and links
 * back to the GitHub repo, so the preview both demonstrates and describes what
 * the plugin can do. Closing the modal (Escape, click-outside, or the preview's
 * own link) resolves the first-run `prompt()` promise the same way.
 */
import { Modal } from "obsidian";
import { t } from "../i18n";
import { WELCOME_DEMO_ID } from "../constants";
import { LiveCalloutPreview } from "./LiveCalloutPreview";
import { buildWelcomeDemoDefinition } from "./welcomeDemo";
import type { SettingsTabPlugin } from "./sections/types";

const REPO_URL = "https://github.com/Niv20/obsidian-plugin-callout-studio";

export class WelcomeModal extends Modal {
	private resolved = false;
	private resolve: () => void = () => {};
	private preview: LiveCalloutPreview | null = null;

	constructor(private readonly plugin: SettingsTabPlugin) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("cs-welcome-modal");
		// No title bar — the hero lives in the left column.
		this.titleEl.remove();

		const panel = this.contentEl.createDiv({
			cls: "cs-split-panel cs-welcome-panel",
		});

		// ── Left column: hero + slogan, centered ────────────────────────
		const left = panel.createDiv({ cls: "cs-welcome-left" });
		const hero = left.createDiv({ cls: "cs-welcome-hero" });
		hero.createEl("h1", {
			cls: "cs-welcome-title",
			text: t("welcome.title"),
		});
		left.createEl("p", {
			cls: "cs-welcome-tagline",
			text: t("welcome.tagline"),
		});

		// ── Right column: self-describing live preview ─────────────────
		const right = panel.createDiv({ cls: "cs-welcome-right" });
		this.preview = new LiveCalloutPreview(this.app, right, {
			title: t("welcome.previewTitle"),
			initialText: t("welcome.sample", {
				id: WELCOME_DEMO_ID,
				repoUrl: REPO_URL,
			}),
			beforeRender: () => {
				// The splash demonstrates itself with a demo callout of its own,
				// never a real one — see welcomeDemo.ts for why the built-ins
				// it used to borrow could not survive a theme.
				this.plugin.registry.setPreviewDefinition(
					buildWelcomeDemoDefinition(),
					true,
				);
				this.plugin.cssInjector.inject(false);
			},
			onDestroy: () => {
				this.plugin.registry.setPreviewDefinition(null);
				// Not merely tidying: `injectNow` skips the startup CSS
				// snapshot for as long as a preview definition is live, and on
				// a fresh install this modal is what holds one during the very
				// first launch. This inject is the one that writes it.
				this.plugin.cssInjector.inject(false);
			},
		});
	}

	onClose(): void {
		this.preview?.destroy();
		this.preview = null;
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.resolve();
		}
	}

	/** Open the modal and resolve once it closes (for the first-run flow). */
	prompt(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
