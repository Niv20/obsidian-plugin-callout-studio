/** Build-time host. Only the exported artwork and frame-driven player ship. */
import { installDomHelpers } from "obsidian";
import { setLocale } from "../../src/i18n/index.ts";
import { makeHost } from "../user-guide/fixture-host.mjs";

export const layoutCss = `
html,body { margin:0; padding:0; width:740px; height:650px; overflow:hidden; background:transparent!important; }
*,*::before,*::after { animation:none!important; transition:none!important; caret-color:transparent!important; }
#intro-stage { position:relative; width:740px; height:650px; background:transparent; overflow:visible; }
.modal-container { position:static; padding:0; height:auto; min-height:0; }
.modal-bg { display:none!important; }
.modal { position:relative; margin:0; max-height:570px!important; max-width:680px!important; }
.modal-content { min-height:0; }
.guide-settings { width:650px; padding:24px; background:var(--background-secondary); border:1px solid var(--background-modifier-border); border-radius:12px; max-height:570px; overflow:auto; }
.guide-note { width:650px; padding:28px; background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:12px; max-height:570px; overflow:auto; }
.guide-note .markdown-rendered { padding:0; }
.guide-outline { width:230px; padding:16px; background:var(--background-secondary); border-radius:8px; }
.guide-outline .tree-item-inner { min-height:24px; }
.intro-host-panel { background:var(--background-primary); border:1px solid var(--background-modifier-border); border-radius:12px; padding:24px; }
.intro-native-editor .cm-editor { background:var(--background-primary); font-size:18px; }
.intro-native-editor .cm-content { padding:18px; }
`;

export async function settle() {
	await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	await document.fonts.ready;
}

export function createContext(id) {
	installDomHelpers(); setLocale("en");
	document.body.className = `theme-${id === "17" ? "dark" : globalThis.__INTRO_UI_MODE__ || "light"} is-desktop`;
	const stage = document.body.createDiv({ attr: { id: "intro-stage" } });
	const plugin = makeHost();
	let fitted = [];
	const points = [];
	const ctx = {
		id, stage, plugin, points, settle,
		/** Mount the original DOM; fitting changes only its outer placement/scale. */
		show(root, box = { x:28, y:28, width:684, height:594 }, append = false) {
			if (typeof root === "string") root = document.querySelector(root);
			if (!root) throw new Error(`Scene ${id}: missing production root`);
			if (!append) { stage.replaceChildren(); fitted = []; }
			const wrap = stage.createDiv();
			Object.assign(wrap.style, { position:"absolute", left:"0px", top:"0px", transformOrigin:"0 0" });
			wrap.appendChild(root);
			fitted.push({ root, wrap, box });
			ctx.fit();
			return root;
		},
		fit() {
			for (const {root, wrap, box} of fitted) {
				wrap.style.transform = "none";
				const r = root.getBoundingClientRect();
				const scale = Math.min(1,box.width/r.width,box.height/r.height);
				Object.assign(wrap.style, { left:`${box.x+(box.width-r.width*scale)/2}px`,top:`${box.y+(box.height-r.height*scale)/2}px`,transform:`scale(${scale})` });
			}
		},
		point(time, target, click = false) {
			ctx.fit();
			if (typeof target === "string") target = document.querySelector(target);
			if (!target) throw new Error(`Scene ${id}: missing cursor target at ${time}`);
			const r = target.getBoundingClientRect?.();
			const x = r ? r.x+r.width/2 : target.x;
			const y = r ? r.y+r.height/2 : target.y;
			points.push({time,x,y,click});
		},
		async capture(time, options={}) {
			await settle(); ctx.fit(); await settle();
			return globalThis.__INTRO_CAPTURE__({time, ...options});
		},
		async until(predicate, label="component") {
			for (let n=0;n<180;n++) { if(predicate()) return; await settle(); }
			throw new Error(`Scene ${id}: ${label} did not render`);
		},
	};
	return ctx;
}
