/** Assemble the separately importable scenes with an offline download index. */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,copyFileSync} from "node:fs";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {catalog} from "./video-intros/catalog.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const site=process.env.SCENE_GENERATOR_ROOT || "/Users/niv/Documents/GitHub/Apple-Style-Generators";
const {zipSync,strToU8,unzipSync}=createRequire(path.join(site,"package.json"))("fflate");
const output=process.env.INTRO_OUTPUT_DIR || path.join(root,"dist/video-intros");
const files={},summary=[];
const archiveEntry=(name,data)=>{files[name]=[data,{mtime:new Date("2000-01-01T00:00:00.000Z")}];};
const escape=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
const cards=[];
for(const meta of catalog){
	const dir=path.join(output,meta.slug);
	const verified=JSON.parse(readFileSync(path.join(dir,"verification.json"),"utf8"));
	const provenance=JSON.parse(readFileSync(path.join(dir,"provenance.json"),"utf8"));
	assert.equal(verified.status,"passed",`${meta.id} has not passed`);
	const zip=readFileSync(path.join(dir,"intro.scene.zip")), entries=unzipSync(zip);
	assert.ok(entries["scene.json"]&&entries["Scene.tsx"],"Scene ZIP must have no wrapper folder");
	assert.deepEqual(JSON.parse(Buffer.from(entries["scene.json"]).toString("utf8")),JSON.parse(readFileSync(path.join(dir,"source/scene.json"),"utf8")));
	for(const [name,bytes]of Object.entries(entries))assert.ok(Buffer.from(bytes).equals(readFileSync(path.join(dir,"source",name))),`${meta.id}: stale packaged ${name}`);
	const end=`frame-${String((meta.duration-1)*1000).padStart(5,"0")}.png`;
	copyFileSync(path.join(dir,"qa",end),path.join(dir,"preview.png"));
	archiveEntry(`${meta.slug}/intro.scene.zip`,zip);
	archiveEntry(`${meta.slug}/preview.png`,readFileSync(path.join(dir,"preview.png")));
	summary.push({id:meta.id,name:meta.name,durationSeconds:meta.duration,width:740,height:650,pixelRatio:2,bytes:zip.length,sha256:createHash("sha256").update(zip).digest("hex"),sourceStates:provenance.states.length,frameSamples:verified.framesChecked,checks:["actual destination ZIP reader and compiler","actual SDK and Player","30/60 fps equality","direct and reverse seeking","final second held","transparent alpha and clear outer edges","light/dark background visual inspection","half-size visual inspection"],sources:provenance.sources});
	cards.push(`<article><div class="art"><img src="${meta.slug}/preview.png" alt="${escape(meta.name)}" loading="lazy"></div><div class="details"><span class="number">${meta.id}</span><h2 dir="ltr">${escape(meta.name)}</h2><p>${meta.duration} שניות · 740×650 · שקוף</p><a href="${meta.slug}/intro.scene.zip" download="${meta.id}-intro.scene.zip">הורדת הסצנה</a></div></article>`);
}
const instructions=`Callout Studio — 17 סצנות פתיחה\n\n1. חלץ את קובץ האוסף.\n2. באתר Apple-Style-Generators, פתח Your visuals ולחץ Add a visual.\n3. בחר intro.scene.zip מתוך התיקייה של הסרטון הרצוי. אין לחלץ את ה-ZIP הפנימי.\n4. בחר את הסצנה בספרייה והוסף באתר את הכותרת.\n\nקובץ האוסף אינו קובץ סצנה לייבוא. כל אחד מ-17 הקבצים הפנימיים ניתן לייבוא ישיר.\n\nכל סצנה:740×650, ללא אודיו וללא כותרת פתיחה, רקע חיצוני שקוף ושנייה אחרונה יציבה.\nהממשק רונדר מרכיבי המקור של הפלאגין, עם נתוני הדגמה בזיכרון, לתמונות PNG שקופות ברזולוציה כפולה. נגן React ו-SVG מציג את המצבים ומנפיש את העכבר מתוך הפריים בלבד. מעטפות Obsidian מסופקות על ידי סביבת הרינדור המקומית וסגנונות Obsidian המותקן.\n\nהסצנות עברו את קורא ה-ZIP והקומפיילר של האתר המקומי, בדיקות SDK,30/60FPS, קפיצות בין פריימים, שקיפות, שוליים וסיום יציב. נבדקו חזותית על רקע בהיר וכהה. לא בוצעה העלאה לספריית האתר שלך.\n\nבחירת Light/Dark נשמרה כהגדרה בתהליך ההפקה. הפקת מצב כהה דורשת רינדור חוזר, עם אותם שלבים ותזמון.\n`;
const html=`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Callout Studio — 17 פתיחות</title><style>body{margin:0;padding:40px;background:#f5f5f7;color:#202127;font:16px system-ui,sans-serif}main{max-width:1160px;margin:auto}h1{font-size:32px;margin:0 0 12px}header p{line-height:1.8;max-width:850px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-top:32px}article{background:white;border:1px solid #dedee3;border-radius:16px;overflow:hidden}.art{background-color:#eee;background-image:linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0px}.art img{display:block;width:100%;height:auto}.details{padding:20px}.number{color:#71717d;font-weight:600}h2{font-size:18px;line-height:1.4;margin:6px 0}p{font-size:14px;color:#565660}a{display:inline-block;padding:9px 14px;background:#6853bc;color:white;text-decoration:none;border-radius:8px;font-weight:600}footer{margin-top:30px;color:#686872;font-size:13px}</style><main><header><h1>17 פתיחות ל־Callout Studio</h1><p>כל סצנה רונדרה מרכיבי המקור, ללא כותרת וללא אודיו, עם רקע שקוף ושנייה אחרונה יציבה. משבצות הרקע כאן ממחישות שקיפות ואינן חלק מהסצנה.</p><p>לייבוא: <b>Your visuals → Add a visual</b>, ואז בחר את קובץ ה־ZIP של הסצנה. השאר אותו סגור. האתר ימקם את הסצנה לצד הכותרת שתוסיף.</p></header><div class="grid">${cards.join("")}</div><footer>נבדק באמצעות הקומפיילר וה־SDK האמיתיים של האתר, ב־30 וב־60 FPS, כולל קפיצה לפריימים, שקיפות, שוליים וסיום יציב.</footer></main></html>`;
writeFileSync(path.join(output,"IMPORT.txt"),instructions);
writeFileSync(path.join(output,"index.html"),html);
writeFileSync(path.join(output,"verification-summary.json"),JSON.stringify(summary,null,2)+"\n");
archiveEntry("IMPORT.txt",strToU8(instructions));archiveEntry("index.html",strToU8(html));archiveEntry("verification-summary.json",strToU8(JSON.stringify(summary,null,2)+"\n"));
const zipped=zipSync(files,{level:6});writeFileSync(path.join(output,"callout-studio-17-intros.zip"),zipped);
assert.equal(Object.keys(unzipSync(zipped)).filter(n=>n.endsWith("/intro.scene.zip")).length,17);
console.log(JSON.stringify({scenes:17,frameSamples:summary.reduce((sum,s)=>sum+s.frameSamples,0),bytes:zipped.length,output:path.join(output,"callout-studio-17-intros.zip")},null,2));
