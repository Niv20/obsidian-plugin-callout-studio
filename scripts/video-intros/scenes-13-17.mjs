/** Production-rendered intro states. All data and host services stay in memory. */
import { MarkdownView } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection } from "@codemirror/view";
import { SettingsRecoveryModal } from "../../src/settings/SettingsRecoveryModal.ts";
import { mergeVersions } from "../../src/manager/setupVersions.ts";
import { setupDetails } from "../../src/manager/setupDetails.ts";
import { differingEntries } from "../../src/manager/setupDifference.ts";
import { renderResetSection } from "../../src/settings/sections/DataManagementSection.ts";
import { PortableConversionView } from "../../src/portable/PortableConversionView.ts";
import { QuickInsertModal } from "../../src/settings/QuickInsertModal.ts";
import { registerQuickInsertRibbon } from "../../src/icons/registerUiIcons.ts";
import { UI_ICON_CONTENT } from "../../src/icons/uiIcons.ts";
import { OutlineDecorator } from "../../src/outline/OutlineDecorator.ts";
import { ThemeAppearanceProbe } from "../../src/manager/theme/ThemeAppearanceProbe.ts";
import { syncThemeOverlayRows } from "../../src/manager/theme/themeOverlayRows.ts";
import { renderCalloutRow } from "../../src/settings/sections/CalloutRowRenderer.ts";
import { createCalloutListsController } from "../../src/settings/sections/CalloutListsSection.ts";
import { freshPaging } from "../../src/settings/sections/calloutListsSignature.ts";
import { renderMarkdown, seedExample, settingsContext } from "../user-guide/fixture-host.mjs";

const copy = value => JSON.parse(JSON.stringify(value));
const park = ctx => ctx.point(Number(ctx.id === "17" ? 6.8 : ctx.id === "14" ? 1.8 : 4.8), { x: 701, y: 590 });
function panel(cls = "guide-settings callout-studio-settings") {
	return document.body.createDiv({ cls });
}

function recoveryData(plugin) {
	seedExample(plugin);
	const current = copy(plugin.registry.toSaveData());
	const previous = copy(current);
	Object.assign(previous.callouts.find(def => def.id === "project"), { colorLight: "#2563eb", colorDark: "#60a5fa" });
	const oldest = copy(previous);
	oldest.callouts = oldest.callouts.filter(def => def.id !== "project");
	const source = (data, time, reason) => ({ data, kind: "history", time, reason, origin: "this-device", path: null, historyHash: `intro-${time}` });
	const versions = mergeVersions([
		source(current, 1791180000000, "edit"),
		source(previous, 1791093600000, "before-import"),
		source(oldest, 1791007200000, "edit"),
	]);
	plugin.recovery = {
		listVersions: async () => versions,
		difference: data => ({ callouts: data.callouts?.length ?? 0, changed: differingEntries(current, data).size }),
		details: (source, version) => ({ ...setupDetails(source, current), version }),
		restore: async () => { throw new Error("Intro never restores settings"); },
		removeVersion: async () => { throw new Error("Intro never deletes versions"); },
	};
}

async function history(ctx) {
	recoveryData(ctx.plugin);
	const modal = new SettingsRecoveryModal(ctx.plugin.app, ctx.plugin);
	modal.open();
	await ctx.until(() => modal.contentEl.querySelectorAll(".cs-recovery-row").length === 3, "version rows");
	ctx.show(modal.modalEl);
	ctx.point(0, { x: 682, y: 557 });
	await ctx.capture(0);
	const row = modal.contentEl.querySelectorAll(".cs-recovery-row")[1];
	const eye = row.querySelector(".extra-setting-button");
	ctx.point(1.6, eye);
	ctx.point(2.3, eye, true);
	eye.click();
	await ctx.until(() => document.querySelector('.cs-recovery-details-modal .modal-content[aria-busy="false"]'), "version comparison");
	const details = document.querySelector(".cs-recovery-details-modal");
	ctx.show(details);
	await ctx.capture(2.5, { transition: 0.35 });
	park(ctx);
	await ctx.capture(5);
	return {
		sources: ["src/settings/SettingsRecoveryModal.ts", "src/settings/SettingsRecoveryDetailsModal.ts", "src/settings/recoveryDetailsView.ts", "src/settings/recoveryComparisonTable.ts", "src/settings/recoveryPreview.ts", "src/manager/setupDetails.ts"],
		description: "Real Version history eye action opens the actual comparison table for three in-memory versions; Project changes from purple to blue. No restore or filesystem operation occurs.",
	};
}

async function danger(ctx) {
	const { plugin } = ctx;
	plugin.seedNote("Design notes.md", "# [!tip] Design notes\n\nKeep the first milestone small.");
	plugin.app.vault.process = async () => { throw new Error("Intro never converts or writes notes"); };
	const root = panel();
	renderResetSection(settingsContext(plugin), root);
	ctx.show(root);
	let review, reviewError;
	plugin.app.setting = { close() {} };
	plugin.app.workspace.ensureSideLeaf = async () => {
		try {
		const leaf = { app: plugin.app, loadIfDeferred: async () => {} };
		review = new PortableConversionView(leaf);
		leaf.view = review;
		review.contentEl.classList.add("intro-host-panel");
		review.contentEl.style.width = "650px";
		review.contentEl.style.height = "490px";
		await review.onOpen();
		if (!review.contentEl.querySelector(".cs-portable-after")) throw new Error(`Conversion review has no proposed row: ${review.contentEl.textContent}`);
		return leaf;
		} catch (error) { reviewError = error; throw error; }
	};
	plugin.app.workspace.revealLeaf = async () => {};
	ctx.point(0, { x: 685, y: 505 });
	await ctx.capture(0);
	const button = root.querySelector("button.cs-settings-neutral-btn");
	ctx.point(0.72, button, true); button.click();
	await ctx.until(() => { if (reviewError) throw reviewError; return review?.contentEl.querySelector(".cs-portable-after"); }, "conversion review");
	ctx.show(review.contentEl);
	await ctx.capture(1.0, { transition: 0.25 });
	park(ctx);
	await ctx.capture(2);
	return {
		sources: ["src/settings/sections/DataManagementSection.ts", "src/portable/registerPortableConversionView.ts", "src/portable/PortableConversionView.ts", "src/portable/portableConversionRows.ts", "src/utils/portableCalloutVault.ts"],
		description: "The production Danger zone Review conversion button opens the real conversion sidebar and before/after row for one synthetic heading. The conversion itself is never executed.",
	};
}

/** The host editor supplies only the Obsidian Editor API; wrapping is production code. */
function selectedEditor(plugin, parent, text) {
	const cm = new EditorView({ parent, state: EditorState.create({
		doc: text, selection: { anchor: 0, head: text.length },
		extensions: [drawSelection(), EditorView.theme({ "&": { minHeight: "170px" } })],
	}) });
	const pos = offset => { const line = cm.state.doc.lineAt(offset); return { line: line.number - 1, ch: offset - line.from }; };
	const offset = p => cm.state.doc.line(p.line + 1).from + p.ch;
	const editor = {
		getValue: () => cm.state.doc.toString(),
		getLine: line => cm.state.doc.line(line + 1).text,
		lineCount: () => cm.state.doc.lines,
		getCursor: which => pos(["anchor", "from"].includes(which) ? cm.state.selection.main.from : cm.state.selection.main.to),
		getSelection: () => cm.state.sliceDoc(cm.state.selection.main.from, cm.state.selection.main.to),
		replaceRange: (insert, from, to = from) => cm.dispatch({ changes: { from: offset(from), to: offset(to), insert } }),
		setCursor: value => cm.dispatch({ selection: { anchor: offset(value) } }),
		focus: () => cm.focus(),
	};
	const view = new MarkdownView();
	const file = plugin.seedNote("Project plan.md", text);
	const leaf = { view };
	Object.assign(view, { file, leaf, editor, getMode: () => "source" });
	Object.assign(plugin.app.workspace, {
		getActiveViewOfType: type => view instanceof type ? view : null,
		getLeavesOfType: type => type === "markdown" ? [leaf] : [],
		getMostRecentLeaf: () => leaf,
	});
	return { cm, editor };
}

async function quickInsert(ctx) {
	const { plugin } = ctx;
	seedExample(plugin, { colorLight: "#267b70", colorDark: "#57c4b2" });
	for (const [id, displayName, icon] of [["meeting", "Meeting", "users"], ["decision", "Decision", "check-check"]]) {
		seedExample(plugin, { id, displayName, icon: { type: "lucide", value: icon } });
	}
	plugin.localState.quickInsertSource = "user";
	const root = panel("guide-note");
	root.style.display = "flex"; root.style.gap = "18px"; root.style.alignItems = "center";
	const ribbon = root.createDiv({ cls: "workspace-ribbon mod-left" });
	Object.assign(ribbon.style, { position: "static", width: "40px", flex: "0 0 40px", height: "200px", border: "none" });
	ribbon.style.setProperty("display", "flex", "important");
	const content = root.createDiv({ cls: "intro-native-editor markdown-source-view mod-cm6", attr: { style: "flex:1;min-width:0" } });
	const { cm, editor } = selectedEditor(plugin, content, "Keep decisions together.\nPlan the next milestone.");
	let modal;
	plugin.addRibbonIcon = (id, title, action) => {
		const button = ribbon.createDiv({ cls: "side-dock-ribbon-action clickable-icon", attr: { "aria-label": title } });
		button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="svg-icon" viewBox="0 0 24 24" width="24" height="24">${UI_ICON_CONTENT[id]}</svg>`;
		button.addEventListener("click", action); return button;
	};
	plugin.openQuickInsert = () => { modal = new QuickInsertModal(plugin); modal.open(); };
	registerQuickInsertRibbon(plugin);
	ctx.show(root); await ctx.settle(); cm.focus();
	ctx.point(0, { x: 467, y: 455 });
	await ctx.capture(0);
	const button = ribbon.querySelector(".side-dock-ribbon-action");
	ctx.point(1.25, button, true); button.click();
	await ctx.until(() => modal?.contentEl.querySelectorAll(".cs-qi-preview .callout").length === 3, "Quick insert previews");
	ctx.show(modal.modalEl);
	await ctx.capture(1.5, { transition: 0.3 });
	const project = modal.contentEl.querySelector('.callout[data-callout="project"]').closest(".cs-qi-row");
	ctx.point(2.6, project.querySelector(".callout-title"));
	project.dispatchEvent(new MouseEvent("mouseenter"));
	await ctx.capture(2.6, { transition: 0.15 });
	ctx.point(3.35, project.querySelector(".callout-title"), true); project.click();
	if (!editor.getValue().includes("> [!project]")) throw new Error("Quick insert did not wrap the synthetic editor");
	const result = document.createElement("div"); result.className = "markdown-rendered";
	await renderMarkdown(plugin, result, editor.getValue());
	cm.destroy(); content.replaceChildren(result);
	ctx.show(root);
	await ctx.capture(3.6, { transition: 0.3 });
	park(ctx); await ctx.capture(5);
	return {
		sources: ["src/icons/registerUiIcons.ts", "src/icons/uiIcons.ts", "src/settings/QuickInsertModal.ts", "src/settings/quickInsertRow.ts", "src/settings/quickInsertPreview.ts", "src/editor/CalloutBlockTools.ts", "src/reading/calloutPostProcessor.ts"],
		description: "The actual ribbon callback opens QuickInsertModal with three user callouts. Selecting its real Project row executes production wrapping against an in-memory editor; the result uses the production reading processor and generated CSS.",
	};
}

async function heading(ctx) {
	const { plugin } = ctx;
	const markdown = "# Project plan\n\n[[#[!tip] Design notes]]\n\n## Overview\n\nKeep the first milestone small.\n\nReview the plan before starting.\n\nBuild one clear path through the project.\n\nLeave room for feedback.\n\n## [!tip] Design notes\n\nKeep the navigation clear.\n\nUse one accent consistently.\n\n## Next steps\n\nShare the draft with your team.\n\nCollect the open questions.\n\nReview the first prototype.\n\nKeep track of each decision.\n\nPlan the next milestone.";
	const file = plugin.seedNote("Project plan.md", markdown);
	const root = panel("guide-note");
	root.style.width = "680px"; root.style.display = "flex"; root.style.gap = "22px";
	const viewport = root.createDiv({ cls: "markdown-preview-view" });
	Object.assign(viewport.style, { width: "398px", height: "430px", overflow: "hidden", flex: "0 0 398px" });
	const content = viewport.createDiv({ cls: "markdown-rendered" });
	await renderMarkdown(plugin, content, markdown);
	const sidebar = root.createDiv({ cls: "guide-outline outline" });
	Object.assign(sidebar.style, { width: "186px", flex: "0 0 186px", padding: "10px" });
	sidebar.createDiv({ cls: "view-header-title", text: "Outline" });
	const tree = sidebar.createDiv({ cls: "tree-item-children" });
	for (const h of plugin.app.metadataCache.getFileCache(file).headings) {
		const item = tree.createDiv({ cls: "tree-item" });
		item.style.paddingLeft = `${(h.level - 1) * 10}px`;
		item.createDiv({ cls: "tree-item-self" }).createDiv({ cls: "tree-item-inner", text: h.heading.replace(/\[([^\]]+)\]/g, "$1") });
	}
	plugin.app.workspace.getLeavesOfType = type => type === "outline" ? [{ view: { containerEl: sidebar, file } }] : [];
	new OutlineDecorator(plugin).attachAll();
	await ctx.until(() => !sidebar.textContent.includes("!tip"), "Outline decoration");
	ctx.show(root); ctx.point(0, { x: 675, y: 555 }); await ctx.capture(0);
	const link = content.querySelector("a.internal-link");
	const target = [...content.querySelectorAll("h2")].find(el => el.textContent.includes("Design notes"));
	if (!link || !target || link.textContent.includes("[!")) throw new Error("Heading link did not render through production decorator");
	ctx.point(1.5, link); ctx.point(2.2, link, true);
	let followed = false;
	link.addEventListener("click", event => { event.preventDefault(); followed = true; });
	link.click();
	if (!followed) throw new Error("Heading link host navigation did not run");
	const amount = Math.min(target.offsetTop - content.offsetTop - 14, content.scrollHeight - viewport.clientHeight);
	// Bake the original scroll at 60 Hz; zero crossfade keeps letters crisp.
	for (let i = 1; i <= 96; i++) {
		const fraction = i / 96;
		viewport.scrollTop = Math.max(0, amount * (fraction * fraction * (3 - 2 * fraction)));
		await ctx.capture((135 + i) / 60, { transition: 0 });
	}
	park(ctx); await ctx.capture(5);
	return {
		sources: ["src/reading/calloutPostProcessor.ts", "src/outline/OutlineDecorator.ts", "src/editor/renderShared.ts"],
		description: "Production reading and Outline decorators render a Tip heading and its clean internal link. Obsidian host navigation is simulated as a deterministic scroll inside the note; no source headings are drawn by hand.",
	};
}

async function theme(ctx) {
	const { plugin } = ctx;
	const css = globalThis.__CS_GUIDE_THEME_CSS__;
	if (!css) throw new Error("Intro17 requires the local AnuPpuccin stylesheet");
	document.body.classList.add("ctp-mocha", "anp-callout-sleek");
	const styleEl = [...document.querySelectorAll("style")].find(el => el.textContent === css);
	Object.assign(plugin.app.customCss, { theme: "AnuPpuccin", themes: { AnuPpuccin: { name: "AnuPpuccin", version: "local" } }, styleEl });
	plugin.cssInjector.themeCallouts().invalidate();
	syncThemeOverlayRows(plugin.registry, plugin.cssInjector.themeCallouts().themeDefinedIds());
	const probe = new ThemeAppearanceProbe(plugin.app);
	await probe.ensure(plugin.registry.getAll().filter(def => plugin.registry.themeOwns(def)).flatMap(def => plugin.registry.vaultIdFormsFor(def)), () => {});
	plugin.registry.setThemeAppearances(probe.results()); plugin.cssInjector.inject(false);
	plugin.localState.isExpanded = kind => kind === "theme";
	const root = panel();
	const settings = settingsContext(plugin);
	createCalloutListsController(settings, { paging: freshPaging(), onAddNewCallout: async () => {},
		renderRow: (container, def, kind) => renderCalloutRow(settings, container, def, kind, { onEdit() {}, onOpenBuiltInMenu() {}, onOpenUserMenu() {} }),
	}).render(root);
	const group = root.querySelector(".cs-theme-desc").closest(".cs-sticky-section");
	const rows = [...group.querySelectorAll(".callout-studio-row")];
	if (rows.length < 3) throw new Error("Actual theme scan must yield at least three rows");
	const chosen = rows[1];
	// The first three rows form a fixed viewport crop, preserving their real DOM.
	const list = chosen.parentElement;
	root.replaceChildren(group); ctx.show(root);
	await ctx.settle();
	list.style.maxHeight = `${rows[2].offsetTop + rows[2].offsetHeight - list.offsetTop}px`;
	list.style.overflow = "hidden";
	const eye = chosen.querySelector("button");
	ctx.fit();
	ctx.point(0, { x: 691, y: 573 }); await ctx.capture(0);
	ctx.point(2.5, chosen.querySelector(".callout-studio-row-name"));
	ctx.point(3.6, eye, true); eye.click();
	await ctx.until(() => document.querySelector(".modal .cs-theme-preview-note"), "theme preview");
	const modal = document.querySelector(".cs-theme-preview-note").closest(".modal");
	await ctx.until(() => modal.querySelector(".callout"), "theme block preview");
	ctx.show(modal, undefined, true);
	await ctx.capture(4, { transition: 0.35 });
	park(ctx); await ctx.capture(7);
	return {
		sources: ["src/manager/theme/ThemeAppearanceProbe.ts", "src/manager/theme/themeOverlayRows.ts", "src/settings/sections/CalloutListsSection.ts", "src/settings/sections/CalloutRowRenderer.ts", "src/settings/sections/themeRowActions.ts", "src/settings/ThemeCalloutPreviewModal.ts", "src/settings/LiveCalloutPreview.ts"],
		description: "The installed AnuPpuccin theme is scanned and measured by the real plugin. A real theme row opens ThemeCalloutPreviewModal through its original eye action; all colors, icons and callout layout come from the source CSS.",
	};
}

export const scenes = { "13": history, "14": danger, "15": quickInsert, "16": heading, "17": theme };
