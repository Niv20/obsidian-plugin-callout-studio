/** Validate with the destination site's real compiler, SDK and Chromium. */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
import {createRequire} from "node:module";
import {pathToFileURL,fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import path from "node:path";
import {build} from "esbuild";
import {catalog} from "./video-intros/catalog.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const site=process.env.SCENE_GENERATOR_ROOT || "/Users/niv/Documents/GitHub/Apple-Style-Generators";
const runtime="/Users/niv/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(runtime,"playwright"));
const sharp=require(path.join(runtime,"sharp"));
const {packageScene}=await import(pathToFileURL(path.join(site,"scripts/package-scene.ts")));
const {readSceneZip,compileScene,validateSceneManifest,imageDimensions}=await import(pathToFileURL(path.join(site,"server/assets.ts")));
const uiMode=process.env.INTRO_UI_MODE || "light";
const selected=process.argv.slice(2), output=process.env.INTRO_OUTPUT_DIR || path.join(root,`dist/video-intros${uiMode==="dark"?"-dark":""}`);
const entries=catalog.filter(s=>(!selected.length || selected.includes(s.id))&&existsSync(path.join(output,s.slug,"source/scene.json")));
const bootstrap=`import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {Player} from '@remotion/player';import * as jsxRuntime from 'react/jsx-runtime';import * as SDK from '${site}/src/scenes/sdk.tsx';
globalThis.__runtime={React,jsxRuntime,SDK};const host=document.getElementById('host');const shadow=host.attachShadow({mode:'open'});const mount=document.createElement('div');shadow.appendChild(mount);const root=createRoot(mount);
const Frame=(props)=>React.createElement(globalThis.__Component,{...props,parameters:{},asset:name=>'https://scene.invalid/'+name});
globalThis.__qaRender=(props)=>{flushSync(()=>root.render(React.createElement(Player,{component:Frame,inputProps:props,compositionWidth:props.width,compositionHeight:props.height,fps:props.fps,durationInFrames:props.durationInFrames,controls:false,autoPlay:false,style:{width:props.width,height:props.height}})));};`;
const runtimeBundle=(await build({stdin:{contents:bootstrap,loader:"tsx",resolveDir:site},bundle:true,write:false,format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'}})).outputFiles[0].text;
const browser=await chromium.launch({headless:true});
const hash=b=>createHash("sha256").update(b).digest("hex");
const reports=[];
try {
	for(const meta of entries) {
		const dir=path.join(output,meta.slug),sourceDir=path.join(dir,"source"),qaDir=path.join(dir,"qa");mkdirSync(qaDir,{recursive:true});
		const page=await browser.newPage({viewport:{width:740,height:650},deviceScaleFactor:1});
		const errors=[],network=[];page.on("pageerror",e=>errors.push(e.message));
		try {
			const pack=await packageScene(sourceDir,path.join(dir,"intro.scene.zip"));
			const files=await readSceneZip(readFileSync(pack.output));
			const manifest=validateSceneManifest(JSON.parse(files.get("scene.json").toString("utf8")));
			assert.equal(manifest.width,740);assert.equal(manifest.height,650);assert.equal(manifest.durationSeconds,meta.duration);
			for(const [name,buffer] of files) if(name.endsWith(".png"))assert.deepEqual(imageDimensions(buffer,".png"),{width:1480,height:1300});
			const source=files.get("Scene.tsx").toString("utf8");
			assert.ok(!/\b(?:setTimeout|setInterval|requestAnimationFrame|fetch|XMLHttpRequest)\b|Date\.now|Math\.random|@keyframes|from\s*["'](?:remotion|obsidian)/.test(source),"Forbidden scene runtime API");
			const compiled=await compileScene(files,manifest);
			await page.route("**/*",route=>{
				const url=new URL(route.request().url()),name=decodeURIComponent(url.pathname.slice(1));
				if(url.hostname==="scene.invalid"&&files.has(name))return route.fulfill({status:200,contentType:name.endsWith(".png")?"image/png":"image/svg+xml",body:files.get(name)});
				network.push(url.href);return route.abort();
			});
			await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"><div id="host"></div></body></html>');
			await page.addScriptTag({content:runtimeBundle});
			await page.addScriptTag({content:compiled.replace("export default function createScene","function createScene")+"\nglobalThis.__Component=createScene(globalThis.__runtime);"});
			const provenance=JSON.parse(readFileSync(path.join(dir,"provenance.json"),"utf8"));
			const frameImage=async(time,fps=30,background="transparent",size=740)=>{
				await page.evaluate(({time,fps,duration,background,size})=>{
					document.body.style.background=background;
					__qaRender({frame:Math.round(time*fps),fps,width:size,height:650*size/740,durationInFrames:duration*fps});
				},{time,fps,duration:meta.duration,background,size});
				await page.evaluate(async()=>{
					const imgs=[...document.getElementById("host").shadowRoot.querySelectorAll("img")];
					await Promise.all(imgs.map(img=>img.decode()));await document.fonts.ready;
					await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
				});
				return page.screenshot({omitBackground:true});
			};
			const times=[...new Set([0,.5,meta.duration-1,...Array.from({length:meta.duration*2},(_,i)=>i/2),...provenance.states.flatMap(s=>[Math.max(0,s.time-1/30),s.time,s.time+(s.transition||.14)/2,s.time+(s.transition||.14)])].map(t=>Math.round(Math.min(meta.duration-1,t)*30)/30))].sort((a,b)=>a-b);
			const records=[];
			for(const time of times) {
				const png=await frameImage(time);const pixels=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
				let transparent=0,visible=0,edge=0;
				for(let y=0;y<650;y++)for(let x=0;x<740;x++){
					const a=pixels.data[(y*740+x)*4+3];if(a===0)transparent++;else visible++;
					if((x<4||x>=736||y<4||y>=646)&&a>0)edge++;
				}
				assert.ok(transparent>10000,`${meta.id}@${time}: canvas is opaque`);assert.ok(visible>1000,`${meta.id}@${time}: empty render`);assert.equal(edge,0,`${meta.id}@${time}: content touches canvas edge`);
				records.push({time,hash:hash(png),transparentPixels:transparent,visiblePixels:visible});
				writeFileSync(path.join(qaDir,`frame-${String(Math.round(time*1000)).padStart(5,"0")}.png`),png);
			}
			const keyTimes=[0,Math.min(1.5,meta.duration-1),Math.min(3,meta.duration-1),meta.duration-1];
			for(const time of keyTimes)assert.equal(hash(await frameImage(time,30)),hash(await frameImage(time,60)),`${meta.id}:30/60fps mismatch@${time}`);
			const seekTime=Math.min(2.5,meta.duration-1),before=hash(await frameImage(seekTime));await frameImage(meta.duration-1);await frameImage(0);assert.equal(hash(await frameImage(seekTime)),before,`${meta.id}:direct seek mismatch`);
			const final=hash(await frameImage(meta.duration-1));assert.equal(hash(await frameImage(meta.duration-.5)),final,"Final half-second drift");assert.equal(hash(await frameImage(meta.duration-1/30)),final,"Last frame drift");
			for(const [label,color]of[["light","#f5f5f7"],["dark","#17181c"]])writeFileSync(path.join(qaDir,`${label}-final.png`),await frameImage(meta.duration-1,30,color));
			writeFileSync(path.join(qaDir,"half-size.png"),await frameImage(meta.duration-1,30,"transparent",370));
			assert.deepEqual(errors,[],`${meta.id}: runtime errors`);assert.deepEqual(network,[],`${meta.id}: external network requests`);
			const report={id:meta.id,name:meta.name,duration:meta.duration,pack,states:provenance.states.length,framesChecked:records.length,records,fps:[30,60],directSeek:true,finalHold:true,alpha:true,edgeMargin:true,lightDark:true,resizing:true,actualCompiler:true,actualSdk:true,errors,network,status:"passed"};
			writeFileSync(path.join(dir,"verification.json"),JSON.stringify(report,null,2)+"\n");reports.push(report);console.log(`PASS ${meta.id}: ${records.length} frame samples; 30/60fps; seek; final hold; alpha; native importer+SDK`);
		}catch(error){reports.push({id:meta.id,status:"failed",error:error.stack,errors,network});console.error(`FAIL ${meta.id}: ${error.stack}`);await page.screenshot({path:path.join(qaDir,"failure.png"),omitBackground:true});}
		finally{await page.close();}
	}
}finally{await browser.close();}
writeFileSync(path.join(output,"verification-report.json"),JSON.stringify(reports,null,2)+"\n");
assert.ok(reports.every(r=>r.status==="passed"),"Some scenes failed actual import/playback verification");
