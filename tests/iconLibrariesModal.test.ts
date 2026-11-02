/**
 * tests/iconLibrariesModal.test.ts — the Icon libraries window.
 *
 * Opened from the button beside Pick an icon's library menu. Above the line,
 * the libraries the picker offers, in its order; below it, the rest. Each row
 * has one button, and which one it is says what kind of library it is: trash
 * or download for a library whose files are downloaded, hide or show for one
 * that ships with the plugin. What this suite holds the window to:
 *
 * - the bands and buttons follow the settings and the files on the device;
 * - a drag or an arrow key above the line saves the whole order, at once;
 * - the last library in the picker cannot leave it;
 * - a download lands in the library's saved slot and writes no settings, so
 *   one device's download cannot reorder another device's list;
 * - deleting a library callouts use asks first — naming them and saying they
 *   keep their icons — and is refused while saving is paused, because the
 *   copy of their icons has to reach the disk before the files go;
 * - the reset arrow puts everything back the way the plugin came — the
 *   catalog order, nothing hidden, and every downloaded library deleted, after
 *   one question that names them.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../src/constants";
import { t } from "../src/i18n";
import { PACK_MANIFEST } from "../src/icons/data/packManifest";
import type { PackDataStore } from "../src/icons/PackDataStore";
import { libraryFiles, type EditedCallout } from "../src/icons/iconLibraries";
import { IconLibrariesModal, type IconLibrariesHost } from "../src/settings/iconpicker/IconLibrariesModal";
import { ConfirmModal } from "../src/utils/ConfirmModal";
import type { CalloutDefinition, CalloutIcon, IconPackId, IconSourceId } from "../src/types";
import { parseRules } from "./support/cssInjectorHarness";
import { asEl, el, FakeElement, installFakeDom } from "./support/fakeDom";
import { Notice } from "./support/obsidianStub";
import { readRepoFile } from "./support/sourceScan";

installFakeDom();
// Reduced motion: reorders apply at once instead of sliding.
Object.assign(window, { matchMedia: () => ({ matches: true }) });

const CATALOG: readonly IconSourceId[] = [
	"lucide",
	"tabler",
	"material",
	"emoji",
	"octicons",
	"fa",
	"rpg-awesome",
	"simple-icons",
	"image",
];

interface Options {
	/** Pack files on this device. */
	ready?: IconPackId[];
	order?: string[];
	hidden?: string[];
	frozen?: boolean;
	/** Committed callouts. */
	users?: CalloutDefinition[];
	/** The callout the editor holds unsaved, as the picker hands it over. */
	editing?: EditedCallout;
	/** Libraries whose files cannot be deleted. */
	failDelete?: IconSourceId[];
	/** Deletions wait until the test calls `release()`. */
	hold?: boolean;
	/** Downloads show their spinner until the test calls `finishDownload()`. */
	holdDownload?: boolean;
	/** Downloads end without the library arriving. */
	failDownload?: boolean;
}

function callout(id: string, icon: CalloutDefinition["icon"]): CalloutDefinition {
	return {
		id,
		displayName: `Callout ${id}`,
		icon,
		colorLight: "#3b82f6",
		colorDark: "#3b82f6",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
	};
}

function mount(options: Options = {}) {
	const ready = new Set<IconPackId>(options.ready ?? []);
	const listeners = new Set<() => void>();
	const notify = (): void => {
		for (const cb of [...listeners]) cb();
	};
	const settings = structuredClone(DEFAULT_SETTINGS);
	settings.iconLibraries = { order: [...(options.order ?? [])], hidden: [...(options.hidden ?? [])] };
	let saves = 0;
	let release = (): void => {};
	const gate = options.hold
		? new Promise<void>((resolve) => {
				release = resolve;
			})
		: undefined;
	const deleted: IconSourceId[] = [];
	/** The unsaved icons each deletion was told to keep, in call order. */
	const kept: CalloutIcon[][] = [];
	const downloads: IconPackId[] = [];
	const loading = new Set<IconPackId>();
	let finishDownload = (): void => {};
	const downloadGate = options.holdDownload
		? new Promise<void>((resolve) => {
				finishDownload = resolve;
			})
		: undefined;
	const packs = {
		state: (id: IconPackId) => (loading.has(id) ? "loading" : ready.has(id) ? "ready" : "unavailable"),
		info: (id: IconPackId) => PACK_MANIFEST[id],
		loadAllFromDisk: () => Promise.resolve(),
		onChange: (cb: () => void) => {
			listeners.add(cb);
			return () => {
				listeners.delete(cb);
			};
		},
		download: async (id: IconPackId) => {
			downloads.push(id);
			if (downloadGate) {
				loading.add(id);
				notify();
				await downloadGate;
				loading.delete(id);
			}
			if (options.failDownload) {
				notify();
				return false;
			}
			ready.add(id);
			notify();
			return true;
		},
	};
	const host: IconLibrariesHost = {
		app: {} as App,
		settings,
		saveSettings: () => {
			saves++;
			return Promise.resolve();
		},
		settingsWriter: { isFrozen: options.frozen ?? false },
		registry: { getCommitted: () => options.users ?? [], getUserImages: () => [] },
		icons: {
			packs: packs as unknown as PackDataStore,
			deleteLibrary: async (id: IconSourceId, alsoKeep: readonly CalloutIcon[] = []) => {
				deleted.push(id);
				kept.push([...alsoKeep]);
				await gate;
				if (options.failDelete?.includes(id)) return false;
				for (const file of libraryFiles(id)) ready.delete(file);
				notify();
				return true;
			},
		},
		countFor: () => 1234,
		editing: options.editing,
	};

	const modal = new IconLibrariesModal(host);
	const container = el({ cls: "modal-container" });
	const modalEl = container.createDiv({ cls: "modal" });
	const content = modalEl.createDiv({ cls: "modal-content" });
	Object.assign(modal, {
		app: host.app,
		containerEl: asEl(container),
		modalEl: asEl(modalEl),
		contentEl: asEl(content),
		titleEl: asEl(modalEl.createDiv()),
	});
	let closedWith: boolean | undefined;
	(modal as unknown as { resolve: (changed: boolean) => void }).resolve = (changed) => {
		closedWith = changed;
	};
	modal.onOpen();

	const list = (): FakeElement => content.querySelector(".cs-icon-library-list")!;
	const rows = (): FakeElement[] => list().querySelectorAll(".cs-icon-library-row");
	/** One group: the window marks each with `data-cs-group`. */
	const groupEl = (group: "available" | "download" | "hidden"): FakeElement => {
		const found = content
			.querySelector(".cs-icon-library-list")!
			.children.find((child) => child.dataset.csGroup === group);
		assert.ok(found, `no ${group} group`);
		return found;
	};
	/** The rows in one group's box. */
	const groupRows = (group: "available" | "download" | "hidden"): FakeElement[] =>
		groupEl(group).querySelectorAll(".cs-icon-library-row");
	const row = (id: IconSourceId): FakeElement => {
		const found = rows().find((r) => r.dataset.csItemId === id);
		assert.ok(found, `no row for ${id}`);
		return found;
	};
	return {
		modal,
		content,
		settings,
		ready,
		deleted,
		kept,
		downloads,
		list,
		rows,
		row,
		notify,
		release: () => release(),
		finishDownload: () => finishDownload(),
		saves: () => saves,
		closedWith: () => closedWith,
		/** The libraries in one group, top to bottom. */
		inGroup: (group: "available" | "download" | "hidden") => groupRows(group).map((r) => r.dataset.csItemId),
		/** The group element, with its heading and its box. */
		group: groupEl,
		above: () => groupRows("available").map((r) => r.dataset.csItemId),
		below: () => [...groupRows("download"), ...groupRows("hidden")].map((r) => r.dataset.csItemId),
		button: (id: IconSourceId): FakeElement => row(id).querySelector(".cs-icon-library-action")!,
		reset: (): FakeElement => content.querySelector(".cs-icon-library-reset")!,
		/** Let the window finish reading the disk and subscribe to the store. */
		settle: () => setImmediate(),
	};
}

/** Answer the delete dialog, and report what it said. */
async function withConfirm(
	answer: boolean,
	body: (asked: () => { title: string; text: string } | null) => Promise<void>,
): Promise<void> {
	const original = Object.getOwnPropertyDescriptor(ConfirmModal.prototype, "confirm")!;
	let asked: { title: string; text: string } | null = null;
	ConfirmModal.prototype.confirm = function (this: ConfirmModal) {
		const dialog = this as unknown as { title: string; message: { textContent: string } };
		asked = { title: dialog.title, text: dialog.message.textContent };
		return Promise.resolve(answer);
	};
	try {
		await body(() => asked);
	} finally {
		Object.defineProperty(ConfirmModal.prototype, "confirm", original);
	}
}

describe("Icon libraries — the title", () => {
	it("is named after the button that opens it, and says what the window is for", async () => {
		const h = mount();
		try {
			await h.settle();
			const title = (h.modal as unknown as { titleEl: FakeElement }).titleEl;
			assert.equal(title.textContent, t("iconLibraries.manage"));
			assert.equal(t("iconLibraries.manage"), "Manage icon libraries");
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — the description", () => {
	const descOf = (h: ReturnType<typeof mount>): FakeElement => h.content.querySelector(".setting-item-description")!;

	it("puts each sentence on a line of its own, not in one paragraph", async () => {
		const h = mount();
		try {
			await h.settle();
			const lines = t("iconLibraries.desc").split("\n");
			assert.equal(lines.length, 3, "one line for each thing it says");
			assert.equal(descOf(h).querySelectorAll("br").length, lines.length - 1);
			assert.equal(descOf(h).textContent, lines.join(""), "the breaks are elements, never a stray \\n");
		} finally {
			h.modal.onClose();
		}
	});

	it("says in one short line that the libraries that come with the plugin can only be hidden", async () => {
		const h = mount();
		try {
			await h.settle();
			const lines = t("iconLibraries.desc").split("\n");
			assert.equal(lines[2], "Lucide, Emoji and Material come with the plugin, so they can only be hidden.");
			for (const name of [t("iconPicker.lucide"), t("iconPicker.emoji"), t("iconPicker.material")]) {
				assert.ok(lines[2].includes(name), `${name} cannot be deleted`);
			}
		} finally {
			h.modal.onClose();
		}
	});

	it("does not repeat that callouts keep their icons: the delete dialog says it", async () => {
		const h = mount();
		try {
			await h.settle();
			const text = descOf(h).textContent;
			assert.ok(!/Deleting a library/.test(text));
			assert.ok(!/already use its icons/.test(text));
			assert.ok(!/keep/i.test(text));
		} finally {
			h.modal.onClose();
		}
	});

	it("carries no reset arrow of its own: that sits on the Available libraries heading", async () => {
		const h = mount({ ready: ["octicons"] });
		try {
			await h.settle();
			assert.equal(h.content.querySelector(".setting-item-description")!.querySelector(".clickable-icon"), null);
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — the groups", () => {
	// Three Obsidian setting groups (finding S4-13). The first two headings are
	// the Choose source menu's, from the same keys, so the window and the menu
	// cannot drift apart.
	type Group = "available" | "download" | "hidden";
	const headingOf = (h: ReturnType<typeof mount>, group: Group): string | undefined =>
		h.group(group).querySelector(".setting-item-heading")?.querySelector(".setting-item-name")?.textContent;
	const shown = (h: ReturnType<typeof mount>, group: Group): boolean => !h.group(group).hasClass("cs-hidden");
	const EVERYTHING: IconPackId[] = [
		"tabler-outline",
		"tabler-filled",
		"octicons",
		"fa-solid",
		"fa-regular",
		"fa-brands",
		"rpg-awesome",
		"simple-icons",
	];

	it("are three Obsidian list groups under the description, headed in the Choose source menu's words", async () => {
		const h = mount({ hidden: ["emoji"] });
		try {
			await h.settle();
			assert.deepEqual(
				h.list().children.map((child) => child.dataset.csGroup),
				["available", "download", "hidden"],
			);
			for (const group of ["available", "download", "hidden"] as const) {
				assert.ok(h.group(group).hasClass("setting-group"), `${group} is an Obsidian group`);
				assert.ok(h.group(group).hasClass("mod-list"), `${group} uses Obsidian's list layout`);
			}
			assert.equal(headingOf(h, "available"), t("iconPicker.librariesAvailable"));
			assert.equal(t("iconPicker.librariesAvailable"), "Available libraries");
			assert.equal(headingOf(h, "download"), t("iconPicker.librariesToDownload"));
			assert.equal(t("iconPicker.librariesToDownload"), "Libraries to download");
			assert.equal(headingOf(h, "hidden"), t("iconLibraries.librariesHidden"));
			assert.equal(t("iconLibraries.librariesHidden"), "Hidden libraries");
			// Below the description.
			const order = h.content.children;
			assert.ok(order.indexOf(h.list()) > order.indexOf(h.content.querySelector(".setting-item-description")!));
		} finally {
			h.modal.onClose();
		}
	});

	it("puts the reset arrow at the end of the Available libraries heading", async () => {
		const h = mount({ ready: ["octicons"] });
		try {
			await h.settle();
			const arrows = h
				.group("available")
				.querySelector(".setting-item-heading")!
				.querySelectorAll(".clickable-icon");
			assert.equal(arrows.length, 1);
			assert.equal(arrows[0], h.reset());
			assert.equal(h.reset().hasClass("cs-reset-idle"), false, "something differs, so it shows");
		} finally {
			h.modal.onClose();
		}
	});

	it("keeps Available libraries and its arrow when nothing is left to download, and shows no empty group", async () => {
		const h = mount({ ready: EVERYTHING });
		try {
			await h.settle();
			assert.ok(shown(h, "available"));
			assert.equal(shown(h, "download"), false);
			assert.equal(shown(h, "hidden"), false);
			assert.deepEqual(h.below(), []);
			assert.ok(h.reset(), "the arrow keeps its heading");
		} finally {
			h.modal.onClose();
		}
	});

	it("lists the libraries still to download in a group of their own", async () => {
		const h = mount();
		try {
			await h.settle();
			assert.ok(shown(h, "download"));
			assert.deepEqual(h.inGroup("download"), ["tabler", "octicons", "fa", "rpg-awesome", "simple-icons"]);
			assert.equal(shown(h, "hidden"), false, "nothing is hidden");
		} finally {
			h.modal.onClose();
		}
	});

	it("brings Libraries to download back the moment a library is deleted", async () => {
		const h = mount({ ready: EVERYTHING });
		try {
			await h.settle();
			await withConfirm(true, async () => {
				h.button("octicons").fire("click");
				await h.settle();
			});
			assert.ok(shown(h, "download"));
			assert.deepEqual(h.inGroup("download"), ["octicons"]);
		} finally {
			h.modal.onClose();
		}
	});

	it("lists a hidden library in Hidden libraries, never under Libraries to download", async () => {
		const h = mount({ hidden: ["emoji"] });
		try {
			await h.settle();
			assert.deepEqual(h.inGroup("download"), ["tabler", "octicons", "fa", "rpg-awesome", "simple-icons"]);
			assert.deepEqual(h.inGroup("hidden"), ["emoji"]);
			assert.ok(shown(h, "hidden"));
		} finally {
			h.modal.onClose();
		}
	});

	it("shows only Hidden libraries when nothing is left to download", async () => {
		const h = mount({ ready: EVERYTHING, hidden: ["emoji", "material"] });
		try {
			await h.settle();
			assert.equal(shown(h, "download"), false);
			assert.deepEqual(h.inGroup("hidden"), ["material", "emoji"], "in catalog order");
		} finally {
			h.modal.onClose();
		}
	});

	it("moves a library between the groups as it is hidden and shown", async () => {
		const h = mount();
		try {
			await h.settle();
			assert.equal(shown(h, "hidden"), false);
			h.button("emoji").fire("click");
			assert.deepEqual(h.inGroup("hidden"), ["emoji"]);
			assert.ok(shown(h, "hidden"));
			h.button("emoji").fire("click");
			assert.equal(shown(h, "hidden"), false);
			assert.ok(h.above().includes("emoji"));
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — the rows", () => {
	it("lists what the picker offers first in its order, then those to download, then the hidden", async () => {
		const h = mount({
			ready: ["octicons"],
			order: ["image", "octicons", "lucide", "tabler", "material", "emoji", "fa", "rpg-awesome", "simple-icons"],
			hidden: ["emoji"],
		});
		try {
			await h.settle();
			assert.deepEqual(h.above(), ["image", "octicons", "lucide", "material"]);
			assert.deepEqual(
				h.below(),
				["tabler", "fa", "rpg-awesome", "simple-icons", "emoji"],
				"to download in catalog order, then hidden in catalog order",
			);
		} finally {
			h.modal.onClose();
		}
	});

	it("is an Obsidian setting row: the emblem, the name, the line under it, then the button", async () => {
		const h = mount();
		try {
			await h.settle();
			const r = h.row("lucide");
			assert.ok(r.hasClass("setting-item"));
			assert.ok(r.children[0]!.hasClass("setting-item-icon"), "the emblem comes first");
			assert.equal(r.querySelector(".setting-item-name")!.textContent, t("iconPicker.lucide"));
			const action = h.button("lucide");
			assert.ok(action.closest(".setting-item-control"), "the button is in the row's control");
			assert.equal(action.tagName.toLowerCase(), "div", "an Obsidian extra button, the handle's size on a phone");
		} finally {
			h.modal.onClose();
		}
	});

	it("gives each kind of library its own button", async () => {
		const h = mount({ ready: ["tabler-outline", "tabler-filled"], hidden: ["emoji"] });
		try {
			await h.settle();
			const label = (id: IconSourceId) => h.button(id).getAttribute("aria-label");
			assert.equal(label("tabler"), t("iconLibraries.delete", { name: t("iconPicker.tabler") }));
			assert.equal(label("lucide"), t("iconLibraries.hide", { name: t("iconPicker.lucide") }));
			assert.equal(label("emoji"), t("iconLibraries.show", { name: t("iconPicker.emoji") }));
			assert.equal(label("octicons"), t("iconLibraries.download", { name: t("iconPicker.octicons") }));
			assert.ok(h.button("tabler").hasClass("cs-icon-library-delete"));
			assert.ok(!h.button("lucide").hasClass("cs-icon-library-delete"));
		} finally {
			h.modal.onClose();
		}
	});

	it("gives a handle only to the rows of Available libraries, at the very end", async () => {
		const h = mount();
		try {
			await h.settle();
			for (const id of h.above()) {
				const r = h.row(id as IconSourceId);
				const handle = r.querySelector(".cs-drag-handle");
				assert.ok(handle, `${id} can move`);
				assert.equal(r.children.at(-1), handle, `${id}'s handle ends the row`);
			}
			for (const id of h.below()) {
				assert.equal(h.row(id as IconSourceId).querySelector(".cs-drag-handle"), null, `${id} has no handle`);
			}
		} finally {
			h.modal.onClose();
		}
	});

	it("says what each library costs on the line under its name", async () => {
		const h = mount({ ready: ["octicons"] });
		try {
			await h.settle();
			const meta = (id: IconSourceId) => h.row(id).querySelector(".setting-item-description")?.textContent;
			assert.match(meta("octicons") ?? "", /375\u00a0KB/, "number and unit kept on one line");
			assert.match(meta("lucide") ?? "", new RegExp(t("iconLibraries.noDownload")));
			assert.match(meta("material") ?? "", new RegExp(t("iconLibraries.perIcon")));
			const missing =
				(PACK_MANIFEST["fa-solid"]!.bytes +
					PACK_MANIFEST["fa-regular"]!.bytes +
					PACK_MANIFEST["fa-brands"]!.bytes) /
				1024 /
				1024;
			assert.match(meta("fa") ?? "", new RegExp(`${missing.toFixed(1)}\u00a0MB`));
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — hiding and showing", () => {
	it("moves a hidden library below the line and saves, and brings it back", async () => {
		const h = mount();
		try {
			await h.settle();
			h.button("emoji").fire("click");
			assert.deepEqual(h.settings.iconLibraries.hidden, ["emoji"]);
			assert.ok(h.below().includes("emoji"));
			assert.equal(h.saves(), 1);

			h.button("emoji").fire("click");
			assert.deepEqual(h.settings.iconLibraries.hidden, []);
			assert.deepEqual(h.above(), ["lucide", "material", "emoji", "image"], "back in its slot");
			assert.equal(h.saves(), 2);
		} finally {
			h.modal.onClose();
		}
	});

	it("keeps the last library in the picker, and says why", async () => {
		const h = mount({ hidden: ["lucide", "material", "emoji"] });
		try {
			await h.settle();
			assert.deepEqual(h.above(), ["image"]);
			const last = h.button("image");
			assert.equal(last.getAttribute("aria-disabled"), "true", "dimmed, not disabled");
			last.fire("click");
			assert.equal(String(Notice.last?.message), t("iconLibraries.keepOne"));
			assert.deepEqual(h.settings.iconLibraries.hidden, ["lucide", "material", "emoji"]);
			assert.equal(h.saves(), 0);
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — downloading and deleting", () => {
	it("downloads into the library's saved slot without writing settings", async () => {
		const h = mount();
		try {
			await h.settle();
			h.button("octicons").fire("click");
			await h.settle();
			assert.deepEqual(h.downloads, ["octicons"]);
			assert.deepEqual(h.above(), ["lucide", "material", "emoji", "octicons", "image"]);
			assert.equal(h.saves(), 0, "a download is this device's business, not a setting");
		} finally {
			h.modal.onClose();
		}
	});

	it("downloads only the files a library still lacks", async () => {
		const h = mount({ ready: ["fa-brands"] });
		try {
			await h.settle();
			assert.ok(h.below().includes("fa"), "Brands alone does not put Font Awesome in the picker");
			h.button("fa").fire("click");
			await h.settle();
			assert.deepEqual(h.downloads, ["fa-solid", "fa-regular"]);
			assert.ok(h.above().includes("fa"));
		} finally {
			h.modal.onClose();
		}
	});

	it("deletes a library nothing uses at once, without asking", async () => {
		const h = mount({ ready: ["tabler-outline", "tabler-filled"] });
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.button("tabler").fire("click");
				await h.settle();
				assert.equal(asked(), null);
			});
			assert.deepEqual(h.deleted, ["tabler"]);
			assert.ok(h.below().includes("tabler"));
		} finally {
			h.modal.onClose();
		}
	});

	it("asks before deleting a library callouts use, naming them", async () => {
		const users = Array.from({ length: 12 }, (_, i) => callout(`c${i}`, { type: "tabler-outline", value: "bulb" }));
		const h = mount({ ready: ["tabler-outline", "tabler-filled"], users });
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.button("tabler").fire("click");
				await h.settle();
				const dialog = asked();
				assert.ok(dialog, "it asked");
				assert.equal(dialog.title, t("confirm.titleDeleteLibrary"));
				const name = t("iconPicker.tabler");
				assert.ok(dialog.text.includes(t("iconLibraries.inUse", { name, count: "12" })));
				for (let i = 0; i < 10; i++) assert.ok(dialog.text.includes(`Callout c${i}`), `names c${i}`);
				assert.ok(!dialog.text.includes("Callout c10"), "the eleventh is summed up");
				assert.ok(dialog.text.includes(t("iconLibraries.inUseMore", { count: "2" })));
				assert.ok(dialog.text.includes(t("iconLibraries.inUseKeeps", { name })));
			});
			assert.deepEqual(h.deleted, ["tabler"]);
		} finally {
			h.modal.onClose();
		}
	});

	it("says one callout, not one callouts", async () => {
		const h = mount({ ready: ["octicons"], users: [callout("solo", { type: "octicons", value: "alert" })] });
		try {
			await h.settle();
			await withConfirm(false, async (asked) => {
				h.button("octicons").fire("click");
				await h.settle();
				assert.ok(asked()?.text.includes(t("iconLibraries.inUseOne", { name: t("iconPicker.octicons") })));
			});
			assert.deepEqual(h.deleted, [], "cancelling deletes nothing");
			assert.ok(h.above().includes("octicons"));
		} finally {
			h.modal.onClose();
		}
	});

	it("asks before deleting a library the callout being edited uses, though it is not saved yet", async () => {
		// The reported flow: download a library, pick one of its icons in the
		// callout editor, open Pick an icon again and delete the library. The
		// registry knows no callout using it — the editor holds the icon until
		// Save — but the person has just applied it and must be told.
		const editing: EditedCallout = {
			id: null,
			name: "My new callout",
			icon: { type: "octicons", value: "rocket" },
		};
		const h = mount({ ready: ["octicons"], editing });
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.button("octicons").fire("click");
				await h.settle();
				const dialog = asked();
				assert.ok(dialog, "it asked");
				assert.ok(dialog.text.includes(t("iconLibraries.inUseOne", { name: t("iconPicker.octicons") })));
				assert.ok(dialog.text.includes("My new callout"), "names the callout being edited");
			});
			assert.deepEqual(h.deleted, ["octicons"]);
			assert.deepEqual(h.kept, [[editing.icon]], "its drawing is kept with the others");
		} finally {
			h.modal.onClose();
		}
	});

	it("counts the callout being edited together with the saved ones", async () => {
		const editing: EditedCallout = {
			id: null,
			name: "My new callout",
			icon: { type: "octicons", value: "rocket" },
		};
		const users = [callout("solo", { type: "octicons", value: "alert" })];
		const h = mount({ ready: ["octicons"], users, editing });
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.button("octicons").fire("click");
				await h.settle();
				const text = asked()?.text ?? "";
				assert.ok(text.includes(t("iconLibraries.inUse", { name: t("iconPicker.octicons"), count: "2" })));
				assert.ok(text.includes("Callout solo") && text.includes("My new callout"));
			});
		} finally {
			h.modal.onClose();
		}
	});

	it("names a saved callout once when its edit uses the library as well", async () => {
		const users = [callout("solo", { type: "octicons", value: "alert" })];
		const editing: EditedCallout = {
			id: "solo",
			name: "Callout solo",
			icon: { type: "octicons", value: "rocket" },
		};
		const h = mount({ ready: ["octicons"], users, editing });
		try {
			await h.settle();
			await withConfirm(false, async (asked) => {
				h.button("octicons").fire("click");
				await h.settle();
				assert.ok(asked()?.text.includes(t("iconLibraries.inUseOne", { name: t("iconPicker.octicons") })));
			});
		} finally {
			h.modal.onClose();
		}
	});

	it("deletes at once when the callout being edited uses another library", async () => {
		const editing: EditedCallout = {
			id: null,
			name: "My new callout",
			icon: { type: "tabler-outline", value: "bulb" },
		};
		const h = mount({ ready: ["octicons", "tabler-outline", "tabler-filled"], editing });
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.button("octicons").fire("click");
				await h.settle();
				assert.equal(asked(), null, "nothing uses Octicons, so nothing to ask");
			});
			assert.deepEqual(h.deleted, ["octicons"]);
			assert.deepEqual(h.kept, [[]], "the edit's icon is not Octicons', so it is not passed along");
		} finally {
			h.modal.onClose();
		}
	});

	it("refuses to delete a library only the edit uses while saving is paused", async () => {
		const editing: EditedCallout = {
			id: null,
			name: "My new callout",
			icon: { type: "octicons", value: "rocket" },
		};
		const h = mount({ ready: ["octicons"], frozen: true, editing });
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.button("octicons").fire("click");
				await h.settle();
				assert.equal(asked(), null);
			});
			assert.equal(String(Notice.last?.message), t("notice.blockedWhilePaused"));
			assert.deepEqual(h.deleted, []);
		} finally {
			h.modal.onClose();
		}
	});

	it("refuses to delete a library in use while saving is paused", async () => {
		const h = mount({
			ready: ["octicons"],
			frozen: true,
			users: [callout("solo", { type: "octicons", value: "alert" })],
		});
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.button("octicons").fire("click");
				await h.settle();
				assert.equal(asked(), null, "no question while the answer could not be kept");
			});
			assert.equal(String(Notice.last?.message), t("notice.blockedWhilePaused"));
			assert.deepEqual(h.deleted, []);
		} finally {
			h.modal.onClose();
		}
	});

	it("follows a download that finishes somewhere else", async () => {
		// The picker's own download prompt, or a second window.
		const h = mount();
		try {
			await h.settle();
			h.ready.add("rpg-awesome");
			const packs = (h.modal as unknown as { host: IconLibrariesHost }).host.icons.packs;
			await packs.download("rpg-awesome");
			assert.ok(h.above().includes("rpg-awesome"));
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — the order", () => {
	it("saves the whole order when an arrow key moves a library", async () => {
		const h = mount();
		try {
			await h.settle();
			const handle = h.row("lucide").querySelector(".cs-drag-handle")!;
			handle.fire("keydown", { key: "ArrowDown", preventDefault: () => {} });
			assert.deepEqual(h.above(), ["material", "lucide", "emoji", "image"]);
			assert.deepEqual(h.settings.iconLibraries.order, [
				"material",
				"tabler",
				"lucide",
				"emoji",
				"octicons",
				"fa",
				"rpg-awesome",
				"simple-icons",
				"image",
			]);
			assert.equal(h.saves(), 1);
		} finally {
			h.modal.onClose();
		}
	});

	it("never moves a library across the line by keyboard", async () => {
		const h = mount();
		try {
			await h.settle();
			const handle = h.row("image").querySelector(".cs-drag-handle")!;
			handle.fire("keydown", { key: "ArrowDown", preventDefault: () => {} });
			assert.deepEqual(h.above(), ["lucide", "material", "emoji", "image"]);
			assert.equal(h.saves(), 0);
		} finally {
			h.modal.onClose();
		}
	});

	it("saves a drag in Available libraries", async () => {
		const h = mount();
		try {
			await h.settle();
			// The drag happens in the Available box.
			const list = h.group("available").querySelector(".setting-items")!;
			asEl(list).setPointerCapture = () => {};
			asEl(list).releasePointerCapture = () => {};
			for (const r of list.children) {
				Object.assign(r, { instanceOf: (ctor: typeof Object) => r instanceof ctor });
				Object.defineProperty(r, "nextElementSibling", {
					get: () => list.children[list.children.indexOf(r) + 1] ?? null,
				});
				r.style.removeProperty = (name: string) => {
					delete r.style[name];
				};
				r.getBoundingClientRect = () => {
					const top = list.children.indexOf(r) * 40;
					return {
						x: 0,
						y: top,
						top,
						bottom: top + 36,
						left: 0,
						right: 240,
						width: 240,
						height: 36,
						toJSON: () => ({}),
					};
				};
			}
			const target = h.row("lucide").querySelector(".cs-drag-handle")!;
			const event = { pointerId: 1, button: 0, target, preventDefault: () => {} };
			list.fire("pointerdown", { ...event, clientY: 18 });
			list.fire("pointermove", { ...event, clientY: 110 });
			list.fire("pointerup", event);
			assert.deepEqual(h.above(), ["material", "emoji", "lucide", "image"]);
			assert.deepEqual(h.settings.iconLibraries.order, [
				"material",
				"tabler",
				"emoji",
				"lucide",
				"octicons",
				"fa",
				"rpg-awesome",
				"simple-icons",
				"image",
			]);
			assert.equal(h.saves(), 1);
		} finally {
			h.modal.onClose();
		}
	});

	it("hides the reset arrow while nothing differs from the default", async () => {
		const h = mount();
		try {
			await h.settle();
			assert.equal(h.reset().hasClass("cs-reset-idle"), true);
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — the reset arrow", () => {
	it("restores the catalog order and every library, and asks nothing when none is downloaded", async () => {
		const h = mount({ order: ["image", ...CATALOG.filter((id) => id !== "image")], hidden: ["emoji"] });
		try {
			await h.settle();
			const reset = h.reset();
			assert.equal(reset.hasClass("cs-reset-idle"), false);
			await withConfirm(true, async (asked) => {
				reset.fire("click");
				await h.settle();
				assert.equal(asked(), null, "there is nothing to delete, so nothing to ask");
			});
			assert.deepEqual(h.settings.iconLibraries, { order: [], hidden: [] });
			assert.deepEqual(h.above(), ["lucide", "material", "emoji", "image"]);
			assert.equal(reset.hasClass("cs-reset-idle"), true);
			assert.equal(h.saves(), 1);
			assert.deepEqual(h.deleted, []);
		} finally {
			h.modal.onClose();
		}
	});

	it("offers itself while a library is downloaded, even in the default order", async () => {
		const h = mount({ ready: ["octicons"] });
		try {
			await h.settle();
			assert.equal(h.reset().hasClass("cs-reset-idle"), false);
		} finally {
			h.modal.onClose();
		}
	});

	it("deletes every downloaded library, after naming them, and puts the order and hidden list back", async () => {
		const h = mount({
			ready: ["tabler-outline", "tabler-filled", "octicons"],
			order: ["image", ...CATALOG.filter((id) => id !== "image")],
			hidden: ["emoji"],
		});
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.reset().fire("click");
				await h.settle();
				const dialog = asked();
				assert.ok(dialog, "it asked");
				assert.equal(dialog.title, t("confirm.titleResetLibraries"));
				assert.ok(dialog.text.includes(t("iconLibraries.resetConfirm")));
				assert.ok(dialog.text.includes(t("iconPicker.tabler")));
				assert.ok(dialog.text.includes(t("iconPicker.octicons")));
				assert.ok(!dialog.text.includes(t("iconPicker.fa")), "only what is on the device");
				assert.ok(dialog.text.includes(t("iconLibraries.resetKeeps")), "callouts keep their icons");
			});
			assert.deepEqual(h.deleted, ["tabler", "octicons"], "one at a time, in catalog order");
			assert.deepEqual(h.settings.iconLibraries, { order: [], hidden: [] });
			assert.deepEqual(
				h.above(),
				["lucide", "material", "emoji", "image"],
				"only what ships with the plugin is left on offer",
			);
			assert.equal(h.reset().hasClass("cs-reset-idle"), true, "back to how the plugin came");
		} finally {
			h.modal.onClose();
		}
	});

	it("deletes a library with only some of its files, which no menu offers", async () => {
		const h = mount({ ready: ["fa-brands"] });
		try {
			await h.settle();
			await withConfirm(true, async () => {
				h.reset().fire("click");
				await h.settle();
			});
			assert.deepEqual(h.deleted, ["fa"]);
		} finally {
			h.modal.onClose();
		}
	});

	it("changes nothing when the question is declined", async () => {
		const h = mount({
			ready: ["octicons"],
			order: ["image", ...CATALOG.filter((id) => id !== "image")],
			hidden: ["emoji"],
		});
		try {
			await h.settle();
			await withConfirm(false, async () => {
				h.reset().fire("click");
				await h.settle();
			});
			assert.deepEqual(h.deleted, []);
			assert.deepEqual(h.settings.iconLibraries.hidden, ["emoji"]);
			assert.equal(h.settings.iconLibraries.order[0], "image");
			assert.equal(h.saves(), 0);
			assert.ok(h.above().includes("octicons"));
		} finally {
			h.modal.onClose();
		}
	});

	it("refuses while saving is paused when callouts use a library it would delete", async () => {
		const h = mount({
			ready: ["octicons"],
			frozen: true,
			hidden: ["emoji"],
			users: [callout("solo", { type: "octicons", value: "alert" })],
		});
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.reset().fire("click");
				await h.settle();
				assert.equal(asked(), null, "no question while the answer could not be kept");
			});
			assert.equal(String(Notice.last?.message), t("notice.blockedWhilePaused"));
			assert.deepEqual(h.deleted, []);
			assert.deepEqual(h.settings.iconLibraries.hidden, ["emoji"], "nothing was reset");
		} finally {
			h.modal.onClose();
		}
	});

	it("hands the callout editor's unsaved icon only to the library it belongs to", async () => {
		const editing: EditedCallout = {
			id: null,
			name: "My new callout",
			icon: { type: "octicons", value: "rocket" },
		};
		const h = mount({ ready: ["tabler-outline", "tabler-filled", "octicons"], editing });
		try {
			await h.settle();
			await withConfirm(true, async () => {
				h.reset().fire("click");
				await h.settle();
			});
			assert.deepEqual(h.deleted, ["tabler", "octicons"]);
			assert.deepEqual(h.kept, [[], [editing.icon]]);
		} finally {
			h.modal.onClose();
		}
	});

	it("refuses while saving is paused when only the unsaved edit uses a library it would delete", async () => {
		const editing: EditedCallout = {
			id: null,
			name: "My new callout",
			icon: { type: "octicons", value: "rocket" },
		};
		const h = mount({ ready: ["octicons"], frozen: true, hidden: ["emoji"], editing });
		try {
			await h.settle();
			await withConfirm(true, async (asked) => {
				h.reset().fire("click");
				await h.settle();
				assert.equal(asked(), null);
			});
			assert.equal(String(Notice.last?.message), t("notice.blockedWhilePaused"));
			assert.deepEqual(h.deleted, []);
			assert.deepEqual(h.settings.iconLibraries.hidden, ["emoji"], "nothing was reset");
		} finally {
			h.modal.onClose();
		}
	});

	it("goes on when one library cannot be deleted, says so, and keeps the arrow", async () => {
		const h = mount({ ready: ["tabler-outline", "tabler-filled", "octicons"], failDelete: ["tabler"] });
		try {
			await h.settle();
			await withConfirm(true, async () => {
				h.reset().fire("click");
				await h.settle();
			});
			assert.deepEqual(h.deleted, ["tabler", "octicons"], "the second was still tried");
			assert.equal(
				String(Notice.last?.message),
				t("iconLibraries.deleteFailed", { name: t("iconPicker.tabler") }),
			);
			assert.ok(h.above().includes("tabler"), "its files are still here");
			assert.ok(h.below().includes("octicons"));
			assert.equal(h.reset().hasClass("cs-reset-idle"), false, "so there is still something to reset");
		} finally {
			h.modal.onClose();
		}
	});

	it("tells the picker something changed", async () => {
		const h = mount({ ready: ["octicons"] });
		await h.settle();
		await withConfirm(true, async () => {
			h.reset().fire("click");
			await h.settle();
		});
		h.modal.onClose();
		assert.equal(h.closedWith(), true);
	});
});

describe("Icon libraries — closing while files are being deleted", () => {
	it("waits for a deletion under way before telling the picker", async () => {
		// The picker reads the pack files when it hears back; a half-deleted
		// library would still look downloaded to it.
		const h = mount({ ready: ["octicons"], hold: true });
		await h.settle();
		h.button("octicons").fire("click");
		await h.settle();
		h.modal.onClose();
		assert.equal(h.closedWith(), undefined, "the files are still going");
		h.release();
		await h.settle();
		assert.equal(h.closedWith(), true);
		assert.deepEqual(h.deleted, ["octicons"]);
	});

	it("sees a reset through to the last library even once the window is closed", async () => {
		const h = mount({ ready: ["tabler-outline", "tabler-filled", "octicons"], hold: true });
		await h.settle();
		await withConfirm(true, async () => {
			h.reset().fire("click");
			await h.settle();
		});
		h.modal.onClose();
		assert.equal(h.closedWith(), undefined);
		h.release();
		await h.settle();
		assert.deepEqual(h.deleted, ["tabler", "octicons"], "the second library was not left behind");
		assert.equal(h.closedWith(), true);
	});
});

describe("Icon libraries — closing", () => {
	it("tells the picker whether anything changed", async () => {
		const quiet = mount();
		await quiet.settle();
		quiet.modal.onClose();
		assert.equal(quiet.closedWith(), false);

		const busy = mount();
		await busy.settle();
		busy.button("emoji").fire("click");
		busy.modal.onClose();
		assert.equal(busy.closedWith(), true);
	});
});

/* -------------------------------------------------------------------------- */
/* Scrolling                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The fake DOM has no layout engine, so the window is given one: every child
 * of the list — row, caption or line — is `ROW` tall, one under the next from
 * `LIST_TOP`, and the window's body is a scrollport `VIEW` tall that has been
 * scrolled by its `scrollTop`. That is enough to say where a row is on screen,
 * and so whether the window moved to keep it there; how it looks in Obsidian's
 * own CSS was checked in a browser.
 */
const LIST_TOP = 100;
const ROW = 50;
const VIEW = 300;
/** Every file of every downloadable library: the whole picker is on offer. */
const EVERYTHING = CATALOG.flatMap((id) => [...libraryFiles(id)]);

type Harness = ReturnType<typeof mount>;

const rect = (top: number, bottom: number): DOMRect =>
	({
		x: 0,
		y: top,
		top,
		bottom,
		left: 0,
		right: 240,
		width: 240,
		height: bottom - top,
		toJSON: () => ({}),
	}) as DOMRect;

/** Lay the window out, and return the way back. */
function withLayout(h: Harness, view = VIEW): () => void {
	Object.assign(h.content, { clientHeight: view, clientTop: 0 });
	h.content.getBoundingClientRect = () => rect(0, view);
	const original = Object.getOwnPropertyDescriptor(FakeElement.prototype, "getBoundingClientRect")!;
	FakeElement.prototype.getBoundingClientRect = function (this: FakeElement): DOMRect {
		if (!this.hasClass("cs-icon-library-row")) return (original.value as () => DOMRect).call(this);
		// Every row in display order, across the three groups, and two rows'
		// height for each group heading above it (its 24px gap, its words).
		const at = h.rows().indexOf(this);
		const group = h.list().children.indexOf(this.closest(".cs-icon-library-group")!);
		const top = LIST_TOP + (at + 2 * group) * ROW - h.content.scrollTop;
		return rect(top, top + ROW);
	};
	return () => {
		Object.defineProperty(FakeElement.prototype, "getBoundingClientRect", original);
	};
}

/** Whether a library's row is wholly inside the window's body right now. */
function inView(h: Harness, id: IconSourceId, view = VIEW): boolean {
	const { top, bottom } = h.row(id).getBoundingClientRect();
	return top >= 0 && bottom <= view;
}

describe("Icon libraries — scrolling to a library that moved", () => {
	it("follows a deleted library down to where it landed, out of sight", async () => {
		const h = mount({ ready: EVERYTHING });
		const unlay = withLayout(h);
		try {
			await h.settle();
			assert.equal(h.content.scrollTop, 0);
			h.button("tabler").fire("click");
			await h.settle();
			assert.ok(h.below().includes("tabler"), "it dropped below the line");
			assert.ok(h.content.scrollTop > 0, "the window scrolled down");
			assert.ok(inView(h, "tabler"), "and the row is in view where it landed");
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("follows a hidden library down, and back up when it is shown", async () => {
		const h = mount({ ready: EVERYTHING });
		const unlay = withLayout(h);
		try {
			await h.settle();
			h.button("lucide").fire("click");
			assert.ok(h.below().includes("lucide"));
			const low = h.content.scrollTop;
			assert.ok(low > 0 && inView(h, "lucide"), "down to the hidden libraries, with the row in view");

			h.button("lucide").fire("click");
			assert.ok(h.above().includes("lucide"));
			assert.ok(h.content.scrollTop < low, "back up");
			assert.ok(inView(h, "lucide"), "to where it is shown again");
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("follows a download up once it has finished, and does not move while it runs", async () => {
		const h = mount({ holdDownload: true });
		const unlay = withLayout(h);
		try {
			await h.settle();
			// The end of the list, where the libraries to download are.
			h.content.scrollTop = 350;
			assert.ok(inView(h, "tabler"));
			h.button("tabler").fire("click");
			await h.settle();
			assert.equal(h.content.scrollTop, 350, "the row only shows its spinner, in place");
			assert.ok(h.below().includes("tabler"));

			h.finishDownload();
			await h.settle();
			assert.ok(h.above().includes("tabler"), "it rose above the line");
			assert.ok(h.content.scrollTop < 350, "the window scrolled up with it");
			assert.ok(inView(h, "tabler"));
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("waits for the last file of a library made of several", async () => {
		const h = mount({ holdDownload: true });
		const unlay = withLayout(h);
		try {
			await h.settle();
			h.content.scrollTop = 350;
			h.button("fa").fire("click");
			await h.settle();
			assert.equal(h.content.scrollTop, 350);
			h.finishDownload();
			await h.settle();
			assert.deepEqual(h.downloads, [...libraryFiles("fa")], "every file, one after the other");
			assert.ok(h.above().includes("fa"));
			assert.ok(inView(h, "fa"));
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("follows a deletion that waits for its question", async () => {
		const users = [callout("c0", { type: "tabler-outline", value: "bulb" })];
		const h = mount({ ready: EVERYTHING, users });
		const unlay = withLayout(h);
		try {
			await h.settle();
			await withConfirm(true, async () => {
				h.button("tabler").fire("click");
				await h.settle();
			});
			assert.ok(h.below().includes("tabler"));
			assert.ok(inView(h, "tabler"));
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("leaves the window where it is when the row lands in view anyway", async () => {
		const h = mount({ ready: EVERYTHING });
		const unlay = withLayout(h, 2000);
		try {
			await h.settle();
			h.button("tabler").fire("click");
			await h.settle();
			assert.ok(h.below().includes("tabler"));
			assert.equal(h.content.scrollTop, 0);
		} finally {
			unlay();
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — everything else leaves the scroll alone", () => {
	it("does not move for a download that fails, nor for the library arriving later by other means", async () => {
		const h = mount({ failDownload: true });
		const unlay = withLayout(h);
		try {
			await h.settle();
			h.content.scrollTop = 350;
			h.button("tabler").fire("click");
			await h.settle();
			assert.equal(String(Notice.last?.message), t("iconPack.downloadFailed", { name: "Tabler Icons" }));
			assert.equal(h.content.scrollTop, 350);
			assert.ok(h.below().includes("tabler"));

			// The press ended; it must not be remembered, or a move that someone
			// else makes of that library later would scroll the window.
			h.ready.add("tabler-outline");
			h.ready.add("tabler-filled");
			h.notify();
			assert.ok(h.above().includes("tabler"), "it did move");
			assert.equal(h.content.scrollTop, 350, "and nothing followed");
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("does not move for a library that arrives from somewhere else", async () => {
		const h = mount();
		const unlay = withLayout(h);
		try {
			await h.settle();
			h.content.scrollTop = 350;
			h.ready.add("tabler-outline");
			h.ready.add("tabler-filled");
			h.notify();
			assert.ok(h.above().includes("tabler"));
			assert.equal(h.content.scrollTop, 350);
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("does not move when the question before a deletion is declined", async () => {
		const users = [callout("c0", { type: "tabler-outline", value: "bulb" })];
		const h = mount({ ready: EVERYTHING, users });
		const unlay = withLayout(h);
		try {
			await h.settle();
			await withConfirm(false, async () => {
				h.button("tabler").fire("click");
				await h.settle();
			});
			assert.equal(h.content.scrollTop, 0);
			assert.ok(h.above().includes("tabler"));

			// Declined, and forgotten: the same library going later is not followed.
			for (const file of libraryFiles("tabler")) h.ready.delete(file);
			h.notify();
			assert.ok(h.below().includes("tabler"));
			assert.equal(h.content.scrollTop, 0);
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("does not move when a press is refused", async () => {
		const h = mount({ hidden: ["lucide", "material", "emoji"] });
		const unlay = withLayout(h);
		try {
			await h.settle();
			h.content.scrollTop = 120;
			h.button("image").fire("click");
			assert.equal(h.content.scrollTop, 120);
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("does not move for the reset arrow, though it sends libraries below the line", async () => {
		const h = mount({ ready: EVERYTHING, order: ["image", ...CATALOG.filter((id) => id !== "image")] });
		const unlay = withLayout(h);
		try {
			await h.settle();
			h.content.scrollTop = 40;
			await withConfirm(true, async () => {
				h.reset().fire("click");
				await h.settle();
			});
			assert.ok(h.below().includes("tabler"), "the reset deleted the libraries");
			assert.equal(h.content.scrollTop, 40);
		} finally {
			unlay();
			h.modal.onClose();
		}
	});

	it("does not move for a library reordered with the keyboard", async () => {
		const h = mount();
		const unlay = withLayout(h);
		try {
			await h.settle();
			h.content.scrollTop = 40;
			h.row("lucide")
				.querySelector(".cs-drag-handle")!
				.fire("keydown", { key: "ArrowDown", preventDefault: () => {} });
			assert.deepEqual(h.above(), ["material", "lucide", "emoji", "image"]);
			assert.equal(h.content.scrollTop, 40);
		} finally {
			unlay();
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — each group is rebuilt in one step", () => {
	// The one thing about scrolling the fake DOM can show: a rebuild that first
	// empties a box lets the browser lay the page out with part of it gone — as
	// it does, to blur the focused button being removed — and the window's
	// scroll offset is clamped to the top for good. Only a single swap of each
	// box never presents that state.
	it("swaps every box's rows in at once instead of emptying it first", async () => {
		const h = mount();
		try {
			await h.settle();
			const boxes = (["available", "download", "hidden"] as const).map((group) =>
				h.group(group).querySelector(".setting-items")!,
			);
			let emptied = 0;
			const swaps: number[] = [];
			for (const box of boxes) {
				const empty = box.empty.bind(box);
				box.empty = () => {
					emptied++;
					empty();
				};
				const replace = box.replaceChildren.bind(box);
				box.replaceChildren = (...nodes) => {
					swaps.push(nodes.length);
					replace(...nodes);
				};
			}
			h.button("emoji").fire("click");
			assert.equal(emptied, 0, "no box is ever emptied on its own");
			assert.deepEqual(
				swaps,
				boxes.map((box) => box.children.length),
				"one swap per box, carrying all its rows",
			);
		} finally {
			h.modal.onClose();
		}
	});
});

describe("Icon libraries — the headings are Obsidian's", () => {
	it("leaves the group headings to Obsidian: no size, weight or colour of the plugin's", () => {
		const css = readRepoFile("styles.css");
		const own = parseRules(css)
			.filter((r) => r.selector.includes("cs-icon-library") && /heading|setting-item-name/.test(r.selector))
			.filter((r) => ["font-size", "font-weight", "color"].some((prop) => r.props.includes(prop)))
			.map((r) => r.selector);
		assert.deepEqual(own, []);
	});
});
