/** Source component scenes. Obsidian services operate only on synthetic memory. */
import { Menu, MarkdownView } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection } from "@codemirror/view";
import { GlobalStyleModal } from "../../src/settings/GlobalStyleModal.ts";
import { addItems } from "../../src/editor/contextmenu/items.ts";
import { registerCalloutCommands } from "../../src/editor/commands.ts";
import { CalloutAutoComplete } from "../../src/editor/AutoComplete.ts";
import { renderLanguageSection } from "../../src/settings/sections/LanguageSection.ts";
import { processImportedJSON } from "../../src/settings/sections/DataManagementSection.ts";
import { renderCalloutRow } from "../../src/settings/sections/CalloutRowRenderer.ts";
import { registerLocale, t } from "../../src/i18n/index.ts";
import { es } from "../../src/i18n/es.ts";
import { CalloutCombobox } from "../../src/settings/calloutCombobox.ts";
import { createOccurrencesFrame } from "../../src/usage/occurrencesViewFrame.ts";
import { OccurrenceResults } from "../../src/usage/occurrenceResults.ts";
import { OccurrenceTypeChoices, occurrencePickerChoices, ALL_TYPES_ID } from "../../src/usage/occurrenceTypeChoices.ts";
import { scanCalloutOccurrences } from "../../src/usage/scanCalloutOccurrences.ts";
import { navigateToCalloutOccurrence } from "../../src/usage/navigation.ts";
import { renderMarkdown, mountSettings } from "../user-guide/fixture-host.mjs";

const sources = (...paths) => paths.map(path => `src/${path}`);
const park = (ctx,time) => ctx.point(time,{x:686,y:590});
const click = (ctx,time,el) => { ctx.point(time,el,true); el.click(); };
function note() {
	const panel=document.body.createDiv({cls:"guide-note markdown-preview-view"});
	panel.createDiv({cls:"markdown-rendered"});
	return panel;
}
async function paintNote(ctx,panel,text) {
	panel.firstElementChild.empty();
	await renderMarkdown(ctx.plugin,panel.firstElementChild,text);
}
function editorHost(text,width=630) {
	const root=document.body.createDiv({cls:"intro-host-panel intro-native-editor"});
	root.style.width=`${width}px`;
	const view=new EditorView({parent:root,state:EditorState.create({doc:text,extensions:[drawSelection(),EditorView.lineWrapping]})});
	const offset=pos=>view.state.doc.line(pos.line+1).from+pos.ch;
	const position=index=>{ const line=view.state.doc.lineAt(index); return {line:line.number-1,ch:index-line.from}; };
	const api={
		getValue:()=>view.state.doc.toString(), getLine:n=>view.state.doc.line(n+1).text,
		lineCount:()=>view.state.doc.lines,
		getCursor(which="head") { const s=view.state.selection.main; return position(which==="anchor"?s.anchor:which==="from"?s.from:which==="to"?s.to:s.head); },
		getSelection:()=>view.state.sliceDoc(view.state.selection.main.from,view.state.selection.main.to),
		setSelection:(from,to)=>view.dispatch({selection:{anchor:offset(from),head:offset(to)}}),
		setCursor:pos=>view.dispatch({selection:{anchor:offset(pos)}}),
		replaceRange:(insert,from,to=from)=>view.dispatch({changes:{from:offset(from),to:offset(to),insert}}),
		getRange:(from,to)=>view.state.sliceDoc(offset(from),offset(to)),
		focus:()=>view.focus(),scrollIntoView:()=>{},
	};
	return {root,view,api};
}

async function globalStyle(ctx) {
	ctx.plugin.settings.globalStyle.borderRadius=1;
	const modal=new GlobalStyleModal(ctx.plugin,"regular"); modal.open();
	ctx.show(modal.modalEl);
	await ctx.until(()=>modal.modalEl.querySelector(".callout"),"global style preview");
	const row=[...modal.modalEl.querySelectorAll(".callout-studio-slider-row")].find(el=>el.textContent.includes(t("settings.borderRadius")))
		?? [...modal.modalEl.querySelectorAll("input[type=range]")].find(el=>Number(el.max)===24)?.parentElement;
	const slider=row?.querySelector("input[type=range]");
	if(!slider)throw new Error("Missing actual corner-rounding slider");
	slider.scrollIntoView({block:"nearest"});
	ctx.fit(); park(ctx,0); await ctx.capture(0);
	const pointer=()=>{const r=slider.getBoundingClientRect();return{x:r.x+6+(r.width-12)*Number(slider.value)/24,y:r.y+r.height/2};};
	ctx.point(1.5,pointer());
	for(let i=1;i<=12;i++) {
		slider.value=String(i);slider.dispatchEvent(new Event("input",{bubbles:true}));
		await ctx.settle();ctx.point(1.5+i/6,pointer());await ctx.capture(1.5+i/6,{transition:1/6});
	}
	slider.dispatchEvent(new Event("change",{bubbles:true}));
	await ctx.capture(4,{transition:.18});park(ctx,5.8);await ctx.capture(6);
	return {sources:sources("settings/GlobalStyleModal.ts","settings/styleControls.ts","settings/LiveCalloutPreview.ts","manager/CSSInjector.ts"),description:"Real GlobalStyleModal corner slider drives generated CSS and the same live source preview from 1px to 12px."};
}

async function rightClick(ctx) {
	let text="> [!note]+ Design notes\n> Keep the next step clear.\n> Bring the useful details together.";
	const panel=note();await paintNote(ctx,panel,text);ctx.show(panel,{x:40,y:70,width:660,height:270});
	park(ctx,0);await ctx.capture(0);
	const callout=panel.querySelector(".callout");ctx.point(.9,callout.querySelector(".callout-title"),true);
	const editor={getLine:n=>text.split("\n")[n],lineCount:()=>text.split("\n").length,replaceRange:(replacement,from,to)=>{const lines=text.split("\n");lines[from.line]=lines[from.line].slice(0,from.ch)+replacement+lines[to.line].slice(to.ch);text=lines.join("\n");}};
	const menu=new Menu();addItems(ctx.plugin,menu,{id:"note",role:"regular",editor,view:null,surface:"reading",targetEl:callout,callout:{id:"note",headerLine:0,prefix:"> ",quoteDepth:1}});
	menu.showAtPosition({x:0,y:0});menu.dom.style.position="relative";menu.dom.style.width="310px";
	ctx.show(menu.dom,{x:300,y:255,width:390,height:320},true);await ctx.capture(1,{transition:.14});
	const option=[...menu.dom.querySelectorAll(".menu-item")].find(el=>el.textContent.includes(t("contextMenu.setFoldClosed")));
	if(!option)throw new Error("Missing actual fold-closed menu action");
	ctx.point(2.5,option);option.classList.add("selected");await ctx.capture(2.6,{transition:.12});
	click(ctx,4,option);menu.hide();await paintNote(ctx,panel,text);
	const content=panel.querySelector(".callout-content");
	// Native Obsidian fold shell hides a body carrying the persisted '-' mark.
	if(!text.startsWith("> [!note]-"))throw new Error("Production fold action did not update source");
	content.style.display="none";
	await ctx.capture(4.2,{transition:.35});park(ctx,5.7);await ctx.capture(6);
	return {sources:sources("editor/contextmenu/items.ts","reading/calloutPostProcessor.ts","manager/CSSInjector.ts"),description:"Actual context-menu item changes the synthetic Markdown fold marker from + to -; source-rendered note is repainted through the production reading pipeline."};
}

async function commands(ctx) {
	const text="Keep the next step clear.";
	const ed=editorHost(text);ctx.show(ed.root);park(ctx,0);await ctx.capture(0);
	ctx.point(.2,ed.view.contentDOM);ed.api.setSelection({line:0,ch:0},{line:0,ch:text.length});ed.api.focus();await ctx.capture(.7,{transition:.15});
	const registered=[];ctx.plugin.addCommand=command=>registered.push(command);
	const file=ctx.plugin.seedNote("Design notes.md",text);ctx.plugin.app.workspace.getActiveFile=()=>file;
	const suggest=new CalloutAutoComplete(ctx.plugin);ctx.plugin.autoComplete=suggest;
	let popup;
	ctx.plugin.app.workspace.editorSuggest={trigger(editor,file){
		const trigger=suggest.onTrigger(editor.getCursor(),editor,file);if(!trigger)throw new Error("Wrap command did not trigger autocomplete");
		suggest.context={...trigger,editor,file};
		popup=document.body.createDiv({cls:"suggestion-container"});popup.style.width="510px";
		const list=popup.createDiv({cls:"suggestion"});
		for(const item of suggest.getSuggestions(suggest.context).slice(0,8)) {
			const row=list.createDiv({cls:"suggestion-item"});suggest.renderSuggestion(item,row);row.dataset.calloutId=item.id??"";
			row.addEventListener("click",ev=>{suggest.selectSuggestion(item,ev);popup.remove();});
		}
		ctx.show(popup,{x:115,y:305,width:510,height:275},true);
	}};
	registerCalloutCommands(ctx.plugin,{openEditor(){throw new Error("Unused command");},openQuickInsert(){},openOccurrences(){}});
	const command=registered.find(item=>item.id==="callout-wrap");
	if(!command)throw new Error("Wrap command not registered");
	// The native command palette belongs to Obsidian. Its shell uses installed
	// app.css classes; its single filtered result comes from plugin registration.
	const palette=document.body.createDiv({cls:"prompt"});palette.style.width="590px";
	palette.createEl("input",{cls:"prompt-input",value:command.name});
	const results=palette.createDiv({cls:"prompt-results"});
	const result=results.createDiv({cls:"suggestion-item is-selected"});
	result.createDiv({cls:"suggestion-content"}).createDiv({cls:"suggestion-title",text:`Callout Studio: ${command.name}`});
	result.addEventListener("click",()=>{palette.remove();command.editorCallback(ed.api);});
	ctx.show(palette,{x:75,y:175,width:590,height:220},true);await ctx.capture(1.2,{transition:.15});
	click(ctx,2.25,result);await ctx.until(()=>popup?.isConnected,"production autocomplete");
	const choice=popup.querySelector('[data-callout-id="note"]');if(!choice)throw new Error("Note missing in production suggestions");
	choice.scrollIntoView({block:"nearest"});await ctx.settle();await ctx.capture(2.4,{transition:.15});
	ctx.point(3.15,choice);click(ctx,3.55,choice);await ctx.settle();
	if(!ed.api.getValue().includes("[!note]"))throw new Error("Autocomplete did not insert Note");
	const rendered=note();await paintNote(ctx,rendered,ed.api.getValue());ctx.show(rendered);await ctx.capture(4,{transition:.25});park(ctx,4.9);await ctx.capture(5);
	return {sources:sources("editor/commands.ts","editor/CalloutBlockTools.ts","editor/AutoComplete.ts","reading/calloutPostProcessor.ts"),description:"Actual fixed-command registration and wrap action, real CodeMirror selection, and CalloutAutoComplete suggestion renderer and commit. Obsidian's command-palette shell is populated from registered command data."};
}

async function imports(ctx) {
	const rows=[
		{id:"idea",displayName:"Idea",icon:{type:"lucide",value:"lightbulb"},colorLight:"#7c3aed",colorDark:"#a78bfa"},
		{id:"meeting",displayName:"Meeting",icon:{type:"lucide",value:"users"},colorLight:"#267b70",colorDark:"#57c4b2"},
		{id:"project",displayName:"Project",icon:{type:"lucide",value:"bookmark"},colorLight:"#2563eb",colorDark:"#60a5fa"},
	].map(row=>({...ctx.plugin.registry.getReal("note"),...row,aliases:[],builtIn:false,source:"user"}));
	const memory=new Map(),folders=new Set();
	Object.assign(ctx.plugin.app.vault.adapter,{
		exists:async path=>memory.has(path)||folders.has(path),mkdir:async path=>{folders.add(path);},
		write:async(path,value)=>{memory.set(path,value);},read:async path=>memory.get(path),
		list:async dir=>({files:[...memory.keys()].filter(path=>path.startsWith(dir+"/")),folders:[]}),remove:async path=>{memory.delete(path);},
	});
	ctx.plugin.customCommands.syncAll=()=>{};
	const section={app:ctx.plugin.app,plugin:ctx.plugin,display(){},registerDisposer(){}};
	const completion=processImportedJSON(section,new File([JSON.stringify(rows)],"Callout Studio.json",{type:"application/json"}));
	await ctx.until(()=>document.querySelector(".modal button.mod-cta"),"actual import confirmation");
	const modal=document.querySelector(".modal");ctx.show(modal);park(ctx,0);await ctx.capture(0);
	const confirm=modal.querySelector("button.mod-cta");ctx.point(1.2,confirm);click(ctx,2,confirm);await completion;
	if(rows.some(row=>!ctx.plugin.registry.has(row.id)))throw new Error("Import failed to add all three definitions");
	ctx.plugin.cssInjector.inject(false);
	const result=mountSettings(ctx.plugin,{render(panel,settings){
		for(const row of rows)renderCalloutRow(settings,panel,ctx.plugin.registry.getReal(row.id),"user",{onEdit(){},onOpenBuiltInMenu(){},onOpenUserMenu(){}});
	}});
	ctx.show(result.selector);await ctx.capture(2.7,{transition:.3});park(ctx,4.8);await ctx.capture(5);
	return {sources:sources("settings/sections/DataManagementSection.ts","utils/ConfirmModal.ts","manager/settingsBackup.ts","settings/sections/CalloutRowRenderer.ts"),description:"Actual JSON validator, numeric confirmation, verified in-memory backup, import transaction, and resulting production callout rows. No user vault is read or written."};
}

async function languages(ctx) {
	registerLocale("es",es);
	const panel=document.body.createDiv({cls:"callout-studio-settings guide-settings"});
	panel.style.height="420px";
	const section={app:ctx.plugin.app,plugin:ctx.plugin,display(){panel.empty();renderLanguageSection(section,panel);},registerDisposer(){}};
	renderLanguageSection(section,panel);ctx.show(panel);park(ctx,0);await ctx.capture(0);
	const control=panel.querySelector(".cs-language-setting .cs-combobox-control");click(ctx,.75,control);await ctx.settle();
	const choice=[...panel.querySelectorAll('[role="option"]')].find(el=>el.textContent==="Español");
	if(!choice)throw new Error("Spanish missing from actual language picker");
	choice.scrollIntoView({block:"nearest"});await ctx.capture(1,{transition:.12});
	ctx.point(1.6,choice);click(ctx,2,choice);await ctx.until(()=>ctx.plugin.settings.language==="es" && panel.querySelector("input")?.value==="Español","Spanish setting update");
	await ctx.capture(2.4,{transition:.18});park(ctx,2.9);await ctx.capture(3);
	return {sources:sources("settings/sections/LanguageSection.ts","ui/listboxPopup.ts","i18n/index.ts","i18n/es.ts"),description:"Real language picker commits Español; production setLanguage applies the repository's Spanish locale and rerenders the same settings section."};
}

async function findCallouts(ctx) {
	const def={...ctx.plugin.registry.getReal("note"),id:"project",displayName:"Project",icon:{type:"lucide",value:"bookmark"},colorLight:"#267b70",colorDark:"#57c4b2",builtIn:false,source:"user"};
	ctx.plugin.registry.add(def);ctx.plugin.cssInjector.inject(false);
	const texts={"Launch plan.md":"# Launch plan\n\n> [!project] Scope\n> Ship the first milestone.\n\n> [!note] Next steps\n> Review with the team.","Design notes.md":"# Design notes\n\n> [!project] Follow-up\n> Refine the prototype."};
	const files=Object.entries(texts).map(([path,text])=>ctx.plugin.seedNote(path,text));
	const all=Object.entries(texts).flatMap(([path,text])=>scanCalloutOccurrences(path,text));
	const types=new OccurrenceTypeChoices(ctx.plugin.registry,{dataRevision:1,query:()=>({occurrences:all,fileCount:files.length})});
	const root=document.body.createDiv({cls:"view-content cs-occurrences-view intro-host-panel"});Object.assign(root.style,{width:"450px",height:"560px",padding:"18px"});
	const frame=createOccurrencesFrame(root),results=new OccurrenceResults(100);let selected=ALL_TYPES_ID;
	const refresh=()=>{
		const shown=selected===ALL_TYPES_ID?all:all.filter(row=>row.rawId===selected);
		frame.summary.setText(t("usage.summary",{count:shown.length,files:new Set(shown.map(row=>row.path)).size}));
		results.render(frame.results,shown,100,true,()=>{},()=>{});
	};
	const picker=new CalloutCombobox(frame.pickerHost,{registry:ctx.plugin.registry,choices:()=>occurrencePickerChoices(types,selected),value:selected,ariaLabel:t("vaultStats.columnType"),labelOf:def=>def.id===ALL_TYPES_ID?t("usage.allTypes"):def.id,iconlessOptionId:ALL_TYPES_ID,hideSingleGroup:true,showSingleGroupKey:"browse",groupOf:def=>def.id===ALL_TYPES_ID?{key:"browse",label:t("usage.browse"),order:-1}:{key:"registered",label:t("usage.registeredCallouts"),order:0},onChange:id=>{selected=id;picker.setValue(id);refresh();}});
	refresh();ctx.show(root,{x:28,y:40,width:684,height:570});park(ctx,0);await ctx.capture(0);
	const input=frame.pickerHost.querySelector("input");click(ctx,.8,input);
	input.value="project";input.dispatchEvent(new Event("input",{bubbles:true}));await ctx.settle();await ctx.capture(1,{transition:.12});
	const option=[...frame.pickerHost.querySelectorAll('[role="option"]')].find(el=>el.textContent.includes("Project"));
	if(!option)throw new Error("Missing Project type choice");click(ctx,1.65,option);await ctx.capture(2,{transition:.18});
	const ed=editorHost(texts[files[0].path],380);ed.root.style.height="330px";
	const view=new MarkdownView();Object.assign(view,{file:files[0],editor:ed.api,getMode:()=>"source"});
	const rootSplit={};ctx.plugin.app.workspace.rootSplit=rootSplit;
	const leaf={view,getRoot:()=>rootSplit,openFile:async file=>{view.file=file;ed.view.dispatch({changes:{from:0,to:ed.view.state.doc.length,insert:texts[file.path]}});},loadIfDeferred:async()=>{},setEphemeralState(){}};
	Object.assign(ctx.plugin.app.workspace,{getMostRecentLeaf:()=>leaf,getLeavesOfType:type=>type==="markdown"?[leaf]:[],getLeaf:()=>leaf,getActiveViewOfType:()=>view});
	let navigation;
	frame.results.addEventListener("click",event=>{const button=event.target.closest(".cs-occurrences-result");if(!button)return;const occurrence=results.getOccurrence(button);if(!occurrence)return;results.select(occurrence);navigation=navigateToCalloutOccurrence(ctx.plugin.app,occurrence);});
	const result=frame.results.querySelector(".cs-occurrences-result");ctx.point(3,result);click(ctx,3.7,result);if(!await navigation)throw new Error("Actual occurrence navigation did not select the source");
	ctx.show(root,{x:24,y:32,width:340,height:586});ctx.show(ed.root,{x:380,y:140,width:336,height:400},true);
	await ctx.capture(4.15,{transition:.3});park(ctx,4.9);await ctx.capture(5);
	return {sources:sources("usage/occurrencesViewFrame.ts","usage/occurrenceResults.ts","usage/occurrenceTypeChoices.ts","settings/calloutCombobox.ts","usage/navigation.ts","ui/sidebarNavigation.ts"),description:"Real occurrence scanner, type filter and result components; clicking a card runs production navigation and selects the exact token in a real CodeMirror editor using synthetic TFiles."};
}

export const scenes={"07":globalStyle,"08":rightClick,"09":commands,"10":imports,"11":languages,"12":findCallouts};
