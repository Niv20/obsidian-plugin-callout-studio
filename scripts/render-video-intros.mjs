/** Bake actual plugin UI to portable deterministic React scene packages. */
import assert from "node:assert/strict";
import {mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import {introAssets} from "./video-intros/assets.mjs";
import {catalog} from "./video-intros/catalog.mjs";
import {sceneSource} from "./video-intros/player-template.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const uiMode=process.env.INTRO_UI_MODE || "light";
assert.ok(["light","dark"].includes(uiMode),"INTRO_UI_MODE must be light or dark");
const require=createRequire(import.meta.url);
const runtime="/Users/niv/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || path.join(runtime,"playwright"));
const {appCss,icons,version}=introAssets();
const pluginCss=readFileSync(path.join(root,"styles.css"),"utf8");
const themePath=process.env.GUIDE_THEME_CSS || path.resolve(root,"../../themes/AnuPpuccin/theme.css");
const themeCss=existsSync(themePath)?readFileSync(themePath,"utf8").replace(/@import[^;]+;/g,"").replace(/@font-face\s*\{[^}]*\}/g,""):null;
const selected=process.argv.slice(2);
const entries=catalog.filter(s=>!selected.length || selected.includes(s.id));
const imports=[...new Set(entries.map(s=>Number(s.id)<=6?"01-06":Number(s.id)<=12?"07-12":"13-17"))];
const entry=`import {createContext,layoutCss} from './scripts/video-intros/context.mjs';${imports.map((part,i)=>`import {scenes as s${i}} from './scripts/video-intros/scenes-${part}.mjs';`).join("")}const scenes={${imports.map((_,i)=>`...s${i}`).join(",")}};export const css=layoutCss;export async function mount(id){const ctx=createContext(id);const result=await scenes[id](ctx);return {...result,points:ctx.points};}`;
const {outputFiles}=await build({stdin:{contents:entry,resolveDir:root,sourcefile:"intro-entry.mjs"},bundle:true,write:false,format:"iife",globalName:"introScenes",alias:{obsidian:path.join(root,"scripts/user-guide/obsidian-runtime.ts")}});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
const output=process.env.INTRO_OUTPUT_DIR || path.join(root,`dist/video-intros${uiMode==="dark"?"-dark":""}`);
mkdirSync(output,{recursive:true});
const results=[];
try {
	for(const meta of entries) {
		const dir=path.join(output,meta.slug,"source"), assetDir=path.join(dir,"assets");
		mkdirSync(assetDir,{recursive:true});
		for(const file of readdirSync(assetDir)) if(/^state-\d+\.(?:svg|png)$/.test(file))unlinkSync(path.join(assetDir,file));
		const page=await browser.newPage({viewport:{width:740,height:650},deviceScaleFactor:2,colorScheme:meta.id==="17"?"dark":uiMode});
		const errors=[],requests=[],states=[];
		page.on("pageerror",error=>errors.push(error.message));
		await page.route("**/*",route=>{requests.push(route.request().url());return route.abort();});
		try {
			await page.setContent('<!doctype html><html><head></head><body></body></html>');
			await page.addStyleTag({content:appCss});
			if(meta.id==="17") {assert.ok(themeCss,"Local theme CSS missing");await page.addStyleTag({content:themeCss});}
			await page.addStyleTag({content:pluginCss});
			await page.evaluate(({icons,version,themeCss,uiMode})=>{globalThis.__CS_GUIDE_ICONS__=icons;globalThis.__CS_GUIDE_OBSIDIAN_VERSION__=version;globalThis.__CS_GUIDE_THEME_CSS__=themeCss;globalThis.__INTRO_UI_MODE__=uiMode;},{icons,version,themeCss,uiMode});
			await page.addScriptTag({content:outputFiles[0].text});
			await page.addStyleTag({content:await page.evaluate(()=>introScenes.css)});
			await page.exposeFunction("__INTRO_CAPTURE__",async options=>{
				assert.ok(options.time>=0 && options.time<=meta.duration-1,`${meta.id}: capture outside active timeline`);
				assert.ok(!states.length || options.time>states.at(-1).time,`${meta.id}: state times must increase`);
				const file=`assets/state-${String(states.length).padStart(3,"0")}.png`;
				const png=await page.locator("#intro-stage").screenshot({omitBackground:true,animations:"disabled"});
				writeFileSync(path.join(dir,file),png);
				states.push({time:options.time,file,transition:options.transition??0.14});
				writeFileSync(path.join(output,meta.slug,`build-${String(states.length-1).padStart(3,"0")}.png`),png);
			});
			const details=await page.evaluate(id=>introScenes.mount(id),meta.id);
			assert.ok(states.length && states[0].time===0,`${meta.id}: first frame missing`);
			assert.deepEqual(errors,[],`${meta.id}: browser errors`);
			assert.deepEqual(requests,[],`${meta.id}: network access`);
			const points=details.points.sort((a,b)=>a.time-b.time);
			if(!points.length || points[0].time>0) points.unshift({time:0,x:660,y:565,click:false});
			assert.ok(points.every(p=>p.time<=meta.duration-1 && p.x>=15&&p.x<=705&&p.y>=15&&p.y<=605),`${meta.id}: cursor outside safe region: ${JSON.stringify(points)}`);
			const manifest={formatVersion:1,name:`${meta.id} · ${meta.name}`,entry:"Scene.tsx",width:740,height:650,durationSeconds:meta.duration};
			writeFileSync(path.join(dir,"scene.json"),JSON.stringify(manifest,null,2)+"\n");
			writeFileSync(path.join(dir,"Scene.tsx"),sceneSource(meta,states,points));
			const record={...meta,states,points,description:details.description,sources:details.sources,obsidianVersion:version,uiMode:meta.id==="17"?"dark":uiMode,artwork:"Native Chromium render of production component DOM",pixelRatio:2,errors,requests};
			writeFileSync(path.join(output,meta.slug,"provenance.json"),JSON.stringify(record,null,2)+"\n");
			results.push({id:meta.id,states:states.length,status:"rendered"});
			console.log(`Rendered ${meta.id}: ${states.length} source states, ${points.length} cursor waypoints`);
		} catch(error) {
			await page.screenshot({path:path.join(output,`${meta.id}-failure.png`),omitBackground:true});
			writeFileSync(path.join(output,`${meta.id}-failure.html`),await page.content());
			results.push({id:meta.id,status:"failed",message:error.stack,errors,requests});
			console.error(`FAILED ${meta.id}: ${error.stack}`);
		} finally {await page.close();}
	}
} finally {await browser.close();}
writeFileSync(path.join(output,"build-report.json"),JSON.stringify(results,null,2)+"\n");
assert.ok(results.every(r=>r.status==="rendered"),"Some source scenes failed; inspect build-report.json");
