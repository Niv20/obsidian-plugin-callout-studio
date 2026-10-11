/** Read the installed application's font data alongside its actual CSS/icons. */
import {readFileSync,readdirSync} from "node:fs";
import {homedir} from "node:os";
import path from "node:path";
import {loadObsidianAssets} from "../user-guide/obsidian-assets.mjs";

export function introAssets() {
	const assets=loadObsidianAssets();
	const updates=path.join(homedir(),"Library/Application Support/obsidian");
	const names=readdirSync(updates).filter(n=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(n)).sort((a,b)=>b.localeCompare(a,"en",{numeric:true}));
	const filename=process.env.OBSIDIAN_ASAR || (names[0]?path.join(updates,names[0]):"/Applications/Obsidian.app/Contents/Resources/obsidian.asar");
	const archive=readFileSync(filename), headerSize=archive.readUInt32LE(4), jsonSize=archive.readUInt32LE(12);
	const header=JSON.parse(archive.subarray(16,16+jsonSize).toString("utf8"));
	const appCss=assets.appCss.replace(/@font-face\s*\{[^}]*\}/g,rule=>{
		if(!/url\(public\/fonts\//.test(rule)) return rule;
		const embedded=rule.replace(/url\((public\/fonts\/[^)]+)\)/g,(_,fontPath)=>{
			let entry=header; for(const segment of fontPath.split("/")) entry=entry.files[segment];
			if(!entry || entry.unpacked) throw new Error(`Cannot read installed font ${fontPath}`);
			const start=8+headerSize+Number(entry.offset), data=archive.subarray(start,start+entry.size);
			const mime=fontPath.endsWith("woff2")?"font/woff2":"font/ttf";
			return `url(data:${mime};base64,${data.toString("base64")})`;
		}).replace(/font-display:\s*swap/g,"font-display:block");
		return embedded;
	});
	return {...assets,appCss};
}
