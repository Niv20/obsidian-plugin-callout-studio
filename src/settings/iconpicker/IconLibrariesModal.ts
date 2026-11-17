/**
 * settings/iconpicker/IconLibrariesModal.ts — the **Manage icon libraries**
 * window, over Pick an icon.
 *
 * Who calls it. openIconLibraries.ts, for Pick an icon's **Manage libraries**
 * button (IconPickerModal.ts).
 *
 * The main idea. The window is a frame around the list of libraries
 * (IconLibrariesView.ts), which the settings' **Icon libraries** page draws
 * too (declarative/iconLibrariesPage.ts), so the two cannot disagree. The
 * picker needs a window of its own: it and the callout editor under it are
 * windows that cover the settings, so a settings page could be reached only by
 * closing them, and with them the icon the person had chosen and not yet saved.
 *
 * What the frame adds is Obsidian's window shell, with no footer (every button
 * and every drag saves itself), the title, the body as the one scroller, and
 * the answer the picker waits for: whether anything changed. It is given once
 * the window has closed and every deletion it started has finished, because the
 * picker reads the pack files when it hears back, and a library still half
 * deleted would look as if it were there.
 */
import { Modal } from "obsidian";
import { t } from "../../i18n";
import { applyModalChrome, removeModalChrome } from "../modalChrome";
import { IconLibrariesView, type IconLibrariesHost } from "./IconLibrariesView";

export class IconLibrariesModal extends Modal {
	private resolve: ((changed: boolean) => void) | null = null;
	private readonly view: IconLibrariesView;

	constructor(private readonly host: IconLibrariesHost) {
		super(host.app);
		this.view = new IconLibrariesView(this.host);
	}

	/** Open the window; resolves with whether anything changed once it closes. */
	openAndWait(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		applyModalChrome(this);
		this.contentEl.addClass("cs-icon-libraries");
		// The same words as the button that opens the window, so the two agree.
		this.titleEl.setText(t("iconLibraries.manage"));
		this.view.open({
			containerEl: this.contentEl,
			descClass: "setting-item-description",
			// The body of the window is its one scroll container (modalChrome.ts).
			scroller: () => this.contentEl,
		});
	}

	onClose(): void {
		const running = this.view.close();
		const changed = this.view.anythingChanged;
		this.contentEl.empty();
		removeModalChrome(this);
		const resolve = this.resolve;
		this.resolve = null;
		if (running === null) resolve?.(changed);
		else void running.then(() => resolve?.(changed));
	}
}
