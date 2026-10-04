/** Meaningful checks on source-rendered fixtures and the exported vector data. */
export async function verifyScene(page, name, selector) {
	await page.evaluate(({ name, selector }) => {
		const root = document.querySelector(selector);
		const require = (value, message) => { if (!value) throw new Error(`${name}: ${message}`); };
		require(document.body.classList.contains("theme-dark") && matchMedia("(prefers-color-scheme: dark)").matches, "expected dark mode");
		const color = getComputedStyle(root).backgroundColor.match(/[\d.]+/g)?.map(Number);
		require(color && color.slice(0, 3).every(channel => channel < 80), "expected a dark scene surface");
		if (name === "create-settings") {
			const labels = root.innerText;
			for (const label of ["My callout types", "Add new callout", "Built-in callouts", "No custom callouts for now."]) require(labels.includes(label), `missing ${label}`);
			require(root.querySelector(".cs-discover-callouts-btn"), "missing actual discovery control");
		} else if (name === "create-editor") {
			require(root.querySelector('input[type="text"]').value === "Project note", "wrong example name");
			require(root.querySelectorAll('input[type="range"]').length === 9, "expected independent adjustment controls for all three roles");
			const preview = root.querySelector(".cs-live-preview-render");
			require(preview && !preview.textContent.includes("[!"), "sample Markdown was not processed");
			for (const selector of ['.cs-heading-callout[data-callout="project note"]', '.cs-inline-callout[data-callout="project note"]', '.callout[data-callout="project-note"]']) {
				const role = preview.querySelector(selector);
				require(role && role.querySelector("svg path"), `missing rendered role or icon: ${selector}`);
			}
			const block = preview.querySelector(".callout");
			require(getComputedStyle(block).backgroundColor !== "rgba(0, 0, 0, 0)", "block callout lost its background");
			require(getComputedStyle(block.querySelector(".callout-title")).color !== getComputedStyle(root).color, "block title lost its accent color");
			require(document.querySelector("#callout-studio-dynamic-css").textContent.includes("project-note"), "missing actual generated callout CSS");
			require(root.innerText.includes("Create callout"), "missing create action");
		} else if (name === "create-autocomplete") {
			require(root.querySelector(".cm-content").textContent === "> [!project", "wrong CodeMirror source");
			require(root.querySelector(".callout-studio-suggestion-name").textContent === 'Create "project"', "wrong autocomplete label");
			require(root.querySelector(".callout-studio-suggestion-icon svg"), "missing actual create icon");
		} else if (name === "formats-autocomplete") {
			require(root.querySelector(".cm-content").textContent.includes("> [!note"), "wrong CodeMirror token");
			require(root.querySelector(".callout-studio-suggestion-name").textContent === "Note", "missing actual Note suggestion");
		} else {
			require(root.innerText.trim().length > 20, "missing source-rendered UI text");
			require(root.getBoundingClientRect().height <= 704.5, "window exceeds documentation height limit");
			for (const preview of root.querySelectorAll(".cs-live-preview-render")) require(!preview.textContent.includes("[!"), "unprocessed callout preview");
			if (name.startsWith("palette-")) {
				const preview = root.querySelector(".cs-live-preview-render");
				for (const selector of [".cs-heading-callout", ".cs-inline-callout", ".callout"]) {
					const role = preview?.querySelector(selector);
					require(role, `missing palette preview role ${selector}`);
					if (name === "palette-gradient") require(getComputedStyle(role).backgroundImage.startsWith("linear-gradient("), "missing source gradient");
				}
			}
			if (name.startsWith("icon-") && name !== "icon-libraries") require(root.querySelector(".icon-picker-grid.is-loaded .icon-picker-cell.is-selected"), "missing selected production icon");
			if (name === "theme-callouts") require(root.querySelectorAll("svg").length > 8 && root.innerText.includes("Callouts from your theme"), "missing measured theme rows");
			if (name === "context-menu") require(root.querySelectorAll(".menu-item").length >= 4, "missing production context actions");
		}
	}, { name, selector });
}

export async function verifySvg(page, svg, name) {
	await page.evaluate(({ svg, name }) => {
		if (/\b(?:NaN|Infinity)\b/.test(svg)) throw new Error(`${name}: invalid numeric SVG value`);
		const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
		if (Number(doc.documentElement.getAttribute("height")) > 760) throw new Error(`${name}: vector exceeds maximum image height`);
		const allowed = new Set(["svg", "title", "desc", "defs", "g", "rect", "text", "path", "line", "circle", "polyline", "polygon", "ellipse", "clipPath", "linearGradient", "stop"]);
		if (doc.querySelector("parsererror")) throw new Error(`${name}: invalid SVG XML`);
		for (const element of doc.querySelectorAll("*")) {
			if (!allowed.has(element.localName)) throw new Error(`${name}: non-vector SVG element ${element.localName}`);
			for (const attribute of element.attributes) {
				if (/^on/i.test(attribute.name) || /href$/i.test(attribute.name) && !attribute.value.startsWith("#") || /url\(\s*["']?(?!#)/i.test(attribute.value)) throw new Error(`${name}: active or external SVG content`);
			}
		}
		if (name === "create-settings" && !doc.documentElement.textContent.includes("Add new callout")) throw new Error("Settings action disappeared during vector export");
		if (name === "palette-gradient" && doc.querySelectorAll("linearGradient").length < 3) throw new Error("Palette gradients disappeared during vector export");
	}, { svg, name });
}
