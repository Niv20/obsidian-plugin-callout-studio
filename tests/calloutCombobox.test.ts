/**
 * tests/calloutCombobox.test.ts — the picker that replaced the callout dropdowns.
 *
 * Three things here are the reported bug or a near miss of it, and each is
 * pinned rather than described:
 *
 * - **`Abstract (abstract)` is gone.** The command editor labelled every option
 *   with the display name and the id in parentheses. The closed field now shows
 *   the name alone; the ids and aliases live on a second line in the popup, the
 *   way the `[!` popover has always drawn them.
 * - **Blur never commits.** One of the two values chosen through this widget is
 *   `fallbackCalloutId`, which is persisted *and synced to every device*. A
 *   picker that resolved a half-typed word to "probably the first match" on the
 *   way out would write a callout id the user never chose into a synced file.
 * - **A row click outlives the blur it causes.** Clicking a row blurs the input
 *   first; without the popup's `mousedown` guard the revert would land before
 *   the click and every mouse selection would silently undo itself.
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { asEl, el, fakeDom } from "./support/fakeDom";
import type { FakeElement } from "./support/fakeDom";
import { CalloutRegistry } from "../src/manager/CalloutRegistry";
import { CalloutCombobox } from "../src/settings/calloutCombobox";
import { renderFallbackSection } from "../src/settings/sections/FallbackSection";
import { ListboxPopup } from "../src/ui/listboxPopup";
import type { CalloutDefinition, PluginData } from "../src/types";

function def(over: Partial<CalloutDefinition> = {}): CalloutDefinition {
	return {
		id: "x",
		displayName: "X",
		icon: { type: "lucide", value: "star" },
		colorLight: "#336699",
		colorDark: "#88bbee",
		foldable: true,
		defaultFolded: false,
		builtIn: false,
		source: "user",
		...over,
	};
}

function registryWith(callouts: CalloutDefinition[]): CalloutRegistry {
	const registry = new CalloutRegistry();
	registry.load({ callouts } as Partial<PluginData>);
	return registry;
}

/** The three built-ins these tests pick between. */
const CHOICES = [
	def({
		id: "abstract",
		displayName: "Abstract",
		aliases: ["summary", "tldr"],
		colorLight: "#00b8d4",
	}),
	def({ id: "note", displayName: "Note", colorLight: "#448aff" }),
	def({ id: "warning", displayName: "Warning", aliases: ["caution", "attention"] }),
];

interface Harness {
	host: FakeElement;
	box: CalloutCombobox;
	committed: string[];
	input: FakeElement;
	control: FakeElement;
	menu: FakeElement;
	rows(): FakeElement[];
	/** Row names, top to bottom — what the user actually sees listed. */
	names(): string[];
	open(): void;
	type(text: string): void;
	key(key: string): void;
}

function mount(
	choices: readonly CalloutDefinition[] = CHOICES,
	options: { value?: string; disabled?: boolean } = {},
): Harness {
	fakeDom.light();
	const host = el();
	const committed: string[] = [];
	const box = new CalloutCombobox(asEl(host), {
		registry: registryWith([...choices]),
		choices: () => choices,
		value: options.value ?? "note",
		ariaLabel: "Callout type",
		disabled: options.disabled,
		onChange: (id) => {
			committed.push(id);
		},
	});

	const pick = (cls: string): FakeElement => {
		const found = host.querySelector(cls);
		assert.ok(found, `missing ${cls}`);
		return found;
	};
	const input = pick(".cs-combobox-input");
	const control = pick(".cs-combobox-control");
	const menu = pick(".cs-combobox-menu");
	const rows = (): FakeElement[] => menu.querySelectorAll(".cs-combobox-option");

	return {
		host,
		box,
		committed,
		input,
		control,
		menu,
		rows,
		names: () =>
			rows().map(
				(row) =>
					row.querySelector(".callout-studio-suggestion-name")?.textContent ??
					"",
			),
		open: () => input.fire("focus"),
		type: (text: string) => {
			input.value = text;
			input.fire("input");
		},
		key: (key: string) =>
			input.fire("keydown", {
				key,
				preventDefault: () => {},
				stopPropagation: () => {},
			}),
	};
}

/** Click a row the way a mouse would: the menu's mousedown, then the click. */
function clickRow(h: Harness, index: number): void {
	const row = h.rows()[index];
	assert.ok(row, `no row at ${index}`);
	h.menu.fire("mousedown", { preventDefault: () => {} });
	row.fire("click");
}

const isOpen = (h: Harness): boolean =>
	!h.menu.classList.contains("cs-combobox-menu-hidden");

/* -------------------------------------------------------------------------- */

describe("CalloutCombobox — the closed field", () => {
	it("shows the display name alone, never 'Abstract (abstract)'", () => {
		// The reported bug. The id belongs on a row that needs explaining, not
		// welded to every label in the list.
		const h = mount(CHOICES, { value: "abstract" });

		assert.strictEqual(h.input.value, "Abstract");
		assert.ok(!h.input.value.includes("("), h.input.value);
	});

	it("paints the committed callout's own accent beside the name", () => {
		const h = mount(CHOICES, { value: "abstract" });

		const lead = h.host.querySelector(".cs-combobox-lead");
		assert.strictEqual(lead?.style.color, "#00b8d4");
	});

	it("takes the dark accent when the body is dark", () => {
		fakeDom.dark();
		const host = el();
		new CalloutCombobox(asEl(host), {
			registry: registryWith([...CHOICES]),
			choices: () => CHOICES,
			value: "abstract",
			ariaLabel: "Callout type",
			onChange: () => {},
		});

		assert.strictEqual(
			host.querySelector(".cs-combobox-lead")?.style.color,
			"#88bbee",
		);
		fakeDom.light();
	});

	it("reads an id it does not know as nothing selected", () => {
		const h = mount(CHOICES, { value: "ghost" });

		assert.strictEqual(h.input.value, "");
		assert.ok(h.host.querySelector(".cs-combobox")?.classList.contains("is-empty"));
		assert.deepStrictEqual(h.committed, []);
	});
});

describe("CalloutCombobox — opening and filtering", () => {
	it("offers every choice on open, not a search for what is already chosen", () => {
		// The query is separate state from the input's text. Treating the
		// committed label as the query would open a list of exactly one row.
		const h = mount(CHOICES, { value: "abstract" });

		h.open();

		assert.ok(isOpen(h));
		assert.deepStrictEqual(h.names(), ["Abstract", "Note", "Warning"]);
		assert.strictEqual(h.input.selectCount, 1, "text should be selected");
	});

	it("filters on an alias, and says why the row matched", () => {
		const h = mount();

		h.open();
		h.type("summ");

		assert.deepStrictEqual(h.names(), ["Abstract"]);
		const idLine = h.rows()[0]?.querySelector(".callout-studio-suggestion-id");
		assert.strictEqual(idLine?.textContent, "summary");
	});

	it("lists every id and alias while browsing, like the popover does", () => {
		// The ids are how you find a callout you only half remember, so the line
		// is always there rather than appearing and disappearing with the query.
		const h = mount();

		h.open();

		const idLine = h.rows()[0]?.querySelector(".callout-studio-suggestion-id");
		assert.strictEqual(idLine?.textContent, "abstract, summary, tldr");
	});

	it("narrows the id line to the matching aliases once you type", () => {
		const h = mount();

		h.open();
		h.type("abs");

		assert.deepStrictEqual(h.names(), ["Abstract"]);
		assert.strictEqual(
			h.rows()[0]?.querySelector(".callout-studio-suggestion-id")?.textContent,
			"abstract",
		);
	});

	it("matches a substring anywhere, not a fuzzy scatter", () => {
		const h = mount();

		h.open();
		h.type("arn");

		assert.deepStrictEqual(h.names(), ["Warning"]);
	});

	it("shows an empty state, and Enter on it commits nothing", () => {
		const h = mount();

		h.open();
		h.type("zzzz");

		assert.deepStrictEqual(h.names(), []);
		assert.ok(h.menu.querySelector(".callout-studio-empty-state"));

		h.key("Enter");
		assert.deepStrictEqual(h.committed, []);
	});
});

describe("CalloutCombobox — choosing", () => {
	it("commits on click, once, and closes", () => {
		const h = mount();

		h.open();
		clickRow(h, 0);

		assert.deepStrictEqual(h.committed, ["abstract"]);
		assert.strictEqual(h.input.value, "Abstract");
		assert.ok(!isOpen(h));
	});

	it("arrows move the highlight and Enter takes it", () => {
		const h = mount();

		h.open();
		// Opens on the committed row — Note, the second.
		assert.ok(h.rows()[1]?.classList.contains("is-active"));

		h.key("ArrowDown");
		assert.ok(h.rows()[2]?.classList.contains("is-active"));
		assert.strictEqual(
			h.input.getAttribute("aria-activedescendant"),
			h.rows()[2]?.id,
		);

		h.key("Enter");
		assert.deepStrictEqual(h.committed, ["warning"]);
	});

	it("marks the committed row selected, separately from the highlight", () => {
		// `is-active` is where the keyboard is; `is-selected` is what is chosen.
		// Folding the two together would make merely arrowing past a row look
		// like choosing it.
		const h = mount();

		h.open();
		h.key("ArrowDown");

		const rows = h.rows();
		assert.ok(rows[1]?.classList.contains("is-selected"), "Note stays selected");
		assert.ok(!rows[1]?.classList.contains("is-active"));
		assert.ok(rows[2]?.classList.contains("is-active"));
		assert.strictEqual(rows[1]?.getAttribute("aria-selected"), "true");
	});
});

describe("CalloutCombobox — leaving without choosing", () => {
	it("reverts a half-typed word on blur and commits nothing", () => {
		// The one that matters: `fallbackCalloutId` is synced, so a guess here
		// travels to every device the user owns.
		const h = mount();

		h.open();
		h.type("warn");
		h.input.fire("blur");

		assert.deepStrictEqual(h.committed, []);
		assert.strictEqual(h.input.value, "Note");
		assert.ok(!isOpen(h));
	});

	it("reverts on Escape", () => {
		const h = mount();

		h.open();
		h.type("warn");
		h.key("Escape");

		assert.deepStrictEqual(h.committed, []);
		assert.strictEqual(h.input.value, "Note");
		assert.ok(!isOpen(h));
	});

	it("stops Escape from also closing the modal around it", () => {
		const h = mount();
		let stopped = false;
		h.open();
		h.input.fire("keydown", {
			key: "Escape",
			preventDefault: () => {},
			stopPropagation: () => {
				stopped = true;
			},
		});

		assert.ok(stopped, "the first Escape belongs to the popup");
	});

	it("closes on a click elsewhere in the document", () => {
		const h = mount();
		h.open();

		fakeDom.document.fire("click", { target: el() });

		assert.ok(!isOpen(h));
		assert.deepStrictEqual(h.committed, []);
	});

	it("ignores a document click that landed inside itself", () => {
		const h = mount();
		h.open();

		fakeDom.document.fire("click", { target: h.menu });

		assert.ok(isOpen(h));
	});
});

describe("CalloutCombobox — lifecycle", () => {
	it("destroy() takes its document listener back", () => {
		fakeDom.light();
		const before = fakeDom.document.listeners.get("click")?.length ?? 0;

		const h = mount();
		assert.strictEqual(
			fakeDom.document.listeners.get("click")?.length ?? 0,
			before + 1,
		);

		h.box.destroy();
		assert.strictEqual(
			fakeDom.document.listeners.get("click")?.length ?? 0,
			before,
		);
	});

	it("an empty choice list disables the field and refuses to open", () => {
		const h = mount([], { value: "" });

		assert.strictEqual(h.input.disabled, true);
		h.open();
		assert.ok(!isOpen(h));
	});

	it("setValue moves the selection without reporting a change", () => {
		const h = mount();

		h.box.setValue("warning");

		assert.strictEqual(h.input.value, "Warning");
		assert.strictEqual(h.box.value, "warning");
		assert.deepStrictEqual(h.committed, []);
	});
});

describe("CalloutCombobox — clicking into the field", () => {
	/**
	 * A real mouse click: mousedown, then the focus it causes, then click.
	 * `focus()` as well as `fire("focus")` — the first moves the document's
	 * `activeElement`, which is the very thing the mousedown handler reads to
	 * tell a first click from a second.
	 */
	function clickControl(h: Harness): void {
		h.control.fire("mousedown", {});
		h.input.focus();
		h.input.fire("focus");
		h.control.fire("click", {});
	}

	it("selects the whole label so the first keystroke replaces it", () => {
		// `openMenu`'s own select() cannot survive a mouse click — the browser's
		// mouseup places a caret and collapses it — so the control re-selects on
		// click, which runs after. Without that second select this is the bug the
		// user reported: you click, and you are typing into the middle of "Note".
		const h = mount();

		clickControl(h);

		assert.ok(h.input.selectCount >= 2, `selectCount=${h.input.selectCount}`);
	});

	it("leaves a second click alone, so the text stays editable", () => {
		const h = mount();

		clickControl(h);
		const afterFirst = h.input.selectCount;
		// Focus is already on the input now, so this one must place a caret.
		h.control.fire("mousedown", {});
		h.control.fire("click", {});

		assert.strictEqual(h.input.selectCount, afterFirst);
	});
});

describe("CalloutCombobox — creating the callout you searched for", () => {
	/** Mounts with an onCreate that mints `made` and adds it to the choices. */
	function mountCreatable(made: CalloutDefinition | null) {
		fakeDom.light();
		const host = el();
		const pool = [...CHOICES];
		const committed: string[] = [];
		const asked: string[] = [];
		const box = new CalloutCombobox(asEl(host), {
			registry: registryWith([...CHOICES, ...(made ? [made] : [])]),
			choices: () => pool,
			value: "note",
			ariaLabel: "Callout type",
			onCreate: (name) => {
				asked.push(name);
				// The real editor saves into the registry before resolving; the
				// picker re-reads `choices()`, so mirror that here.
				if (made) pool.push(made);
				return Promise.resolve(made);
			},
			onChange: (id) => {
				committed.push(id);
			},
		});
		const input = host.querySelector(".cs-combobox-input");
		assert.ok(input);
		const menu = host.querySelector(".cs-combobox-menu");
		assert.ok(menu);
		return { host, box, input, menu, committed, asked };
	}

	const CREATED = def({ id: "recipe", displayName: "Recipe" });

	it("offers to create it instead of reporting a dead end", () => {
		const h = mountCreatable(CREATED);

		h.input.fire("focus");
		h.input.value = "Recipe";
		h.input.fire("input");

		// The create row replaces the empty state — and wears the popover's own
		// create-row class, so it looks like the offer the user already knows.
		assert.strictEqual(h.menu.querySelector(".callout-studio-empty-state"), null);
		const createRow = h.menu.querySelector(".callout-studio-suggestion-create-new");
		assert.ok(createRow, "expected a create row");
		assert.ok(
			createRow.querySelector(".callout-studio-suggestion-name")?.textContent
				?.includes("Recipe"),
		);
	});

	it("adopts what was created, and reports it as the new value", async () => {
		const h = mountCreatable(CREATED);

		h.input.fire("focus");
		h.input.value = "Recipe";
		h.input.fire("input");
		h.menu.fire("mousedown", { preventDefault: () => {} });
		h.menu.querySelector(".callout-studio-suggestion-create-new")?.fire("click");
		// onCreate is async, and so is the adoption that follows it.
		await Promise.resolve();
		await Promise.resolve();

		assert.deepStrictEqual(h.asked, ["Recipe"]);
		assert.strictEqual(h.box.value, "recipe");
		assert.strictEqual(h.input.value, "Recipe");
		assert.deepStrictEqual(h.committed, ["recipe"]);
	});

	it("keeps the old value when the user backs out of the editor", async () => {
		const h = mountCreatable(null);

		h.input.fire("focus");
		h.input.value = "Recipe";
		h.input.fire("input");
		h.menu.fire("mousedown", { preventDefault: () => {} });
		h.menu.querySelector(".callout-studio-suggestion-create-new")?.fire("click");
		await Promise.resolve();
		await Promise.resolve();

		assert.deepStrictEqual(h.committed, []);
		assert.strictEqual(h.box.value, "note");
	});

	it("offers nothing to create for an empty query", () => {
		const h = mountCreatable(CREATED);

		h.input.fire("focus");

		assert.strictEqual(
			h.menu.querySelector(".callout-studio-suggestion-create-new"),
			null,
		);
	});
});

/* -------------------------------------------------------------------------- */

describe("renderComboboxRows — group headings", () => {
	/** Two groups, drawn through the popup the palette picker uses. */
	function grouped(query: string): FakeElement {
		fakeDom.light();
		const host = el();
		const items = [
			{ id: "a", group: "custom", name: "Aqua" },
			{ id: "b", group: "custom", name: "Amber" },
			{ id: "c", group: "preset", name: "Crimson" },
		];
		new ListboxPopup<(typeof items)[number]>(asEl(host), {
			ariaLabel: "Color",
			placeholder: "Search colors…",
			emptyText: () => "none",
			itemsFor: (q) =>
				items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())),
			renderRow: (rowEl, item) => rowEl.createSpan({ text: item.name }),
			groupOf: (item) => ({ key: item.group, label: item.group }),
			labelOf: (item) => item.name,
			keyOf: (item) => item.id,
			onCommit: () => {},
		});
		const input = host.querySelector(".cs-combobox-input");
		assert.ok(input);
		input.fire("focus");
		if (query) {
			input.value = query;
			input.fire("input");
		}
		return host;
	}

	const labels = (host: FakeElement): string[] =>
		host
			.querySelectorAll(".cs-combobox-group-label")
			.map((e) => e.textContent ?? "");

	it("opens one heading per run, not one per row", () => {
		assert.deepStrictEqual(labels(grouped("")), ["custom", "preset"]);
	});

	it("drops a heading whose every row was typed away", () => {
		// The bug this design avoids: headings emitted from a fixed list of
		// groups would leave "preset" stranded over nothing.
		assert.deepStrictEqual(labels(grouped("am")), ["custom"]);
	});
});

/* -------------------------------------------------------------------------- */

describe("renderFallbackSection — the settings row end to end", () => {
	/** The slice of the section's context this row actually touches. */
	function fakeCtx(registry: CalloutRegistry) {
		const disposers: (() => void)[] = [];
		const settings = { fallbackCalloutId: "note" };
		const calls: string[] = [];
		return {
			disposers,
			settings,
			calls,
			ctx: {
				app: {},
				display: () => {},
				registerDisposer: (d: () => void) => disposers.push(d),
				plugin: {
					registry,
					settings,
					restyleUncustomizedFallbackRows: () => {
						calls.push("restyle");
						return 0;
					},
					saveSettings: () => {
						calls.push("save");
						return Promise.resolve();
					},
					refreshCallouts: () => calls.push("refresh"),
				},
			} as unknown as Parameters<typeof renderFallbackSection>[0],
		};
	}

	it("offers the callouts, but never a theme overlay row", () => {
		// `fallbackCalloutId` is persisted and synced, and a theme row exists
		// only while that theme is active on this machine (issue #41).
		fakeDom.light();
		const registry = registryWith([...CHOICES]);
		// Added, not loaded: a theme overlay row is minted from the active
		// theme's stylesheet and never persisted, so `load` would not keep one.
		registry.add(def({ id: "themed", displayName: "Themed", source: "theme" }));
		const host = el();
		const { ctx } = fakeCtx(registry);

		renderFallbackSection(ctx, asEl(host));

		const input = host.querySelector(".cs-combobox-input");
		assert.ok(input);
		assert.strictEqual(input.value, "Note");
		input.fire("focus");
		// The registry seeds the built-ins alongside these, so the assertion is
		// about who is present, not about the whole list.
		const names = host
			.querySelectorAll(".callout-studio-suggestion-name")
			.map((e) => e.textContent);
		for (const offered of ["Abstract", "Note", "Warning"]) {
			assert.ok(names.includes(offered), `${offered} missing`);
		}
		assert.ok(!names.includes("Themed"), "a theme row must never be offered");
	});

	it("saves before refreshing, and registers its teardown", async () => {
		fakeDom.light();
		const host = el();
		const harness = fakeCtx(registryWith([...CHOICES]));

		renderFallbackSection(harness.ctx, asEl(host));
		assert.strictEqual(harness.disposers.length, 1);

		const input = host.querySelector(".cs-combobox-input");
		assert.ok(input);
		input.fire("focus");
		// Narrow to exactly one row rather than indexing into the built-ins.
		input.value = "warning";
		input.fire("input");
		const row = host.querySelectorAll(".cs-combobox-option")[0];
		assert.ok(row);
		host.querySelector(".cs-combobox-menu")?.fire("mousedown", {
			preventDefault: () => {},
		});
		row.fire("click");

		assert.strictEqual(harness.settings.fallbackCalloutId, "warning");
		// `onChange` awaits the save, so the refresh lands a microtask later.
		await Promise.resolve();
		// The order matters: a refresh that ran before the save would paint from
		// settings that had not been written yet.
		assert.deepStrictEqual(harness.calls, ["restyle", "save", "refresh"]);
	});

	it("the registered disposer really releases the listener", () => {
		fakeDom.light();
		const before = fakeDom.document.listeners.get("click")?.length ?? 0;
		const harness = fakeCtx(registryWith([...CHOICES]));

		renderFallbackSection(harness.ctx, asEl(el()));
		for (const dispose of harness.disposers) dispose();

		assert.strictEqual(
			fakeDom.document.listeners.get("click")?.length ?? 0,
			before,
		);
	});
});
