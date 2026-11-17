/**
 * Places the two captured pages side by side in two windows on the README
 * banner's ground (`#14101e` → `#1c142b`, `#39265f` glow, `#b392ff` accent),
 * under a headline, and renders the 1200 × 900 picture at 1.5x.
 */
const W = 1200;
const H = 900;
const SCALE = 1.5;

const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;

function html({ panels, width, background }) {
	const pane = (variant, label) => `
 <div class="col"><div class="label ${variant}"><span class="dot"></span>${label}</div>
  <div class="win ${variant}-win"><div class="bar"><i></i><i></i><i></i></div><div class="body"><img src="${dataUrl(panels[variant])}"></div></div></div>`;
	return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px}
body{font-family:-apple-system,"SF Pro Text",system-ui,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;
 background:radial-gradient(ellipse 70% 55% at 50% 0%,#39265f 0%,rgba(57,38,95,0) 70%),linear-gradient(160deg,#14101e,#1c142b);
 display:flex;align-items:center;justify-content:center;overflow:hidden}
.stack{display:flex;flex-direction:column;align-items:center;gap:40px}
.head{text-align:center}
.head h1{font-size:36px;font-weight:700;letter-spacing:-.01em;color:#f4effc}
.head p{margin-top:10px;font-size:18px;color:#b9aed0}
.row{display:flex;gap:44px;align-items:flex-start;position:relative}
.col{display:flex;flex-direction:column;gap:14px;width:${width + 32}px}
.label{display:flex;align-items:center;gap:9px;font-size:17px;font-weight:600;letter-spacing:.01em;padding-left:4px}
.label .dot{width:9px;height:9px;border-radius:50%}
.without{color:#a79fba}.without .dot{background:#6b6280}
.with{color:#d9c8ff}.with .dot{background:#b392ff;box-shadow:0 0 0 4px rgba(179,146,255,.18)}
.win{border-radius:12px;overflow:hidden;background:${background};box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 24px 60px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08)}
.with-win{box-shadow:0 24px 60px rgba(0,0,0,.45),0 0 0 1px rgba(179,146,255,.55),0 0 40px rgba(137,99,201,.35)}
.bar{height:30px;display:flex;align-items:center;gap:7px;padding:0 13px;background:#ecebef;border-bottom:1px solid #dddbe3}
.bar i{width:10px;height:10px;border-radius:50%;background:#cfccd8;display:block}
.body{padding:0 16px}
.body img{display:block;width:${width}px}
.arrow{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;
 background:#2a1f40;border:1px solid rgba(179,146,255,.5);display:flex;align-items:center;justify-content:center;margin-top:14px}
</style></head><body>
<div class="stack"><div class="head"><h1>Callout Studio for Digital Garden</h1><p>Your heading, inline and block callouts, with the icons and colors you set up in Obsidian.</p></div>
<div class="row">${pane("without", "Without Callout Studio")}
 <div class="arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d9c8ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></div>${pane("with", "With Callout Studio")}
</div></div></body></html>`;
}

/** The finished picture, as a PNG buffer. Throws when the windows do not fit the canvas. */
export async function frame(browser, shot) {
	const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
	try {
		const page = await context.newPage();
		await page.route("**/*", (route) => route.abort());
		await page.setContent(html(shot), { waitUntil: "load" });
		const height = await page.evaluate(() => document.querySelector(".stack").getBoundingClientRect().height);
		if (height > H - 48) throw new Error(`The picture is ${Math.ceil(height)} px tall, more than the ${H} px canvas allows; shorten page.md`);
		return await page.screenshot();
	} finally {
		await context.close();
	}
}
