/**
 * The persisted `edit` menu row is one adaptive action: it edits a definition
 * when the token resolves to one and creates the token's own definition when
 * it only borrows the fallback appearance. The distinction must come from the
 * resolver's `unknown` flag — unknown tokens normally still return `def`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Editor, Menu } from "obsidian";
import { t } from "../src/i18n";
import type CalloutStudioPlugin from "../src/main";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutEditor } from "../src/settings/CalloutEditor";
import { addItems } from "../src/editor/contextmenu/items";
import type { ResolvedCalloutContext } from "../src/editor/contextmenu/resolve";
import type { CalloutDefinition } from "../src/types";

interface RecordedItem {
	title: string;
	icon: string;
	section: string;
	click: (() => void) | null;
}

function recordingMenu(): { menu: Menu; items: RecordedItem[] } {
	const items: RecordedItem[] = [];
	const menu = {
		addItem(configure: (item: unknown) => void) {
			const recorded: RecordedItem = {
				title: "",
				icon: "",
				section: "",
				click: null,
			};
			const item = {
				setTitle(value: string) {
					recorded.title = value;
					return this;
				},
				setIcon(value: string) {
					recorded.icon = value;
					return this;
				},
				setSection(value: string) {
					recorded.section = value;
					return this;
				},
				onClick(value: () => void) {
					recorded.click = value;
					return this;
				},
			};
			configure(item);
			items.push(recorded);
			return menu;
		},
	};
	return { menu: menu as unknown as Menu, items };
}

function context(id: string): ResolvedCalloutContext {
	return {
		role: "inline",
		id,
		editor: {} as Editor,
		view: null,
		surface: "source",
		targetEl: {} as Element,
	};
}

function harness(id: string, enabled = true) {
	const registry = new CalloutRegistry();
	registry.load(null);
	registry.settings.contextMenu.items.inline = [{ id: "edit", enabled }];
	const plugin = {
		app: {},
		registry,
		settings: registry.settings,
	} as unknown as CalloutStudioPlugin;
	const recorded = recordingMenu();
	addItems(plugin, recorded.menu, context(id));
	return { ...recorded, plugin, registry };
}

function addCustom(
	registry: CalloutRegistry,
	id: string,
	aliases: string[] = [],
): CalloutDefinition {
	const note = registry.get("note")!;
	const def: CalloutDefinition = {
		...note,
		icon: { ...note.icon },
		id,
		displayName: id,
		aliases,
		builtIn: false,
		source: "user",
	};
	registry.add(def);
	return def;
}

function withRecordedEditors(run: (opened: CalloutEditor[]) => void): void {
	const original = Object.getOwnPropertyDescriptor(
		CalloutEditor.prototype,
		"openAndWait",
	)!;
	const opened: CalloutEditor[] = [];
	CalloutEditor.prototype.openAndWait = function () {
		opened.push(this);
		return Promise.resolve(null);
	};
	try {
		run(opened);
	} finally {
		Object.defineProperty(CalloutEditor.prototype, "openAndWait", original);
	}
}

describe("adaptive create/edit context-menu action", () => {
	it("edits the canonical definition for exact, alias, and attribute-form ids", () => {
		for (const clickedId of ["a b", "short", "a-b"]) {
			const h = harness(clickedId);
			const def = addCustom(h.registry, "a b", ["short"]);
			// The item list was built before the custom row was registered above.
			h.items.length = 0;
			addItems(h.plugin, h.menu, context(clickedId));

			assert.equal(h.items.length, 1);
			assert.equal(h.items[0]!.title, t("contextMenu.editCallout"));
			assert.equal(h.items[0]!.icon, "pencil");
			withRecordedEditors((opened) => {
				h.items[0]!.click!();
				assert.equal(opened.length, 1);
				assert.equal(
					(opened[0] as unknown as { existingId: string | null })
						.existingId,
					def.id,
				);
			});
		}
	});

	it("offers one create action for an unknown token instead of editing its fallback", () => {
		const h = harness("missing_name-with-dash");
		assert.equal(h.items.length, 1);
		assert.equal(h.items[0]!.title, t("editor.createCallout"));
		assert.equal(h.items[0]!.icon, "plus");

		withRecordedEditors((opened) => {
			h.items[0]!.click!();
			assert.equal(opened.length, 1);
			const editor = opened[0] as unknown as {
				existingId: string | null;
				calloutId: string;
				createFromToken: boolean;
			};
			assert.equal(editor.existingId, null);
			assert.equal(editor.calloutId, "missing_name-with-dash");
			assert.equal(editor.createFromToken, true);
		});
	});

	it("still offers creation when the configured fallback definition is missing", () => {
		const h = harness("not-yet-defined");
		h.registry.settings.fallbackCalloutId = "missing-fallback";
		h.items.length = 0;
		addItems(h.plugin, h.menu, context("not-yet-defined"));
		assert.equal(h.items.length, 1);
		assert.equal(h.items[0]!.title, t("editor.createCallout"));
	});

	it("adds nothing when the single saved action is disabled", () => {
		assert.equal(harness("unknown", false).items.length, 0);
	});
});
