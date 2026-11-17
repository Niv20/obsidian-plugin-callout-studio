/**
 * webPanel/WebPanelView.ts — Publish to the web, as a panel in the sidebar:
 * getting heading and inline callouts, and the look of block callouts, onto a
 * published site.
 *
 * Who opens it. The Website row of the settings and the **Publish to the web**
 * command (`registerWebPanel.ts`).
 *
 * The panel, top to bottom, for Digital Garden half way through:
 *
 *   ┌──────────────────────────────────┐
 *   │ 🌱 Digital Garden               ⇕│
 *   │                                  │
 *   │ 1. Create the note               │
 *   │ ╭──────────────────────────────╮ │
 *   │ │ [Open note] │ This note is   │ │
 *   │ │             │ required for … │ │
 *   │ ╰──────────────────────────────╯ │
 *   │ 2. Install the garden plugin     │
 *   │ ╭──────────────────────────────╮ │
 *   │ │ [Open garden plugins]        │ │
 *   │ │ ──────────────────────────── │ │
 *   │ │ Search for Callout Studio …  │ │
 *   │ ╰──────────────────────────────╯ │
 *   │ 3. Publish the note              │
 *   │ 4. All done                      │
 *   └──────────────────────────────────┘
 *
 * Each step is drawn as Obsidian draws a group of settings: its number and
 * name as the heading, over a rounded box of lines with a hairline between
 * two lines (`webPanelFrame.ts`). The number has a period after it, as a
 * numbered list's has in Obsidian.
 *
 * The main idea.
 * - **A panel beside the work, not a page of the settings.** It was a page
 *   until 2026-11-16. The settings are a window, and nearly every step is
 *   done somewhere else in Obsidian (Digital Garden's Publication Center,
 *   Publish changes), so the instructions had to be closed to be followed. A
 *   panel stays in view while they are.
 * - **It is opened when asked for and closed when done.** Setting a site up
 *   happens once, so the panel is no fixture of the sidebar: nothing opens it
 *   but its row and its command, closing its tab removes it, and a tab left
 *   open is closed when Obsidian starts (`ui/initializeSidebarTabs.ts`), as
 *   Review conversion's is. Nothing is lost by that: all it shows is read
 *   from the vault and from this device's memory each time it opens.
 * - **Numbered steps, with no sign of which are done, and none held back**:
 *   most of them happen outside the vault, where the plugin cannot see them,
 *   and until 2026-11-16 night the user ticked those by hand, and a step
 *   whose time had not come was dimmed, its Copy buttons off; see
 *   `manager/web/webChecklist.ts`. What the plugin can see still shows:
 *   something wrong is said in its step.
 * - **It follows the vault while it is open.** Delete the note and its step
 *   offers Create note again at once; install the Quartz plugin in a site
 *   whose configuration is in the vault and its step answers.
 *   It listens for the files it is about and reads them again, a moment
 *   after the last change. It never writes because something changed: only
 *   the button does that, and from then on `manager/web/autoUpdate.ts`.
 * - **The service is a list at the top, not a row of tabs.** Three names do
 *   not fit across a sidebar, and nearly every vault has one service. It is
 *   Obsidian's dropdown and menu (`ui/selectDropdown.ts`), not a `<select>`,
 *   so each service has its icon, and a triangle after its name while
 *   something needs the user. So several can still be set up next to each
 *   other. Until 2026-11-16 night it was a `<select>` of words ("Digital
 *   Garden · All done", "· Detected"). A caption over it names it (**Website
 *   hosting service**), and a hairline the width of the pane under it ends the
 *   top, as the field row and count of the other two sidebars end in one.
 * - **Before a service is chosen, a mascot in the middle** (`drawChoose`), over
 *   one quiet line, as Find callouts draws a search that found nothing. Until
 *   2026-11-17 the line stood alone, right under the list.
 * - **Every step on one page** (`drawService`), in order, the last one
 *   saying the whole is done and what happens from then on. Until
 *   2026-11-16 night the panel showed one phase at a time: the setup's
 *   steps, then the site's step alone once they were done. The user found publishing belongs on the
 *   page with the steps before it, and a finished step should stay put.
 * - **Nothing folds** (`drawRow`). Every step is always open, and its
 *   heading is only a heading. Until 2026-11-16 night a step could be folded
 *   from its heading, with a slide, and before that it folded away by itself
 *   the moment it was done; the user asked for folding to be taken out
 *   altogether.
 * - **A button wherever a step can be done by one** (`siteActions.ts`): open
 *   Digital Garden's plugins or its Publication Center, Publish changes, a
 *   file in Finder, the Quartz site's folder, the note. Where one cannot run
 *   here, the step says it in words.
 * - **Nothing is written until the button is pressed.** Opening the panel
 *   and choosing a service write no file in the vault.
 * - **Opening the panel ends the offer** on the settings' main page for every
 *   service the vault points at (`manager/web/webOffer.ts`).
 *
 * The panel is drawn whole each time, which keeps every row's words and
 * controls in step with one reading of the vault. The keyboard's place and
 * the scroll position are put back afterwards; where the control that had the
 * keyboard went (a button pressed), the first control of the steps gets it.
 */
import { DropdownComponent, ItemView, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import { t } from "../i18n";
import { WEB_PANEL_ICON_ID } from "../icons/uiIcons";
import type { DeviceLocalStore, WebExportMemory } from "../manager/DeviceLocalStore";
import { detectServices, isContentVault, type Detection } from "../manager/web/detectService";
import { readNotePublisher, type NotePublisher } from "../manager/web/notePublisher";
import { QUARTZ_CONFIG_FILE, type QuartzVersion } from "../manager/web/quartzConfig";
import { readSiteFacts, type SiteFacts } from "../manager/web/siteFacts";
import {
	PUBLISH_CSS,
	PUBLISH_JS,
	WEB_TARGET_IDS,
	isWebTargetId,
	newNotePath,
	noteKindOf,
	type WebTargetId,
} from "../manager/web/targets";
import { checklistFor, type Checklist, type ChecklistRow } from "../manager/web/webChecklist";
import type { WebExportPlugin } from "../manager/web/webData";
import { locateWebNote, type WebNoteLocation } from "../manager/web/webNoteLocation";
import { markWebOfferHandled } from "../manager/web/webOffer";
import {
	exportWebTarget,
	summarize,
	webTargetStatus,
	type WebExportOutcome,
	type WebTargetStatus,
} from "../manager/web/writeTarget";
import { showNotice } from "../ui/mascot/mascotNotices";
import { KeptMascot } from "../ui/mascot/mascotPlaces";
import { SelectDropdown } from "../ui/selectDropdown";
import { ConfirmModal } from "../utils/ConfirmModal";
import { openWebNote } from "./openWebNote";
import { actionsHere, runAction, type PanelAction } from "./siteActions";
import { WEB_PANEL_VIEW } from "./viewType";
import {
	SERVICE_ICON,
	prerequisiteWords,
	rowWords,
	serviceName,
	summaryText,
	type RowPart,
	type WordsContext,
} from "./webPanelCopy";
import {
	addAction,
	addCode,
	addLine,
	addText,
	drawHelpMark,
	drawPrerequisite,
	drawRow,
	drawRows,
	drawServiceBadge,
} from "./webPanelFrame";

/** The plugin, as far as the panel is concerned. */
export interface WebPanelHost extends WebExportPlugin {
	localState: Pick<DeviceLocalStore, "webExport" | "setWebExport">;
	/** Tells the panel when an automatic refresh rewrote something. */
	webAutoUpdate?: { onDidWrite(listener: () => void): () => void };
	settings: { headingCallouts: { enabled: boolean }; inlineCallouts: { enabled: boolean } };
	/** The settings tab, whose main page shows the offer this panel ends. */
	settingsTab?: { update(): void };
}

/** What was last read of one service: its files, and what else the vault says. */
interface ServiceRead {
	status: WebTargetStatus;
	facts: SiteFacts;
}

/** How long the vault must sit still before it is read again. */
export const WEB_PANEL_REREAD_MS = 300;

export class WebPanelView extends ItemView {
	private opened = false;
	/** Bumped when the panel opens and when it closes, so a late answer from an older visit is dropped. */
	private generation = 0;
	/** The vault was read once, so there is something to draw. */
	private loaded = false;
	private detections: Detection[] = [];
	private readonly read = new Map<WebTargetId, ServiceRead>();
	/** The mascot over the line that asks for a service; on the page only while none is chosen. */
	private readonly chooseMascot = new KeptMascot("medium");
	/** Where each service's note is (Digital Garden, Quartz); missing until it was looked for. */
	private readonly notes = new Map<WebTargetId, WebNoteLocation>();
	private scrollEl: HTMLElement | null = null;
	private stopListening: (() => void) | null = null;
	private timer?: number;
	private reading = false;
	private readAgain = false;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly host: WebPanelHost,
		private readonly rereadMs = WEB_PANEL_REREAD_MS,
	) {
		super(leaf);
		this.register(() => this.stop());
	}

	getViewType(): string {
		return WEB_PANEL_VIEW;
	}

	getDisplayText(): string {
		return t("web.title");
	}

	getIcon(): string {
		return WEB_PANEL_ICON_ID;
	}

	/** The language changed: every word on the panel is drawn again. */
	refreshLabels(): void {
		this.draw();
	}

	async onOpen(): Promise<void> {
		this.opened = true;
		this.loaded = false;
		const generation = ++this.generation;
		this.contentEl.addClass("cs-web-view");
		this.watch();
		this.draw();
		await this.firstRead(generation);
	}

	onClose(): Promise<void> {
		this.stop();
		this.contentEl.empty();
		this.scrollEl = null;
		return Promise.resolve();
	}

	/** Nothing that is still on its way may draw, and nothing is listened for. */
	private stop(): void {
		this.opened = false;
		this.generation++;
		if (this.timer !== undefined) window.clearTimeout(this.timer);
		this.timer = undefined;
		this.readAgain = false;
		this.stopListening?.();
		this.stopListening = null;
		this.chooseMascot.detach();
	}

	/* --- The device's memory -------------------------------------------------- */

	private memory(): WebExportMemory {
		return this.host.localState.webExport;
	}

	private remember(patch: Partial<WebExportMemory>): void {
		this.host.localState.setWebExport({ ...this.memory(), ...patch });
	}

	/** The service the panel shows, if any was chosen. */
	private selected(): WebTargetId | undefined {
		const service = this.memory().service;
		return isWebTargetId(service) ? service : undefined;
	}

	private detectionFor(id: WebTargetId): Detection | undefined {
		return this.detections.find((detection) => detection.id === id);
	}

	/** The configuration file says which Quartz it is, where it can be seen; else what the user chose. */
	private quartzVersion(): QuartzVersion {
		return (
			this.read.get("quartz")?.facts.quartzConfig?.version ??
			this.memory().quartzVersion ??
			this.detectionFor("quartz")?.quartzVersion ??
			4
		);
	}

	/* --- Reading the vault ---------------------------------------------------- */

	/**
	 * Listen for the files the panel is about, and for an automatic refresh.
	 * The vault's listeners go when the panel closes: Obsidian unloads a view
	 * before its `onClose`, and that releases what `registerEvent` holds.
	 */
	private watch(): void {
		const { vault } = this.app;
		const changed =
			(listChanged: boolean) =>
			(file: TAbstractFile, oldPath?: string): void => {
				if (this.concerns(file.path, listChanged) || (oldPath !== undefined && this.concerns(oldPath, true)))
					this.rereadSoon();
			};
		this.registerEvent(vault.on("create", changed(true)));
		this.registerEvent(vault.on("delete", changed(true)));
		this.registerEvent(vault.on("rename", changed(true)));
		this.registerEvent(vault.on("modify", changed(false)));
		// A callout changed a moment ago is written a moment later: the panel
		// must not go on saying "out of date" about it.
		this.stopListening = this.host.webAutoUpdate?.onDidWrite(() => this.rereadSoon()) ?? null;
		// A plugin switched on or off (Quartz Syncer, Digital Garden…) tells the
		// vault nothing, and in Obsidian 1.15 it is done in Settings, a window of
		// its own: the panel looks again when its window has the focus back.
		const win = this.contentEl.ownerDocument?.defaultView;
		if (win) this.registerDomEvent(win, "focus", () => this.rereadSoon());
	}

	/**
	 * Whether a change at `path` can change what the panel says. A note that
	 * appears, moves or goes may be a service's, found by its property and not
	 * by its name; an edit to any other note is nothing to the panel, and
	 * notes are edited all day. The settings of the plugin that publishes a
	 * Quartz site's notes are in the configuration folder, which Obsidian sends
	 * no events for: the panel reads them when it opens and after each write.
	 */
	private concerns(path: string, listChanged: boolean): boolean {
		if (path === PUBLISH_JS || path === PUBLISH_CSS) return true;
		if (path === QUARTZ_CONFIG_FILE[4] || path === QUARTZ_CONFIG_FILE[5]) return true;
		for (const note of this.notes.values()) if (path === note.path || note.others.includes(path)) return true;
		return listChanged && path.toLowerCase().endsWith(".md");
	}

	/** Read the vault again once it has been still for a moment. */
	private rereadSoon(): void {
		if (!this.opened) return;
		if (this.timer !== undefined) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = undefined;
			void this.reread();
		}, this.rereadMs);
	}

	private async reread(): Promise<void> {
		if (!this.opened) return;
		// One reading at a time: a change during it is read after it.
		if (this.reading) {
			this.readAgain = true;
			return;
		}
		const generation = this.generation;
		await this.readAll();
		if (generation !== this.generation) return;
		this.draw();
		this.readMissed();
	}

	/** The vault changed while it was being read: read it once more. */
	private readMissed(): void {
		if (!this.readAgain) return;
		this.readAgain = false;
		this.rereadSoon();
	}

	/** Look at the vault and read every service's files, then draw. */
	private async firstRead(generation: number): Promise<void> {
		this.detections = await detectServices(this.app);
		if (generation !== this.generation) return;
		// The panel shows every service the vault points at, so the settings'
		// main page has nothing left to offer about them.
		if (
			markWebOfferHandled(
				this.host,
				this.detections.map((detection) => detection.id),
			)
		)
			this.host.settingsTab?.update();
		// Where a new Quartz note goes follows what the vault is now, not what
		// it was at the last visit.
		const inVault = this.detectionFor("quartz")?.quartzInVault === true;
		if ((this.memory().quartzInVault === true) !== inVault) this.remember({ quartzInVault: inVault });
		// Never chosen: open on the likeliest service. That writes no file.
		const likely = this.detections[0]?.id;
		if (!this.selected() && likely) this.remember({ service: likely });
		await this.readAll();
		if (generation !== this.generation) return;
		this.loaded = true;
		this.draw();
		this.readMissed();
	}

	private async readAll(): Promise<void> {
		this.reading = true;
		try {
			await Promise.all(WEB_TARGET_IDS.map((id) => this.readOne(id)));
		} finally {
			this.reading = false;
		}
	}

	/**
	 * Where a new note of `id`'s goes, and what it is created with: inside the
	 * folder the plugin that publishes a Quartz site's notes publishes from,
	 * with that plugin's property on (`notePublisher.ts`).
	 */
	private noteOptions(publisher: NotePublisher | null): {
		quartzInVault: boolean;
		noteFolder?: string;
		noteMarkers: string[];
	} {
		const quartzInVault = this.memory().quartzInVault === true;
		if (!publisher) return { quartzInVault, noteMarkers: [] };
		return { quartzInVault, noteFolder: publisher.folder, noteMarkers: publisher.key ? [publisher.key] : [] };
	}

	/** Read one service, without writing anything. */
	private async readOne(id: WebTargetId): Promise<void> {
		const { app, host } = this;
		const publisher = id === "quartz" ? await readNotePublisher(app) : null;
		const options = this.noteOptions(publisher);
		// A service's note is found by its property, wherever it was moved.
		const kind = noteKindOf(id);
		const note = kind ? await locateWebNote(app, kind, newNotePath(id, options)) : null;
		if (note) this.notes.set(id, note);
		const [status, facts] = await Promise.all([
			webTargetStatus(app, host, id, { ...options, ...(note ? { notePath: note.path } : {}) }),
			readSiteFacts(app, id, { publisher, ...(note?.found ? { notePath: note.path } : {}) }),
		]);
		this.read.set(id, { status, facts });
	}

	/** How a service stands, from what was last read. */
	private checklist(id: WebTargetId): Checklist {
		const read = this.read.get(id);
		const { headingCallouts, inlineCallouts } = this.host.settings;
		return checklistFor({
			id,
			files: read?.status ?? "missing",
			quartzConfig: read?.facts.quartzConfig?.state ?? null,
			notePublishes: read?.facts.notePublishes ?? true,
			noteOutside: read?.facts.noteOutside ?? false,
			publisher: Boolean(read?.facts.publisher),
			needsDomain: headingCallouts.enabled || inlineCallouts.enabled,
		});
	}

	/* --- Drawing -------------------------------------------------------------- */

	private draw(): void {
		if (!this.opened) return;
		const root = this.contentEl;
		const focused = root.ownerDocument.activeElement as HTMLElement | null;
		const focusKey = focused && root.contains(focused) ? focused.dataset.csKey : undefined;
		const scrollTop = this.scrollEl?.scrollTop ?? 0;
		root.empty();
		const id = this.selected();
		this.drawTop(root, id);
		const scroll = (this.scrollEl = root.createDiv({ cls: "cs-web-scroll" }));
		// Before the first reading there is nothing true to say about any row.
		const choosing = this.loaded && !id;
		scroll.toggleClass("is-choosing", choosing);
		if (choosing) this.drawChoose(scroll);
		else this.chooseMascot.detach();
		if (this.loaded && id) this.drawService(scroll, id);
		scroll.scrollTop = scrollTop;
		if (!focusKey) return;
		const same = Array.from(root.querySelectorAll<HTMLElement>("[data-cs-key]")).find(
			(el) => el.dataset.csKey === focusKey,
		);
		// A control can go with a drawing (Create note, once pressed): the
		// keyboard stays on the panel, on the first control of the steps.
		(same ?? scroll.querySelector<HTMLElement>(".cs-web-row [data-cs-key]"))?.focus({ preventScroll: true });
	}

	/** The services, detected ones first. */
	private order(): WebTargetId[] {
		const detected = this.detections.map((detection) => detection.id);
		return [...detected, ...WEB_TARGET_IDS.filter((id) => !detected.includes(id))];
	}

	/**
	 * The top of the panel, which stays put: a caption, then the service, each with its icon
	 * and, while something needs the user, a triangle (`drawServiceBadge`),
	 * the chosen one's in the field too. Until one is chosen the field says
	 * so, and the menu offers only the services. Where the chosen one is not
	 * set up yet, that is also read out, as a live region: a screen reader
	 * hears it change, and the eye has the steps.
	 */
	private drawTop(root: HTMLElement, id: WebTargetId | undefined): void {
		const top = root.createDiv({ cls: "cs-web-top" });
		// The caption names the list. The list carries the same words as its
		// own name, so a screen reader is not told them twice.
		top.createDiv({ cls: "cs-web-top-label", text: t("web.serviceLabel"), attr: { "aria-hidden": "true" } });
		const picker = new SelectDropdown(top, t("web.serviceLabel"), {
			fieldIcon: true,
			placeholder: t("web.serviceChoose"),
		});
		picker.controlEl.dataset.csKey = "service";
		picker.setOptions(
			this.order().map((service) => {
				const verdict = this.loaded ? this.checklist(service).verdict : null;
				return {
					value: service,
					label: serviceName(service),
					icon: SERVICE_ICON[service],
					...(verdict ? { badge: (el: HTMLElement) => drawServiceBadge(el, verdict) } : {}),
				};
			}),
		);
		picker.setValue(id ?? "");
		picker.onChange((value) => {
			if (!isWebTargetId(value)) return;
			this.remember({ service: value });
			this.draw();
		});
		if (!id || !this.loaded) return;
		top.createDiv({
			cls: "cs-web-summary cs-visually-hidden",
			text: summaryText(this.checklist(id).verdict) ?? "",
			attr: { role: "status", "aria-live": "polite" },
		});
	}

	/**
	 * No service is chosen: the mascot over one quiet line, in the middle of
	 * what the panel has under the list (styles.css), drawn as Find callouts
	 * draws a search that found nothing. Nothing is wrong here, so the face is
	 * the friendly one, held still: a panel can stay open for hours. Where the
	 * mascot cannot be drawn the line stands alone.
	 */
	private drawChoose(scroll: HTMLElement): void {
		const line = scroll.createDiv({ cls: "search-empty-state cs-web-choose", text: t("web.intro") });
		if (!this.chooseMascot.attach(line, "start")) return;
		line.addClass("cs-mascot-line");
		this.chooseMascot.setMood("hello");
	}

	private wordsContext(id: WebTargetId): WordsContext {
		return {
			id,
			quartzVersion: this.quartzVersion(),
			quartzConfig: this.read.get("quartz")?.facts.quartzConfig ?? null,
			quartzInVault: this.memory().quartzInVault === true,
			quartzBesideVault: isContentVault(this.app),
			notePath: this.notes.get(id)?.path ?? "",
			noteKey: noteKindOf(id)?.key ?? "",
			noteOthers: this.notes.get(id)?.others ?? [],
			publisher: this.read.get(id)?.facts.publisher ?? null,
			// Looked for at each drawing: a plugin turned on or off since shows at once.
			actions: actionsHere(this.app),
		};
	}

	/** One service's steps, every one of them, numbered in order, the last saying what happens from then on. */
	private drawService(scroll: HTMLElement, id: WebTargetId): void {
		const ctx = this.wordsContext(id);
		const list = drawRows(scroll);
		const prerequisite = prerequisiteWords(ctx);
		if (prerequisite) {
			const box = drawPrerequisite(list, prerequisite.title);
			this.drawLines(
				box,
				prerequisite.parts,
				id,
				{ kind: "gardenInstall", mark: "todo" },
				{ code: 0, action: 0 },
			);
		}
		this.checklist(id).rows.forEach((row, index) => this.drawRow(list, id, row, index + 1, ctx));
	}

	/** One step: its heading, numbered from 1, and its box, which is always open. */
	private drawRow(list: HTMLElement, id: WebTargetId, row: ChecklistRow, number: number, ctx: WordsContext): void {
		const words = rowWords(row, ctx);
		const box = drawRow(list, { number, mark: row.mark, title: words.title });
		// Which Quartz it is decides the lines below, so it is asked first, and
		// only where the configuration file is not there to say.
		if (row.kind === "quartzPlugin" && !ctx.quartzConfig) this.drawVersion(addLine(box));
		this.drawLines(box, words.parts, id, row, { code: 0, action: 0 });
	}

	/**
	 * What a step says, in its box, as lines: the parts that follow one
	 * another share a line, and each smaller step (`{ kind: "steps" }`) is a
	 * line of its own, in order. `keys` counts the lines to copy and the
	 * buttons across the step, smaller steps included, so each control keeps
	 * one key from one drawing to the next (`draw`).
	 */
	private drawLines(
		box: HTMLElement,
		parts: readonly RowPart[],
		id: WebTargetId,
		row: ChecklistRow,
		keys: { code: number; action: number },
		step = false,
	): void {
		let line: HTMLElement | null = null;
		for (const part of parts) {
			if (part.kind === "steps") {
				for (const inner of part.steps) this.drawLines(box, inner, id, row, keys, true);
				line = null;
				continue;
			}
			line ??= addLine(box, step);
			this.drawPart(line, part, id, row, keys);
		}
	}

	private drawPart(
		line: HTMLElement,
		part: Exclude<RowPart, { kind: "steps" }>,
		id: WebTargetId,
		row: ChecklistRow,
		keys: { code: number; action: number },
	): void {
		switch (part.kind) {
			case "text":
				addText(line, part.text, part.tone, part.help);
				return;
			case "code":
				addCode(line, {
					code: part.code,
					key: `copy:${row.kind}:${keys.code++}`,
					onCopy: (code) => {
						void navigator.clipboard
							.writeText(code)
							.then(() => showNotice("success", t("notice.webCopied")));
					},
				});
				return;
			case "write":
				addAction(line, {
					text: part.text,
					key: "write",
					primary: true,
					onClick: (button) => {
						button.disabled = true;
						void this.write(id);
					},
				});
				return;
			case "action": {
				const { action } = part;
				addAction(line, {
					text: part.text,
					key: `go:${row.kind}:${keys.action++}`,
					onClick: () => void this.go(action),
				});
				return;
			}
		}
	}

	/**
	 * Quartz 4 or 5, for a site whose configuration file is outside the vault.
	 *
	 * How to tell them apart is in a "?" after the question, said when it is
	 * pointed at (`drawHelpMark`). Until 2026-11-17 the sentence always stood
	 * under the line.
	 */
	private drawVersion(body: HTMLElement): void {
		const line = body.createDiv({ cls: "cs-web-version" });
		const label = line.createSpan({ cls: "cs-web-version-label" });
		label.createSpan({ text: t("web.quartzVersion") });
		drawHelpMark(label, t("web.quartzVersionDesc"));
		const dropdown = new DropdownComponent(line)
			.addOption("4", t("web.quartzVersion4"))
			.addOption("5", t("web.quartzVersion5"))
			.setValue(String(this.quartzVersion()))
			.onChange((value) => {
				this.remember({ quartzVersion: value === "5" ? 5 : 4 });
				this.draw();
			});
		dropdown.selectEl.setAttribute("aria-label", t("web.quartzVersion"));
		dropdown.selectEl.dataset.csKey = "quartz-version";
	}

	/* --- What the user does --------------------------------------------------- */

	/**
	 * A button that leads somewhere else was pressed. If what it needs went
	 * away since the panel was drawn, say so, and draw again: the step then
	 * says it in words.
	 */
	private async go(action: PanelAction): Promise<void> {
		if (await runAction(this.app, action)) return;
		showNotice("problem", t("web.actionFailed"));
		this.draw();
	}

	private async write(id: WebTargetId): Promise<void> {
		const { app, host } = this;
		// Closing the panel moves this on: a draw after it would land on a panel
		// that is no longer open.
		const generation = this.generation;
		// Read again now: the plugin that publishes a Quartz site's notes may
		// have changed its folder or its property since the panel was drawn.
		const publisher = id === "quartz" ? await readNotePublisher(app) : null;
		const outcome = await exportWebTarget(app, host, id, {
			...this.noteOptions(publisher),
			confirmOverwrite: (paths) =>
				new ConfirmModal(
					app,
					t("confirm.titleOverwriteWebFiles"),
					t("confirm.overwriteWebFiles", { files: paths.join(", ") }),
					t("confirm.overwriteSnippetOk"),
				)
					.withMascot(t("confirm.subtitleOverwriteWebFiles"))
					.confirm(),
		});
		announce(outcome);
		if (generation !== this.generation) return;
		await this.readOne(id);
		if (generation !== this.generation) return;
		this.draw();
		// The note is what is read next, and on a garden published: it opens, beside the panel.
		const note = this.notes.get(id);
		if (id !== "publish" && outcome.status === "written" && note) void openWebNote(app, note.path);
	}
}

function announce(outcome: WebExportOutcome): void {
	switch (outcome.status) {
		case "written": {
			const summary = summarize(outcome);
			if (summary === "created") showNotice("success", t("notice.webFilesCreated"));
			else if (summary === "updated") showNotice("success", t("notice.webFilesUpdated"));
			else showNotice("upToDate", t("notice.webFilesUnchanged"));
			return;
		}
		case "failed":
			showNotice("problem", t("notice.webFilesFailed"));
			return;
		case "cancelled":
			// The confirmation was the whole interaction.
			return;
		case "waiting":
			// Only an automatic refresh waits for icons; a write by hand does not.
			return;
	}
}
