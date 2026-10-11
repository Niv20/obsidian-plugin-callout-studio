/** Production components, driven at build time into native transparent renders. */
import { Menu } from "obsidian";
import { registerNativeUiIcons } from "./native-icons.mjs";
import { CalloutEditor } from "../../src/settings/CalloutEditor.ts";
import { IconPicker } from "../../src/settings/iconpicker/IconPickerModal.ts";
import { ManualCalloutDiscovery } from "../../src/manager/ManualCalloutDiscovery.ts";
import { renderCustomPalettesSection } from "../../src/settings/sections/CustomPalettesSection.ts";
import { createCalloutListsController } from "../../src/settings/sections/CalloutListsSection.ts";
import { renderCalloutRow } from "../../src/settings/sections/CalloutRowRenderer.ts";
import { openRowMenu, openBuiltInRowMenu } from "../../src/settings/sections/CalloutRowActions.ts";
import { freshPaging } from "../../src/settings/sections/calloutListsSignature.ts";
import { derivePaletteFromColor } from "../../src/utils/colorUtils.ts";
import { bakePaletteColors, customPaletteToColorPalette } from "../../src/utils/colorPalettes.ts";
import { renderMarkdown, seedExample, settingsContext } from "../user-guide/fixture-host.mjs";

const noteSource = ["src/reading/calloutPostProcessor.ts", "src/manager/CSSInjector.ts", "src/manager/CalloutRegistry.ts"];
const rowSource = ["src/settings/sections/CalloutListsSection.ts", "src/settings/sections/CalloutRowRenderer.ts"];
const full = { x: 28, y: 28, width: 684, height: 594 };
function required(root, selector) {
	const node = root.querySelector(selector);
	if (!node) throw new Error(`Missing production component ${selector}`);
	return node;
}
function button(root, text) {
	const node = [...root.querySelectorAll("button")].find(el => el.textContent.trim() === text);
	if (!node) throw new Error(`Missing production button ${text}`);
	return node;
}
function type(input, value) {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}
function park(ctx, time) { ctx.point(time, { x: 683, y: 600 }); }
async function note(ctx, markdown, width = 650) {
	const panel = document.body.createDiv({ cls: "guide-note markdown-preview-view" });
	panel.style.width = `${width}px`;
	await renderMarkdown(ctx.plugin, panel.createDiv({ cls: "markdown-rendered" }), markdown);
	return panel;
}
function settings(ctx, hooks = {}) {
	const root = document.body.createDiv({ cls: "callout-studio-settings guide-settings" });
	const context = settingsContext(ctx.plugin);
	const controller = createCalloutListsController(context, {
		paging: freshPaging(), onAddNewCallout: hooks.add ?? (async () => {}),
		renderRow: (parent, def, kind) => renderCalloutRow(context, parent, def, kind, {
			onEdit() {}, onOpenBuiltInMenu: (event, row) => void openBuiltInRowMenu(context, event, row),
			onOpenUserMenu: (event, row) => void openRowMenu(context, event, row),
		}),
	});
	context.display = () => { controller.refresh(true); hooks.refresh?.(); };
	controller.render(root);
	// Focused crop of the real user section; no altered controls or UI copy.
	root.querySelector(".cs-header-row").style.display = "none";
	root.querySelector(".cs-sticky-section-last").style.display = "none";
	return { root, controller, context };
}

async function threeTypes(ctx) {
	const root = await note(ctx, "> [!note] Note\n> Keep the important details together.\n\n## [!note] Note\n\nA heading introduces the next section.\n\nKeep a [!note]{Note} inside the sentence.");
	ctx.show(root); ctx.point(0, { x: 669, y: 583 }); await ctx.capture(0);
	ctx.point(1.6, required(root, ".callout-title"));
	ctx.point(2.8, required(root, ".callout-title"));
	ctx.point(4, required(root, "h2"));
	ctx.point(5, required(root, "h2"));
	ctx.point(6.1, required(root, ".cs-inline-callout, .callout-studio-inline, [data-cs-render-role='inline']"));
	ctx.point(6.8, required(root, ".cs-inline-callout, .callout-studio-inline, [data-cs-render-role='inline']"));
	park(ctx, 8); await ctx.capture(8);
	return { sources: noteSource, description: "The production reading processor and generated stylesheet render Note as a block, heading and inline token. The pointer guides the eye through the actual three render roles." };
}

async function createCallout(ctx) {
	let modal;
	const list = settings(ctx, { add: async () => { modal = new CalloutEditor(ctx.plugin); modal.open(); } });
	ctx.show(list.root); ctx.point(0, { x: 666, y: 518 }); await ctx.capture(0);
	const add = button(list.root, "Add new callout"); ctx.point(0.55, add, true); add.click();
	await ctx.until(() => modal?.modalEl.querySelector("input"), "callout editor");
	ctx.show(modal.modalEl); await ctx.capture(0.8, { transition: 0.2 });
	const input = required(modal.modalEl, "input.cs-text-control"); ctx.point(1.12, input, true);
	for (const [time, text] of [[1.35,"I"],[1.5,"Id"],[1.65,"Ide"],[1.85,"Idea"]]) {
		type(input, text); await ctx.capture(time, { transition: 0 });
	}
	await ctx.until(() => modal.modalEl.querySelector(".cs-live-preview-render")?.textContent.includes("Idea"), "Idea live preview");
	const preview = required(modal.modalEl,".cs-live-preview-render");
	const targetScroll = Math.max(0, preview.getBoundingClientRect().top - modal.contentEl.getBoundingClientRect().top + modal.contentEl.scrollTop - 24);
	// Capture the real scroll at 60Hz: dissolving large scroll steps doubles text.
	for (let frame=0;frame<=30;frame++) {
		const progress=frame/30;
		const eased=progress*progress*(3-2*progress);
		modal.contentEl.scrollTop=targetScroll*eased;
		await ctx.capture(2.05+frame/60,{transition:0});
	}
	const create = button(modal.modalEl, "Create callout"); ctx.point(3.2, create, true); create.click();
	await ctx.until(() => ctx.plugin.registry.getReal("idea") && !ctx.plugin.settingsEditOpen, "saved Idea");
	list.controller.refresh(true); ctx.show(list.root); await ctx.capture(3.85, { transition: 0.22 });
	park(ctx, 5); await ctx.capture(5);
	return { sources: [...rowSource,"src/settings/CalloutEditor.ts","src/settings/editor/CalloutEditorSave.ts"], description: "The real Add new callout control opens CalloutEditor. Native input events type Idea, derive its ID, update its production preview and save it into the isolated registry through the normal Create action." };
}

async function colorPalettes(ctx) {
	const palette = { id: "intro-warning", name: "Warm warning", baseColor: "#ed8b24", bgIntensity: 0.18,
		...derivePaletteFromColor("#ed8b24", 0.18), transparentBg: true };
	ctx.plugin.settings.customPalettes.push(palette);
	ctx.plugin.registry.update("warning", { ...bakePaletteColors(customPaletteToColorPalette(palette)), paletteId: palette.id });
	ctx.plugin.cssInjector.inject(false);
	const list = document.body.createDiv({ cls: "callout-studio-settings guide-settings" });
	renderCustomPalettesSection(settingsContext(ctx.plugin), list);
	required(list, 'button[aria-label="Edit palette Warm warning"]').click();
	const modal = required(document, ".callout-studio-editor-modal");
	ctx.show(modal); await ctx.settle();
	ctx.point(0, { x: 667, y: 529 }); await ctx.capture(0);
	const style = required(modal, ".cs-palette-bgstyle-setting .cs-combobox-control");
	ctx.point(0.85, style, true); style.click(); await ctx.capture(1.05, { transition: 0.15 });
	const gradient = [...modal.querySelectorAll('[role="option"]')].find(el => el.textContent.trim() === "Gradient");
	if (!gradient) throw new Error("Actual palette Gradient option missing");
	ctx.point(1.5, gradient, true); gradient.click(); await ctx.capture(1.8, { transition: 0.18 });
	const secondRow = [...modal.querySelectorAll(".setting-item")].find(el => el.querySelector(".setting-item-name")?.textContent === "Second color");
	const second = required(secondRow, 'input[type="color"]'); ctx.point(2.4, second, true);
	// Native color chooser is supplied by the operating system, outside the plugin DOM.
	// Its real committed input event is rendered without inventing a replacement picker.
	type(second, "#f27468"); await ctx.capture(2.8, { transition: 0.24 });
	const save = button(modal, "Save"); ctx.point(3.75, save, true); save.click();
	await ctx.until(() => Boolean(palette.bgGradient), "saved gradient palette");
	ctx.plugin.cssInjector.inject(false);
	const result = await note(ctx, "> [!warning] Warning\n> Check the details before continuing.");
	ctx.show(list, { x:28,y:64,width:684,height:224 });
	ctx.show(result, { x:28,y:307,width:684,height:276 }, true);
	await ctx.capture(4.3, { transition: 0.22 }); park(ctx, 5); await ctx.capture(5);
	return { sources: ["src/settings/PaletteEditorModal.ts","src/settings/sections/CustomPalettesSection.ts","src/ui/ColorSwatchInput.ts",...noteSource], description: "The production saved-palette Edit action opens its actual editor. Real Style and Second color input events change Transparent to an orange/coral Gradient; Save cascades the palette to the linked Warning definition. The editor retains its authentic generic preview; the final separate Warning excerpt is rendered by the real reading processor." };
}

async function customIcons(ctx) {
	// Use the real saved library visibility preference to show only local artwork.
	ctx.plugin.settings.iconLibraries.hidden = ["material"];
	const picker = new IconPicker(ctx.plugin, undefined, { id: "note", name: "Note" });
	const choice = picker.openAndWait(); ctx.show(picker.modalEl);
	await ctx.until(() => picker.modalEl.querySelector(".icon-picker-grid.is-loaded .icon-picker-cell"), "All sources grid");
	ctx.point(0, { x:663,y:550 }); await ctx.capture(0);
	const search = required(picker.modalEl, ".icon-picker-search-input"); ctx.point(0.35, search, true);
	for (const [time,value] of [[0.45,"s"],[0.6,"st"],[0.75,"sta"],[0.9,"star"]]) {
		type(search,value); await ctx.capture(time, { transition: 0 });
	}
	await ctx.until(() => [...picker.modalEl.querySelectorAll(".icon-picker-cell")].some(el => el.textContent.includes("⭐")), "star emoji search result");
	const cells = [...picker.modalEl.querySelectorAll(".icon-picker-cell")];
	const emoji = cells.find(el => el.textContent.includes("⭐"));
	const outline = cells.find(el => el.querySelector("svg"));
	if (outline) ctx.point(1.6, outline);
	emoji.scrollIntoView({block:"nearest"}); await ctx.settle();
	ctx.point(2.7, emoji); await ctx.capture(2);
	ctx.point(3.1, emoji, true); emoji.click(); await ctx.capture(3.2, { transition: 0.15 });
	const confirm = button(picker.modalEl, "Confirm"); ctx.point(4, confirm, true); confirm.click();
	const icon = await choice;
	if (icon?.type !== "emoji" || !icon.value.includes("⭐")) throw new Error("Icon picker did not commit star emoji");
	ctx.plugin.registry.update("note", { icon }); ctx.plugin.cssInjector.inject(false);
	const root = await note(ctx, "> [!note] Note\n> Keep the important details together.\n\n## [!note] Note\n\nA heading introduces the next section.\n\nKeep a [!note]{Note} inside the sentence.");
	ctx.show(root); await ctx.capture(4.35, { transition: 0.22 }); park(ctx,5); await ctx.capture(5);
	return { sources: ["src/settings/iconpicker/IconPickerModal.ts","src/settings/iconpicker/PackPanel.ts",...noteSource], description: "Actual All sources icon picker searches the locally bundled indexes for star. Selecting the real emoji cell and Confirm updates Note's icon, which is then displayed by all three production renderers." };
}

async function discovery(ctx) {
	ctx.plugin.seedNote("Recipe.md", "> [!recipe] Recipe\n> Keep your favorite combinations here.");
	const list = settings(ctx);
	// Keep the real settings crop anchored as the empty state becomes one row.
	list.root.style.height="168px";
	list.root.style.boxSizing="border-box";
	const scan = new ManualCalloutDiscovery({ app:ctx.plugin.app, registry:ctx.plugin.registry,
		settingsWriter: { isFrozen:false, busy:false, commit:async (_data,guard,publish) => { if (!guard()) return false; publish(); return true; } },
		themeIds:() => new Set(), canApply:() => true,
		onSettled:() => { ctx.plugin.cssInjector.inject(false); list.controller.refresh(true); },
	});
	ctx.plugin.runVaultScan = () => scan.run();
	const root = await note(ctx, "> [!recipe] Recipe\n> Keep your favorite combinations here.");
	ctx.show(root, {x:28,y:50,width:684,height:250});
	ctx.show(list.root, {x:28,y:316,width:684,height:272}, true);
	ctx.point(0,{x:663,y:598}); await ctx.capture(0);
	const scanButton = required(list.root, ".cs-discover-callouts-btn");
	ctx.point(0.62,scanButton,true); scanButton.click();
	await ctx.until(() => ctx.plugin.registry.getReal("recipe"), "Recipe scan result");
	await ctx.capture(1.1,{transition:0}); park(ctx,2); await ctx.capture(2);
	return { sources: [...rowSource,"src/manager/ManualCalloutDiscovery.ts","src/settings/sections/manualDiscoveryButton.ts",...noteSource], description: "The actual Scan for callouts action runs ManualCalloutDiscovery over a synthetic in-memory Recipe note. Its staged persistence adapter commits only to the isolated fixture; the actual row receives Default fallback while the note keeps its appearance." };
}

async function replaceCallout(ctx) {
	// The documentation host Menu lacks Component.register; production uses it
	// only to register hide cleanup. This build-time menu has one finite lifetime.
	Menu.prototype.register ??= function () {};
	registerNativeUiIcons();
	seedExample(ctx.plugin,{id:"idea",displayName:"Idea",icon:{type:"lucide",value:"lightbulb"},colorLight:"#a464de",colorDark:"#c294ef"});
	const paths = ["Planning.md","Research.md"];
	const texts = ["> [!idea] Idea\n> Capture the next step.","> [!idea] Idea\n> Keep the useful reference."];
	paths.forEach((path,i) => ctx.plugin.seedNote(path,texts[i]));
	ctx.plugin.app.vault.process = async (file,transform) => {
		const result = transform(await ctx.plugin.app.vault.read(file));
		ctx.plugin.seedNote(file.path,result); return result;
	};
	const list = settings(ctx);
	const notes = await note(ctx,texts.join("\n\n"));
	ctx.show(list.root,{x:28,y:48,width:684,height:215});
	ctx.show(notes,{x:28,y:282,width:684,height:302},true);
	ctx.point(0,{x:673,y:583}); await ctx.capture(0);
	const more = required(list.root,".callout-studio-more-btn");
	ctx.point(0.6,more,true); more.click();
	await ctx.until(() => document.querySelector(".menu"), "row actions menu");
	const menu = required(document,".menu");
	// The native menu is a separate overlay; give it a bounded scene position.
	Object.assign(menu.style,{position:"absolute",left:"416px",top:"190px"}); ctx.stage.appendChild(menu);
	await ctx.capture(0.85,{transition:0.14});
	const replace = [...menu.querySelectorAll(".menu-item")].find(el => el.textContent.includes("Replace in vault"));
	if (!replace) throw new Error("Actual Replace in vault menu action missing");
	ctx.point(1.4,replace,true); replace.click(); menu.remove();
	await ctx.until(() => document.querySelector(".callout-studio-replace-modal"), "replacement modal");
	const modal = required(document,".callout-studio-replace-modal"); ctx.show(modal,full);
	await ctx.capture(1.7,{transition:0.2});
	const search = required(modal,".callout-studio-replace-search"); ctx.point(2.1,search,true);
	for (const [time,value] of [[2.3,"T"],[2.5,"Ti"],[2.7,"Tip"]]) { type(search,value); await ctx.capture(time,{transition:0}); }
	const tip = [...modal.querySelectorAll(".callout-studio-replace-item")].find(el => el.querySelector(".callout-studio-replace-item-id")?.textContent === "tip");
	if (!tip) throw new Error("Actual Tip result missing");
	ctx.point(3.5,tip,true); tip.click(); await ctx.capture(3.6,{transition:0.16});
	const confirm = button(modal,"Replace"); ctx.point(4.35,confirm,true); confirm.click();
	await ctx.until(() => !modal.querySelector(".callout-studio-replace-search"), "replacement confirmation");
	await ctx.settle();
	await ctx.until(() => !document.querySelector(".menu"), "dismissed replacement menu");
	const after = await Promise.all(paths.map(path => ctx.plugin.app.vault.read(ctx.plugin.app.vault.getAbstractFileByPath(path))));
	if (after.some(text => !text.includes("[!tip]"))) throw new Error("Production replacement did not update the synthetic notes");
	list.controller.refresh(true);
	const result = await note(ctx,after.join("\n\n"));
	ctx.show(list.root,{x:28,y:48,width:684,height:215}); ctx.show(result,{x:28,y:282,width:684,height:302},true);
	await ctx.capture(5.15,{transition:0.22}); park(ctx,6); await ctx.capture(6);
	return { sources: [...rowSource,"src/settings/sections/CalloutRowActions.ts","src/settings/sections/calloutVaultActions.ts","src/utils/ReplaceCalloutModal.ts","src/utils/vaultCalloutScanner.ts",...noteSource], description: "The real Idea row menu opens Replace in vault; its production modal filters Tip and confirms. The actual vault replacement implementation rewrites two synthetic notes through an in-memory process adapter. Their content survives and the Idea definition remains in the real list." };
}

export const scenes = {"01":threeTypes,"02":createCallout,"03":colorPalettes,"04":customIcons,"05":discovery,"06":replaceCallout};
