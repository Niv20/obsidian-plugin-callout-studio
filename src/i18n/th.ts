export const th: Record<string, string> = {
	"cmd.openSettings": "เปิดการตั้งค่า",
	"cmd.createCallout": "สร้างประเภท callout ใหม่",
	"cmd.insertEmptyCallout": "แทรก callout ว่าง",
	"cmd.calloutWrap": "ห่อใน callout",
	"cmd.calloutUnwrap": "นำ callout ออก",

	"cmd.customWrapBlock": "ห่อใน callout แบบบล็อก {{name}}",
	"cmd.customInsertBlock": "แทรก callout แบบบล็อก {{name}}",
	"cmd.customInsertHeading": "แทรกหัวข้อ callout H{{level}} {{name}}",
	"cmd.customInsertInline": "แทรก callout แบบอินไลน์ {{name}}",
	"cmd.openQuickInsert": "แทรก callout แบบบล็อกอย่างรวดเร็ว",

	"autocomplete.createNew": 'สร้าง callout ใหม่: "{{name}}"',

	"settings.fallbackTag": "ค่าเริ่มต้น",
	"settings.fallbackTagAuto": "ค่าเริ่มต้นอัตโนมัติ",
	"settings.autoDiscover": "ตรวจจับ callout ในคลังของคุณโดยอัตโนมัติ",
	"settings.autoDiscoverDesc":
		"สังเกตประเภท callout ที่เขียนไว้ในโน้ตของคุณและเพิ่มลงในรายการโดยอัตโนมัติ การปิดตัวเลือกนี้จะไม่ส่งผลต่อ callout ที่มีอยู่แล้ว — คุณยังสามารถเพิ่มเองได้ หรือใช้ สแกนคลังอีกครั้ง ด้านล่าง",
	"settings.rescanVault": "สแกน vault ใหม่",
	"settings.rescanVaultDesc":
		"ค้นหา ID callout ที่ไม่รู้จักในโน้ตและเพิ่มเป็นแถวสำรอง",
	"settings.rescanVaultHintAction": "สแกนเดี๋ยวนี้",
	"settings.rescanComplete":
		"สแกนใหม่เสร็จแล้ว: เพิ่ม {{count}} callout ใหม่",
	"replaceModal.deleteWithoutReplaceSuffix": "(กลับไปใช้ค่าเริ่มต้น)",
	"replaceModal.titleDelete": "ลบ callout",
	"replaceModal.titleReplace": "แทนที่ใน vault",

	"firstRun.title": "ค้นหา callout ที่มีอยู่ใน vault หรือไม่?",
	"firstRun.body":
		"Callout Studio สามารถสแกน vault ของคุณเพื่อค้นพบ callout ที่คุณใช้งานอยู่แล้ว เพื่อให้แสดงในรายการการตั้งค่าและใช้สไตล์สำรองของคุณ",
	"firstRun.heavyVaultNote":
		"vault ของคุณมีไฟล์ Markdown {{count}} ไฟล์ — การสแกนอาจใช้เวลาสักครู่",
	"firstRun.laterHint":
		"คุณสามารถเรียกใช้งานนี้ในภายหลังได้จาก การตั้งค่า → ข้อมูลเชิงลึกและการบำรุงรักษา vault → สแกน vault ใหม่",
	"firstRun.scanNow": "สแกนเดี๋ยวนี้",
	"firstRun.noThanks": "ไม่ ขอบคุณ",
	"firstRun.autoScanComplete":
		"Callout Studio สแกน vault ของคุณและเพิ่ม {{count}} callout แล้ว",
	"firstRun.scanning": "กำลังสแกน",
	"firstRun.autoScanFailed":
		"Callout Studio ไม่สามารถสแกน vault ของคุณได้ คุณสามารถลองอีกครั้งได้จาก การตั้งค่า → ข้อมูลเชิงลึกและการบำรุงรักษา vault → สแกน vault ใหม่",
	"firstRun.scanFailed":
		"การสแกนไม่เสร็จสมบูรณ์ คุณสามารถลองอีกครั้งได้จาก การตั้งค่า → ข้อมูลเชิงลึกและการบำรุงรักษา vault → สแกน vault ใหม่",

	"welcome.tooltip": "เกี่ยวกับ Callout Studio",
	"welcome.title": "ยินดีต้อนรับสู่ Callout Studio!",
	"welcome.tagline":
		"โซลูชันครบวงจรของคุณสำหรับสร้าง จัดรูปแบบ และจัดการ callout ใน Obsidian",
	"welcome.previewTitle": "ดูการทำงานจริง",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Callout Studio ช่วยให้คุณสร้าง callout ที่มีไอคอน สี และชื่อที่กำหนดเองได้\n\n" +
		"คุณสามารถใช้ callout นี้ได้ **สาม** รูปแบบที่แตกต่างกัน:\n\n" +
		"## [!{{id}}] callout เป็นหัวข้อ\n" +
		"หากต้องการเปลี่ยนหัวข้อใดๆ ให้เป็นหัวข้อสไตล์ callout ให้เพิ่ม `[!type]` ต่อจาก `#` ทันที\n\n" +
		"ต้องการ [!{{id}}]{callout แบบอินไลน์} แบบนี้ไหม? แค่เพิ่ม `[!type]{text}` กลางประโยคได้เลย โดยไม่ต้องขัดจังหวะการเขียนของคุณ\n\n" +
		"> [!{{id}}] callout แบบบล็อก\n" +
		"> callout แบบคลาสสิกยังคงทำงานด้วยไวยากรณ์แบบเดียวกับที่คุณคุ้นเคยอยู่แล้ว: `> [!type]`\n\n" +
		"Callout Studio ยังมีอะไรให้มากกว่านี้อีกมาก! [เรียนรู้เพิ่มเติม]({{repoUrl}})\n",

	"deleteModal.title": 'ลบ callout "{{name}}" หรือไม่?',
	"deleteModal.bodyInUse":
		"callout นี้ปรากฏ {{count}} ครั้งใน {{files}} ไฟล์",
	"deleteModal.bodyInUseExplain":
		"การลบจะแปลงบล็อกเหล่านั้นเป็นข้อความธรรมดา — จะสูญเสียสไตล์และหัว callout",
	"deleteModal.replaceHint":
		"คุณสามารถแทนที่ด้วย callout อื่นแทน ซึ่งจะรักษาเนื้อหาใน vault เป็น callout ที่มีสไตล์",
	"deleteModal.bodyUnused":
		'"{{name}}" ไม่ได้ใช้งานในโน้ตใด แต่เป็น callout แบบกำหนดเองที่คุณสร้าง การลบจะนำออกจากรายการนี้',
	"deleteModal.replaceInstead": "แทนที่แทน",
	"deleteModal.deleteInUse": "ลบ (แปลงเป็นข้อความธรรมดา)",
	"deleteModal.deleteUnused": "ลบ callout",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'ล้างการใช้งานทั้งหมดของ "{{name}}" หรือไม่?',
	"deleteModal.keepsRowBuiltIn":
		"นี่คือหนึ่งใน callout ในตัวของ Obsidian ดังนั้นประเภทนี้จะยังคงใช้งานได้ — มีเพียงการใช้งานในโน้ตของคุณเท่านั้นที่จะเปลี่ยนแปลง",
	"deleteModal.keepsRowTheme":
		"{{theme}} กำหนดประเภท callout นี้ไว้ จึงยังคงใช้งานได้และคงรูปลักษณ์เดิม Callout Studio จะเปลี่ยนเฉพาะโน้ตภายใน vault ของคุณเท่านั้น — ไม่แตะต้องสิ่งใดที่เป็นของธีมของคุณ",
	"deleteModal.clearUsages": "ล้างการใช้งาน (แปลงเป็นข้อความธรรมดา)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "ประเภท callout ของฉัน",
	"settings.builtInCallouts": "Callout ในตัว",
	"settings.contextMenu": "เมนูบริบท",
	"settings.autocomplete": "เติมข้อความอัตโนมัติ",
	"settings.keyboardShortcuts": "แป้นพิมพ์ลัด",
	"settings.language": "ภาษา",
	"settings.languageDesc":
		"ภาษาที่แสดงผลสำหรับ Callout Studio ค่าเริ่มต้นจะใช้ตามภาษาอินเทอร์เฟซของ Obsidian",
	"settings.languageAuto": "อัตโนมัติ (ตาม Obsidian)",
	"settings.importExport": "นำเข้า / ส่งออก",
	"settings.import": "นำเข้า",
	"settings.export": "ส่งออก",
	"settings.importDesc":
		"นำเข้าข้อมูล Callout Studio จาก vault อื่นโดยใช้ไฟล์ JSON",
	"settings.exportDesc":
		"บันทึกประเภท callout แบบกำหนดเองทั้งหมดในรูปแบบ JSON",
	"settings.importConflictNotice":
		"นำเข้า {{count}} ประเภท callout แล้ว; เขียนทับ {{overwritten}} รายการที่มีอยู่",

	"settings.addNewCallout": "+ เพิ่ม callout",

	"settings.noCalloutsNow": "ยังไม่มี callout แบบกำหนดเองในขณะนี้",

	"settings.editAria": "แก้ไข {{name}}",
	"settings.moreRowActionsAria": "การดำเนินการเพิ่มเติมสำหรับ {{name}}",
	"settings.usageInfo": "ใช้งาน {{count}} ครั้งใน {{files}} ไฟล์",
	"settings.replaceAction": "แทนที่ใน vault",
	"settings.deleteAction": "ลบ",
	"settings.resetAction": "รีเซ็ตเป็นค่าเริ่มต้น",
	"settings.makeFallbackAction": "ใช้สไตล์สำรองเริ่มต้น",

	"settings.colorSwatchAria": "จุดเน้น: {{accent}} · พื้นหลัง: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "จัดสไตล์ด้วย CSS ของฉันเอง",
	"settings.externalCssStopAction": "ให้ Callout Studio จัดสไตล์นี้อีกครั้ง",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "CSS ภายนอก",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callout จากธีมของคุณ",
	"settings.themeCalloutsDesc":
		"{{theme}} กำหนดหรือปรับสไตล์ callout เหล่านี้ ดังนั้น Callout Studio จะปล่อยให้เป็นไปตามที่ธีมของคุณวาดไว้ และเสนอให้ใช้ได้เฉพาะแบบ Block callout เท่านั้น ทั้งสองประเภทจะปรากฏที่นี่: ประเภท callout ที่ธีมของคุณเพิ่มเข้ามา และ callout ในตัวที่ธีมเปลี่ยนรูปลักษณ์ ประเภท callout ที่ธีมของคุณเพิ่มเข้ามาจะแสดงเฉพาะขณะที่ธีมนั้นใช้งานอยู่เท่านั้น",
	"settings.themeCalloutsDefaultTheme": "ธีมของคุณ",
	"settings.themePreviewAria":
		'ดูตัวอย่าง "{{name}}" — ดูว่าธีมของคุณวาดมันอย่างไร',
	"settings.clearUsesAction": "ล้างการใช้งานในโน้ตของคุณ",
	"settings.builtInAllThemeStyled":
		"{{theme}} ปรับสไตล์ callout ในตัวทุกรายการ ดังนั้นทั้งหมดจะแสดงอยู่ด้านบนและ Callout Studio จะไม่แตะต้อง หากต้องการออกแบบของคุณเอง ให้เพิ่ม callout ที่มี ID ต่างออกไป",
	"settings.fallbackCallout": "Callout สำรองเริ่มต้น",
	"settings.fallbackCalloutDesc":
		"ประเภท callout ที่ไม่รู้จักใน vault จะสืบทอดสไตล์ของ callout นี้",

	"settings.globalStyle": "สไตล์ callout ส่วนกลาง",
	"settings.border": "ขอบ",
	"settings.borderAll": "ทั้งหมด",
	"settings.borderTop": "บน",
	"settings.borderRight": "ขวา",
	"settings.borderBottom": "ล่าง",
	"settings.borderLeft": "ซ้าย",
	"settings.borderWidth": "ความหนาของขอบ",
	"settings.fontScaleGroup": "ขนาดตัวอักษร",
	"settings.titleScale": "หัวเรื่อง",
	"settings.contentScale": "เนื้อหา",
	"settings.inlineTextScale": "ข้อความ",
	"settings.shapeGroup": "รูปร่าง",
	"settings.borderRadius": "ความโค้งมุม",
	"settings.alignGroup": "การจัดแนว",
	"settings.alignContent": "จัดเนื้อหาให้ตรงกับชื่อเรื่อง",
	"settings.headingSpacingGroup": "ระยะห่างหัวเรื่อง",
	"settings.headingPadVertical": "ระยะห่างแนวตั้ง",
	"settings.headingGap": "ระยะห่างระหว่างหัวข้อ",
	"settings.headingFoldGroup": "การพับ",
	"settings.headingFoldArrow": "แสดงลูกศรพับ",
	"settings.styleDemoName": "ตัวอย่าง",
	"settings.previewTitle": "ตัวอย่าง",

	// Settings — Saved color palettes
	"settings.customPalettes": "ชุดสีที่บันทึกไว้",
	"settings.newPalette": "ชุดสีใหม่",
	"settings.customPalettesEmpty": "ยังไม่มีชุดสีที่บันทึกไว้ในขณะนี้",
	"settings.editPaletteAria": "แก้ไขชุดสี {{name}}",
	"settings.deletePaletteAria": "ลบชุดสี {{name}}",
	"settings.deletePaletteConfirm":
		'ลบชุดสี "{{name}}" หรือไม่?\nCallout ที่ใช้สีนี้จะไม่ได้รับผลกระทบ',
	"settings.enableAutocomplete": "เปิดใช้การเติมข้อความอัตโนมัติ [!",
	"settings.enableAutocompleteDesc":
		'แสดงคำแนะนำเมื่อพิมพ์ "[!" ในบล็อกอ้างอิงในตัวแก้ไข เลือกประเภท callout จากรายการเพื่อแทรกส่วนหัว callout ที่สมบูรณ์',

	"settings.customCommands": "คำสั่งและแป้นพิมพ์ลัด",
	"settings.customCommandsDesc":
		"ดูคำสั่งทั้งหมดของ Callout Studio และแป้นพิมพ์ลัดที่ผูกไว้ พร้อมสร้างคำสั่งของคุณเองสำหรับ callout ที่คุณใช้บ่อยที่สุด ไม่มีการกำหนดแป้นพิมพ์ลัดโดยค่าเริ่มต้น",
	"settings.customCommandsButton": "จัดการคำสั่ง",

	"commandBuilder.title": "คำสั่งและแป้นพิมพ์ลัด",
	"commandBuilder.desc":
		"ใช้ปุ่ม + เพื่อตั้งค่าหรือเปลี่ยนแป้นพิมพ์ลัดในการตั้งค่าแป้นพิมพ์ลัดของ Obsidian",
	"commandBuilder.builtIn": "คำสั่งในตัว",
	"commandBuilder.toggleAria": "เปิดหรือปิด {{name}}",
	"commandBuilder.hotkeyBlank": "ว่าง",
	"commandBuilder.hotkeyAria": "ตั้งค่าแป้นพิมพ์ลัดสำหรับ {{name}}",
	"commandBuilder.yourCommands": "คำสั่งของคุณ",
	"commandBuilder.newCommand": "คำสั่งใหม่",
	"commandBuilder.empty": "ยังไม่มีคำสั่งแบบกำหนดเอง",
	"commandBuilder.unknownCommand": "คำสั่งนี้",
	"commandBuilder.editAria": "แก้ไข {{name}}",
	"commandBuilder.deleteAria": "ลบ {{name}}",
	"commandBuilder.deleteConfirm":
		"ลบคำสั่ง {{name}} หรือไม่? แป้นพิมพ์ลัดที่กำหนดไว้จะใช้งานไม่ได้อีกต่อไป",
	"commandBuilder.newTitle": "คำสั่งใหม่",
	"commandBuilder.editTitle": "แก้ไขคำสั่ง",
	"commandBuilder.format": "รูปแบบ callout",
	"commandBuilder.formatDesc": "ชนิดของ callout ที่คำสั่งนี้เขียน",
	"commandBuilder.formatHeading": "หัวข้อ",
	"commandBuilder.formatInline": "อินไลน์",
	"commandBuilder.formatBlock": "บล็อก",
	"commandBuilder.roleDisabled":
		"รูปแบบนี้ถูกปิดอยู่ คำสั่งจึงจะแทรกข้อความธรรมดาจนกว่าคุณจะเปิดใช้อีกครั้ง",
	"commandBuilder.roleThemeOwned":
		"ธีมของคุณกำหนด callout นี้ไว้ จึงมีเฉพาะรูปแบบ Block เท่านั้น",
	"commandBuilder.commandSuspended":
		"หยุดชั่วคราว: ธีมของคุณกำหนด callout นี้ไว้ จึงมีเฉพาะรูปแบบ Block เท่านั้น คำสั่งนี้จะใช้งานได้อีกครั้งเมื่อธีมเลิกกำหนด callout นี้",
	"commandBuilder.callout": "ประเภท callout",
	"commandBuilder.calloutDesc": "callout ที่คำสั่งนี้แทรก",
	"commandBuilder.headingLevel": "ระดับหัวข้อ",
	"commandBuilder.headingLevelDesc": "ระดับหัวข้อที่จะเขียน",
	"commandBuilder.action": "การกระทำ",
	"commandBuilder.actionDesc":
		"ห่อจะเปลี่ยนข้อความที่เลือกให้เป็น callout ส่วนแทรกจะเพิ่ม callout เปล่า",
	"commandBuilder.actionWrap": "ห่อข้อความที่เลือก",
	"commandBuilder.actionInsert": "แทรกใหม่",
	"commandBuilder.preview": "ชื่อคำสั่ง",
	"commandBuilder.duplicate": "คุณมีคำสั่งที่ทำแบบนี้อยู่แล้ว",
	"commandBuilder.noCallouts": "ยังไม่มีประเภท callout ให้สร้างคำสั่งจาก",
	"commandBuilder.save": "บันทึก",

	"settings.vaultMaintenance": "ข้อมูลเชิงลึกและการบำรุงรักษา vault",
	"settings.vaultStats": "สถิติ callout",
	"settings.vaultStatsDesc":
		"นับ callout ทุกรายการในโน้ต Markdown ของคุณ — แบบบล็อก แบบหัวข้อ และแบบอินไลน์ — แล้วจัดกลุ่มตามประเภท",
	"settings.vaultStatsButton": "ดูสถิติ",
	"settings.vaultStatsScanning": "กำลังสแกน",
	"settings.resetAll": "รีเซ็ต",
	"settings.resetAllDesc":
		"ลบ callout ผู้ใช้ทั้งหมด รีเซ็ต callout ในตัว สไตล์ส่วนกลาง (ขอบ ขนาดตัวอักษร รูปร่าง) ชุดสีที่บันทึกไว้ การปรับแต่งเมนูคลิกขวา และ SVG Material ที่ดาวน์โหลด",
	"settings.resetAllButton": "รีเซ็ตทั้งหมด",
	"settings.resetAllConfirm":
		"การดำเนินการนี้จะลบ callout แบบกำหนดเองทั้งหมด รีเซ็ต callout ในตัว สไตล์ส่วนกลาง ชุดสีที่บันทึกไว้ การปรับแต่งเมนูคลิกขวา และ SVG Material ที่แคชทั้งหมด ไม่สามารถยกเลิกได้ คุณแน่ใจหรือไม่?",
	"notice.resetAllDone": "รีเซ็ตทุกอย่างเป็นค่าเริ่มต้นแล้ว",

	"notice.customCommandsRemoved":
		"ลบคำสั่งแบบกำหนดเอง {{count}} รายการที่ประเภท callout ไม่มีอยู่แล้ว",
	"notice.customCommandMissingCallout":
		"ประเภท callout ของคำสั่งนี้ไม่มีอยู่แล้ว",
	"notice.exported": "ส่งออก callout ไปยัง callout-studio-export.json แล้ว",
	"notice.importedJSON": "นำเข้า {{count}} ประเภท callout จาก JSON แล้ว",
	"notice.importedSettings": "นำเข้าการตั้งค่าปลั๊กอินแล้ว",
	"notice.importedCalloutManager":
		"นำเข้าจาก Callout Manager: สร้างแล้ว {{created}} รายการ, อัปเดตแล้ว {{updated}} รายการ",
	"notice.importedAdmonition":
		"นำเข้าจาก Admonition แล้ว: สร้าง {{created}} รายการ อัปเดต " +
		"{{updated}} รายการ",
	"notice.noNewJSON": "ไม่มีประเภท callout ใหม่ที่นำเข้า (ID อาจมีอยู่แล้ว)",
	"notice.iconDownloadFailed":
		'ไม่สามารถดาวน์โหลดไอคอน Material "{{name}}" ได้ อาจไม่มีให้บริการสำหรับสไตล์/น้ำหนักนี้ หรือการเชื่อมต่อของคุณออฟไลน์อยู่',
	"notice.externalCssOn":
		'Callout Studio จะไม่จัดสไตล์ "{{name}}" อีกต่อไป — CSS ของคุณเองจะเป็นตัวกำหนดรูปลักษณ์ รูปแบบ Heading Callout และ Inline Callout จะไม่แสดงผล',
	"notice.externalCssOff": 'ตอนนี้ Callout Studio จัดสไตล์ "{{name}}" อีกครั้งแล้ว',
	"notice.nothingToWrap": "ไม่มีอะไรให้ห่อ",
	"notice.cursorNotInsideCallout": "เคอร์เซอร์ไม่อยู่ใน callout",
	"notice.autocompleteTargetMoved":
		"ไม่ได้แทรกสิ่งใด — บรรทัดเปลี่ยนไปขณะที่ตัวแก้ไขเปิดอยู่",
	"notice.openHotkeysFailed":
		"ไม่สามารถเปิดการตั้งค่าแป้นพิมพ์ลัดของ Obsidian ได้",
	"notice.filterHotkeysFailed":
		"เปิดแป้นพิมพ์ลัด Obsidian แล้ว แต่ไม่สามารถใช้ตัวกรอง Callout Studio ได้",

	"editor.editCallout": "แก้ไข callout",
	"editor.newCallout": "callout ใหม่",
	"editor.displayName": "ชื่อที่แสดง",
	"editor.displayNameDesc": "ป้ายกำกับที่อ่านได้ที่แสดงใน UI",
	"editor.displayNameBuiltIn":
		"ไม่สามารถเปลี่ยนชื่อที่แสดงสำหรับ callout ในตัวได้",
	"editor.displayNamePlaceholder": "callout ของฉัน",
	"editor.calloutIds": "ID callout",
	"editor.calloutIdsDesc":
		"ตัวระบุทั้งหมดสำหรับ callout นี้ อนุญาตให้ใช้ช่องว่างได้\nกด Enter หรือปุ่ม + เพื่อเพิ่ม",
	"editor.calloutIdsPlaceholder": "เพิ่ม ID",
	"editor.addId": "เพิ่ม ID",
	"editor.idLinkedToName": "เชื่อมโยงกับชื่อที่แสดง",
	"editor.idCannotDelete":
		"ID นี้เชื่อมโยงกับชื่อที่แสดงและไม่สามารถลบได้ — แก้ไขชื่อเพื่อเปลี่ยน",
	"editor.icon": "ไอคอน",
	"editor.pickIcon": "เปลี่ยนไอคอน",
	"editor.replaceIcon": "แทนที่ไอคอน",
	"editor.removeIcon": "ลบไอคอน",
	"editor.noIcon": "ไม่มีไอคอน",
	"editor.resetIcon": "รีเซ็ตไอคอนเป็นค่าเริ่มต้น",
	"editor.livePreview": "ตัวอย่างสด",
	"editor.iconAdjustment": "ปรับไอคอน",
	"editor.picture": "รูปภาพ",
	"editor.size": "ขนาด",
	"editor.horizontalOffset": "ระยะเลื่อนแนวนอน",
	"editor.verticalOffset": "ระยะเลื่อนแนวตั้ง",
	"editor.colors": "สี",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "รีเซ็ตสีเป็นค่าเริ่มต้น",
	"editor.paletteDeleted": "สีที่ถูกลบ",
	"editor.paletteGroupObsidian": "Callout Obsidian",
	"editor.paletteGroupPresets": "ค่าสีที่ตั้งไว้ล่วงหน้า",
	"editor.paletteGroupCustom": "กำหนดเอง",
	"editor.paletteNewColor": "สีใหม่…",
	"editor.contrastWarning": "คอนทราสต์ต่ำเมื่อเทียบกับพื้นหลัง — อาจอ่านยาก",
	"editor.foldable": "พับได้",
	"editor.foldableDesc":
		"เลือกว่า callout พับได้หรือไม่และสถานะเริ่มต้นที่จะใช้กับ vault ทั้งหมด",
	"editor.foldOff": "ปิด",
	"editor.foldOpen": "เปิดโดยค่าเริ่มต้น",
	"editor.foldClosed": "ปิดโดยค่าเริ่มต้น",
	"editor.cancel": "ยกเลิก",
	"editor.saveChanges": "บันทึกการเปลี่ยนแปลง",
	"editor.createCallout": "สร้าง callout",
	"editor.nameRequired": "ต้องใส่ชื่อที่แสดงก่อนสร้าง callout",
	"editor.noChangesToSave": "ไม่มีการเปลี่ยนแปลง",
	"editor.downloadingIcon": "กำลังดาวน์โหลดไอคอน",
	"editor.idEmpty": "ต้องมี ID อย่างน้อยหนึ่งรายการ",
	"editor.idExists": "มี callout ที่มี ID นี้อยู่แล้ว",
	"editor.idConflict": "ID นี้ขัดแย้งกับ callout ที่มีอยู่",
	"editor.idFromTheme":
		"{{theme}} มี callout ที่ใช้ ID นี้อยู่แล้ว Callout Studio จึงไม่สามารถจัดสไตล์ได้ กรุณาเลือก ID อื่น",
	"editor.idThemePattern":
		"โปรดทราบ: ธีมของคุณจัดสไตล์ callout ทุกรายการที่ตรงกับ {{pattern}} จึงอาจแทนที่รูปลักษณ์ของ callout นี้",
	"editor.idDashConflict":
		'Obsidian เขียนช่องว่างเป็นขีดกลาง ดังนั้น ID นี้จึงขัดแย้งกับ "{{other}}"',
	"editor.untitledCallout": "Callout ไม่มีชื่อ",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText": "นี่คือแคปซูล [!{id}] แบบอินไลน์ภายในย่อหน้า",
	"editor.previewReadOnly": "ไม่สามารถแก้ไขตัวอย่างสดได้",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — กำหนดโดยธีมของคุณ',
	"themePreview.owned":
		'{{theme}} กำหนดและจัดสไตล์ "{{name}}" Callout Studio จะไม่แทนที่มัน ดังนั้น Block callout จึงมีรูปลักษณ์ตามที่ธีมของคุณวาดไว้ทุกประการ',
	"themePreview.readOnly":
		"หมายความว่าไม่สามารถเปลี่ยนสี ไอคอน ชื่อ และ ID ได้ที่นี่ หากต้องการออกแบบของคุณเอง ให้สร้าง callout ใหม่ด้วย ID ที่ต่างออกไป",
	"themePreview.blockOnly":
		"รูปแบบ Heading และ Inline ไม่สามารถใช้ได้กับ callout ที่ธีมของคุณกำหนดไว้ Block callout จะใช้สไตล์ดั้งเดิมของธีม",
	"themePreview.previewTitle": "รูปลักษณ์ปัจจุบัน",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> นี่คือลักษณะเนื้อหาของ callout\n",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleClose": "เข้าใจแล้ว",

	// Palette editor modal
	"palette.newTitle": "ชุดสีใหม่",
	"palette.groupPalette": "แผงสี",
	"palette.editTitle": "แก้ไขชุดสี",
	"palette.name": "ชื่อ",
	"palette.namePlaceholder": "ชุดสีของฉัน",
	"palette.nameExists": "มีชุดสีชื่อนี้อยู่แล้ว",
	"palette.baseColor": "สีพื้นฐาน",
	"palette.baseColorHint":
		"เราจะจับคู่สีพื้นหลังให้เข้ากับสีนี้โดยอัตโนมัติ หากต้องการ คุณสามารถควบคุมแยกต่างหากได้โดย{{link}}",
	"palette.baseColorHintLink": "คลิกที่นี่",
	"palette.advancedColors": "สี",
	"palette.advancedColorsHint":
		"กำลังแก้ไขสีสำหรับโหมด {{mode}} - อีกโหมดจะอัปเดตโดยอัตโนมัติ สลับธีมของ Obsidian เพื่อตรวจสอบ",
	"palette.revertHint": "ต้องการใช้สีพื้นฐานเดียวแทนหรือไม่? {{link}}",
	"palette.revertHintLink": "เปลี่ยนกลับ",
	"palette.lightMode": "สว่าง",
	"palette.darkMode": "มืด",
	"palette.accentColor": "สีเน้น",
	"palette.backgroundColorChannel": "สีพื้นหลัง",
	"palette.textColorChannel": "สีข้อความ",
	"palette.bgIntensity": "ความเข้ม",
	"palette.bgStyle": "รูปแบบ",
	"palette.bgSolid": "สีพื้น",
	"palette.bgGradient": "ไล่ระดับสี",
	"palette.bgTransparent": "โปร่งใส",
	"palette.gradientTo": "สีที่สอง",
	"palette.gradientDirection": "ทิศทาง",
	"palette.gradientText": "ข้อความหัวเรื่องแบบไล่ระดับสี",
	"palette.save": "บันทึก",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "แดง",
	"colorName.orange": "ส้ม",
	"colorName.amber": "อำพัน",
	"colorName.yellow": "เหลือง",
	"colorName.lime": "เขียวมะนาว",
	"colorName.green": "เขียว",
	"colorName.teal": "เขียวอมฟ้า",
	"colorName.cyan": "ฟ้าอมเขียว",
	"colorName.sky": "ฟ้า",
	"colorName.blue": "น้ำเงิน",
	"colorName.indigo": "คราม",
	"colorName.violet": "ม่วงน้ำเงิน",
	"colorName.purple": "ม่วง",
	"colorName.pink": "ชมพู",
	"colorName.rose": "กุหลาบ",
	"colorName.brown": "น้ำตาล",
	"colorName.gray": "เทา",
	"colorName.black": "ดำ",
	"colorName.white": "ขาว",
	"colorName.crimson": "สีแดงเข้ม",
	"colorName.coral": "สีปะการัง",
	"colorName.grape": "สีองุ่น",
	"colorName.plum": "สีพลัม",
	"colorName.bubblegum": "หมากฝรั่ง",

	"iconPicker.pickIcon": "เลือกไอคอน",
	"iconPicker.confirm": "ยืนยัน",
	"iconPicker.cancel": "ยกเลิก",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "ค้นหาไอคอน Lucide",
	"iconPicker.searchTabler": "ค้นหาไอคอน Tabler",
	"iconPicker.tablerStyle": "สไตล์ไอคอน",
	"iconPicker.tablerStyleOutline": "เส้นขอบ",
	"iconPicker.tablerStyleFilled": "เต็ม",
	"iconPicker.loadMore": "โหลดเพิ่มเติม",
	"iconPicker.materialStyle": "สไตล์ไอคอน",
	"iconPicker.materialStyleOutlined": "เส้นขอบ (Outlined)",
	"iconPicker.materialStyleFilled": "เต็ม (Filled)",
	"iconPicker.materialStyleRounded": "โค้งมน (Rounded)",
	"iconPicker.materialStyleSharp": "คม (Sharp)",
	"iconPicker.materialWeight": "น้ำหนักไอคอน",
	"iconPicker.materialWeight100": "บาง (Thin)",
	"iconPicker.materialWeight200": "บางพิเศษ (Extra Light)",
	"iconPicker.materialWeight300": "เบา (Light)",
	"iconPicker.materialWeight400": "ปกติ (Regular)",
	"iconPicker.materialWeight500": "ปานกลาง (Medium)",
	"iconPicker.materialWeight600": "ค่อนข้างหนา (Semi Bold)",
	"iconPicker.materialWeight700": "หนา (Bold)",
	"iconPicker.materialFontFailed":
		"ไม่สามารถโหลดตัวอย่างไอคอน Material ได้ จะแสดงชื่อไอคอนแทน — การค้นหาและการเลือกยังใช้งานได้ตามปกติ",
	"iconPicker.materialFontRetry": "ลองอีกครั้ง",
	"iconPicker.searchMaterial": "ค้นหาไอคอน Material",
	"iconPicker.searchEmoji": "ค้นหาอีโมจิ",
	"iconPicker.skinTone": "โทนสีผิว",
	"iconPicker.allCategories": "ทุกหมวดหมู่",
	"iconPicker.noIconSelected": "ไม่ได้เลือกไอคอน",
	"iconPicker.noResults": "ไม่มีไอคอนที่ตรงกับการค้นหาของคุณ",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "ค้นหา Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "ค้นหา Font Awesome",
	"iconPicker.faStyle": "สไตล์ไอคอน",
	"iconPicker.faStyleSolid": "ทึบ",
	"iconPicker.faStyleRegular": "ปกติ",
	"iconPicker.faStyleBrands": "แบรนด์",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "ค้นหา RPG Awesome",
	"iconPicker.image": "รูปภาพของคุณ",
	"iconPicker.searchImage": "ค้นหารูปภาพของคุณ",
	"iconPicker.imageTooLarge":
		"{{name}} มีขนาดใหญ่เกินไป รูปภาพต้องมีขนาดน้อยกว่า 5 MB",
	"iconPicker.imageUnsupported":
		"{{name}} ไม่ใช่รูปแบบรูปภาพที่รองรับ ใช้ SVG, PNG, JPEG หรือ WebP",
	"iconPicker.imageInvalidSvg":
		"ไม่สามารถอ่าน {{name}} เป็น SVG ที่ปลอดภัยได้จึงไม่ได้เพิ่ม",
	"iconPicker.imageDecodeFailed": "ไม่สามารถอ่าน {{name}} เป็นรูปภาพได้",
	"iconPicker.imageDuplicate":
		"{{name}} มีอยู่ในรูปภาพของคุณแล้ว เปลี่ยนชื่อไฟล์หรือลบรูปภาพที่มีอยู่",
	"iconPicker.imageAdd": "เพิ่มรูปภาพ",
	"iconPicker.imageEmpty":
		"ยังไม่มีรูปภาพ เพิ่มไฟล์ SVG, PNG, JPEG หรือ WebP จากคอมพิวเตอร์ของคุณ หรือลากมาที่นี่",
	"iconPicker.imageDelete": "ลบ",
	"iconPicker.imageDeleteConfirm": "ลบ “{{name}}” หรือไม่?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout ใช้รูปภาพนี้ จะแสดงไอคอนตัวแทนจนกว่าคุณจะกำหนดใหม่",
	"iconPicker.imageRecolor": "ตามสี Callout",
	"iconPicker.allSources": "ทุกแหล่งข้อมูล",
	"iconPicker.searchAllSources": "ค้นหาในทุกแหล่งไอคอน",
	"iconPicker.sourcesNotDownloaded":
		"ยังไม่ได้รวม: {{names}} เลือกแหล่งข้อมูลด้านบนเพื่อดาวน์โหลด",
	"iconPicker.chooseSource": "เลือกแหล่งข้อมูล",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "ค้นหาทุกไลบรารีพร้อมกัน",
	"iconPicker.descLucide": "ชุดของ Obsidian เอง ออฟไลน์เสมอ",
	"iconPicker.descTabler": "ไอคอน UI ที่สะอาดและสม่ำเสมอ, เส้นขอบและเต็ม",
	"iconPicker.descMaterial": "ชุดของ Google สี่สไตล์และเจ็ดน้ำหนัก",
	"iconPicker.descEmoji": "กลิฟสี ทุกโทนผิว",
	"iconPicker.descOcticons": "ไอคอนอินเทอร์เฟซ GitHub",
	"iconPicker.descFa": "ทึบ ปกติ และแบรนด์",
	"iconPicker.descRpgAwesome": "ไอคอนแฟนตาซีและเกมกระดาน",
	"iconPicker.descImage": "รูปภาพที่คุณเพิ่มจากคอมพิวเตอร์",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "การช่วยเหลือพิเศษ",
	"iconPicker.cat.Actions": "การกระทำ",
	"iconPicker.cat.Activities": "กิจกรรม",
	"iconPicker.cat.Alert": "การแจ้งเตือน",
	"iconPicker.cat.Alphabet": "ตัวอักษร",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "สัตว์",
	"iconPicker.cat.Arrows": "ลูกศร",
	"iconPicker.cat.Astronomy": "ดาราศาสตร์",
	"iconPicker.cat.Audio&Video": "เสียงและวิดีโอ",
	"iconPicker.cat.Automotive": "ยานยนต์",
	"iconPicker.cat.Badges": "เหรียญตรา",
	"iconPicker.cat.Brand": "แบรนด์",
	"iconPicker.cat.Buildings": "อาคาร",
	"iconPicker.cat.Business": "ธุรกิจ",
	"iconPicker.cat.Camping": "แคมป์ปิ้ง",
	"iconPicker.cat.Charity": "การกุศล",
	"iconPicker.cat.Charts": "แผนภูมิ",
	"iconPicker.cat.Charts + Diagrams": "แผนภูมิและไดอะแกรม",
	"iconPicker.cat.Childhood": "วัยเด็ก",
	"iconPicker.cat.Clothing + Fashion": "เสื้อผ้าและแฟชั่น",
	"iconPicker.cat.Coding": "การเขียนโค้ด",
	"iconPicker.cat.Communicate": "สื่อสาร",
	"iconPicker.cat.Communication": "การสื่อสาร",
	"iconPicker.cat.Computers": "คอมพิวเตอร์",
	"iconPicker.cat.Connectivity": "การเชื่อมต่อ",
	"iconPicker.cat.Construction": "การก่อสร้าง",
	"iconPicker.cat.Currencies": "สกุลเงิน",
	"iconPicker.cat.Database": "ฐานข้อมูล",
	"iconPicker.cat.Design": "การออกแบบ",
	"iconPicker.cat.Development": "การพัฒนา",
	"iconPicker.cat.Devices": "อุปกรณ์",
	"iconPicker.cat.Devices + Hardware": "อุปกรณ์และฮาร์ดแวร์",
	"iconPicker.cat.Disaster + Crisis": "ภัยพิบัติและวิกฤต",
	"iconPicker.cat.Document": "เอกสาร",
	"iconPicker.cat.E-commerce": "อีคอมเมิร์ซ",
	"iconPicker.cat.Editing": "การแก้ไข",
	"iconPicker.cat.Education": "การศึกษา",
	"iconPicker.cat.Electrical": "ไฟฟ้า",
	"iconPicker.cat.Emoji": "อีโมจิ",
	"iconPicker.cat.Energy": "พลังงาน",
	"iconPicker.cat.Extensions": "ส่วนขยาย",
	"iconPicker.cat.Files": "ไฟล์",
	"iconPicker.cat.Film + Video": "ภาพยนตร์และวิดีโอ",
	"iconPicker.cat.Food": "อาหาร",
	"iconPicker.cat.Food + Beverage": "อาหารและเครื่องดื่ม",
	"iconPicker.cat.Fruits + Vegetables": "ผลไม้และผัก",
	"iconPicker.cat.Games": "เกม",
	"iconPicker.cat.Gaming": "การเล่นเกม",
	"iconPicker.cat.Gender": "เพศ",
	"iconPicker.cat.Genders": "เพศ",
	"iconPicker.cat.Gestures": "ท่าทาง",
	"iconPicker.cat.Halloween": "ฮาโลวีน",
	"iconPicker.cat.Hands": "มือ",
	"iconPicker.cat.Hardware": "ฮาร์ดแวร์",
	"iconPicker.cat.Health": "สุขภาพ",
	"iconPicker.cat.Holidays": "วันหยุด",
	"iconPicker.cat.Home": "บ้าน",
	"iconPicker.cat.Household": "ของใช้ในบ้าน",
	"iconPicker.cat.Humanitarian": "มนุษยธรรม",
	"iconPicker.cat.Images": "รูปภาพ",
	"iconPicker.cat.Laundry": "การซักผ้า",
	"iconPicker.cat.Letters": "ตัวอักษร",
	"iconPicker.cat.Logic": "ตรรกะ",
	"iconPicker.cat.Logistics": "โลจิสติกส์",
	"iconPicker.cat.Map": "แผนที่",
	"iconPicker.cat.Maps": "แผนที่",
	"iconPicker.cat.Maritime": "ทางทะเล",
	"iconPicker.cat.Marketing": "การตลาด",
	"iconPicker.cat.Math": "คณิตศาสตร์",
	"iconPicker.cat.Mathematics": "คณิตศาสตร์",
	"iconPicker.cat.Media": "สื่อ",
	"iconPicker.cat.Media Playback": "การเล่นสื่อ",
	"iconPicker.cat.Medical + Health": "การแพทย์และสุขภาพ",
	"iconPicker.cat.Money": "เงิน",
	"iconPicker.cat.Mood": "อารมณ์",
	"iconPicker.cat.Moving": "การย้ายบ้าน",
	"iconPicker.cat.Music + Audio": "เพลงและเสียง",
	"iconPicker.cat.Nature": "ธรรมชาติ",
	"iconPicker.cat.Numbers": "ตัวเลข",
	"iconPicker.cat.Photography": "การถ่ายภาพ",
	"iconPicker.cat.Photos + Images": "รูปถ่ายและรูปภาพ",
	"iconPicker.cat.Political": "การเมือง",
	"iconPicker.cat.Privacy": "ความเป็นส่วนตัว",
	"iconPicker.cat.Punctuation + Symbols": "เครื่องหมายวรรคตอนและสัญลักษณ์",
	"iconPicker.cat.Religion": "ศาสนา",
	"iconPicker.cat.Science": "วิทยาศาสตร์",
	"iconPicker.cat.Science Fiction": "นิยายวิทยาศาสตร์",
	"iconPicker.cat.Security": "ความปลอดภัย",
	"iconPicker.cat.Shapes": "รูปทรง",
	"iconPicker.cat.Shopping": "การช้อปปิ้ง",
	"iconPicker.cat.Social": "โซเชียลมีเดีย",
	"iconPicker.cat.Spinners": "ไอคอนหมุน",
	"iconPicker.cat.Sport": "กีฬา",
	"iconPicker.cat.Sports + Fitness": "กีฬาและฟิตเนส",
	"iconPicker.cat.Symbols": "สัญลักษณ์",
	"iconPicker.cat.System": "ระบบ",
	"iconPicker.cat.Text": "ข้อความ",
	"iconPicker.cat.Text Formatting": "การจัดรูปแบบข้อความ",
	"iconPicker.cat.Time": "เวลา",
	"iconPicker.cat.Toggle": "สลับ",
	"iconPicker.cat.Transit": "การขนส่งสาธารณะ",
	"iconPicker.cat.Transportation": "การคมนาคม",
	"iconPicker.cat.Travel": "การเดินทาง",
	"iconPicker.cat.Travel + Hotel": "การเดินทางและโรงแรม",
	"iconPicker.cat.UI actions": "การกระทำ UI",
	"iconPicker.cat.Users + People": "ผู้ใช้และผู้คน",
	"iconPicker.cat.Vehicles": "ยานพาหนะ",
	"iconPicker.cat.Version control": "การควบคุมเวอร์ชัน",
	"iconPicker.cat.Weather": "สภาพอากาศ",
	"iconPicker.cat.Writing": "การเขียน",
	"iconPicker.cat.Zodiac": "ราศี",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} ยังไม่ได้ดาวน์โหลด",
	"iconPack.downloadDetail":
		"{{count}} ไอคอน · {{size}} · ดาวน์โหลดครั้งเดียว",
	"iconPack.download": "ดาวน์โหลด",
	"iconPack.downloading": "กำลังดาวน์โหลด {{name}}…",
	"iconPack.downloadFailed":
		"ไม่สามารถดาวน์โหลด {{name}} ได้ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
	"iconPack.retry": "ลองอีกครั้ง",
	"iconPack.faBrandsNotice":
		"ไอคอนแบรนด์เป็นเครื่องหมายการค้าของเจ้าของแต่ละราย การรวมไว้ไม่ได้หมายความว่าได้รับการรับรอง โปรดใช้เฉพาะเพื่อแทนบริษัท ผลิตภัณฑ์ หรือบริการที่อ้างถึง",
	"iconPack.artworkRestored": "ดาวน์โหลดงานศิลป์ไอคอนสำหรับ {{names}} แล้ว",
	"iconPack.diskWriteFailed":
		"Callout Studio ไม่สามารถบันทึกชุดไอคอนลงดิสก์ได้ จึงต้องดาวน์โหลดใหม่ในครั้งถัดไป ไอคอนที่คุณเลือกยังคงบันทึกไว้ในการตั้งค่า",

	// Icon licences & credits
	"credits.title": "ใบอนุญาตไอคอนและเครดิต",
	"credits.intro":
		"Callout Studio ใช้ไลบรารีไอคอนแบบเปิดหลายแห่ง ใบอนุญาตของไลบรารีเหล่านั้นจะปรากฏด้านล่าง พร้อมกับสิ่งที่เปลี่ยนแปลงเพื่อใช้งานที่นี่",
	"credits.fullNotices": "ประกาศบุคคลที่สามฉบับเต็ม",
	"credits.pluginLicense":
		"โค้ดของ Callout Studio เองอยู่ภายใต้สัญญาอนุญาต permissive ไลบรารีไอคอนยังคงใบอนุญาตของตนเอง",

	"contextMenu.editCallout": "แก้ไขการตั้งค่า callout",
	"contextMenu.copyMarkdown": "คัดลอก Markdown callout",
	"contextMenu.openSettings": "เปิดการตั้งค่า Callout Studio",
	"contextMenu.setFoldClosed": "ตั้งค่า callout เป็นปิด (-)",
	"contextMenu.setFoldOpen": "ตั้งค่า callout เป็นเปิด (+)",
	"contextMenu.setFoldNone": "ทำให้ callout พับไม่ได้",
	"contextMenu.cutSection": "ตัดส่วนหัวข้อ",
	"contextMenu.copySection": "คัดลอกส่วนหัวข้อ",
	"contextMenu.deleteSection": "ลบส่วนหัวข้อ",

	"heading.toggleFold": "สลับการพับ",

	"settings.globalSettings": "ตัวเลือกสไตล์ส่วนกลางของ Callout Studio",
	"settings.globalSettingsScope":
		"นี่คือการตั้งค่าส่วนกลาง โดยแต่ละรายการจะเปลี่ยนรูปร่าง ระยะห่าง และขนาดของทุก callout ที่ Callout Studio จัดสไตล์ให้พร้อมกัน ส่วน callout ที่ธีมของคุณจัดสไตล์จะคงการออกแบบของธีมไว้",
	"settings.globalSettingsRegularDesc":
		"ปรับขอบ ความโค้งมุม ขนาดตัวอักษร และการจัดแนวของทุก block callout ใน vault ของคุณ",
	"settings.globalSettingsHeadingDesc":
		"ปรับขอบ รูปร่าง และระยะห่างแนวตั้งของทุก callout หัวข้อ ใน vault ของคุณ",
	"settings.globalSettingsInlineDesc":
		"ปรับขอบและรูปร่างของทุก callout อินไลน์ ใน vault ของคุณ",
	"settings.globalSettingsCustomize": "ปรับแต่ง",

	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Callout หัวข้อ",
	"settings.calloutTypeInline": "Callout อินไลน์",

	"settings.customizeMenu": "ปรับแต่งรายการเมนู",
	"settings.customizeMenuDesc":
		"เลือกว่าการดำเนินการคลิกขวาใดจะปรากฏสำหรับแต่ละประเภท callout และจัดลำดับใหม่ ใช้งานได้ในโหมดต้นฉบับ และ Live Preview",
	"settings.customizeMenuButton": "ปรับแต่งรายการเมนู",
	"menuCustomize.title": "ปรับแต่งเมนูคลิกขวา",
	"menuCustomize.desc":
		"เปิดหรือปิดการดำเนินการและลากที่จับเพื่อจัดลำดับใหม่ การเปลี่ยนแปลงจะถูกบันทึกโดยอัตโนมัติ",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Callout หัวข้อ",
	"menuCustomize.inline": "Callout อินไลน์",
	"menuCustomize.dragHandle": "ลากเพื่อจัดลำดับใหม่",
	"menuItem.edit": "แก้ไข callout",
	"menuItem.openSettings": "เปิดการตั้งค่า",
	"menuItem.copyMarkdown": "คัดลอก Markdown",
	"menuItem.foldDefaults": "ค่าเริ่มต้นการพับ (เปิด / ปิด / ไม่มี)",
	"menuItem.cutSection": "ตัดส่วน",
	"menuItem.copySection": "คัดลอกส่วน",
	"menuItem.deleteSection": "ลบส่วน",

	"confirm.ok": "ลบ",
	"confirm.cancel": "ยกเลิก",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "ลบคำสั่ง",
	"confirm.titleResetAll": "รีเซ็ต callout ทั้งหมด",
	"confirm.titleResetCallout": "รีเซ็ต callout",
	"confirm.titleDeletePalette": "ลบชุดสี",
	"confirm.titleDeleteImage": "ลบรูปภาพ",

	"vault.filesUpdated":
		"อัปเดต {{count}} การอ้างอิง callout ในไฟล์ vault แล้ว",
	"vault.idsUpdated":
		"อัปเดต {{count}} ID callout ในไฟล์ vault แล้ว: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"อัปเดต {{count}} หัวเรื่อง callout ในไฟล์ vault แล้ว: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "แทนที่ด้วย:",
	"vault.deleteWithout": "ลบโดยไม่แทนที่",
	"vault.confirmDelete": "ยืนยัน",
	"vault.confirmReplace": "แทนที่",
	"vault.replacePromptInUse":
		'"{{name}}" ถูกใช้งาน {{count}} ครั้งใน {{files}} ไฟล์ เลือก callout เพื่อแทนที่:',
	"vault.replacePromptUnused": 'เลือก callout เพื่อแทนที่ "{{name}}":',
	"vault.noReplacementAvailable":
		"ไม่มี callout อื่นที่พร้อมใช้งานเพื่อแทนที่",
	"vault.convertedToPlainText":
		"แปลง {{blocks}} บล็อก callout ใน {{files}} ไฟล์เป็นข้อความธรรมดาแล้ว",
	"vault.resetAliasWarning":
		"{{count}} การอ้างอิงใน {{files}} ไฟล์ใช้นามแฝงแบบกำหนดเอง: {{aliases}} นามแฝงเหล่านี้จะหยุดทำงานหลังจากรีเซ็ต ดำเนินการต่อหรือไม่?",
	"vault.resetConfirm": "รีเซ็ต",
	"vault.resetAllInUse":
		"⚠ {{count}} การอ้างอิง callout ใน {{files}} ไฟล์ใช้ประเภท callout แบบกำหนดเองที่จะถูกลบ",

	"quickInsert.title": "แทรก callout แบบบล็อกอย่างรวดเร็ว",
	"quickInsert.desc": "เลือก callout เพื่อแทรกที่ตำแหน่งเคอร์เซอร์ เฉพาะ callout แบบบล็อกเท่านั้น",
	"quickInsert.searchPlaceholder": "ค้นหา callout",
	"quickInsert.sourceAria": "กรองตามแหล่งที่มาของ callout",
	"quickInsert.sourceAll": "ทั้งหมด",
	"quickInsert.sourceBuiltIn": "ในตัว",
	"quickInsert.sourceUser": "callout ของฉัน",
	"quickInsert.editAria": "แก้ไข {{name}}",
	"quickInsert.insertAria": "แทรก {{name}} เป็น callout แบบบล็อก",
	"quickInsert.noResults": "ไม่พบ callout",
	"quickInsert.noUserCallouts": "คุณยังไม่ได้สร้าง callout ใดๆ",
	"quickInsert.noEditorHint": "ไม่มีบันทึกที่เปิดอยู่ในโหมดแก้ไข จึงไม่สามารถแทรกอะไรได้",
	"quickInsert.noEditor": "เปิดบันทึกในโหมดแก้ไขเพื่อแทรก callout",

	"vaultStats.title": "สถิติ callout",
	"vaultStats.totalCallouts": "callout ทั้งหมด",
	"vaultStats.typesFound": "ประเภทที่พบ",
	"vaultStats.filesWithCallouts": "ไฟล์ที่มี callout",
	"vaultStats.filesScanned": "ไฟล์ Markdown ที่สแกน",
	"vaultStats.empty": "ไม่พบ callout ในโน้ต Markdown",
	"vaultStats.columnType": "ประเภท",
	"vaultStats.columnName": "ชื่อ",
	"vaultStats.columnSource": "แหล่งที่มา",
	"vaultStats.columnCount": "จำนวน",
	"vaultStats.columnFiles": "ไฟล์",
	"vaultStats.unknown": "ไม่รู้จัก",
	"vaultStats.sourceBuiltIn": "ในตัว",
	"vaultStats.sourceCustom": "กำหนดเอง",
	"vaultStats.sourceAutoFallback": "สำรองอัตโนมัติ",
	"vaultStats.sourceTheme": "CSS snippet",
	"vaultStats.sourceAlias": "นามแฝงของ {{id}}",
	"vaultStats.sourceUnknown": "ไม่รู้จัก",
	"vaultStats.byRole": "เขียนเป็น",
	"vaultStats.roleBlock": "บล็อก",
	"vaultStats.roleHeading": "หัวเรื่อง",
	"vaultStats.roleInline": "อินไลน์",
	"vaultStats.defineUndefined": "กำหนด {{count}} รายการที่ขาดหายไป",
	"vaultStats.defineRunning": "กำลังสแกน",
	"vaultStats.defineDone": "เพิ่มประเภท callout แล้ว {{count}} รายการ",
	"vaultStats.close": "ปิด",

	"import.title": "ปัญหาการนำเข้า",
	"import.reportLeadIn": "ดูเหมือนไฟล์ที่นำเข้าถูกแก้ไข นี่คือรายการปัญหา:",
	"import.reportLeadInFatal":
		"ไฟล์นี้ดูไม่เหมือนการส่งออกของ Callout Studio ไม่สามารถนำเข้าได้:",
	"import.entryHeading": "รายการ {{index}} — {{label}}",
	"import.summary":
		"{{valid}} จาก {{total}} รายการถูกต้อง · พบ {{issues}} ปัญหา",
	"import.btnCancel": "ยกเลิก",
	"import.btnImportValid": "นำเข้าเฉพาะที่ถูกต้อง ({{count}})",
	"import.err.notRecognized":
		"ไฟล์ที่ไม่รู้จัก: คาดว่าเป็น array ของนิยาม callout หรือไฟล์ส่งออกของ Callout Studio",
	"import.warn.settingsIgnored":
		"บล็อกการตั้งค่าไม่ใช่ object ที่ถูกต้องและถูกละเว้น",
	"import.warn.invalidGradient":
		"การไล่ระดับสีพื้นหลังไม่ถูกต้องและถูกละเว้น",
	"import.err.parseFailed":
		"ไฟล์ไม่ใช่ JSON ที่ถูกต้องและไม่สามารถแยกวิเคราะห์ได้",
	"import.err.entryNotObject": "รายการต้องเป็น object",
	"import.err.requiredMissing":
		'ฟิลด์ที่จำเป็น "{{field}}" หายไปหรือมีประเภทที่ไม่ถูกต้อง',
	"import.err.idEmpty": "ID ต้องไม่ว่างเปล่า",
	"import.err.idTooLong":
		'ID "{{value}}" มี {{length}} อักขระ สูงสุด {{max}}',
	"import.err.idBadChar":
		'ID "{{value}}" มีอักขระที่ไม่ถูกต้อง (ไม่อนุญาตให้ใช้ "|" "[" "]" แท็บ และการขึ้นบรรทัดใหม่)',
	"import.err.idMetadata":
		'ID "{{value}}" มี "|" อยู่ด้วย ใน Obsidian ทุกอย่างหลัง "|" แรกคือ metadata ของ callout ไม่ใช่ส่วนหนึ่งของประเภท ดังนั้น entry นี้อธิบาย callout "{{id}}" ถูกข้ามไป เพื่อให้ "{{id}}" ที่มีอยู่ของคุณไม่ถูกเปลี่ยนแปลง',
	"import.err.idReserved":
		'ID "{{value}}" ถูกสงวนไว้โดย Callout Studio สำหรับการแสดงตัวอย่างของตัวเอง และไม่สามารถนำเข้าได้',
	"import.err.displayNameEmpty": "ชื่อที่แสดงต้องไม่ว่างเปล่า",
	"import.err.displayNameTooLong":
		"ชื่อที่แสดงมี {{length}} อักขระ สูงสุด {{max}}",
	"import.err.boolField": '"{{field}}" ต้องเป็น boolean (true หรือ false)',
	"import.err.iconNotObject": "ไอคอนต้องเป็น object",
	"import.err.iconTypeInvalid":
		'ประเภทไอคอน "{{value}}" ต้องเป็นหนึ่งใน: {{types}}',
	"import.warn.iconFieldIgnored":
		'"{{field}}" ใช้เฉพาะกับไอคอน Material เท่านั้น และถูกละเว้นสำหรับประเภทไอคอน {{type}}',
	"import.err.iconValueEmpty": "ค่าไอคอนต้องเป็น string ที่ไม่ว่างเปล่า",
	"import.err.iconValueTooLong": "ค่าไอคอนยาวผิดปกติ ({{length}} อักขระ)",
	"import.err.materialStyle":
		'สไตล์ไอคอน Material "{{value}}" ต้องเป็นหนึ่งใน: outlined, filled, rounded, sharp',
	"import.err.materialWeight":
		'น้ำหนักไอคอน Material "{{value}}" ต้องเป็นจำนวนเต็มระหว่าง 100 ถึง 700 ด้วยขั้นตอน 100',
	"import.warn.iconRecolorIgnored":
		'"recolor" ใช้เฉพาะกับรูปภาพของคุณเองเท่านั้น และถูกละเว้นสำหรับประเภทไอคอน {{type}}',
	"import.err.iconRecolorInvalid":
		'"recolor" ต้องเป็น true หรือ false (ได้รับ: "{{value}}")',
	"import.err.colorInvalid":
		'"{{field}}" ต้องเป็นสี hex เช่น "#448aff" (ได้รับ "{{value}}")',
	"import.err.numberRange":
		'"{{field}}" ต้องเป็นตัวเลขระหว่าง {{min}} ถึง {{max}} (ได้รับ "{{value}}")',
	"import.err.iconSizeRange":
		'"{{field}}" ต้องเป็นตัวเลขระหว่าง {{min}} ถึง {{max}} (ได้รับ "{{value}}")',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" ต้องเป็น array ของ string',
	"import.err.aliasNotString": "นามแฝงต้องเป็น string",
	"import.err.aliasDup": 'นามแฝง "{{value}}" ซ้ำกันในรายการนี้',
	"import.err.tooManyIds":
		"มี ID มากเกินไป ({{count}}) แต่ละ callout มีได้สูงสุด {{max}} ID (หลัก + นามแฝง)",
	"import.err.metadataShape":
		'"metadata" ต้องเป็น object ที่ค่าทั้งหมดเป็น string',
	"import.warn.unknownFields": "ละเว้นฟิลด์ที่ไม่รู้จัก: {{fields}}",
	"import.err.duplicateInFile":
		'ID/นามแฝง "{{value}}" ถูกใช้โดยรายการ #{{first}} ในไฟล์นี้แล้ว',
	"import.err.aliasConflict":
		'นามแฝง "{{value}}" ถูกใช้โดย callout อื่น ("{{other}}") ใน vault ของคุณแล้ว',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" เป็น true ในขณะที่ "foldable" เป็น false; defaultFolded ถูกรีเซ็ตเป็น false แล้ว',
	"import.warn.imageMissing":
		"Callout นี้ใช้รูปภาพที่ไม่มีในไฟล์และไม่มีใน vault นี้ จึงจะแสดงไอคอนตัวแทนจนกว่าคุณจะกำหนดใหม่",

	"import.err.paletteIdInvalid":
		'"paletteId" ต้องเป็น ID ข้อความที่ไม่ว่างเปล่า (ได้รับ "{{value}}")',
	"import.warn.iconNameUnknown":
		'ไม่มีไอคอน "{{value}}" ใน {{type}} จึงใช้ไอคอนเริ่มต้นแทน',
	"import.warn.cmIconUnknownNew":
		'ไอคอน "{{value}}" ไม่พร้อมใช้งานในโวลต์นี้ จึงใช้ไอคอนเริ่มต้นแทน',
	"import.warn.cmIconUnknownExisting":
		'ไอคอน "{{value}}" ไม่พร้อมใช้งานในโวลต์นี้ ดังนั้น "{{id}}" จึงยังคงใช้ไอคอนเดิม',
	"import.chooseSource": "นำเข้าจาก",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc": "โหลดไฟล์ .json ที่ส่งออกจาก Callout Studio",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"วางสไตล์ที่คุณคัดลอกจากปุ่ม Copy ของ Callout Manager",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"นำ admonition ที่คุณกำหนดเองมาจากปลั๊กอิน Admonition",
	"import.cmTitle": "นำเข้าจาก Callout Manager",
	"import.cmFromVault": "ห้องนิรภัยนี้",
	"import.cmVaultChecking": "กำลังค้นหาปลั๊กอิน Callout Manager…",
	"import.cmVaultFound": "พบ callout ที่กำหนดเอง {{count}} รายการ",
	"import.cmVaultNotFound": "ไม่พบ callout ที่กำหนดเองในห้องนิรภัยนี้",
	"import.cmPasteLabel": "หรือวางสไตล์ที่คัดลอกจาก Callout Manager ที่นี่:",
	"import.cmInstructions":
		"ใน Callout Manager ให้ใช้ปุ่ม Copy เพื่อคัดลอกสไตล์ callout ที่กำหนดเอง จากนั้นวางด้านล่าง",
	"import.cmPlaceholder": "วางสไตล์ที่คัดลอกไว้ที่นี่…",
	"import.cmBtnCancel": "ยกเลิก",
	"import.cmBtnImport": "นำเข้า",
	"import.err.cmNotRecognized":
		"ไม่รู้จักไฟล์นี้: ต้องเป็นสไตล์ที่สร้างจากปุ่ม Copy ของ Callout Manager หรือไฟล์ data.json ของ Callout Manager",
	"import.err.cmNoEntries": "ไม่พบ callout ที่กำหนดเองเพื่อนำเข้า",
	"import.err.cmNoBlocksFound": "ไม่พบสไตล์ Callout Manager ในข้อความที่วาง",
	"import.err.cmNoColorForNew":
		'ไม่พบสีที่ใช้งานได้สำหรับ callout ใหม่ "{{value}}" จึงถูกข้ามไป',
	"import.warn.cmNoColorDefault":
		"ไม่ได้ตั้งค่าสีไว้ใน Callout Manager จึงใช้สีเทาเริ่มต้น",
	"import.warn.cmThemeCondition":
		"สีหรือไอคอนของ callout นี้ตั้งไว้สำหรับธีมเดียวเท่านั้น Callout Studio ไม่รองรับสไตล์แยกตามธีม จึงนำมาใช้กับทุกธีม",
	"import.warn.cmCustomStyles":
		"callout นี้มี CSS แบบกำหนดเองใน Callout Manager ด้วย สไตล์ดังกล่าวไม่รวมอยู่ในการนำเข้า จึงนำมาเฉพาะไอคอนและสี",
	"import.err.cmIdConflict":
		'ID "{{value}}" ถูกใช้เป็น alias โดย callout อื่น ("{{other}}") แล้ว จึงถูกข้ามไป',

	// Import — Admonition
	"import.admTitle": "นำเข้าจาก Admonition",
	"import.admInstructions":
		"admonition แต่ละรายการจะกลายเป็น callout พร้อมชื่อ ไอคอน " +
		"และสีของมัน ส่วนการตั้งค่าที่ Callout Studio ไม่มีเทียบเท่า " +
		"(คำสั่ง ปุ่มคัดลอก ซ่อนหัวเรื่อง) จะไม่ถูกนำเข้า",
	"import.admFromVault": "ห้องนิรภัยนี้",
	"import.admVaultChecking": "กำลังค้นหาปลั๊กอิน Admonition…",
	"import.admVaultFound": "พบ admonition ที่กำหนดเอง {{count}} รายการ",
	"import.admVaultNotFound": "ไม่พบ admonition ที่กำหนดเองในห้องนิรภัยนี้",
	"import.admFromFile": "ไฟล์",
	"import.admFromFileDesc": "ไฟล์ admonitions.json หรือชุดที่แชร์กันมา",
	"import.admChooseFile": "เลือกไฟล์…",
	"import.admPasteLabel": "หรือวาง JSON ที่นี่:",
	"import.admPlaceholder": "วาง admonition ของคุณที่นี่…",
	"import.admBtnCancel": "ยกเลิก",
	"import.admBtnImport": "นำเข้า",
	"import.err.admNotRecognized":
		"ไม่รู้จักไฟล์นี้: ต้องเป็นรายการ admonition หรือไฟล์ data.json " +
		"ของ Admonition",
	"import.err.admNoEntries": "ไม่พบ admonition ที่จะนำเข้า",
	"import.err.admTypeMissing": 'admonition นี้ไม่มี "type" จึงถูกข้ามไป',
	"import.warn.admIconUnknown":
		'ไม่พบไอคอนชื่อ "{{value}}" ในคลังไอคอนใดเลย ' +
		"จึงใช้ไอคอนเริ่มต้นแทน",
	"import.warn.admIconUnknownExisting":
		'ไม่พบไอคอนชื่อ "{{value}}" ในคลังไอคอนใดเลย "{{id}}" ' +
		"จึงยังคงใช้ไอคอนเดิม",
	"import.warn.admImageFailed":
		"อ่านรูปภาพที่อัปโหลดไม่ได้ จึงใช้ไอคอนเริ่มต้นแทน",
	"import.warn.admIconWithCss":
		"admonition นี้จัดรูปแบบด้วยสไนปเป็ต CSS ใน Admonition " +
		"สไตล์นั้นไม่ได้รวมอยู่ในการนำเข้า จึงนำมาเฉพาะชื่อ ไอคอน และสี",
	"import.warn.admNoColor": "ไม่ได้ตั้งค่าสีไว้ จึงใช้สีน้ำเงินเริ่มต้น",
	"import.warn.admTitleTruncated":
		"หัวเรื่องยาว {{length}} อักขระ ถูกย่อเหลือ {{max}}",

	"footer.tagline":
		"มีคำติชม ความคิดเห็น หรือข้อเสนอแนะหรือไม่? ยินดีรับฟัง!",
	"footer.madeBy": "สร้างโดย Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'ลบพาเลต "{{name}}" ใช่ไหม?\nมี 1 callout ใช้งานอยู่ มันจะคงสีเดิมไว้ และคุณสามารถเชื่อมโยงกลับได้ภายหลังจากแถวสีในตัวแก้ไขของมัน',
	"settings.deletePaletteConfirmLinked":
		'ลบพาเลต "{{name}}" ใช่ไหม?\nมี {{count}} callout ใช้งานอยู่ พวกมันจะคงสีเดิมไว้ และคุณสามารถเชื่อมโยงกลับได้ภายหลังจากแถวสีในตัวแก้ไขของแต่ละรายการ',
	"settings.unlinkedColors": "สีที่ยังไม่เชื่อมโยง",
	"settings.unlinkedColorsDesc":
		"Callout ที่สีที่บันทึกไว้ถูกลบไปแล้ว พวกมันยังคงสีเดิมไว้; การกู้คืนจะบันทึกสีนั้นอีกครั้งและเชื่อมโยงทั้งกลุ่มกลับเข้าหากัน",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout",
	"settings.restoreColor": "กู้คืน",
	"settings.palettesMergedNotice":
		"รวมพาเลตที่นำเข้า {{count}} รายการเข้ากับสีที่บันทึกไว้ซึ่งมีสีเดียวกันอยู่แล้ว",
	"notice.palettesMerged":
		"รวมสีที่บันทึกไว้ {{count}} รายการที่มีสีเหมือนกัน: {{names}} callout ที่ใช้สีเหล่านี้จะยังคงสีเดิม และตอนนี้เชื่อมโยงกับสีที่เหลืออยู่แล้ว",
	"editor.colorsDescDeleted":
		"สีที่บันทึกไว้ของ callout นี้ถูกลบแล้ว คุณสามารถบันทึกอีกครั้งได้โดย {{link}}",
	"editor.colorsDescDeletedOther":
		"สีที่บันทึกไว้ของ callout นี้ถูกลบแล้ว คุณสามารถบันทึกอีกครั้งได้โดย {{link}} — และอีก 1 callout ที่ใช้สีนี้จะถูกเชื่อมโยงกลับด้วย",
	"editor.colorsDescDeletedOthers":
		"สีที่บันทึกไว้ของ callout นี้ถูกลบแล้ว คุณสามารถบันทึกอีกครั้งได้โดย {{link}} — และอีก {{count}} callout ที่ใช้สีนี้จะถูกเชื่อมโยงกลับด้วย",
	"editor.colorsDescDeletedLink": "คลิกที่นี่",
	"palette.colorExists":
		'สีเหล่านี้เหมือนกับ "{{name}}" ทุกประการ ไม่สามารถมีสีที่บันทึกไว้สองรายการที่เหมือนกันได้ — เปลี่ยนสีหนึ่งสีเพื่อให้แยกกันได้',
	"palette.colorExistsUse":
		'สีเหล่านี้เหมือนกับ "{{name}}" ทุกประการ ไม่สามารถมีสีที่บันทึกไว้สองรายการที่เหมือนกันได้ — เปลี่ยนสีหนึ่งสี หรือ {{link}}',
	"palette.colorExistsUseLink": "ใช้สีที่มีอยู่",
	"locale.downloading": "กำลังดาวน์โหลดคำแปล…",
	"locale.notDownloaded": "ยังไม่ได้ดาวน์โหลด {{name}}",
	"locale.notDownloadedDesc":
		"Callout Studio กำลังแสดงภาษาอังกฤษจนกว่าจะดาวน์โหลดคำแปลได้ และจะลองอีกครั้งเมื่อ Obsidian เริ่มทำงานครั้งถัดไป",
	"locale.retry": "ลองอีกครั้ง",
	"locale.diskWriteFailed":
		"Callout Studio ไม่สามารถบันทึกคำแปลลงดิสก์ได้ จึงต้องดาวน์โหลดใหม่ในครั้งถัดไป",
	"notice.exportedCssCreated": "บันทึก CSS snippet ไว้ที่ {{path}} แล้ว",
	"notice.exportedCssUpdated": "อัปเดต CSS snippet ที่ {{path}} แล้ว",
	"notice.exportedCssUnchanged": "CSS snippet เป็นข้อมูลล่าสุดอยู่แล้ว",
	"notice.exportCssEmpty": "ไม่มี callout แบบกำหนดเองให้ส่งออก",
	"notice.exportCssFailed":
		"ไม่สามารถบันทึก CSS snippet ได้ ดูรายละเอียดในคอนโซลนักพัฒนา",
	"notice.exportCssEnabled":
		"เปิดใช้ snippet นี้ใน vault นี้อยู่ Callout Studio จัดรูปแบบ callout เหล่านี้อยู่แล้ว และ snippet จะคงรูปแบบ ณ เวลาที่ส่งออก",
	"confirm.titleOverwriteSnippet": "เขียนทับ CSS snippet",
	"confirm.overwriteSnippet":
		"CSS snippet ในโฟลเดอร์ snippets เปลี่ยนไปตั้งแต่ Callout Studio เขียนไว้ การส่งออกอีกครั้งจะแทนที่ทั้งไฟล์",
	"confirm.overwriteSnippetOk": "เขียนทับ",
	"export.chooseFormat": "ส่งออกเป็น",
	"export.formatJson": "ข้อมูลสำรอง Callout Studio",
	"export.formatJsonDesc":
		"ไฟล์ .json ที่มี callout และการตั้งค่าของคุณสำหรับนำเข้าใน vault อื่น",
	"export.formatCss": "CSS snippet",
	"export.formatCssDesc":
		"ไฟล์ .css ที่บันทึกในโฟลเดอร์ snippets ของ vault นี้ เพื่อใช้ในที่ที่ไม่ได้ติดตั้ง Callout Studio ครอบคลุมเฉพาะ callout ปกติและเป็นภาพ snapshot; ส่งออกอีกครั้งหลังเปลี่ยนแปลง callout",
	"quickInsert.readingViewHint": "บันทึกนี้เปิดอยู่ในโหมดอ่าน จึงไม่สามารถแทรกอะไรได้",
	"quickInsert.readingView": "สลับไปยังโหมดต้นฉบับหรือ Live Preview เพื่อแทรก callout",
	"quickInsert.noCursorHint": "ไม่มีเคอร์เซอร์ในบันทึกนี้ จึงไม่มีตำแหน่งให้แทรก",
	"quickInsert.noCursor": "วางเคอร์เซอร์ในบันทึกตรงตำแหน่งที่ต้องการแทรก callout แล้วลองอีกครั้ง",
};
