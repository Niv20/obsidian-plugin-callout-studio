/**
 * Offline desktop storefront scenes mounted by the production plugin UI.
 * The renderer owns the surrounding artwork, camera, and host-window sizing.
 * These fixtures only seed synthetic content and choose real application state.
 */
import { installDomHelpers } from "obsidian";
import { setLocale } from "../../src/i18n/index.ts";
import { CalloutEditor } from "../../src/settings/CalloutEditor.ts";
import { IconPicker } from "../../src/settings/iconpicker/IconPickerModal.ts";
import { getAllColorPalettes } from "../../src/utils/colorPalettes.ts";
import {
	makeHost,
	mountNote,
	mountSettings,
	openModal,
	seedExample,
} from "../user-guide/fixture-host.mjs";

async function waitFor(predicate, label) {
	for (let frame = 0; frame < 180; frame++) {
		if (predicate()) return;
		await new Promise(resolve => requestAnimationFrame(resolve));
	}
	throw new Error(`Store scene did not finish rendering: ${label}`);
}

function seedCallout(plugin, id, displayName, icon, paletteId, aliases = []) {
	const palette = getAllColorPalettes().find(item => item.id === paletteId);
	if (!palette) throw new Error(`Missing production palette: ${paletteId}`);
	return seedExample(plugin, {
		id,
		aliases,
		displayName,
		icon: { type: "lucide", value: icon },
		paletteId,
		colorLight: palette.colorLight,
		colorDark: palette.colorDark,
		bgColorLight: palette.bgColorLight,
		bgColorDark: palette.bgColorDark,
	});
}

function seedPersonalCallouts(plugin) {
	seedCallout(plugin, "idea", "Idea", "lightbulb", "violet", ["spark"]);
	seedCallout(plugin, "meeting", "Meeting", "messages-square", "plum", ["sync"]);
	seedCallout(plugin, "research", "Research", "telescope", "teal", ["study"]);
}

function settings(plugin) {
	seedPersonalCallouts(plugin);
	// This is the same persisted disclosure state a user reaches by expanding
	// the lists. All 13 built-ins remain in the scrollable production panel.
	plugin.localState.isExpanded = () => true;
	return mountSettings(plugin, {
		title: "All your callouts. One creative space.",
		description: "The production settings list shows Idea, Meeting, and Research with two IDs each above all thirteen expanded built-in callouts, with their actual color swatches and editing controls.",
	});
}

async function notes(plugin, { mobile = false } = {}) {
	seedPersonalCallouts(plugin);
	// Fixed English storefront sample, separate from the localized product UI.
	const mobileCopy = [
		"Give each idea its own icon, colors, and name. Use the same callout in **three** different ways:",
		"",
		"## [!idea] Heading Callout",
		"",
		"Add `[!type]` after the `#`s to make a heading stand out.",
		"",
		"Want an [!idea]{Inline Callout}? Use `[!type]{text}` right in a sentence, without breaking your flow.",
		"",
		"> [!idea] Block Callout",
		"> Use `> [!type]` when an idea deserves its own space.",
		"",
		"Three forms. The same icon and colors throughout your note.",
		"",
		"Use heading callouts to give your notes a clear structure. Mark the start of a new idea, separate your research from your conclusions, or make the next step easy to find when you return to a long note.",
		"",
		"Inline callouts keep small details close to the words around them. Highlight a useful reminder, label an important concept, or add a quick hint while the rest of your paragraph keeps its natural flow.",
		"",
		"Block callouts give longer explanations room to breathe. Gather a few related thoughts, write down the context behind a decision, or save a takeaway you want to revisit later. Choose the form that fits what you want to say.",
	];
	const desktopCopy = [
		"Callout Studio lets you create callouts with a custom icon, colors, and name. Give each idea its own look, then use it anywhere in your notes.",
		"",
		"You can use this callout in **three** different ways:",
		"",
		"## [!idea] Heading Callout",
		"",
		"To turn any heading into a callout-style heading, add `[!type]` right after the `#`s. It keeps the structure of your note while making important sections stand out.",
		"",
		"Want an [!idea]{Inline Callout}? Just add `[!type]{text}` right in a sentence, without breaking your flow. It works well for a quick label or reminder.",
		"",
		"> [!idea] Block Callout",
		"> The classic callout works with the exact syntax you're already used to: `> [!type]`. Use it when an idea deserves its own space.",
		"",
		"Choose the form that fits the moment, and keep the same icon and colors throughout your note.",
	];
	const metadata = await mountNote(plugin, (mobile ? mobileCopy : desktopCopy).join("\n"), {
		title: "Make your notes stand out.",
		description: "The Three Callout Types appears as the note's inline title above a real Idea callout shown as a heading, inline phrase, and block, rendered through the plugin's actual reading processors, icon painter, and generated styles.",
	});
	// Mirror Obsidian's visible note title above the reading view. It comes from
	// the file name, not from a Markdown heading in the note body.
	document.body.classList.add("show-inline-title");
	const note = document.querySelector(metadata.selector);
	if (!note) throw new Error("The note preview was not rendered");
	const inlineTitle = document.createElement("div");
	inlineTitle.className = "inline-title";
	inlineTitle.textContent = "The Three Callout Types";
	note.prepend(inlineTitle);
	return metadata;
}

function create(plugin) {
	// A new callout inherits the configured fallback in the real editor. This
	// seeds the same visible Violet/lightbulb choices without rewriting controls
	// or pretending an existing callout is the Create callout form.
	seedCallout(plugin, "inspiration", "Inspiration", "lightbulb", "violet");
	plugin.settings.fallbackCalloutId = "inspiration";
	const modal = new CalloutEditor(plugin, undefined, {
		seedDisplayName: "Idea",
		seedCalloutId: "idea",
	});
	const metadata = openModal(modal, {
		title: "Create something that feels like you.",
		description: "The actual new-callout editor opens on Idea with the idea and spark IDs, a Violet palette, and a lightbulb icon, showing its real color and icon controls, geometry settings, and live three-format preview.",
	});
	// Commit the second ID through the same field a user uses in this form.
	const input = modal.modalEl.querySelector(".cs-callout-ids-setting .cs-tag-input-field");
	if (!(input instanceof HTMLInputElement)) throw new Error("Callout IDs field was not rendered");
	input.value = "spark";
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
	if (![...modal.modalEl.querySelectorAll(".cs-callout-ids-setting .cs-tag-chip-text")].some(chip => chip.textContent === "spark")) {
		throw new Error("The Idea alias was not added to the callout editor");
	}
	return metadata;
}

async function icons(plugin) {
	const modal = new IconPicker(plugin, { type: "lucide", value: "lightbulb" }, {
		id: "idea",
		name: "Idea",
	});
	const metadata = openModal(modal, {
		title: "Find the perfect icon.",
		description: "The actual icon picker displays the locally installed Lucide library with Lightbulb selected, its source picker, search, icon grid, and Confirm action. No icon library is downloaded.",
	});
	await waitFor(() => modal.modalEl.querySelector(".icon-picker-grid.is-loaded .icon-picker-cell"), "Lucide icon grid");
	await waitFor(() => modal.modalEl.querySelector(".icon-picker-cell.is-selected"), "selected lightbulb");
	return metadata;
}

const mounts = {
	"01-settings": settings,
	"02-notes": notes,
	"03-create": create,
	"04-icons": icons,
};

export const sceneNames = Object.keys(mounts);

export async function mountScene(name, { mobile = false } = {}) {
	installDomHelpers();
	setLocale("en");
	document.body.className = mobile ? "theme-dark is-mobile is-phone" : "theme-dark is-desktop";
	document.body.dataset.storeScene = name;
	const mount = mounts[name];
	if (!mount) throw new Error(`Unknown desktop store scene: ${name}`);
	const metadata = await mount(makeHost(), { mobile });
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	await document.fonts.ready;
	return metadata;
}
