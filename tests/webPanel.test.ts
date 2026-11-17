/**
 * tests/webPanel.test.ts — the Publish to the web panel
 * (`src/webPanel/WebPanelView.ts`), and how it is opened
 * (`src/webPanel/registerWebPanel.ts`).
 *
 * Its promises are about restraint and about telling the truth, and each is
 * one a user would only find out about the wrong way:
 *
 * - **Nothing is written until the button is pressed.** Opening the panel,
 *   choosing a service and changing the Quartz version write no file.
 * - **Each step is a number and a name**, 1., 2., 3., with no sign of
 *   whether it is done and no box to tick: until 2026-11-16 night there were
 *   both ("I installed it", "I published it"). The number has a period after
 *   it, as a numbered list's has in Obsidian.
 * - **The panel follows the vault while it is open.** Delete the note and its
 *   step offers Create note again; edit Quartz's configuration and its step
 *   answers. An edit to any other note does not make it read the vault.
 * - **Nothing is held back.** No step is dimmed, and every Copy button
 *   works: until 2026-11-16 night a step whose time had not come waited,
 *   with its Copy buttons off.
 * - **The service is a list**, Obsidian's menu, detected ones first, each
 *   with its icon and a triangle while something needs the user; a panel
 *   never opened before opens on what the vault points at.
 * - **Every step on one page**, in order, ending with "All done"; a step
 *   says the same before and after it is done, and only its button changes.
 * - **Nothing folds.** A step's heading is only a heading: no arrow, no
 *   button, no stop for the keyboard, and every box is always open.
 * - **A button where a step can be done by one**, and the same step in
 *   words where it cannot: no Digital Garden, the Publish core plugin off, a
 *   phone. A button that leads elsewhere writes nothing.
 * - **Digital Garden's note step has its sentence under its buttons**, on a
 *   line of its own and not above them: the button first, then why the note
 *   is needed.
 * - **It is opened when asked for**: from the settings, which it closes, and
 *   never left listening once it is closed.
 *
 * How a row stands is decided in `webChecklist.ts`, which has its own suite
 * (tests/webChecklist.test.ts); this one checks that the panel shows it, and
 * what a press does. What it looks like is checked by the user
 * guide's pictures, not here.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";
// Listed first among the project imports: it installs the DOM globals before
// anything under test loads (see tests/support/fakeDom.ts).
import { fakeDom, type FakeDocumentFragment, type FakeElement } from "./support/fakeDom";
import {
	Notice,
	Platform,
	createdDropdowns,
	createdMenus,
	type DropdownComponent,
	type Menu,
} from "./support/obsidianStub";
import { TFile, type App, type WorkspaceLeaf } from "obsidian";
import { t } from "../src/i18n";
import { WEB_PANEL_ICON_ID } from "../src/icons/uiIcons";
import { CSSInjector } from "../src/manager/CSSInjector";
import type { CalloutRegistry } from "../src/manager/CalloutRegistry";
import type { WebExportMemory } from "../src/manager/DeviceLocalStore";
import type { WebFileMemory } from "../src/manager/web/fileMemory";
import {
	GARDEN_NOTE_KEY,
	GARDEN_NOTE_PATH,
	GARDEN_PLUGIN_ID,
	GARDEN_PLUGIN_REPO_URL,
	PUBLISH_CSS,
	PUBLISH_JS,
	QUARTZ_NOTE,
	QUARTZ_NOTE_KEY,
	QUARTZ_NOTE_NAME,
	QUARTZ_PLUGIN_PACKAGE,
	QUARTZ_PLUGIN_SOURCE,
} from "../src/manager/web/targets";
import { exportWebTarget } from "../src/manager/web/writeTarget";
import { openWebPanel } from "../src/webPanel/registerWebPanel";
import { WEB_PANEL_VIEW } from "../src/webPanel/viewType";
import { WebPanelView, type WebPanelHost } from "../src/webPanel/WebPanelView";
import { newQuartzNoteFrontmatter } from "../src/web/static/quartzNote";
import { buildNoteBody } from "../src/web/static/webNote";
import { readingHarness } from "./support/readingHarness";
import { webFileMemory } from "./support/webFileMemory";

type VaultEvent = "create" | "delete" | "rename" | "modify";

interface Mounted {
	view: WebPanelView;
	content: FakeElement;
	app: App;
	host: WebPanelHost;
	registry: CalloutRegistry;
	files: Map<string, string>;
	writes: string[];
	memory: { value: WebExportMemory };
	/** An automatic refresh rewrote something: tell whoever is listening. */
	refreshed(): void;
	/** How many are listening for that. */
	listeners: () => number;
	/** How many vault events are being listened for. */
	watching: () => number;
	/** How often the settings were asked to draw themselves again. */
	settingsUpdates: () => number;
	/** The vault says a file appeared, went, moved or changed. */
	emit(event: VaultEvent, path: string, oldPath?: string): void;
	/** The file is gone from the vault, which says so. */
	remove(path: string): void;
	/** The file's text changed, and the vault says so. */
	edit(path: string, text: string): void;
	/** The main area's tabs: what each shows, in which view, and which is active. */
	tabs: TabStandIn[];
	/** Whether the last tab made active was given the keyboard. */
	focused: () => boolean | null;
	/** What the panel's buttons asked of Obsidian and of other plugins, in order. */
	ran: string[];
	/** Turn the Digital Garden plugin and its commands off, as a user can while the panel is open. */
	turnOffGarden(): void;
	destroy(): void;
}

/**
 * What of Obsidian's internals and other plugins the vault has, for the
 * panel's buttons (`src/webPanel/siteActions.ts`). Left out, it has none of
 * them, and every step is said in words.
 */
interface Internals {
	/** Commands that are there, by id. */
	commands?: string[];
	/** The Digital Garden plugin: as it is now, or an older one with only its command. */
	garden?: "current" | "older";
	/** `app.showInFolder`, as on a desktop. */
	reveal?: true;
}

interface TabStandIn {
	file: string | null;
	mode: string | null;
	active: boolean;
}

interface MountOptions {
	files?: Record<string, string>;
	memory?: WebExportMemory;
	/** Community plugins switched on in the vault. */
	plugins?: string[];
	/** Notes the metadata cache knows, by path, with their properties. */
	notes?: Record<string, Record<string, unknown>>;
	/** This device's own callouts, where they are not the plugin's as installed. */
	callouts?: (registry: CalloutRegistry) => void;
	/**
	 * This device's memory of the files it wrote. Without one the plugin
	 * stand-in answers for no file, and cannot tell another device's from its own.
	 */
	webFiles?: WebFileMemory;
	/** The main area starts with one empty tab, the most recent one. */
	emptyTab?: true;
	/** Leave the panel closed: the test opens it itself. */
	closed?: true;
	internals?: Internals;
	/** The vault's name, which is its folder's. Left out, it is "Notes". */
	vaultName?: string;
}

function mount(options: MountOptions = {}): Mounted {
	const files = new Map(Object.entries(options.files ?? {}));
	if (options.plugins) files.set(".obsidian/community-plugins.json", JSON.stringify(options.plugins));
	const folders = new Set<string>();
	const writes: string[] = [];
	const listed = new Map<string, TFile>();
	const refs = new Map<object, { event: VaultEvent; listener: (file: TFile, oldPath?: string) => void }>();
	const emit = (event: VaultEvent, path: string, oldPath?: string): void => {
		const file = listed.get(path) ?? Object.assign(new TFile(), { path });
		for (const ref of [...refs.values()]) if (ref.event === event) ref.listener(file, oldPath);
	};
	const list = (path: string): void => {
		if (listed.has(path)) return;
		listed.set(path, Object.assign(new TFile(), { path }));
		emit("create", path);
	};
	for (const path of files.keys()) listed.set(path, Object.assign(new TFile(), { path }));
	const rootSplit = {};
	const tabs: TabStandIn[] = [];
	let focused: boolean | null = null;
	const leafOf = (tab: TabStandIn) => ({
		tab,
		getRoot: () => rootSplit,
		getViewState: () => ({ type: tab.file ? "markdown" : "empty", state: tab.file ? { file: tab.file } : {} }),
		view: { getViewType: () => (tab.file ? "markdown" : "empty") },
		openFile(file: TFile, opened: { state?: { mode?: string } }): Promise<void> {
			tab.file = file.path;
			tab.mode = opened.state?.mode ?? null;
			return Promise.resolve();
		},
		loadIfDeferred: () => Promise.resolve(),
	});
	const leaves: Array<ReturnType<typeof leafOf>> = [];
	const newTab = () => {
		const tab: TabStandIn = { file: null, mode: null, active: false };
		tabs.push(tab);
		const leaf = leafOf(tab);
		leaves.push(leaf);
		return leaf;
	};
	if (options.emptyTab) newTab().tab.active = true;
	const emitter = {
		offref: (ref: object): void => {
			refs.delete(ref);
		},
	};
	const ran: string[] = [];
	const internals = options.internals ?? {};
	const commands = new Set(internals.commands ?? []);
	let garden: Record<string, unknown> | null = null;
	if (internals.garden) {
		commands.add("digitalgarden:dg-open-publish-modal");
		garden =
			internals.garden === "current"
				? {
						openGardenPlugins: (id?: string) => void ran.push(`garden plugins ${String(id)}`),
						activatePublicationCenter: (target?: { tab: string }) =>
							void ran.push(`publication center ${String(target?.tab)}`),
					}
				: {};
	}
	const app = {
		commands: {
			findCommand: (id: string) => (commands.has(id) ? { id } : undefined),
			executeCommandById(id: string): boolean {
				if (!commands.has(id)) return false;
				ran.push(`command ${id}`);
				return true;
			},
		},
		plugins: { getPlugin: (id: string) => (id === "digitalgarden" ? garden : null) },
		...(internals.reveal ? { showInFolder: (path: string) => void ran.push(`reveal ${path}`) } : {}),
		workspace: {
			rootSplit,
			getLeavesOfType: (type: string) => leaves.filter((leaf) => leaf.view.getViewType() === type),
			getMostRecentLeaf: () => leaves.find((leaf) => leaf.tab.active) ?? null,
			getLeaf: (where: string) => {
				assert.equal(where, "tab", "a note of the user's is never replaced");
				return newTab();
			},
			setActiveLeaf(leaf: ReturnType<typeof leafOf>, how: { focus?: boolean }): void {
				for (const tab of tabs) tab.active = tab === leaf.tab;
				focused = how.focus ?? true;
			},
		},
		vault: {
			configDir: ".obsidian",
			getName: () => options.vaultName ?? "Notes",
			getMarkdownFiles: () => Object.keys(options.notes ?? {}).map((path) => ({ path })),
			getAbstractFileByPath: (path: string) => listed.get(path) ?? null,
			on(event: VaultEvent, listener: (file: TFile, oldPath?: string) => void) {
				// As Obsidian's EventRef: it knows the emitter that takes it back.
				const ref = { e: emitter };
				refs.set(ref, { event, listener });
				return ref;
			},
			offref: emitter.offref,
			adapter: {
				exists: (path: string) => Promise.resolve(files.has(path) || folders.has(path)),
				read: (path: string) => Promise.resolve(files.get(path) ?? ""),
				write(path: string, data: string): Promise<void> {
					writes.push(path);
					files.set(path, data);
					list(path);
					return Promise.resolve();
				},
				mkdir(path: string): Promise<void> {
					folders.add(path);
					return Promise.resolve();
				},
			},
		},
		metadataCache: {
			getFileCache: (file: { path: string }) => {
				const frontmatter = options.notes?.[file.path];
				return frontmatter ? { frontmatter } : null;
			},
		},
	};
	const { registry } = readingHarness();
	options.callouts?.(registry);
	const memory = { value: options.memory ?? {} };
	const listeners = new Set<() => void>();
	let settingsUpdates = 0;
	const host = {
		registry,
		settings: registry.settings,
		cssInjector: new CSSInjector(app as unknown as App, registry),
		localState: {
			get webExport(): WebExportMemory {
				return { ...memory.value };
			},
			setWebExport(next: WebExportMemory): void {
				memory.value = next;
			},
		},
		webAutoUpdate: {
			onDidWrite(listener: () => void): () => void {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		},
		settingsTab: { update: () => void settingsUpdates++ },
		...(options.webFiles ? { webFiles: options.webFiles } : {}),
	} as unknown as WebPanelHost;
	const view = new WebPanelView({ app } as unknown as WorkspaceLeaf, host, 0);
	const content = view.contentEl as unknown as FakeElement;
	fakeDom.document.body.appendChild(view.containerEl as unknown as FakeElement);
	if (!options.closed) void view.onOpen();
	return {
		view,
		content,
		app: app as unknown as App,
		host,
		registry,
		files,
		writes,
		memory,
		refreshed: () => listeners.forEach((listener) => listener()),
		listeners: () => listeners.size,
		watching: () => refs.size,
		settingsUpdates: () => settingsUpdates,
		emit,
		remove(path) {
			files.delete(path);
			emit("delete", path);
			listed.delete(path);
		},
		edit(path, text) {
			const fresh = !files.has(path);
			files.set(path, text);
			if (fresh) list(path);
			else emit("modify", path);
		},
		tabs,
		focused: () => focused,
		ran,
		turnOffGarden() {
			garden = null;
			for (const id of [...commands]) if (id.startsWith("digitalgarden:")) commands.delete(id);
		},
		destroy: () => {
			view.unload();
			void view.onClose();
			(view.containerEl as unknown as FakeElement).remove();
		},
	};
}

/**
 * Wait for the panel to settle. It reads the vault and fingerprints files
 * before it draws, through promises and Web Crypto, so a fixed number of
 * microtask turns is not enough; a condition is. The fake window's timers
 * fire only when told to, so each turn fires what is due: that is the moment
 * the panel reads the vault again after a change.
 *
 * The limit is wall-clock time, not a count of turns. Web Crypto answers from
 * a thread of its own, in real time, while a turn with nothing to do takes
 * microseconds: 500 turns came to about 8 ms, which a busy CI runner's hashes
 * once outlasted (2026-11-17, Node 22). Ten seconds is never needed by a
 * passing test and is only spent by one that would fail anyway.
 */
const UNTIL_MS = 10_000;
async function until(check: () => boolean, what: string): Promise<void> {
	const deadline = performance.now() + UNTIL_MS;
	do {
		if (check()) return;
		fakeDom.window.flushTimers();
		await new Promise((resolve) => setImmediate(resolve));
	} while (performance.now() < deadline);
	if (check()) return;
	throw new Error(`the panel never showed ${what}`);
}

const MARKS = ["seen", "clear", "todo", "warning"] as const;
type Mark = (typeof MARKS)[number];

const markOf = (el: FakeElement): Mark | undefined => MARKS.find((mark) => el.hasClass(`is-${mark}`));

/** The panel's steps, in order: each one's name, how it stands, and all it says while it is open. */
const rows = (content: FakeElement) =>
	content.querySelectorAll(".cs-web-row").map((el) => {
		const head = el.querySelector(".cs-web-row-head");
		assert.ok(head, "a step's heading");
		return {
			el,
			head,
			title: el.querySelector(".cs-web-row-title")?.textContent ?? "",
			/** The number before its name, with its period. */
			number: head.querySelector(".cs-web-row-number")?.textContent ?? "",
			mark: markOf(el),
			text: el.textContent,
			/** What it says, in the box under its heading. */
			box: el.querySelector(".cs-web-row-box"),
		};
	});

const row = (content: FakeElement, title: string) => {
	const found = rows(content).find((entry) => entry.title === title);
	assert.ok(
		found,
		`no "${title}" step among: ${rows(content)
			.map((entry) => entry.title)
			.join(" | ")}`,
	);
	return found;
};

/** How a step stands, or `undefined` where the panel has no such step. */
const markAt = (content: FakeElement, title: string): Mark | undefined =>
	rows(content).find((entry) => entry.title === title)?.mark;

/** How the steps stand, as "name: mark" lines. */
const standing = (content: FakeElement): string[] => rows(content).map((entry) => `${entry.title}: ${entry.mark}`);

/** The list of services at the top of the panel: its field, as last drawn. */
function serviceField(content: FakeElement): FakeElement {
	const field = content.querySelector(".cs-web-top .cs-dropdown-field");
	assert.ok(field, "the list of services");
	return field;
}

/** The words in the field: the chosen service's name, or what asks for one. */
const serviceShown = (content: FakeElement): string =>
	serviceField(content).querySelector(".cs-dropdown-field-label")?.textContent ?? "";

/** A service's sign, after its name: a triangle while something needs the user, the only sign there is. */
type Sign = "warning";

/** The sign after the chosen service's name in the field, if it has one. */
const fieldSign = (content: FakeElement): Sign | undefined =>
	serviceField(content).querySelector(".cs-select-badge .cs-web-warning") ? "warning" : undefined;

/** A menu item's words, whether its title is words or words with a sign after them. */
const titleText = (title: string | DocumentFragment): string =>
	typeof title === "string" ? title : (title as unknown as FakeDocumentFragment).textContent;

/** The sign after a menu item's words, if it has one. */
function titleSign(title: string | DocumentFragment): Sign | undefined {
	if (typeof title === "string") return undefined;
	const badge = (title as unknown as FakeDocumentFragment).childNodes.find(
		(node): node is FakeElement => (node as FakeElement).hasClass?.("cs-select-badge") === true,
	);
	return badge?.querySelector(".cs-web-warning") ? "warning" : undefined;
}

/** Open the list of services, as a press on its field does: Obsidian's menu. */
function openServices(content: FakeElement): Menu {
	press(serviceField(content));
	const menu = createdMenus[createdMenus.length - 1];
	assert.ok(menu?.shown, "the menu of services");
	return menu;
}

/** The services in the list, in order, each as the menu draws it; the menu is closed again. */
function services(content: FakeElement): Array<{ title: string; icon?: string; checked: boolean; sign?: Sign }> {
	const menu = openServices(content);
	const items = menu.items.map((item) => {
		const sign = titleSign(item.title);
		return {
			title: titleText(item.title),
			...(item.icon ? { icon: item.icon } : {}),
			checked: item.checked,
			...(sign ? { sign } : {}),
		};
	});
	menu.hide();
	return items;
}

/** The sign after a service's name in the list. */
const serviceSign = (content: FakeElement, name: string): Sign | undefined =>
	services(content).find((item) => item.title === name)?.sign;

/** Choose a service by its name in the list, as a press on its row in the menu does. */
function chooseService(content: FakeElement, name: string): void {
	const menu = openServices(content);
	const index = menu.items.findIndex((item) => titleText(item.title) === name);
	assert.ok(index >= 0, `no ${name} in the list`);
	menu.clickItemAt(index);
}

/** The Quartz version's list, as last drawn, if the panel shows one. */
const versionList = (content: FakeElement): DropdownComponent | undefined =>
	content.querySelector(".cs-web-version")
		? [...createdDropdowns].reverse().find((dropdown) => dropdown.selectEl.dataset?.csKey === "quartz-version")
		: undefined;

const summary = (content: FakeElement): string | null => content.querySelector(".cs-web-summary")?.textContent ?? null;

/** The words of a step's box, line by line, without its buttons. */
const wordsOf = (step: FakeElement): string[] => step.querySelectorAll(".cs-web-row-text").map((el) => el.textContent);

/** The button that writes the files, by the words on it. */
function action(content: FakeElement, text: string): FakeElement {
	const found = content.querySelectorAll("button").find((el) => el.textContent === text);
	assert.ok(found, `no "${text}" button in ${content.textContent}`);
	return found;
}

const hasAction = (content: FakeElement, text: string): boolean =>
	content.querySelectorAll("button").some((el) => el.textContent === text);

/** The fields of a form on the panel: there are none, so no box for the user to tick. */
const inputs = (content: FakeElement): number => content.querySelectorAll("input").length;

/** A Copy button that can be pressed: nothing marks it off, for the eye or for a screen reader. */
const copyWorks = (button: FakeElement): boolean =>
	button.getAttribute("aria-disabled") !== "true" && !button.hasClass("is-disabled");

/** The Copy buttons of a step, with the line each copies. */
const copies = (step: FakeElement) =>
	step.querySelectorAll(".cs-web-code").map((well) => {
		const button = well.querySelectorAll(".clickable-icon").find((el) => el.dataset.csTooltip === t("web.copy"));
		assert.ok(button, "a well's Copy button");
		return { well, button, code: well.querySelector("code")?.textContent ?? "" };
	});

const press = (el: FakeElement): void => el.fire("click", { type: "click", detail: 1 });

/** A step's smaller steps, each a line of its box, as the words of each. */
const stepsOf = (step: FakeElement): string[] =>
	step.querySelectorAll(".cs-web-line.is-step").map((el) => el.textContent);

/** The line a button is on in a step's box, and the line under it (a hairline lies between them). */
function aroundButton(step: FakeElement, text: string): { line: FakeElement; next: FakeElement | undefined } {
	const lines = step.querySelectorAll(".cs-web-line");
	const at = lines.findIndex((line) => line.querySelectorAll("button").some((button) => button.textContent === text));
	const line = lines[at];
	assert.ok(line, `no line with a "${text}" button in ${step.textContent}`);
	return { line, next: lines[at + 1] };
}

/** The panel read the vault and drew what it found: a service's steps, or the line that asks for one. */
const drawn = (content: FakeElement): boolean => content.querySelector(".cs-web-rows, .cs-web-choose") !== null;

const lastNotice = (): string | null => (Notice.last ? String(Notice.last.message) : null);

const IMPORT_LINE = `import { CalloutStudio } from "${QUARTZ_PLUGIN_PACKAGE}"`;
/** The command that installs the Quartz plugin, as the panel shows it for each generation. */
const ADD5 = `npx quartz plugin add ${QUARTZ_PLUGIN_SOURCE}`;
const ADD4 = `npm install ${QUARTZ_PLUGIN_SOURCE}`;
/** The entry `npx quartz plugin add` writes, as Quartz 5.1.0 wrote it. */
const QUARTZ5_ENTRY = `  - source: ${QUARTZ_PLUGIN_SOURCE}\n    enabled: true\n    options: {}\n    order: 65`;

/** Quartz's note as an older Callout Studio wrote it: ours, nobody edited it, and not what this one writes. */
function olderQuartzNote(): string {
	const older = JSON.stringify({ version: 1, heading: true, inline: true, content: true, fallback: null, defs: [] });
	const fingerprint = createHash("sha256").update(older, "utf8").digest("hex");
	return newQuartzNoteFrontmatter() + buildNoteBody(QUARTZ_NOTE, fingerprint, older);
}

/** A `quartz.config.ts` with these lines in `transformers`, and `extra` among its imports. */
const quartz4Config = (extra: string, transformers: string[]): string =>
	[
		'import * as Plugin from "./quartz/plugins"',
		extra,
		"const config = { plugins: { transformers: [",
		...transformers,
		"] } }",
		"export default config",
	].join("\n");

describe("the Publish to the web panel", () => {
	it("is a view of its own, with the brush-and-globe icon and the feature's name", () => {
		const h = mount({ closed: true });
		try {
			assert.equal(h.view.getViewType(), WEB_PANEL_VIEW);
			assert.equal(h.view.getViewType(), "callout-studio-publish-to-web");
			assert.equal(h.view.getIcon(), WEB_PANEL_ICON_ID);
			assert.equal(h.view.getDisplayText(), t("web.title"));
			assert.equal(h.watching(), 0, "a panel that is not open listens for nothing");
		} finally {
			h.destroy();
		}
	});

	it("opens on the detected service, listed first with its icon, says nothing more about it, and writes nothing", async () => {
		const h = mount({ plugins: ["digitalgarden"] });
		try {
			await until(() => drawn(h.content), "the panel");
			// Obsidian's menu, each service with its icon; nothing of any is wrong, so no sign.
			assert.deepEqual(services(h.content), [
				{ title: t("web.serviceGarden"), icon: "sprout", checked: true },
				{ title: t("web.servicePublish"), icon: "send", checked: false },
				{ title: t("web.serviceQuartz"), icon: "gem", checked: false },
			]);
			// Never opened before: the panel opens on what the vault points at, with no line on why.
			assert.equal(serviceShown(h.content), t("web.serviceGarden"));
			assert.equal(fieldSign(h.content), undefined);
			assert.equal(h.memory.value.service, "garden");
			assert.equal(h.content.querySelector(".cs-web-why"), null);
			assert.equal(summary(h.content), t("web.summaryNone"));
			// Every step on one page, in order, none of them held back.
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: todo`,
				`${t("web.rowGardenPlugin")}: todo`,
				`${t("web.siteNote")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			// Each step is its own heading over its own box, numbered as a list is.
			assert.ok(rows(h.content).every((entry) => entry.box !== null));
			assert.deepEqual(
				rows(h.content).map((entry) => entry.number),
				["1.", "2.", "3.", "4."],
			);
			assert.deepEqual(h.writes, [], "showing a service writes nothing");
		} finally {
			h.destroy();
		}
	});

	it("asks for a service where nothing points anywhere, and draws no step until one is chosen", async () => {
		const h = mount();
		try {
			await until(() => drawn(h.content), "the panel");
			// The field asks; the menu offers the services only, none of them chosen.
			assert.equal(serviceShown(h.content), t("web.serviceChoose"));
			const offered = services(h.content);
			assert.deepEqual(
				offered.map((item) => item.title),
				[t("web.servicePublish"), t("web.serviceQuartz"), t("web.serviceGarden")],
			);
			assert.ok(offered.every((item) => !item.checked));
			assert.equal(h.memory.value.service, undefined, "nothing is chosen for the user");
			assert.equal(h.content.querySelector(".cs-web-choose")?.textContent, t("web.intro"));
			// The line stands in the middle of what is left under the list, not
			// at the top of it, and it is the only thing there.
			const scroll = h.content.querySelector(".cs-web-scroll");
			assert.ok(scroll?.classList.contains("is-choosing"), "centred while nothing is chosen");
			assert.equal(scroll?.children.length, 1);
			assert.equal(rows(h.content).length, 0);
			assert.equal(summary(h.content), null);

			chooseService(h.content, t("web.servicePublish"));
			assert.equal(h.memory.value.service, "publish");
			assert.equal(serviceShown(h.content), t("web.servicePublish"));
			// Every step, publishing included, though the files are not there yet.
			assert.deepEqual(standing(h.content), [
				`${t("web.rowFiles")}: todo`,
				`${t("web.rowPublishDomain")}: todo`,
				`${t("web.siteFiles")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			assert.equal(h.content.querySelector(".cs-web-choose"), null);
			// The steps sit from the top, as they always did.
			assert.ok(!h.content.querySelector(".cs-web-scroll")?.classList.contains("is-choosing"));
			assert.deepEqual(h.writes, []);
		} finally {
			h.destroy();
		}
	});

	it("names the list of services in a caption over it, and ends the top in a line of its own", async () => {
		const h = mount();
		try {
			await until(() => drawn(h.content), "the panel");
			const top = h.content.querySelector(".cs-web-top");
			assert.ok(top, "the top of the panel");
			// The caption comes first, then the list: the order of the eye.
			const caption = top.children[0];
			assert.ok(caption, "something is first");
			assert.ok(caption.classList.contains("cs-web-top-label"), "the caption is first");
			assert.equal(caption.textContent, t("web.serviceLabel"));
			assert.ok(top.children[1]?.classList.contains("cs-dropdown-field"), "the list is under it");
			// The list is named by the same words, so the caption is not read twice.
			assert.equal(caption.getAttribute("aria-hidden"), "true");
			// The top is the line's own box, the width of the pane (styles.css), and
			// the steps are not inside it.
			assert.equal(top.querySelector(".cs-web-rows"), null);
			assert.ok(top.parentElement?.classList.contains("cs-web-view") || top.parentElement === h.content);
		} finally {
			h.destroy();
		}
	});

	it("opens with nothing chosen on a device that remembers a service this version no longer has", async () => {
		const h = mount({ memory: { service: "script" } });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.equal(serviceShown(h.content), t("web.serviceChoose"));
			assert.equal(rows(h.content).length, 0);
		} finally {
			h.destroy();
		}
	});

	it("writes only when Create files is pressed, and keeps the step open and saying the same", async () => {
		const h = mount({ memory: { service: "publish" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const before = row(h.content, t("web.rowFiles"));
			assert.equal(before.mark, "todo");
			assert.ok(before.text.includes(t("web.filesPublish")));
			// Under the button, after a hairline, as a note's sentence is.
			assert.deepEqual(wordsOf(before.el), [t("web.filesPublish")]);
			assert.ok(
				before.text.includes("won't appear in Obsidian's file list"),
				"that the file list will not show them",
			);
			const words = wordsOf(before.el);
			assert.deepEqual(h.writes, []);

			const write = action(h.content, t("web.write"));
			assert.ok(write.hasClass("mod-cta"));
			press(write);
			await until(() => row(h.content, t("web.rowFiles")).mark === "seen", "the files as written");
			assert.deepEqual(h.writes, [PUBLISH_JS, PUBLISH_CSS]);
			const after = row(h.content, t("web.rowFiles"));
			assert.equal(lastNotice(), t("notice.webFilesCreated"));
			// Nothing to update: no button asks to be pressed.
			assert.equal(hasAction(h.content, t("web.write")), false);
			assert.equal(hasAction(h.content, t("web.update")), false);
			// Done, saying what it said before.
			assert.deepEqual(wordsOf(after.el), words);
			// What is left is the user's: the domain, and publishing. The last step no longer waits.
			assert.deepEqual(standing(h.content), [
				`${t("web.rowFiles")}: seen`,
				`${t("web.rowPublishDomain")}: todo`,
				`${t("web.siteFiles")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			// On its way: no word for it, and no sign in the list.
			assert.equal(summary(h.content), "");
			assert.equal(serviceSign(h.content, t("web.servicePublish")), undefined);
		} finally {
			h.destroy();
		}
	});

	it("draws each step as a number and a name, with no sign of done and no box to tick", async () => {
		const h = mount({ memory: { service: "publish" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const before = rows(h.content);
			press(action(h.content, t("web.write")));
			await until(() => row(h.content, t("web.rowFiles")).mark === "seen", "the files as written");
			// Before and after the files are written: the same numbers, the same names.
			for (const drawnRows of [before, rows(h.content)]) {
				assert.deepEqual(
					drawnRows.map((entry) => `${entry.number} ${entry.title}`),
					[
						`1. ${t("web.rowFiles")}`,
						`2. ${t("web.rowPublishDomain")}`,
						`3. ${t("web.siteFiles")}`,
						`4. ${t("web.rowDone")}`,
					],
				);
			}
			// The heading is the number and the name, and nothing else.
			const head = row(h.content, t("web.rowFiles")).head;
			assert.deepEqual(
				head.children.map((el) => el.className),
				["cs-web-row-number", "cs-web-row-title"],
			);
			assert.equal(inputs(h.content), 0, "no box to tick anywhere");
			assert.equal(h.content.querySelector(".cs-web-mark"), null, "no sign of how a step stands");
			// Nothing is said to be all done, in the list or to a screen reader.
			assert.equal(serviceSign(h.content, t("web.servicePublish")), undefined);
			assert.equal(summary(h.content), "");
			assert.ok(row(h.content, t("web.rowDone")).text.includes(t("web.donePublish")));
			assert.equal("ticks" in h.memory.value, false, "nothing ticked is remembered");
		} finally {
			h.destroy();
		}
	});

	it("says the same on the step that publishes after the callouts change and the note is rewritten", async () => {
		const h = mount({ memory: { service: "garden" }, webFiles: webFileMemory() });
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			const { head, text: words } = row(h.content, t("web.siteNote"));
			const note = h.files.get(GARDEN_NOTE_PATH);

			// A callout changes, and the note is rewritten without being asked.
			h.registry.update("tip", { colorLight: "#ff00ff" });
			await exportWebTarget(h.app, h.host, "garden", { auto: true });
			assert.notEqual(h.files.get(GARDEN_NOTE_PATH), note, "the note was rewritten");
			h.refreshed();
			await until(() => row(h.content, t("web.siteNote")).head !== head, "the panel drawn again");
			// Publishing again is what the last step says, for every change alike.
			assert.equal(row(h.content, t("web.siteNote")).text, words);
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: seen`,
				`${t("web.rowGardenPlugin")}: todo`,
				`${t("web.siteNote")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			assert.ok(row(h.content, t("web.rowDone")).text.includes(t("web.doneNote")));
		} finally {
			h.destroy();
		}
	});

	it("offers Create note again at once when the note is deleted, and holds the other steps back no more than before", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			assert.equal(markAt(h.content, t("web.siteNote")), "todo");

			h.remove(GARDEN_NOTE_PATH);
			await until(() => row(h.content, t("web.rowNote")).mark === "todo", "the note gone");
			assert.ok(hasAction(h.content, t("web.writeNote")), "the button is back");
			assert.equal(hasAction(h.content, t("web.actionOpenNote")), false, "no note to open");
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: todo`,
				`${t("web.rowGardenPlugin")}: todo`,
				`${t("web.siteNote")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			assert.equal(summary(h.content), t("web.summaryNone"));
		} finally {
			h.destroy();
		}
	});

	it("reads the vault again for its own files only: an edit to some other note is nothing to it", async () => {
		const h = mount({ memory: { service: "publish" } });
		try {
			await until(() => drawn(h.content), "the panel");
			fakeDom.window.flushTimers();
			const idle = fakeDom.window.pendingTimers();
			h.emit("modify", "journal/today.md");
			h.emit("modify", "attachments/picture.png");
			assert.equal(fakeDom.window.pendingTimers(), idle, "no reading was asked for");

			for (const [event, path] of [
				["modify", PUBLISH_JS],
				["modify", PUBLISH_CSS],
				["modify", "quartz.config.ts"],
				["modify", "quartz.config.yaml"],
				["delete", QUARTZ_NOTE_NAME],
				["delete", `content/${QUARTZ_NOTE_NAME}`],
				// A note that appears or goes may be the garden's: it is found by its property.
				["create", "somewhere/renamed.md"],
				["delete", "somewhere/renamed.md"],
			] as const) {
				h.emit(event, path);
				assert.equal(fakeDom.window.pendingTimers(), idle + 1, `${event} ${path}`);
				fakeDom.window.flushTimers();
				await until(() => fakeDom.window.pendingTimers() === idle, "the reading done");
			}
			// A note moved away is known by where it was.
			h.emit("rename", "elsewhere.txt", "old/place.md");
			assert.equal(fakeDom.window.pendingTimers(), idle + 1);
		} finally {
			h.destroy();
		}
	});

	it("reads the files again when an automatic refresh rewrote them, and stops listening once closed", async () => {
		const h = mount({ memory: { service: "publish" } });
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.write")));
			await until(() => row(h.content, t("web.rowFiles")).mark === "seen", "the files as written");
			assert.equal(h.listeners(), 1);
			assert.equal(h.watching(), 4, "create, delete, rename and modify");

			// Changed under the panel, as a refresh a moment later would leave it.
			h.files.set(PUBLISH_JS, "/* callout-studio:start — edited */\nold\n/* callout-studio:end */\n");
			assert.equal(row(h.content, t("web.rowFiles")).mark, "seen", "the panel has not read them yet");
			h.refreshed();
			await until(() => row(h.content, t("web.rowFiles")).mark === "warning", "the files as out of date");
			assert.ok(row(h.content, t("web.rowFiles")).text.includes(t("web.statusStale")));
			assert.ok(hasAction(h.content, t("web.update")), "the button that settles it");

			// As Obsidian closes a view: unloaded, then told.
			h.view.unload();
			await h.view.onClose();
			assert.equal(h.listeners(), 0);
			assert.equal(h.watching(), 0);
			assert.equal(h.content.children.length, 0);
		} finally {
			h.destroy();
		}
	});

	it("draws nothing after the panel was closed, however late the vault answers", async () => {
		const h = mount({ memory: { service: "publish" } });
		try {
			await h.view.onClose();
			// Long enough for the vault to have answered, had anyone been listening.
			for (let turn = 0; turn < 100; turn++) await new Promise((resolve) => setImmediate(resolve));
			assert.equal(h.content.children.length, 0);
			h.refreshed();
			h.emit("modify", PUBLISH_JS);
			fakeDom.window.flushTimers();
			assert.equal(h.content.children.length, 0);
		} finally {
			h.destroy();
		}
	});

	it("keeps a triangle after a service's name while something needs the user, so two can be set up next to each other", async () => {
		const h = mount({ memory: { service: "quartz" }, files: { [QUARTZ_NOTE_NAME]: olderQuartzNote() } });
		try {
			await until(() => drawn(h.content), "the panel");
			// Out of date: a triangle after its name, in the field and in the menu.
			assert.equal(row(h.content, t("web.rowNote")).mark, "warning");
			assert.equal(fieldSign(h.content), "warning");
			assert.equal(serviceSign(h.content, t("web.serviceQuartz")), "warning");
			assert.equal(serviceSign(h.content, t("web.servicePublish")), undefined, "nothing of it is in the vault");

			chooseService(h.content, t("web.servicePublish"));
			press(action(h.content, t("web.write")));
			await until(() => row(h.content, t("web.rowFiles")).mark === "seen", "Publish as written");
			// Nothing wrong: no sign, whatever is left to do.
			assert.equal(serviceSign(h.content, t("web.servicePublish")), undefined);
			assert.equal(fieldSign(h.content), undefined);
			assert.equal(serviceSign(h.content, t("web.serviceQuartz")), "warning", "the other is as it was");
			// Showing the other again loses nothing.
			chooseService(h.content, t("web.serviceQuartz"));
			assert.equal(h.memory.value.service, "quartz");
			assert.equal(row(h.content, t("web.rowNote")).mark, "warning");
			assert.ok(hasAction(h.content, t("web.update")));
		} finally {
			h.destroy();
		}
	});

	it("says the files are another device's, and that Update now takes them over", async () => {
		// The device that set the site up, with callouts of its own.
		const first = mount({
			memory: { service: "quartz" },
			callouts: (registry) => registry.update("tip", { colorLight: "#ff00ff" }),
			webFiles: webFileMemory(),
		});
		let second: Mounted | undefined;
		try {
			await until(() => drawn(first.content), "the first device's panel");
			press(action(first.content, t("web.writeNote")));
			await until(() => row(first.content, t("web.rowNote")).mark === "seen", "Quartz as written");
			const written = [...first.files].filter(([path]) => path === QUARTZ_NOTE_NAME);
			assert.equal(written.length, 1);

			// A second device, with the plugin's callouts as installed, which the
			// first one's files reach through a sync.
			second = mount({
				memory: { service: "quartz" },
				files: Object.fromEntries(written),
				webFiles: webFileMemory(),
			});
			await until(() => drawn(second!.content), "the second device's panel");
			const theirs = row(second.content, t("web.rowNote"));
			assert.equal(theirs.mark, "warning");
			assert.ok(theirs.text.includes(t("web.statusElsewhere")));
			assert.ok(hasAction(second.content, t("web.update")));
			assert.deepEqual(second.writes, [], "looking writes nothing");
		} finally {
			first.destroy();
			second?.destroy();
		}
	});

	it("keeps every step on the page in its place, done, gone or mended", async () => {
		const h = mount({ memory: { service: "quartz" } });
		try {
			await until(() => drawn(h.content), "the panel");
			// Quartz publishes nothing by hand: the file, the plugin, and "all done".
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: todo`,
				`${t("web.rowQuartzPlugin")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			const plugin = wordsOf(row(h.content, t("web.rowQuartzPlugin")).el);

			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "Quartz as written");
			// Done, and still there with its words.
			assert.ok(row(h.content, t("web.rowNote")).text.includes(t("web.filesNote")));
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: seen`,
				`${t("web.rowQuartzPlugin")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			assert.deepEqual(wordsOf(row(h.content, t("web.rowDone")).el), [t("web.doneQuartz")]);

			// Out of date: the step says so where it is, and every step stays where it was.
			h.edit(QUARTZ_NOTE_NAME, olderQuartzNote());
			await until(() => markAt(h.content, t("web.rowNote")) === "warning", "the file out of date");
			assert.ok(row(h.content, t("web.rowNote")).text.includes(t("web.statusStale")));
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: warning`,
				`${t("web.rowQuartzPlugin")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);

			// Mended, without a question: the file was ours.
			press(action(h.content, t("web.update")));
			await until(() => markAt(h.content, t("web.rowNote")) === "seen", "the file current again");

			// Gone: its step offers to create it again, and the plugin's step says what it said.
			h.remove(QUARTZ_NOTE_NAME);
			await until(() => markAt(h.content, t("web.rowNote")) === "todo", "the file gone");
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: todo`,
				`${t("web.rowQuartzPlugin")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			assert.deepEqual(wordsOf(row(h.content, t("web.rowQuartzPlugin")).el), plugin);
		} finally {
			h.destroy();
		}
	});

	it("has no way to fold a step: a heading is only a heading, and every box stays open", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const plugin = row(h.content, t("web.rowGardenPlugin"));
			// Nothing to press, nothing for the keyboard to stop at, nothing that says a box can shut.
			const steps = h.content.querySelector(".cs-web-rows");
			assert.ok(steps);
			for (const attribute of ["role", "tabindex", "aria-expanded"]) {
				assert.equal(plugin.head.getAttribute(attribute), null, `a heading has no ${attribute}`);
			}
			assert.equal(plugin.head.dataset.csKey, undefined);
			assert.equal(steps.querySelectorAll("[tabindex]").length, 0, "no stop for the keyboard but the controls");
			assert.equal(steps.querySelectorAll("[inert]").length, 0);
			for (const hook of [".cs-web-row-arrow", ".cs-web-row-fold", ".cs-web-row-clip"]) {
				assert.equal(steps.querySelector(hook), null, `${hook} is gone`);
			}

			// A press and a key on a heading do nothing, and draw nothing again.
			press(plugin.head);
			for (const key of ["Enter", " "]) {
				plugin.head.fire("keydown", {
					type: "keydown",
					key,
					preventDefault: () => assert.fail("a key was claimed"),
				});
			}
			const same = row(h.content, t("web.rowGardenPlugin"));
			assert.equal(same.head, plugin.head);
			assert.ok(rows(h.content).every((entry) => entry.box !== null && !entry.el.hasClass("is-collapsed")));
			assert.ok(same.text.includes(t("web.stepGardenSearch")));
		} finally {
			h.destroy();
		}
	});

	it("keeps the keyboard's place when the panel is drawn again, on the first control of the steps where its own went", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			// The button that writes goes once the note is written: the first control of the steps gets the keyboard.
			const write = action(h.content, t("web.writeNote"));
			write.focus();
			press(write);
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			assert.equal(fakeDom.document.activeElement, action(h.content, t("web.actionOpenNote")));

			// A button that is still there after a drawing keeps the keyboard.
			const open = action(h.content, t("web.actionOpenNote"));
			open.focus();
			h.emit("modify", GARDEN_NOTE_PATH);
			await until(() => action(h.content, t("web.actionOpenNote")) !== open, "the panel drawn again");
			assert.equal(fakeDom.document.activeElement, action(h.content, t("web.actionOpenNote")));
		} finally {
			h.destroy();
		}
	});

	it("ends with the steps: no line under them", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const scroll = h.content.querySelector(".cs-web-scroll");
			assert.ok(scroll);
			assert.ok(scroll.children[scroll.children.length - 1]?.hasClass("cs-web-rows"));
		} finally {
			h.destroy();
		}
	});

	it("ends the settings' offer for every service the vault points at, and has them drawn again", async () => {
		const h = mount({ plugins: ["quartz-syncer"], files: { "publish.css": "" }, memory: { offered: ["garden"] } });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.deepEqual(h.memory.value.offered, ["garden", "quartz", "publish"]);
			assert.equal(h.settingsUpdates(), 1);
		} finally {
			h.destroy();
		}
	});

	it("asks the settings for nothing when there was no offer to end", async () => {
		const h = mount({ memory: { service: "quartz" } });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.equal(h.settingsUpdates(), 0);
			assert.equal(h.memory.value.offered, undefined);
		} finally {
			h.destroy();
		}
	});
});

describe("the panel for Quartz", () => {
	it("asks which Quartz it is where the configuration is outside the vault, and shows that version's steps", async () => {
		const h = mount({ plugins: ["quartz-syncer"] });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.equal(serviceShown(h.content), t("web.serviceQuartz"));
			const version = versionList(h.content);
			assert.ok(version, "the Quartz version's list");
			assert.equal(version.getValue(), "4");
			const plugin = row(h.content, t("web.rowQuartzPlugin"));
			assert.deepEqual(
				copies(plugin.el).map((entry) => entry.code),
				[ADD4, IMPORT_LINE, "CalloutStudio(),"],
			);
			// A terminal, the command, the two lines Quartz 4 needs, and what to commit.
			const steps = stepsOf(plugin.el);
			assert.equal(steps.length, 5);
			assert.equal(
				steps[0],
				t("web.stepQuartzTerminal", { file: "quartz.config.ts" }),
				"no button to show it by",
			);
			assert.ok(steps[1]?.startsWith(t("web.stepQuartzRun")));
			assert.ok(steps[2]?.startsWith(t("web.stepQuartz4Import")));
			assert.ok(steps[3]?.startsWith(t("web.stepQuartz4Use")));
			assert.equal(steps[4], t("web.stepQuartz4Commit"));
			// Nothing about ignorePatterns: the file is in a folder Quartz does not publish.
			assert.ok(!plugin.text.includes("ignorePatterns"));

			version.select("5");
			assert.equal(h.memory.value.quartzVersion, 5);
			const five = row(h.content, t("web.rowQuartzPlugin"));
			assert.deepEqual(
				copies(five.el).map((entry) => entry.code),
				[ADD5],
			);
			assert.deepEqual(stepsOf(five.el), [
				t("web.stepQuartzTerminal", { file: "quartz.config.yaml" }),
				`${t("web.stepQuartzRun")}${ADD5}`,
				t("web.stepQuartz5Commit"),
			]);
			assert.equal(versionList(h.content)?.getValue(), "5");
			assert.deepEqual(h.writes, [], "choosing a version writes nothing");
			// The file is the same for both: at the top of the vault here.
			assert.ok(row(h.content, t("web.rowNote")).text.includes(t("web.filesNote")));
		} finally {
			h.destroy();
		}
	});

	it("says how to tell the versions apart in a ? that is only pointed at: no sentence under the line, and nothing to press", async () => {
		const h = mount({ plugins: ["quartz-syncer"] });
		try {
			await until(() => drawn(h.content), "the panel");
			const sentence = t("web.quartzVersionDesc");
			const marks = (): FakeElement[] => h.content.querySelectorAll(".cs-web-version .cs-web-help");
			const shown = (): number =>
				h.content.querySelectorAll(".cs-web-row-text").filter((el) => el.textContent === sentence).length;

			assert.equal(marks().length, 1, "one ? beside the question");
			const [mark] = marks();
			assert.equal(mark?.dataset.csTooltip, sentence, "pointed at, it says it");
			assert.equal(mark?.getAttribute("aria-label"), sentence, "and it says it to a screen reader");
			assert.equal(shown(), 0, "the sentence does not stand under the line");

			// It is not a button: not Obsidian's icon button, not in the keyboard's order, not expandable.
			// (`role="img"`, like the triangle after a service's name.)
			assert.ok(!mark?.hasClass("clickable-icon"));
			assert.equal(mark?.getAttribute("tabindex"), null);
			assert.equal(mark?.getAttribute("aria-expanded"), null);
			assert.equal(h.content.querySelectorAll(".cs-web-version button").length, 0);

			// The panel is drawn whole when anything changes; the ? is drawn again with it.
			versionList(h.content)?.select("5");
			assert.equal(marks().length, 1);
			assert.equal(shown(), 0);
			assert.deepEqual(h.writes, [], "asking writes nothing");
		} finally {
			h.destroy();
		}
	});

	for (const version of [4, 5] as const) {
		it(`Quartz ${version}: lets the plugin be installed before the file is written too, with nothing to wait for`, async () => {
			const h = mount({ memory: { service: "quartz", quartzVersion: version } });
			try {
				await until(() => drawn(h.content), "the panel");
				const before = row(h.content, t("web.rowQuartzPlugin"));
				assert.equal(before.mark, "todo");
				const words = wordsOf(before.el);
				// Not held back: every line can be copied.
				const lines = copies(before.el);
				assert.equal(lines.length, version === 5 ? 1 : 3);
				assert.ok(lines.every((entry) => copyWorks(entry.button)));

				press(action(h.content, t("web.writeNote")));
				await until(() => row(h.content, t("web.rowNote")).mark === "seen", "Quartz as written");
				assert.deepEqual(h.writes, [QUARTZ_NOTE_NAME], "one note, of data, and no code");
				const after = row(h.content, t("web.rowQuartzPlugin"));
				assert.equal(after.mark, "todo");
				assert.deepEqual(wordsOf(after.el), words, "saying what it said before");
				// Nothing is published by hand: every build reads the file, as the last step says.
				assert.equal(markAt(h.content, t("web.rowDone")), "clear");
				assert.ok(row(h.content, t("web.rowDone")).text.includes(t("web.doneQuartz")));
				assert.equal(summary(h.content), "");
				assert.equal(serviceSign(h.content, t("web.serviceQuartz")), undefined);
			} finally {
				h.destroy();
			}
		});
	}

	it("Quartz 4: reads the configuration where it is in the vault, and says what it found", async () => {
		const h = mount({ files: { "quartz.config.ts": quartz4Config("", ["Plugin.Description(),"]) } });
		try {
			await until(() => drawn(h.content), "the panel");
			// The vault is the Quartz repository: found, and its file goes under content/.
			assert.equal(serviceShown(h.content), t("web.serviceQuartz"));
			assert.equal(h.memory.value.quartzInVault, true);
			assert.equal(versionList(h.content), undefined, "the file says which Quartz it is");
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "Quartz as written");
			assert.deepEqual(h.writes, [`content/${QUARTZ_NOTE_NAME}`]);
			assert.ok(row(h.content, t("web.rowNote")).text.includes(t("web.filesNote")));

			const before = row(h.content, t("web.rowQuartzPlugin"));
			assert.equal(before.mark, "todo");
			assert.ok(before.text.includes(t("web.quartzNone", { file: "quartz.config.ts" })));

			// Half done: the panel says which half.
			h.edit("quartz.config.ts", quartz4Config(IMPORT_LINE, ["Plugin.Description(),"]));
			await until(
				() =>
					row(h.content, t("web.rowQuartzPlugin")).text.includes(
						t("web.quartzNoUse", { file: "quartz.config.ts" }),
					),
				"the missing call",
			);
			assert.equal(row(h.content, t("web.rowQuartzPlugin")).mark, "todo");

			// In the wrong place: a build would not stop for it, so the panel does.
			h.edit("quartz.config.ts", quartz4Config(IMPORT_LINE, ["Plugin.Description(),", "CalloutStudio(),"]));
			await until(() => row(h.content, t("web.rowQuartzPlugin")).mark === "warning", "the misplaced call");
			assert.ok(
				row(h.content, t("web.rowQuartzPlugin")).text.includes(
					t("web.quartzMisplaced", { file: "quartz.config.ts" }),
				),
			);

			h.edit("quartz.config.ts", quartz4Config(IMPORT_LINE, ["CalloutStudio(),", "Plugin.Description(),"]));
			await until(() => markAt(h.content, t("web.rowQuartzPlugin")) === "seen", "the configuration as right");
			assert.equal(summary(h.content), "");
			// Seen, and still showing its steps: a step says the same once it is done.
			const seen = row(h.content, t("web.rowQuartzPlugin"));
			assert.ok(seen.text.includes(t("web.quartzOk", { file: "quartz.config.ts" })));
			assert.equal(copies(seen.el).length, 3);

			// The file goes: its step offers to create it again, and nothing says
			// the build is broken, since it is not: the plugin builds without it.
			h.remove(`content/${QUARTZ_NOTE_NAME}`);
			await until(() => markAt(h.content, t("web.rowNote")) === "todo", "the file gone");
			assert.equal(markAt(h.content, t("web.rowQuartzPlugin")), "seen");
			assert.equal(fieldSign(h.content), undefined);
		} finally {
			h.destroy();
		}
	});

	it("Quartz 5: reads quartz.config.yaml, and says when the entry is switched off", async () => {
		const yaml = (enabled: boolean): string =>
			`plugins:\n${QUARTZ5_ENTRY.replace("enabled: true", `enabled: ${String(enabled)}`)}\n`;
		const h = mount({ files: { "quartz.config.yaml": yaml(false) }, memory: { quartzVersion: 4 } });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.equal(versionList(h.content), undefined);
			const off = row(h.content, t("web.rowQuartzPlugin"));
			assert.equal(off.mark, "warning");
			assert.ok(off.text.includes(t("web.quartzOff", { file: "quartz.config.yaml" })));
			// The file is Quartz 5's, whatever this device chose before: its command is shown.
			assert.deepEqual(
				copies(off.el).map((entry) => entry.code),
				[ADD5],
			);

			h.edit("quartz.config.yaml", yaml(true));
			await until(() => markAt(h.content, t("web.rowQuartzPlugin")) === "seen", "the entry as switched on");
			assert.ok(
				row(h.content, t("web.rowQuartzPlugin")).text.includes(
					t("web.quartzOk", { file: "quartz.config.yaml" }),
				),
			);

			// The entry a site had before 2026-11-17 named the vault's own folder: that is not the plugin.
			h.edit("quartz.config.yaml", "plugins:\n  - source: ./content/callout-studio-quartz\n    enabled: true\n");
			await until(
				() =>
					row(h.content, t("web.rowQuartzPlugin")).text.includes(
						t("web.quartzNone", { file: "quartz.config.yaml" }),
					),
				"the old entry, not the plugin",
			);
		} finally {
			h.destroy();
		}
	});

	it("says nothing is wrong where the plugin is installed and the file is not written yet: the site builds as before", async () => {
		const h = mount({
			files: { "quartz.config.ts": quartz4Config(IMPORT_LINE, ["CalloutStudio(),", "Plugin.Description(),"]) },
		});
		try {
			await until(() => drawn(h.content), "the panel");
			assert.equal(row(h.content, t("web.rowNote")).mark, "todo");
			assert.equal(row(h.content, t("web.rowQuartzPlugin")).mark, "seen");
			assert.equal(fieldSign(h.content), undefined);
			assert.equal(summary(h.content), t("web.summaryNone"));
		} finally {
			h.destroy();
		}
	});

	it("copies a line with the Copy button at the end of its well", async () => {
		// Node's own `navigator` is a getter-only accessor: redefined for this
		// test, and put back after it.
		const copied: string[] = [];
		const before = Object.getOwnPropertyDescriptor(globalThis, "navigator");
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: {
				clipboard: {
					writeText: (text: string) => {
						copied.push(text);
						return Promise.resolve();
					},
				},
			},
		});
		const h = mount({ memory: { service: "quartz", quartzVersion: 4 } });
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "Quartz as written");
			const lines = copies(row(h.content, t("web.rowQuartzPlugin")).el);
			assert.equal(lines.length, 3, "one button per line");
			// In the well, after the line: beside the sentence it read as copying the sentence.
			assert.equal(lines[0]!.button.parentElement, lines[0]!.well);
			assert.equal(lines[0]!.well.children[lines[0]!.well.children.length - 1], lines[0]!.button);
			assert.ok(copyWorks(lines[0]!.button));
			press(lines[0]!.button);
			await until(() => lastNotice() === t("notice.webCopied"), "the line as copied");
			assert.deepEqual(copied, [ADD4]);
		} finally {
			h.destroy();
			if (before) Object.defineProperty(globalThis, "navigator", before);
		}
	});

	it("Quartz: asks for its note to be read, says what to do where a plugin publishes chosen notes, and opens it", async () => {
		const h = mount({ memory: { service: "quartz" }, internals: { reveal: true } });
		try {
			await until(() => drawn(h.content), "the panel");
			// Nothing in the vault publishes the notes: three steps, and a line for a plugin this one does not know.
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: todo`,
				`${t("web.rowQuartzPlugin")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "Quartz as written");
			const note = row(h.content, t("web.rowNote"));
			assert.deepEqual(wordsOf(note.el), [t("web.filesNote"), t("web.noteChooseToo")]);
			assert.ok(!note.text.includes(t("web.filesPublish")), "Publish's words are Publish's");
			assert.ok(hasAction(note.el, t("web.actionOpenNote")), "a note opens, as the garden's does");
			assert.equal(hasAction(note.el, t("web.actionRevealFinder")), false);
			assert.ok(row(h.content, t("web.rowDone")).text.includes(t("web.doneQuartz")));
			await until(() => h.tabs.some((tab) => tab.file === QUARTZ_NOTE_NAME), "the note opened");
			assert.match(
				h.files.get(QUARTZ_NOTE_NAME) ?? "",
				/^---\ndraft: true\ncallout-studio-quartz: 1\n---\n# READ THIS\n/,
			);
		} finally {
			h.destroy();
		}
	});

	it("leads to Digital Garden's own plugin list in two steps, before the note is written too", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const plugin = row(h.content, t("web.rowGardenPlugin"));
			// Installing it first does no harm, so its step never waits.
			assert.equal(plugin.mark, "todo");
			// No Digital Garden in this vault to open: the first step says where to go, in words.
			assert.deepEqual(stepsOf(plugin.el), [t("web.stepGardenOpenPlugins"), t("web.stepGardenSearch")]);
			// The only address is the fallback's, for a plugin the list does not show yet.
			assert.deepEqual(
				copies(plugin.el).map((c) => c.code),
				[GARDEN_PLUGIN_REPO_URL],
			);
			assert.deepEqual(wordsOf(plugin.el), [...stepsOf(plugin.el), t("web.gardenNotListed")]);
		} finally {
			h.destroy();
		}
	});

	it("puts the button first and why the note is needed under it, after a hairline, in every state of the note", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			// The step's lines, in order: the buttons' line, then the sentence's own line.
			const lines = () => {
				const box = row(h.content, t("web.rowNote")).box;
				const found = box?.querySelectorAll(".cs-web-line") ?? [];
				assert.equal(found.length, 2, "the buttons and the sentence are on two lines");
				assert.equal(box?.querySelectorAll(".cs-web-row-actions").length, 1);
				return [found[0] as FakeElement, found[1] as FakeElement] as const;
			};
			const buttons = (line: FakeElement) =>
				line.querySelector(".cs-web-row-actions")?.children.map((el) => el.textContent);

			// Not written yet: Create note, then the sentence under it.
			let [first, second] = lines();
			assert.deepEqual(buttons(first), [t("web.writeNote")]);
			assert.equal(second.textContent, t("web.filesNote"));
			assert.ok(second.querySelector(".cs-web-row-text"), "the words can be selected and copied like the others");
			// It is the step's only sentence, and nothing of it stands above the button.
			assert.deepEqual(wordsOf(row(h.content, t("web.rowNote")).el), [t("web.filesNote")]);

			// Written: Open note, then the same sentence.
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			[first, second] = lines();
			assert.deepEqual(buttons(first), [t("web.actionOpenNote")]);
			assert.equal(second.textContent, t("web.filesNote"));

			// Changed by hand: what is wrong comes first, then both buttons, then the sentence's line.
			h.edit(GARDEN_NOTE_PATH, "---\ndg-publish: true\n" + GARDEN_NOTE_KEY + ": 1\n---\nwritten over by hand\n");
			await until(() => hasAction(h.content, t("web.update")), "the note as changed by hand");
			[first, second] = lines();
			assert.deepEqual(buttons(first), [t("web.update"), t("web.actionOpenNote")]);
			assert.ok(first.children[0]?.hasClass("is-warning"), "the warning stands above the buttons");
			assert.ok(first.children[first.children.length - 1]?.hasClass("cs-web-row-actions"));
			assert.equal(second.textContent, t("web.filesNote"));
		} finally {
			h.destroy();
		}
	});

	it("writes the note on Create note, opens it beside the panel, and then lets it be published", async () => {
		const h = mount({ memory: { service: "garden" }, emptyTab: true });
		try {
			await until(() => drawn(h.content), "the panel");
			const before = row(h.content, t("web.rowNote"));
			assert.deepEqual(wordsOf(before.el), [t("web.filesNote")]);
			assert.ok(!before.text.includes(t("web.filesPublish")), "a note is in the file list");
			assert.equal(hasAction(h.content, t("web.actionOpenNote")), false, "no note to open yet");
			press(action(h.content, t("web.writeNote")));
			await until(() => h.tabs[0]?.file === GARDEN_NOTE_PATH, "the note in a tab");
			assert.deepEqual(h.writes, [GARDEN_NOTE_PATH]);
			assert.ok(h.files.get(GARDEN_NOTE_PATH)?.startsWith(`---\ndg-publish: true\n${GARDEN_NOTE_KEY}: 1\n---\n`));
			// In Reading view, in the empty tab, and the panel keeps the keyboard.
			assert.deepEqual(h.tabs, [{ file: GARDEN_NOTE_PATH, mode: "preview", active: true }]);
			assert.equal(h.focused(), false);
			// Done, with the same words: only its button changed, Create note to Open note.
			const after = row(h.content, t("web.rowNote"));
			assert.deepEqual(wordsOf(after.el), [t("web.filesNote")]);
			assert.equal(hasAction(h.content, t("web.writeNote")), false);
			assert.ok(hasAction(h.content, t("web.actionOpenNote")));

			// Publishing no longer waits: the note is there to publish.
			const ready = row(h.content, t("web.siteNote"));
			assert.equal(ready.mark, "todo");
			assert.deepEqual(stepsOf(ready.el), [
				t("web.stepGardenOpenCenter"),
				t("web.stepGardenPublish", { note: "callout-studio-web" }),
			]);
		} finally {
			h.destroy();
		}
	});

	it("says the note was changed by hand, names the others, and Update now replaces it", async () => {
		const edited = `---\ndg-publish: true\n${GARDEN_NOTE_KEY}: 1\n---\nwritten over by hand\n`;
		const h = mount({
			memory: { service: "garden" },
			files: { [GARDEN_NOTE_PATH]: edited },
			notes: { [GARDEN_NOTE_PATH]: { [GARDEN_NOTE_KEY]: 1 }, "drafts/copy.md": { [GARDEN_NOTE_KEY]: 1 } },
		});
		try {
			await until(() => drawn(h.content), "the panel");
			const note = row(h.content, t("web.rowNote"));
			assert.equal(note.mark, "warning");
			// Said in the step, whose heading is its number as always, and by a triangle in the list.
			assert.equal(note.number, "1.");
			assert.equal(fieldSign(h.content), "warning");
			assert.ok(note.text.includes(t("web.statusEdited")));
			assert.ok(note.text.includes(t("web.statusDuplicates", { key: GARDEN_NOTE_KEY, files: "drafts/copy.md" })));
			// A garden cannot read it, which the note's step says; publishing is not held back.
			assert.equal(markAt(h.content, t("web.siteNote")), "todo");

			// Nothing in it is worth a question: its body is only the callouts.
			press(action(h.content, t("web.update")));
			await until(() => !hasAction(h.content, t("web.update")), "the note as up to date");
			assert.deepEqual(h.writes, [GARDEN_NOTE_PATH], "the other note is left alone");
			assert.ok(
				h.files
					.get(GARDEN_NOTE_PATH)
					?.startsWith(`---\ndg-publish: true\n${GARDEN_NOTE_KEY}: 1\n---\n# READ THIS\n\n> [!question]`),
			);
			assert.equal(row(h.content, t("web.siteNote")).mark, "todo");
		} finally {
			h.destroy();
		}
	});

	it("says the note is switched off for publishing, and answers when it is switched on again", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.writeNote")));
			await until(() => markAt(h.content, t("web.rowNote")) === "seen", "the note as written");
			const written = h.files.get(GARDEN_NOTE_PATH)!;

			h.edit(GARDEN_NOTE_PATH, written.replace("dg-publish: true", "dg-publish: false"));
			await until(() => markAt(h.content, t("web.rowNote")) === "warning", "the note as switched off");
			assert.ok(row(h.content, t("web.rowNote")).text.includes(t("web.noteSwitchedOff")));
			// Nothing to update: the note's own text is as it should be. Opening it is the way to its properties.
			assert.equal(hasAction(h.content, t("web.update")), false);
			assert.ok(hasAction(h.content, t("web.actionOpenNote")));
			assert.equal(markAt(h.content, t("web.siteNote")), "todo", "publishing is not held back");

			h.edit(GARDEN_NOTE_PATH, written);
			await until(() => markAt(h.content, t("web.rowNote")) === "seen", "the note as switched on");
		} finally {
			h.destroy();
		}
	});

	it("follows a note the user moved: its Open note button and its publishing step name it", async () => {
		const h = mount({ memory: { service: "garden" } });
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			const text = h.files.get(GARDEN_NOTE_PATH)!;
			h.destroy();

			// The same vault later, the note moved to the top and renamed.
			const moved = mount({
				memory: { service: "garden" },
				files: { "my-callouts.md": text },
				notes: { "my-callouts.md": { [GARDEN_NOTE_KEY]: 1 } },
			});
			try {
				await until(() => drawn(moved.content), "the panel");
				assert.equal(row(moved.content, t("web.rowNote")).mark, "seen");
				press(action(moved.content, t("web.actionOpenNote")));
				await until(() => moved.tabs.some((tab) => tab.file === "my-callouts.md"), "the moved note in a tab");
				assert.ok(
					row(moved.content, t("web.siteNote")).text.includes(
						t("web.stepGardenPublish", { note: "my-callouts" }),
					),
				);
			} finally {
				moved.destroy();
			}
		} finally {
			h.destroy();
		}
	});
});

describe("the panel for Obsidian Publish", () => {
	it("asks for a custom domain with a button to Obsidian's help, and lets the files be published either way", async () => {
		const opened: string[] = [];
		const win = fakeDom.window as unknown as { open?: (url: string) => void };
		win.open = (url: string) => void opened.push(url);
		const h = mount({ plugins: [], files: { ".obsidian/publish.json": "{}" } });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.equal(serviceShown(h.content), t("web.servicePublish"));
			const domain = row(h.content, t("web.rowPublishDomain"));
			assert.equal(domain.mark, "todo");
			assert.ok(domain.text.includes(t("web.stepPublishDomain")));
			// The reason is a "?" after the sentence, said when it is pointed at.
			assert.ok(!domain.text.includes(t("web.stepPublishDomainWhy")));
			const mark = domain.el.querySelectorAll(".cs-web-help");
			assert.equal(mark.length, 1, 'one "?" after the sentence');
			assert.equal(mark[0]?.getAttribute("aria-label"), t("web.stepPublishDomainWhy"));
			assert.equal(copies(domain.el).length, 0, "nothing to paste anywhere");
			press(action(domain.el, t("web.stepPublishDomainLink")));
			await until(() => opened.length > 0, "the help page");
			assert.deepEqual(opened, ["https://obsidian.md/help/publish/domains"]);

			press(action(h.content, t("web.write")));
			await until(() => row(h.content, t("web.rowFiles")).mark === "seen", "the files as written");
			// Block callouts work on any address, so publishing does not wait for the domain.
			const site = row(h.content, t("web.siteFiles"));
			assert.equal(site.mark, "todo");
			assert.deepEqual(standing(h.content), [
				`${t("web.rowFiles")}: seen`,
				`${t("web.rowPublishDomain")}: todo`,
				`${t("web.siteFiles")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			// The Publish core plugin is off here: its step is said in words.
			assert.deepEqual(stepsOf(site.el), [t("web.stepPublishOpen"), t("web.stepPublishSelect")]);
			assert.deepEqual(
				wordsOf(site.el),
				[t("web.stepPublishOpen"), t("web.stepPublishSelect")],
				"nothing after the steps",
			);
		} finally {
			h.destroy();
			delete win.open;
		}
	});

	it("asks for no custom domain while heading and inline callouts are both off", async () => {
		const h = mount({ memory: { service: "publish" } });
		try {
			h.registry.settings.headingCallouts.enabled = false;
			h.registry.settings.inlineCallouts.enabled = false;
			await until(() => drawn(h.content), "the panel");
			const domain = row(h.content, t("web.rowPublishDomain"));
			assert.equal(domain.mark, "clear");
			assert.equal(domain.number, "2.", "still a step, in its place");
			assert.ok(domain.text.includes(t("web.domainNotNeeded")));
		} finally {
			h.destroy();
		}
	});

	it("keeps what is the user's in publish.js, and keeps it when the files are rewritten after a change", async () => {
		const own = "console.log('mine');\n";
		const h = mount({ memory: { service: "publish" }, files: { [PUBLISH_JS]: own }, webFiles: webFileMemory() });
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.write")));
			await until(() => row(h.content, t("web.rowFiles")).mark === "seen", "the files as written");
			assert.ok(h.files.get(PUBLISH_JS)?.startsWith(own), "the rest of the file is left as it is");
			const { head, text: words } = row(h.content, t("web.siteFiles"));
			const written = h.files.get(PUBLISH_CSS);

			// A colour is in publish.css; publish.js keeps the user's part either way.
			h.registry.update("tip", { colorLight: "#ff00ff" });
			await exportWebTarget(h.app, h.host, "publish", { auto: true });
			assert.notEqual(h.files.get(PUBLISH_CSS), written, "the files were rewritten");
			assert.ok(h.files.get(PUBLISH_JS)?.startsWith(own), "and the user's part kept");
			h.refreshed();
			await until(() => row(h.content, t("web.siteFiles")).head !== head, "the panel drawn again");
			// Current again, and the step that publishes says what it said: the last step says to publish again.
			assert.equal(markAt(h.content, t("web.rowFiles")), "seen");
			assert.equal(row(h.content, t("web.siteFiles")).text, words);
		} finally {
			h.destroy();
		}
	});
});

describe("the panel's buttons that lead somewhere else", () => {
	/** The button's words for showing a file in the system's file manager, as this test run's platform has them. */
	const revealWords = (): string => (Platform.isMacOS ? t("web.actionRevealFinder") : t("web.actionReveal"));

	it("names the garden plugin by the id its own manifest gives it", () => {
		const manifest = JSON.parse(
			readFileSync(join(process.cwd(), "web-plugins", "digital-garden", "garden-plugin.json"), "utf8"),
		) as {
			id: string;
		};
		assert.equal(GARDEN_PLUGIN_ID, manifest.id);
	});

	it("Digital Garden: opens its garden plugins with ours selected, then its Notes tab to publish the note", async () => {
		const h = mount({ memory: { service: "garden" }, internals: { garden: "current" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const plugin = row(h.content, t("web.rowGardenPlugin"));
			// The first smaller step is the button alone, on a line of its own, with no number.
			assert.deepEqual(stepsOf(plugin.el), [t("web.actionGardenPlugins"), t("web.stepGardenSearch")]);
			// And nothing else but the fallback under them: no box to tick, and no number on it.
			assert.deepEqual(
				plugin.el.querySelectorAll(".cs-web-line").map((el) => el.textContent),
				[...stepsOf(plugin.el), `${t("web.gardenNotListed")}${GARDEN_PLUGIN_REPO_URL}`],
			);
			assert.deepEqual(
				copies(plugin.el).map((c) => c.code),
				[GARDEN_PLUGIN_REPO_URL],
			);
			const open = action(plugin.el, t("web.actionGardenPlugins"));
			assert.equal(open.hasClass("mod-cta"), false, "only the button that writes is the accent");
			press(open);
			await until(() => h.ran.length > 0, "Digital Garden asked");
			assert.deepEqual(h.ran, [`garden plugins ${GARDEN_PLUGIN_ID}`]);

			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			const site = row(h.content, t("web.siteNote"));
			assert.deepEqual(stepsOf(site.el), [
				t("web.actionPublicationCenter"),
				t("web.stepGardenPublish", { note: "callout-studio-web" }),
			]);
			press(action(site.el, t("web.actionPublicationCenter")));
			await until(() => h.ran.length > 1, "the Publication Center asked for");
			assert.equal(h.ran[1], "publication center notes");
			assert.deepEqual(h.writes, [GARDEN_NOTE_PATH], "a button that leads elsewhere writes nothing");
		} finally {
			h.destroy();
		}
	});

	it("Digital Garden: where it is not installed, a box with no number comes before step 1, and the steps keep their numbers", async () => {
		const missing = mount({ memory: { service: "garden" } });
		const there = mount({ memory: { service: "garden" }, internals: { garden: "current" } });
		try {
			await until(() => drawn(missing.content) && drawn(there.content), "both panels");
			const prerequisite = missing.content.querySelector(".cs-web-prereq");
			assert.ok(prerequisite, "the box before the steps");
			assert.match(prerequisite.textContent, new RegExp(t("web.prereqTitle")));
			assert.equal(prerequisite.querySelector(".cs-web-row-number"), null, "it has no number");
			assert.equal(there.content.querySelector(".cs-web-prereq"), null, "nothing to say where it is installed");
			const numbers = (content: FakeElement) => rows(content).map((entry) => entry.number);
			assert.deepEqual(numbers(missing.content), numbers(there.content), "the numbers do not move");
			assert.equal(numbers(missing.content)[0], "1.");
		} finally {
			missing.destroy();
			there.destroy();
		}
	});

	it("Digital Garden: an older one opens its Publication Center by its command, and the step says where to go in it", async () => {
		const h = mount({ memory: { service: "garden" }, internals: { garden: "older" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const plugin = row(h.content, t("web.rowGardenPlugin"));
			assert.equal(
				stepsOf(plugin.el)[0],
				`${t("web.actionPublicationCenter")}${t("web.stepGardenGoPlugins")}`,
				"the button, then where to go",
			);
			press(action(plugin.el, t("web.actionPublicationCenter")));
			await until(() => h.ran.length > 0, "the command run");
			assert.deepEqual(h.ran, ["command digitalgarden:dg-open-publish-modal"]);
		} finally {
			h.destroy();
		}
	});

	it("says so, and puts the step back in words, when Digital Garden was turned off after the panel was drawn", async () => {
		Notice.last = null;
		const h = mount({ memory: { service: "garden" }, internals: { garden: "current" } });
		try {
			await until(() => drawn(h.content), "the panel");
			const open = action(h.content, t("web.actionGardenPlugins"));
			h.turnOffGarden();
			press(open);
			await until(() => lastNotice() === t("web.actionFailed"), "the notice");
			assert.deepEqual(h.ran, []);
			assert.equal(stepsOf(row(h.content, t("web.rowGardenPlugin")).el)[0], t("web.stepGardenOpenPlugins"));
		} finally {
			h.destroy();
		}
	});

	it("Obsidian Publish: shows the files the file list hides, and opens Publish changes", async () => {
		const h = mount({
			memory: { service: "publish" },
			internals: { commands: ["publish:view-changes"], reveal: true },
		});
		try {
			await until(() => drawn(h.content), "the panel");
			// Nothing to show before there are files.
			assert.equal(hasAction(h.content, revealWords()), false);
			press(action(h.content, t("web.write")));
			await until(() => row(h.content, t("web.rowFiles")).mark === "seen", "the files as written");
			// Once there are files, the step's button shows them.
			press(action(row(h.content, t("web.rowFiles")).el, revealWords()));
			await until(() => h.ran.length > 0, "the file shown");
			assert.deepEqual(h.ran, [`reveal ${PUBLISH_JS}`]);

			const site = row(h.content, t("web.siteFiles"));
			assert.deepEqual(stepsOf(site.el), [t("web.actionPublishChanges"), t("web.stepPublishSelect")]);
			press(action(site.el, t("web.actionPublishChanges")));
			await until(() => h.ran.length > 1, "the command run");
			assert.equal(h.ran[1], "command publish:view-changes");
		} finally {
			h.destroy();
		}
	});

	it("Quartz: shows the site's folder by its configuration file where it is in the vault, and not the hidden file", async () => {
		const h = mount({
			files: { "quartz.config.ts": quartz4Config("", ["Plugin.Description(),"]) },
			internals: { reveal: true },
		});
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "Quartz as written");
			assert.equal(hasAction(row(h.content, t("web.rowNote")).el, revealWords()), false);
			const plugin = row(h.content, t("web.rowQuartzPlugin"));
			const words = t("web.stepQuartzTerminal", { file: "quartz.config.ts" });
			// The button comes first, and the words of the step under it, after a hairline.
			const { line, next } = aroundButton(plugin.el, revealWords());
			assert.ok(!line.hasClass("is-step"), "the button is not one of the smaller steps");
			assert.equal(next?.textContent, words);
			assert.equal(stepsOf(plugin.el)[0], words, "the first step is its words alone");
			press(action(plugin.el, revealWords()));
			await until(() => h.ran.length > 0, "the file shown");
			assert.deepEqual(h.ran, ["reveal quartz.config.ts"]);
		} finally {
			h.destroy();
		}
	});

	for (const version of [4, 5] as const) {
		it(`Quartz ${version}: a vault named content shows its own folder, which is where the site is`, async () => {
			const file = version === 5 ? "quartz.config.yaml" : "quartz.config.ts";
			const h = mount({
				vaultName: "Content",
				memory: { service: "quartz", quartzVersion: version },
				internals: { reveal: true },
			});
			try {
				await until(() => drawn(h.content), "the panel");
				const plugin = row(h.content, t("web.rowQuartzPlugin"));
				const words = t("web.stepQuartzTerminal", { file });
				const { line, next } = aroundButton(plugin.el, revealWords());
				assert.equal(line.textContent, revealWords(), "the button on a line of its own");
				assert.ok(!line.hasClass("is-step"), "not one of the smaller steps");
				assert.equal(next?.textContent, words, "the words under it, after a hairline");
				assert.equal(stepsOf(plugin.el)[0], words, "the first step is its words alone");
				press(action(plugin.el, revealWords()));
				await until(() => h.ran.length > 0, "the vault's folder shown");
				// The vault itself: the file manager opens the folder that holds it. Nothing outside it is named.
				assert.deepEqual(h.ran, ["reveal "]);
				assert.deepEqual(h.writes, []);
			} finally {
				h.destroy();
			}
		});
	}

	it("Quartz: says where to open the terminal in words where nothing says where the site is, or nothing can show it", async () => {
		// A vault Quartz reaches some other way: the folder that holds it is not Quartz's.
		const elsewhere = mount({ memory: { service: "quartz", quartzVersion: 5 }, internals: { reveal: true } });
		// A phone: a vault named content, and no file manager to show it in.
		const phone = mount({ vaultName: "content", memory: { service: "quartz", quartzVersion: 5 } });
		try {
			await until(() => drawn(elsewhere.content) && drawn(phone.content), "both panels");
			for (const h of [elsewhere, phone]) {
				const plugin = row(h.content, t("web.rowQuartzPlugin"));
				assert.equal(stepsOf(plugin.el)[0], t("web.stepQuartzTerminal", { file: "quartz.config.yaml" }));
				assert.equal(hasAction(plugin.el, revealWords()), false);
			}
		} finally {
			elsewhere.destroy();
			phone.destroy();
		}
	});
});

describe("opening the panel", () => {
	/** A workspace that hands out one sidebar tab, and the settings window over it. */
	function world(options: { settings?: "none" | "throws"; fails?: true } = {}) {
		const calls: string[] = [];
		const leaf = {
			loadIfDeferred: () => {
				calls.push("load");
				return Promise.resolve();
			},
		};
		const setting =
			options.settings === "none"
				? undefined
				: {
						close: () => {
							calls.push("close settings");
							if (options.settings === "throws") throw new Error("no settings window");
						},
					};
		const app = {
			setting,
			workspace: {
				ensureSideLeaf(type: string, side: string, how: { active: boolean; reveal: boolean }) {
					calls.push(`ensure ${type} ${side} ${String(how.active)} ${String(how.reveal)}`);
					return options.fails ? Promise.reject(new Error("no sidebar")) : Promise.resolve(leaf);
				},
				revealLeaf(shown: unknown) {
					assert.equal(shown, leaf);
					calls.push("reveal");
					return Promise.resolve();
				},
			},
		} as unknown as App;
		return { app, calls };
	}

	it("closes the settings first, then opens one tab of it in the right sidebar and shows it", async () => {
		Notice.last = null;
		const w = world();
		await openWebPanel(w.app);
		assert.deepEqual(w.calls, [
			"close settings",
			// `ensureSideLeaf` brings forward a tab that is already there, rather than a second one.
			`ensure ${WEB_PANEL_VIEW} right true true`,
			"load",
			"reveal",
		]);
		assert.equal(lastNotice(), null, "nothing to say when it worked");
	});

	it("still opens where the settings cannot be closed from here, and says to close them", async () => {
		for (const settings of ["none", "throws"] as const) {
			Notice.last = null;
			const w = world({ settings });
			await openWebPanel(w.app);
			assert.ok(w.calls.includes("reveal"), settings);
			assert.equal(lastNotice(), t("web.closeSettings"), settings);
		}
	});

	it("says so when the sidebar could not be opened, and throws nothing", async () => {
		Notice.last = null;
		const w = world({ fails: true });
		await openWebPanel(w.app);
		assert.equal(lastNotice(), t("web.openFailed"));
	});
});

describe("the Publish to the web panel, for a Quartz site a plugin publishes the notes of", () => {
	const SYNCER_SETTINGS = ".obsidian/plugins/quartz-syncer/data.json";
	const ENVELOPPE_SETTINGS = ".obsidian/plugins/obsidian-mkdocs-publisher/data.json";
	const SYNCER_CENTER = "quartz-syncer:open-publish-modal";

	it("Quartz Syncer: writes the note where it publishes from, switched on, and leads to its Publication Center", async () => {
		const h = mount({
			memory: { service: "quartz" },
			plugins: ["quartz-syncer"],
			files: { [SYNCER_SETTINGS]: JSON.stringify({ vaultPath: "/Public/", publishFrontmatterKey: "publish" }) },
			internals: { commands: [SYNCER_CENTER] },
		});
		try {
			await until(() => drawn(h.content), "the panel");
			assert.deepEqual(standing(h.content), [
				`${t("web.rowNote")}: todo`,
				`${t("web.rowQuartzPlugin")}: todo`,
				`${t("web.siteNote")}: todo`,
				`${t("web.rowDone")}: clear`,
			]);
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			const path = `Public/${QUARTZ_NOTE_NAME}`;
			assert.deepEqual(h.writes, [path]);
			assert.match(h.files.get(path) ?? "", /^---\ndraft: true\npublish: true\ncallout-studio-quartz: 1\n---\n/);
			assert.deepEqual(
				wordsOf(row(h.content, t("web.rowNote")).el),
				[t("web.filesNote")],
				"no line for a plugin it does not know",
			);
			const site = row(h.content, t("web.siteNote"));
			assert.deepEqual(stepsOf(site.el), [
				t("web.actionPublicationCenter"),
				t("web.stepSyncerPublish", { note: "callout-studio-quartz" }),
			]);
			press(action(site.el, t("web.actionPublicationCenter")));
			await until(() => h.ran.includes(`command ${SYNCER_CENTER}`), "Quartz Syncer's window");
			assert.deepEqual(wordsOf(row(h.content, t("web.rowDone")).el), [t("web.doneNote")]);
		} finally {
			h.destroy();
		}
	});

	it("notices Quartz Syncer switched on while the panel is open, once its window has the focus back", async () => {
		const h = mount({ memory: { service: "quartz" } });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.equal(standing(h.content).length, 3, "no plugin publishes the notes: no step to publish");
			// Switched on in Settings, a window of its own: the vault hears nothing.
			h.files.set(".obsidian/community-plugins.json", JSON.stringify(["quartz-syncer"]));
			fakeDom.window.fire("focus");
			fakeDom.window.flushTimers();
			await until(() => standing(h.content).length === 4, "the step to publish the note");
			assert.equal(standing(h.content)[2], `${t("web.siteNote")}: todo`);
		} finally {
			h.destroy();
		}
	});

	it("Quartz Syncer: says in words where its command is not there", async () => {
		const h = mount({ memory: { service: "quartz" }, plugins: ["quartz-syncer"] });
		try {
			await until(() => drawn(h.content), "the panel");
			assert.deepEqual(stepsOf(row(h.content, t("web.siteNote")).el), [
				t("web.stepSyncerOpenCenter"),
				t("web.stepSyncerPublish", { note: "callout-studio-quartz" }),
			]);
		} finally {
			h.destroy();
		}
	});

	it("Quartz Syncer: warns of a note switched off for it, or where it does not publish from", async () => {
		const h = mount({
			memory: { service: "quartz" },
			plugins: ["quartz-syncer"],
			files: {
				[SYNCER_SETTINGS]: JSON.stringify({ vaultPath: "Public" }),
				[`Public/${QUARTZ_NOTE_NAME}`]: olderQuartzNote().replace(
					"draft: true\n",
					"draft: true\npublish: false\n",
				),
			},
			notes: { [`Public/${QUARTZ_NOTE_NAME}`]: { [QUARTZ_NOTE_KEY]: 1, publish: false } },
		});
		try {
			await until(() => drawn(h.content), "the panel");
			const note = row(h.content, t("web.rowNote"));
			assert.equal(note.mark, "warning");
			assert.ok(note.text.includes(t("web.noteNotMarked", { key: "publish", publisher: "Quartz Syncer" })));
		} finally {
			h.destroy();
		}

		const moved = mount({
			memory: { service: "quartz" },
			plugins: ["quartz-syncer"],
			files: {
				[SYNCER_SETTINGS]: JSON.stringify({ vaultPath: "Public" }),
				"Elsewhere/Callouts.md": olderQuartzNote().replace("draft: true\n", "draft: true\npublish: true\n"),
			},
			notes: { "Elsewhere/Callouts.md": { [QUARTZ_NOTE_KEY]: 1, publish: true } },
		});
		try {
			await until(() => drawn(moved.content), "the panel");
			const note = row(moved.content, t("web.rowNote"));
			assert.equal(note.mark, "warning");
			assert.ok(note.text.includes(t("web.noteOutsideFolder", { publisher: "Quartz Syncer", folder: "Public" })));
			assert.ok(hasAction(note.el, t("web.actionOpenNote")), "the note can be opened, to move it");
		} finally {
			moved.destroy();
		}
	});

	it("Enveloppe: writes the note shared, says how to upload it, and warns of a folder it leaves out", async () => {
		const h = mount({
			memory: { service: "quartz" },
			plugins: ["obsidian-mkdocs-publisher"],
			files: {
				[ENVELOPPE_SETTINGS]: JSON.stringify({ plugin: { shareKey: "share", excludedFolder: ["Private"] } }),
			},
		});
		try {
			await until(() => drawn(h.content), "the panel");
			press(action(h.content, t("web.writeNote")));
			await until(() => row(h.content, t("web.rowNote")).mark === "seen", "the note as written");
			assert.match(
				h.files.get(QUARTZ_NOTE_NAME) ?? "",
				/^---\ndraft: true\nshare: true\ncallout-studio-quartz: 1\n---\n/,
			);
			assert.deepEqual(stepsOf(row(h.content, t("web.siteNote")).el), [
				t("web.actionOpenNote"),
				t("web.stepEnveloppeUpload"),
			]);
		} finally {
			h.destroy();
		}

		const kept = mount({
			memory: { service: "quartz" },
			plugins: ["obsidian-mkdocs-publisher"],
			files: {
				[ENVELOPPE_SETTINGS]: JSON.stringify({ plugin: { excludedFolder: ["Private"] } }),
				[`Private/${QUARTZ_NOTE_NAME}`]: olderQuartzNote().replace(
					"draft: true\n",
					"draft: true\nshare: true\n",
				),
			},
			notes: { [`Private/${QUARTZ_NOTE_NAME}`]: { [QUARTZ_NOTE_KEY]: 1, share: true } },
		});
		try {
			await until(() => drawn(kept.content), "the panel");
			assert.ok(
				row(kept.content, t("web.rowNote")).text.includes(
					t("web.noteExcludedFolder", { publisher: "Enveloppe" }),
				),
			);
		} finally {
			kept.destroy();
		}
	});
});
