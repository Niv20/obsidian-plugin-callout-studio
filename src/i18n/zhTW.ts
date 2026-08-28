export const zhTW: Record<string, string> = {
	"cmd.openSettings": "開啟設定",
	"cmd.createCallout": "建立新的 callout 類型",
	"cmd.insertEmptyCallout": "插入空白 callout",
	"cmd.calloutWrap": "以 callout 包覆",
	"cmd.calloutUnwrap": "移除 callout",
	"cmd.customWrapBlock": "以 {{name}} 區塊 callout 包覆",
	"cmd.customInsertBlock": "插入 {{name}} 區塊 callout",
	"cmd.customInsertHeading": "插入 H{{level}} {{name}} 標題 callout",
	"cmd.customInsertInline": "插入 {{name}} 行內 callout",
	"cmd.openQuickInsert": "快速插入區塊 callout",
	"autocomplete.createNew": "建立新 callout：「{{name}}」",
	"settings.fallbackTag": "預設",
	"settings.fallbackTagAuto": "自動預設",
	"settings.autoDiscover": "自動偵測庫中的 callout",
	"settings.autoDiscoverDesc":
		"辨識你筆記中寫出的 callout 類型，並自動加入清單。關閉此選項不會影響你已有的 callout——你仍可以自行新增，或使用下方的重新掃描庫。",
	"settings.rescanVault": "重新掃描 vault",
	"settings.rescanVaultDesc":
		"尋找筆記中未辨識的 callout ID 並將其新增為備用列。",
	"settings.rescanVaultHintAction": "立即掃描",
	"settings.rescanComplete": "重新掃描完成：已新增 {{count}} 個新 callout。",
	"replaceModal.deleteWithoutReplaceSuffix": "（回復為預設值）",
	"replaceModal.titleDelete": "刪除 callout",
	"replaceModal.titleReplace": "在 vault 中替換",
	"firstRun.title": "在 vault 中尋找現有的 callout？",
	"firstRun.body":
		"Callout Studio 可以掃描您的 vault 以探索您已在使用的 callout，使其出現在設定清單中並套用備用樣式。",
	"firstRun.heavyVaultNote":
		"您的 vault 有 {{count}} 個 Markdown 檔案——掃描可能需要幾秒鐘。",
	"firstRun.laterHint":
		"您隨時可以從「設定 → Vault 洞察與維護 → 重新掃描 vault」執行此操作。",
	"firstRun.scanNow": "立即掃描",
	"firstRun.noThanks": "不，謝謝",
	"firstRun.autoScanComplete":
		"Callout Studio 已掃描您的 vault 並新增了 {{count}} 個 callout。",
	"firstRun.scanning": "掃描中",
	"firstRun.autoScanFailed":
		"Callout Studio 無法掃描您的 vault。您可以從「設定 → Vault 洞察與維護 → 重新掃描 vault」重試。",
	"firstRun.scanFailed":
		"掃描未完成。您可以從「設定 → Vault 洞察與維護 → 重新掃描 vault」重試。",

	"welcome.tooltip": "關於 Callout Studio",
	"welcome.title": "歡迎使用 Callout Studio！",
	"welcome.tagline": "建立、設計和管理 Obsidian callout 的完整解決方案。",
	"welcome.previewTitle": "查看實際效果",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Callout Studio 讓您可以建立具有自訂圖示、顏色與名稱的 callout。\n\n" +
		"這個 callout 可以用**三**種不同的方式使用：\n\n" +
		"## [!{{id}}] 標題 callout\n" +
		"只要在 `#` 後面直接加上 `[!type]`，就能把任何標題變成 callout 樣式的標題。\n\n" +
		"想要這樣的 [!{{id}}]{行內 callout} 嗎？只需在句子中加入 `[!type]{text}`，不會打斷您的書寫節奏。\n\n" +
		"> [!{{id}}] 區塊 callout\n" +
		"> 經典的 callout 仍使用您熟悉的語法：`> [!type]`。\n\n" +
		"Callout Studio 還有更多功能等您發掘！[深入了解]({{repoUrl}})。\n",

	"deleteModal.title": "刪除 callout「{{name}}」？",
	"deleteModal.bodyInUse":
		"此 callout 在 {{files}} 個檔案中出現了 {{count}} 次。",
	"deleteModal.bodyInUseExplain":
		"刪除後這些區塊將轉換為純文字——它們將失去樣式和 callout 標題。",
	"deleteModal.replaceHint":
		"您可以改用另一個 callout 替換，這樣 vault 內容仍保持為帶樣式的 callout。",
	"deleteModal.bodyUnused":
		"「{{name}}」未在任何筆記中使用，但它是您建立的自訂 callout。刪除將從清單中移除它。",
	"deleteModal.replaceInstead": "改為替換",
	"deleteModal.deleteInUse": "刪除（轉為純文字）",
	"deleteModal.deleteUnused": "刪除 callout",

	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": "清除所有「{{name}}」的使用？",
	"deleteModal.keepsRowBuiltIn":
		"這是 Obsidian 的內建 callout 之一，因此該類型本身仍可使用——只有它在您筆記中的使用會改變。",
	"deleteModal.keepsRowTheme":
		"{{theme}} 定義了此 callout 類型，因此它仍可使用並保留其外觀。Callout Studio 只會變更您 vault 中的筆記——不會影響任何屬於您佈景主題的內容。",
	"deleteModal.clearUsages": "清除使用（轉換為純文字）",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "我的 callout 類型",
	"settings.builtInCallouts": "內建 callout",
	"settings.contextMenu": "右鍵選單",
	"settings.autocomplete": "自動完成",
	"settings.keyboardShortcuts": "鍵盤快速鍵",
	"settings.language": "語言",
	"settings.languageDesc":
		"Callout Studio 的顯示語言。預設跟隨 Obsidian 的介面語言。",
	"settings.languageAuto": "自動（跟隨 Obsidian）",
	"settings.importExport": "匯入 / 匯出",
	"settings.import": "匯入",
	"settings.export": "匯出",
	"settings.importDesc":
		"使用 JSON 檔案從另一個 vault 匯入 Callout Studio 資料。",
	"settings.exportDesc": "以 JSON 格式儲存所有自訂 callout 類型。",
	"settings.importConflictNotice":
		"已匯入 {{count}} 個 callout 類型；{{overwritten}} 個現有項目已被覆寫。",
	"settings.addNewCallout": "+ 新增 callout",
	"settings.noCalloutsNow": "目前沒有自訂 callout。",
	"settings.editAria": "編輯 {{name}}",
	"settings.moreRowActionsAria": "{{name}} 的更多動作",
	"settings.usageInfo": "在 {{files}} 個檔案中使用了 {{count}} 次",
	"settings.replaceAction": "在 vault 中替換",
	"settings.deleteAction": "刪除",
	"settings.resetAction": "重置為預設值",
	"settings.makeFallbackAction": "使用預設備用樣式",
	"settings.colorSwatchAria": "強調色：{{accent}} · 背景：{{bg}}",

	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "以我自己的 CSS 設定樣式",
	"settings.externalCssStopAction": "讓 Callout Studio 重新為此設定樣式",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "外部 CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "來自您佈景主題的 callout",
	"settings.themeCalloutsDesc":
		"{{theme}} 提供或重新設定了這些 callout 的樣式，因此 Callout Studio 會完全依照您佈景主題繪製的樣子保留它們，並僅將它們作為 Block callout 提供。這裡會顯示兩種情況：您佈景主題新增的 callout 類型，以及佈景主題取代了外觀的內建 callout。佈景主題新增的 callout 類型僅在該佈景主題啟用時列出。",
	"settings.themeCalloutsDefaultTheme": "您的佈景主題",
	"settings.themePreviewAria":
		"預覽「{{name}}」— 查看您的佈景主題如何繪製它",
	"settings.clearUsesAction": "清除筆記中的使用",
	"settings.builtInAllThemeStyled":
		"{{theme}} 重新設定了每個內建 callout 的樣式，因此它們全部列在上方，Callout Studio 不會干預它們。若要設計您自己的樣式，請新增一個使用不同 ID 的 callout。",

	"settings.fallbackCallout": "預設備用 callout",
	"settings.fallbackCalloutDesc":
		"vault 中無法辨識的 callout 類型將繼承此 callout 的樣式。",
	"settings.globalStyle": "全域 callout 樣式",
	"settings.border": "邊框",
	"settings.borderAll": "全部",
	"settings.borderTop": "頂部",
	"settings.borderRight": "右側",
	"settings.borderBottom": "底部",
	"settings.borderLeft": "左側",
	"settings.borderWidth": "邊框粗細",
	"settings.fontScaleGroup": "字型縮放",
	"settings.titleScale": "標題",
	"settings.contentScale": "內容",
	"settings.inlineTextScale": "文字",
	"settings.shapeGroup": "形狀",
	"settings.borderRadius": "圓角",
	"settings.alignGroup": "對齊",
	"settings.alignContent": "將內容與標題對齊",
	"settings.headingSpacingGroup": "標題間距",
	"settings.headingPadVertical": "垂直間距",
	"settings.headingGap": "標題間距",
	"settings.headingFoldGroup": "折疊",
	"settings.headingFoldArrow": "顯示折疊箭頭",
	"settings.styleDemoName": "範例",
	"settings.previewTitle": "預覽",
	// Settings — Saved color palettes
	"settings.customPalettes": "已儲存的調色盤",
	"settings.newPalette": "新增調色盤",
	"settings.customPalettesEmpty": "目前沒有已儲存的調色盤。",
	"settings.editPaletteAria": "編輯調色盤 {{name}}",
	"settings.deletePaletteAria": "刪除調色盤 {{name}}",
	"settings.deletePaletteConfirm":
		"刪除調色盤「{{name}}」？\n使用其顏色的 callout 不受影響。",
	"settings.enableAutocomplete": "啟用 [! 自動完成",
	"settings.enableAutocompleteDesc":
		"在編輯器區塊引用中輸入「[!」時顯示建議。從清單中選擇 callout 類型以插入完整的 callout 標題。",
	"settings.customCommands": "指令與快速鍵",
	"settings.customCommandsDesc":
		"查看每個 Callout Studio 指令及其綁定的快速鍵，並為您最常用的 callout 建立自己的指令。預設不分配快速鍵。",
	"settings.customCommandsButton": "管理指令",
	"commandBuilder.title": "指令與快速鍵",
	"commandBuilder.desc":
		"點擊「+」按鈕以在 Obsidian 的快速鍵設定中設定或變更快速鍵。",
	"commandBuilder.builtIn": "內建指令",
	"commandBuilder.toggleAria": "開啟或關閉 {{name}}",
	"commandBuilder.hotkeyBlank": "空白",
	"commandBuilder.hotkeyAria": "為 {{name}} 設定快速鍵",
	"commandBuilder.yourCommands": "您的指令",
	"commandBuilder.newCommand": "新增指令",
	"commandBuilder.empty": "尚無自訂指令。",
	"commandBuilder.unknownCommand": "此指令",
	"commandBuilder.editAria": "編輯 {{name}}",
	"commandBuilder.deleteAria": "刪除 {{name}}",
	"commandBuilder.deleteConfirm":
		"刪除指令 {{name}}？為其設定的快速鍵將停止作用。",
	"commandBuilder.newTitle": "新增指令",
	"commandBuilder.editTitle": "編輯指令",
	"commandBuilder.format": "Callout 格式",
	"commandBuilder.formatDesc": "此指令寫入的 callout 類型。",
	"commandBuilder.formatHeading": "標題",
	"commandBuilder.formatInline": "行內",
	"commandBuilder.formatBlock": "區塊",
	"commandBuilder.roleDisabled":
		"此格式目前關閉，因此在您重新開啟之前，指令將插入純文字。",
	"commandBuilder.callout": "Callout 類型",
	"commandBuilder.calloutDesc": "此指令插入的 callout。",
	"commandBuilder.headingLevel": "標題層級",
	"commandBuilder.headingLevelDesc": "要寫入的標題層級。",
	"commandBuilder.action": "動作",
	"commandBuilder.actionDesc":
		"「包覆」會將所選內容轉換為 callout；「插入」會新增一個空白的。",
	"commandBuilder.actionWrap": "包覆所選內容",
	"commandBuilder.actionInsert": "插入新項目",
	"commandBuilder.preview": "指令名稱",
	"commandBuilder.duplicate": "您已經有一個執行完全相同動作的指令。",
	"commandBuilder.noCallouts": "目前沒有可用來建立指令的 callout 類型。",
	"commandBuilder.save": "儲存",

	"commandBuilder.roleThemeOwned":
		"您的佈景主題提供了此 callout，因此它只有 Block 格式。",
	"commandBuilder.commandSuspended":
		"已暫停：您的佈景主題提供了此 callout，因此它只有 Block 格式。當佈景主題不再提供它時，此指令將重新生效。",

	"settings.vaultMaintenance": "Vault 洞察與維護",
	"settings.vaultStats": "Callout 統計",
	"settings.vaultStatsDesc":
		"統計 Markdown 筆記中的每個 callout（區塊、標題與行內）並按類型分組。",
	"settings.vaultStatsButton": "檢視統計",
	"settings.vaultStatsScanning": "掃描中",
	"settings.resetAll": "重置",
	"settings.resetAllDesc":
		"刪除所有使用者 callout，重置內建 callout、全域樣式（邊框、字型縮放、形狀）、已儲存的調色盤、右鍵選單自訂設定和已下載的 Material SVG。",
	"settings.resetAllButton": "重置所有內容",
	"settings.resetAllConfirm":
		"此操作將刪除所有自訂 callout，重置內建 callout、全域樣式、已儲存的調色盤、右鍵選單自訂設定和所有快取的 Material SVG。此操作無法還原。確定嗎？",
	"notice.resetAllDone": "所有內容已重置為預設值。",
	"notice.customCommandsRemoved":
		"已移除 {{count}} 個 callout 類型已不存在的自訂指令。",
	"notice.customCommandMissingCallout": "該指令的 callout 類型已不存在。",
	"notice.exported": "Callout 已匯出到 callout-studio-export.json",
	"notice.importedJSON": "已從 JSON 匯入 {{count}} 個 callout 類型。",
	"notice.importedSettings": "已匯入外掛設定。",
	"notice.importedCalloutManager":
		"已從 Callout Manager 匯入：建立了 {{created}} 個，更新了 {{updated}} 個。",
	"notice.importedAdmonition":
		"已從 Admonition 匯入：新建 {{created}} 個，更新 {{updated}} 個。",
	"notice.noNewJSON": "未匯入新的 callout 類型（ID 可能已存在）。",
	"notice.iconDownloadFailed":
		"無法下載 Material 圖示「{{name}}」。該圖示可能不支援此樣式/字重，或您的網路連線已中斷。",

	"notice.externalCssOn":
		"Callout Studio 不再為「{{name}}」設定樣式——由您自己的 CSS 決定它的外觀。它的標題 callout 和行內 callout 形式將不會顯示。",
	"notice.externalCssOff": "Callout Studio 現在再次為「{{name}}」設定樣式。",

	"notice.nothingToWrap": "沒有可包覆的內容。",
	"notice.cursorNotInsideCallout": "游標不在 callout 內部。",
	"notice.autocompleteTargetMoved":
		"未插入任何內容 — 編輯器開啟期間該行已變更。",
	"notice.openHotkeysFailed": "無法開啟 Obsidian 快速鍵設定。",
	"notice.filterHotkeysFailed":
		"已開啟 Obsidian 快速鍵，但無法套用 Callout Studio 篩選器。",
	"editor.editCallout": "編輯 callout",
	"editor.newCallout": "新建 callout",
	"editor.displayName": "顯示名稱",
	"editor.displayNameDesc": "在 UI 中顯示的可讀標籤",
	"editor.displayNameBuiltIn": "內建 callout 的顯示名稱無法更改",
	"editor.displayNamePlaceholder": "我的 callout",
	"editor.calloutIds": "Callout ID",
	"editor.calloutIdsDesc":
		"此 callout 的所有識別符。允許使用空格。\n按 Enter 或 + 按鈕新增。",
	"editor.calloutIdsPlaceholder": "新增 ID",
	"editor.addId": "新增 ID",
	"editor.idLinkedToName": "已連結到顯示名稱",
	"editor.idCannotDelete":
		"此 ID 已連結到顯示名稱，無法刪除——請編輯名稱以變更",
	"editor.icon": "圖示",
	"editor.pickIcon": "更改圖示",
	"editor.replaceIcon": "替換圖示",
	"editor.removeIcon": "移除圖示",
	"editor.noIcon": "無圖示",
	"editor.resetIcon": "重設圖示為預設",
	"editor.livePreview": "即時預覽",
	"editor.iconAdjustment": "圖示調整",
	"editor.picture": "圖片",
	"editor.size": "大小",
	"editor.horizontalOffset": "水平偏移",
	"editor.verticalOffset": "垂直偏移",
	"editor.colors": "顏色",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "重設顏色為預設",
	"editor.paletteDeleted": "已刪除的顏色",
	"editor.paletteGroupObsidian": "Obsidian callout",
	"editor.paletteGroupPresets": "色彩預設",
	"editor.paletteGroupCustom": "自訂",
	"editor.paletteNewColor": "新增顏色…",
	"editor.contrastWarning": "與背景對比度過低——可能難以閱讀",
	"editor.foldable": "可折疊",
	"editor.foldableDesc":
		"選擇 callout 是否可折疊以及在整個 vault 中套用的預設狀態。",
	"editor.foldOff": "關閉",
	"editor.foldOpen": "預設展開",
	"editor.foldClosed": "預設折疊",
	"editor.cancel": "取消",
	"editor.saveChanges": "儲存變更",
	"editor.createCallout": "建立 callout",
	"editor.nameRequired": "建立 callout 前需要提供顯示名稱。",
	"editor.noChangesToSave": "沒有做任何更改。",
	"editor.downloadingIcon": "正在下載圖示",
	"editor.idEmpty": "至少需要一個 ID",
	"editor.idExists": "已存在具有此 ID 的 callout",
	"editor.idConflict": "此 ID 與現有 callout 衝突",
	"editor.idDashConflict":
		"Obsidian 會將空格寫為連字符，因此此 ID 與「{{other}}」衝突",

	"editor.idFromTheme":
		"{{theme}} 已經提供了具有此 ID 的 callout，因此 Callout Studio 無法為其設定樣式。請選擇其他 ID。",
	"editor.idThemePattern":
		"提醒：您的佈景主題會為每個符合 {{pattern}} 的 callout 設定樣式，因此它可能會覆蓋此 callout 的外觀。",

	"editor.untitledCallout": "未命名 Callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet，consectetur adipiscing elit。",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet，consectetur adipiscing elit。",
	"editor.sampleInlineText": "這是一個嵌入在段落中的行內 [!{id}] 徽標。",
	"editor.previewReadOnly": "即時預覽無法編輯",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": "{{name}} — 由您的佈景主題提供",
	"themePreview.owned":
		"{{theme}} 提供並設定了「{{name}}」的樣式。Callout Studio 不會覆蓋它，因此其 Block callout 的外觀與您佈景主題繪製的完全一致。",
	"themePreview.readOnly":
		"這表示它的顏色、圖示、名稱與 ID 在此處無法變更。若您想要自己的設計，請建立一個使用不同 ID 的新 callout。",
	"themePreview.blockOnly":
		"標題與行內格式不適用於您佈景主題提供的 callout。Block callout 使用佈景主題的原生樣式。",
	"themePreview.previewTitle": "目前的顯示方式",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> 這是該 callout 內容的顯示效果。\n",

	"editor.externalStyleClose": "知道了",
	// Palette editor modal
	"palette.newTitle": "新增調色盤",
	"palette.groupPalette": "調色盤",
	"palette.editTitle": "編輯調色盤",
	"palette.name": "名稱",
	"palette.namePlaceholder": "我的調色盤",
	"palette.nameExists": "已存在同名的調色盤",
	"palette.baseColor": "基礎顏色",
	"palette.baseColorHint":
		"我們會自動將背景顏色與之匹配。如果需要，您可以透過{{link}}單獨控制它。",
	"palette.baseColorHintLink": "點擊此處",
	"palette.advancedColors": "顏色",
	"palette.advancedColorsHint":
		"正在編輯{{mode}}模式的顏色 - 另一模式會自動更新。切換 Obsidian 主題以進行檢查。",
	"palette.revertHint": "更喜歡使用單一基礎顏色？{{link}}。",
	"palette.revertHintLink": "還原",
	"palette.lightMode": "淺色",
	"palette.darkMode": "深色",
	"palette.accentColor": "強調色",
	"palette.backgroundColorChannel": "背景顏色",
	"palette.textColorChannel": "文字顏色",
	"palette.bgIntensity": "強度",
	"palette.bgStyle": "樣式",
	"palette.bgSolid": "純色",
	"palette.bgGradient": "漸層",
	"palette.bgTransparent": "透明",
	"palette.gradientTo": "第二種顏色",
	"palette.gradientDirection": "方向",
	"palette.gradientText": "標題文字漸層",
	"palette.save": "儲存",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "紅色",
	"colorName.orange": "橙色",
	"colorName.amber": "琥珀色",
	"colorName.yellow": "黃色",
	"colorName.lime": "萊姆綠",
	"colorName.green": "綠色",
	"colorName.teal": "藍綠色",
	"colorName.cyan": "青色",
	"colorName.sky": "天藍色",
	"colorName.blue": "藍色",
	"colorName.indigo": "靛藍色",
	"colorName.violet": "紫羅蘭色",
	"colorName.purple": "紫色",
	"colorName.pink": "粉紅色",
	"colorName.rose": "玫瑰色",
	"colorName.brown": "棕色",
	"colorName.gray": "灰色",
	"colorName.black": "黑色",
	"colorName.white": "白色",
	"colorName.crimson": "深紅色",
	"colorName.coral": "珊瑚色",
	"colorName.grape": "葡萄色",
	"colorName.plum": "梅子色",
	"colorName.bubblegum": "泡泡糖色",

	"iconPicker.pickIcon": "選擇圖示",
	"iconPicker.confirm": "確認",
	"iconPicker.cancel": "取消",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "搜尋 Lucide 圖示",
	"iconPicker.searchTabler": "搜尋 Tabler 圖示",
	"iconPicker.tablerStyle": "圖示樣式",
	"iconPicker.tablerStyleOutline": "線框",
	"iconPicker.tablerStyleFilled": "實心",
	"iconPicker.loadMore": "載入更多",
	"iconPicker.materialStyle": "圖示樣式",
	"iconPicker.materialStyleOutlined": "線框 (Outlined)",
	"iconPicker.materialStyleFilled": "實心 (Filled)",
	"iconPicker.materialStyleRounded": "圓潤 (Rounded)",
	"iconPicker.materialStyleSharp": "尖銳 (Sharp)",
	"iconPicker.materialWeight": "圖示粗細",
	"iconPicker.materialWeight100": "纖細 (Thin)",
	"iconPicker.materialWeight200": "特細 (Extra Light)",
	"iconPicker.materialWeight300": "細 (Light)",
	"iconPicker.materialWeight400": "一般 (Regular)",
	"iconPicker.materialWeight500": "中等 (Medium)",
	"iconPicker.materialWeight600": "半粗 (Semi Bold)",
	"iconPicker.materialWeight700": "粗體 (Bold)",
	"iconPicker.materialFontFailed":
		"無法載入 Material 圖示預覽。現在會改顯示圖示名稱——搜尋與選取仍可正常運作。",
	"iconPicker.materialFontRetry": "再試一次",
	"iconPicker.searchMaterial": "搜尋 Material 圖示",
	"iconPicker.searchEmoji": "搜尋表情符號",
	"iconPicker.skinTone": "膚色",
	"iconPicker.allCategories": "所有分類",
	"iconPicker.noIconSelected": "未選擇圖示",
	"iconPicker.noResults": "沒有圖示符合您的搜尋。",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "搜尋 Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "搜尋 Font Awesome",
	"iconPicker.faStyle": "圖示樣式",
	"iconPicker.faStyleSolid": "實心",
	"iconPicker.faStyleRegular": "一般",
	"iconPicker.faStyleBrands": "品牌",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "搜尋 RPG Awesome",
	"iconPicker.image": "您的圖片",
	"iconPicker.searchImage": "搜尋您的圖片",
	"iconPicker.imageTooLarge": "{{name}} 太大。圖片必須小於 5 MB。",
	"iconPicker.imageUnsupported":
		"{{name}} 不是受支援的圖片格式。請使用 SVG、PNG、JPEG 或 WebP。",
	"iconPicker.imageInvalidSvg":
		"{{name}} 無法作為安全的 SVG 讀取，因此未新增。",
	"iconPicker.imageDecodeFailed": "{{name}} 無法作為圖片讀取。",
	"iconPicker.imageDuplicate":
		"{{name}} 已在您的圖片中。請重新命名檔案或刪除現有圖片。",
	"iconPicker.imageAdd": "新增圖片",
	"iconPicker.imageEmpty":
		"尚無圖片。從您的電腦新增 SVG、PNG、JPEG 或 WebP 檔案，或將其拖曳至此。",
	"iconPicker.imageDelete": "刪除",
	"iconPicker.imageDeleteConfirm": "刪除「{{name}}」？",
	"iconPicker.imageDeleteInUse":
		"{{count}} 個 callout 使用了這張圖片。在您提供新圖片之前，它們將顯示佔位圖示。",
	"iconPicker.imageRecolor": "跟隨 Callout 色彩",
	"iconPicker.allSources": "所有來源",
	"iconPicker.searchAllSources": "搜尋所有圖示來源",
	"iconPicker.sourcesNotDownloaded":
		"尚未包含：{{names}}。請在上方選擇來源以下載。",
	"iconPicker.chooseSource": "選擇來源",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "同時搜尋所有圖示庫",
	"iconPicker.descLucide": "Obsidian 自有圖示集，始終離線可用",
	"iconPicker.descTabler": "簡潔統一的介面圖示，線框和實心",
	"iconPicker.descMaterial": "Google 圖示集，四種樣式和七種粗細",
	"iconPicker.descEmoji": "彩色字符，每種膚色",
	"iconPicker.descOcticons": "GitHub 介面圖示",
	"iconPicker.descFa": "實心、一般和品牌",
	"iconPicker.descRpgAwesome": "奇幻和桌遊圖示",
	"iconPicker.descImage": "從您的電腦新增的圖片",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "無障礙功能",
	"iconPicker.cat.Actions": "操作",
	"iconPicker.cat.Activities": "活動",
	"iconPicker.cat.Alert": "警示",
	"iconPicker.cat.Alphabet": "字母",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "動物",
	"iconPicker.cat.Arrows": "箭頭",
	"iconPicker.cat.Astronomy": "天文學",
	"iconPicker.cat.Audio&Video": "音訊與視訊",
	"iconPicker.cat.Automotive": "汽車",
	"iconPicker.cat.Badges": "徽章",
	"iconPicker.cat.Brand": "品牌",
	"iconPicker.cat.Buildings": "建築",
	"iconPicker.cat.Business": "商業",
	"iconPicker.cat.Camping": "露營",
	"iconPicker.cat.Charity": "慈善",
	"iconPicker.cat.Charts": "圖表",
	"iconPicker.cat.Charts + Diagrams": "圖表與示意圖",
	"iconPicker.cat.Childhood": "童年",
	"iconPicker.cat.Clothing + Fashion": "服裝與時尚",
	"iconPicker.cat.Coding": "程式設計",
	"iconPicker.cat.Communicate": "交流",
	"iconPicker.cat.Communication": "通訊",
	"iconPicker.cat.Computers": "電腦",
	"iconPicker.cat.Connectivity": "連線",
	"iconPicker.cat.Construction": "建築工程",
	"iconPicker.cat.Currencies": "貨幣",
	"iconPicker.cat.Database": "資料庫",
	"iconPicker.cat.Design": "設計",
	"iconPicker.cat.Development": "開發",
	"iconPicker.cat.Devices": "裝置",
	"iconPicker.cat.Devices + Hardware": "裝置與硬體",
	"iconPicker.cat.Disaster + Crisis": "災難與危機",
	"iconPicker.cat.Document": "文件",
	"iconPicker.cat.E-commerce": "電子商務",
	"iconPicker.cat.Editing": "編輯",
	"iconPicker.cat.Education": "教育",
	"iconPicker.cat.Electrical": "電氣",
	"iconPicker.cat.Emoji": "表情符號",
	"iconPicker.cat.Energy": "能源",
	"iconPicker.cat.Extensions": "擴充功能",
	"iconPicker.cat.Files": "檔案",
	"iconPicker.cat.Film + Video": "影視",
	"iconPicker.cat.Food": "食物",
	"iconPicker.cat.Food + Beverage": "食品與飲料",
	"iconPicker.cat.Fruits + Vegetables": "水果與蔬菜",
	"iconPicker.cat.Games": "遊戲",
	"iconPicker.cat.Gaming": "遊戲娛樂",
	"iconPicker.cat.Gender": "性別",
	"iconPicker.cat.Genders": "性別",
	"iconPicker.cat.Gestures": "手勢",
	"iconPicker.cat.Halloween": "萬聖節",
	"iconPicker.cat.Hands": "手",
	"iconPicker.cat.Hardware": "硬體",
	"iconPicker.cat.Health": "健康",
	"iconPicker.cat.Holidays": "節日",
	"iconPicker.cat.Home": "家庭",
	"iconPicker.cat.Household": "家居",
	"iconPicker.cat.Humanitarian": "人道主義",
	"iconPicker.cat.Images": "圖片",
	"iconPicker.cat.Laundry": "洗衣",
	"iconPicker.cat.Letters": "字母",
	"iconPicker.cat.Logic": "邏輯",
	"iconPicker.cat.Logistics": "物流",
	"iconPicker.cat.Map": "地圖",
	"iconPicker.cat.Maps": "地圖",
	"iconPicker.cat.Maritime": "航海",
	"iconPicker.cat.Marketing": "行銷",
	"iconPicker.cat.Math": "數學",
	"iconPicker.cat.Mathematics": "數學",
	"iconPicker.cat.Media": "媒體",
	"iconPicker.cat.Media Playback": "媒體播放",
	"iconPicker.cat.Medical + Health": "醫療與健康",
	"iconPicker.cat.Money": "金錢",
	"iconPicker.cat.Mood": "情緒",
	"iconPicker.cat.Moving": "搬家",
	"iconPicker.cat.Music + Audio": "音樂與音訊",
	"iconPicker.cat.Nature": "自然",
	"iconPicker.cat.Numbers": "數字",
	"iconPicker.cat.Photography": "攝影",
	"iconPicker.cat.Photos + Images": "照片與圖片",
	"iconPicker.cat.Political": "政治",
	"iconPicker.cat.Privacy": "隱私",
	"iconPicker.cat.Punctuation + Symbols": "標點與符號",
	"iconPicker.cat.Religion": "宗教",
	"iconPicker.cat.Science": "科學",
	"iconPicker.cat.Science Fiction": "科幻",
	"iconPicker.cat.Security": "安全",
	"iconPicker.cat.Shapes": "形狀",
	"iconPicker.cat.Shopping": "購物",
	"iconPicker.cat.Social": "社群媒體",
	"iconPicker.cat.Spinners": "載入圖示",
	"iconPicker.cat.Sport": "運動",
	"iconPicker.cat.Sports + Fitness": "運動與健身",
	"iconPicker.cat.Symbols": "符號",
	"iconPicker.cat.System": "系統",
	"iconPicker.cat.Text": "文字",
	"iconPicker.cat.Text Formatting": "文字格式",
	"iconPicker.cat.Time": "時間",
	"iconPicker.cat.Toggle": "切換",
	"iconPicker.cat.Transit": "大眾運輸",
	"iconPicker.cat.Transportation": "交通運輸",
	"iconPicker.cat.Travel": "旅行",
	"iconPicker.cat.Travel + Hotel": "旅行與飯店",
	"iconPicker.cat.UI actions": "介面操作",
	"iconPicker.cat.Users + People": "使用者與人物",
	"iconPicker.cat.Vehicles": "車輛",
	"iconPicker.cat.Version control": "版本控制",
	"iconPicker.cat.Weather": "天氣",
	"iconPicker.cat.Writing": "寫作",
	"iconPicker.cat.Zodiac": "星座",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} 尚未下載",
	"iconPack.downloadDetail": "{{count}} 個圖示 · {{size}} · 單次下載",
	"iconPack.download": "下載",
	"iconPack.downloading": "正在下載 {{name}}…",
	"iconPack.downloadFailed": "無法下載 {{name}}。請檢查網路連線後重試。",
	"iconPack.retry": "重試",
	"iconPack.faBrandsNotice":
		"品牌圖示是其各自所有者的商標。包含這些圖示並不表示認可。請僅將其用於代表所指的公司、產品或服務。",
	"iconPack.artworkRestored": "已下載 {{names}} 的圖示圖稿。",
	"iconPack.diskWriteFailed":
		"Callout Studio 無法將圖示包儲存至磁碟，下次需要重新下載。您選擇的圖示仍已儲存在您的設定中。",

	// Icon licences & credits
	"credits.title": "圖示授權與致謝",
	"credits.intro":
		"Callout Studio 使用了多個開源圖示庫。其授權條款以及為在此使用所做的更改均已在下方列出。",
	"credits.fullNotices": "完整的第三方聲明",
	"credits.pluginLicense":
		"Callout Studio 自身的程式碼採用 permissive 授權；圖示庫保留各自的授權。",
	"contextMenu.editCallout": "編輯 callout 設定",
	"contextMenu.copyMarkdown": "複製 callout Markdown",
	"contextMenu.openSettings": "開啟 Callout Studio 設定",
	"contextMenu.setFoldClosed": "將 callout 設定為關閉 (-)",
	"contextMenu.setFoldOpen": "將 callout 設定為開啟 (+)",
	"contextMenu.setFoldNone": "使 callout 不可折疊",
	"contextMenu.cutSection": "剪下標題部分",
	"contextMenu.copySection": "複製標題部分",
	"contextMenu.deleteSection": "刪除標題部分",
	"heading.toggleFold": "切換折疊",
	"settings.globalSettings": "Callout Studio 全域樣式選項",
	"settings.globalSettingsScope":
		"這些是全域設定：每一項都會一次性變更 Callout Studio 所設定樣式的每個 callout 的形狀、間距與大小。您佈景主題設定樣式的 callout 保留佈景主題自身的設計。",
	"settings.globalSettingsRegularDesc":
		"調整 vault 中每個 block callout 的邊框、圓角、字型縮放和對齊方式。",
	"settings.globalSettingsHeadingDesc":
		"調整 vault 中每個標題 callout 的邊框、形狀和垂直間距。",
	"settings.globalSettingsInlineDesc":
		"調整 vault 中每個行內 callout 的邊框和形狀。",
	"settings.globalSettingsCustomize": "自訂",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "標題 callout",
	"settings.calloutTypeInline": "行內 callout",
	"settings.customizeMenu": "自訂選單項目",
	"settings.customizeMenuDesc":
		"選擇每種 callout 類型顯示哪些右鍵操作，並調整其順序。 在原始碼模式和即時預覽中均有效。",
	"settings.customizeMenuButton": "自訂選單項目",
	"menuCustomize.title": "自訂右鍵選單",
	"menuCustomize.desc":
		"啟用或停用操作，並拖曳把手調整順序。變更會自動儲存。",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "標題 callout",
	"menuCustomize.inline": "行內 callout",
	"menuCustomize.dragHandle": "拖曳以重新排序",
	"menuItem.edit": "編輯 callout",
	"menuItem.openSettings": "開啟設定",
	"menuItem.copyMarkdown": "複製 Markdown",
	"menuItem.foldDefaults": "折疊預設值（展開 / 折疊 / 無）",
	"menuItem.cutSection": "剪下部分",
	"menuItem.copySection": "複製部分",
	"menuItem.deleteSection": "刪除部分",
	"confirm.ok": "刪除",
	"confirm.cancel": "取消",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "刪除指令",
	"confirm.titleResetAll": "重置所有 callout",
	"confirm.titleResetCallout": "重置 callout",
	"confirm.titleDeletePalette": "刪除調色盤",
	"confirm.titleDeleteImage": "刪除圖片",
	"vault.filesUpdated": "已更新 vault 檔案中的 {{count}} 個 callout 參照。",
	"vault.idsUpdated":
		"已更新 vault 檔案中的 {{count}} 個 callout ID：{{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"已更新 vault 檔案中的 {{count}} 個 callout 標題：{{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "替換為：",
	"vault.deleteWithout": "直接刪除",
	"vault.confirmDelete": "確認",
	"vault.confirmReplace": "替換",
	"vault.replacePromptInUse":
		"「{{name}}」在 {{files}} 個檔案中被使用了 {{count}} 次。選擇替換它的 callout：",
	"vault.replacePromptUnused": "選擇替換「{{name}}」的 callout：",
	"vault.noReplacementAvailable": "沒有其他可用的 callout 來替換此項。",
	"vault.convertedToPlainText":
		"已將 {{files}} 個檔案中的 {{blocks}} 個 callout 區塊轉換為純文字。",
	"vault.resetAliasWarning":
		"{{files}} 個檔案中有 {{count}} 個參照使用了自訂別名：{{aliases}}。重置後這些別名將失效。繼續？",
	"vault.resetConfirm": "重置",
	"vault.resetAllInUse":
		"⚠ {{files}} 個檔案中有 {{count}} 個 callout 參照使用了將被刪除的自訂 callout 類型。",
	"quickInsert.title": "快速插入區塊 callout",
	"quickInsert.desc": "選擇要插入游標位置的 callout。僅限區塊 callout。",
	"quickInsert.searchPlaceholder": "搜尋 callout",
	"quickInsert.sourceAria": "依 callout 來源篩選",
	"quickInsert.sourceAll": "全部",
	"quickInsert.sourceBuiltIn": "內建",
	"quickInsert.sourceUser": "我的 callout",
	"quickInsert.editAria": "編輯 {{name}}",
	"quickInsert.insertAria": "將 {{name}} 作為區塊 callout 插入",
	"quickInsert.noResults": "找不到 callout",
	"quickInsert.noUserCallouts": "您尚未建立任何 callout。",
	"quickInsert.noEditorHint": "沒有筆記以編輯模式開啟，因此無法插入任何內容。",
	"quickInsert.noEditor": "以編輯模式開啟一篇筆記以插入 callout。",

	"vaultStats.title": "Callout 統計",
	"vaultStats.totalCallouts": "Callout 總數",
	"vaultStats.typesFound": "發現的類型",
	"vaultStats.filesWithCallouts": "包含 callout 的檔案",
	"vaultStats.filesScanned": "已掃描的 Markdown 檔案",
	"vaultStats.empty": "在 Markdown 筆記中未找到 callout。",
	"vaultStats.columnType": "類型",
	"vaultStats.columnName": "名稱",
	"vaultStats.columnSource": "來源",
	"vaultStats.columnCount": "數量",
	"vaultStats.columnFiles": "檔案",
	"vaultStats.unknown": "未知",
	"vaultStats.sourceBuiltIn": "內建",
	"vaultStats.sourceCustom": "自訂",
	"vaultStats.sourceAutoFallback": "自動備用",
	"vaultStats.sourceTheme": "CSS 片段",
	"vaultStats.sourceAlias": "{{id}} 的別名",
	"vaultStats.sourceUnknown": "未知",
	"vaultStats.byRole": "寫作形式",
	"vaultStats.roleBlock": "區塊",
	"vaultStats.roleHeading": "標題",
	"vaultStats.roleInline": "行內",
	"vaultStats.defineUndefined": "定義 {{count}} 個缺失項",
	"vaultStats.defineRunning": "掃描中",
	"vaultStats.defineDone": "已新增 {{count}} 種 callout 類型。",
	"vaultStats.close": "關閉",
	"import.title": "匯入問題",
	"import.reportLeadIn": "看起來您匯入的檔案已被修改。以下是問題清單：",
	"import.reportLeadInFatal":
		"此檔案看起來不像 Callout Studio 的匯出檔案，無法匯入：",
	"import.entryHeading": "條目 {{index}} — {{label}}",
	"import.summary":
		"{{total}} 個條目中 {{valid}} 個有效 · 發現 {{issues}} 個問題。",
	"import.btnCancel": "取消",
	"import.btnImportValid": "僅匯入有效項（{{count}} 個）",
	"import.err.notRecognized":
		"無法辨識的檔案：應為 callout 定義陣列或 Callout Studio 匯出檔案。",
	"import.warn.settingsIgnored": "設定區塊不是有效的物件，已被忽略。",
	"import.warn.invalidGradient": "背景漸層無效，已被忽略。",
	"import.err.parseFailed": "檔案不是有效的 JSON，無法解析。",
	"import.err.entryNotObject": "條目必須是物件。",
	"import.err.requiredMissing": "必填欄位「{{field}}」缺失或類型錯誤。",
	"import.err.idEmpty": "ID 不能為空。",
	"import.err.idTooLong":
		"ID「{{value}}」長度為 {{length}} 個字元；最大值為 {{max}}。",
	"import.err.idBadChar":
		"ID「{{value}}」包含無效字元（不允許使用「|」、「[」、「]」、定位字元和換行字元）。",
	"import.err.idMetadata":
		"ID「{{value}}」包含「|」。在 Obsidian 中，第一個「|」後面的所有內容都是 callout 的中繼資料，而非類型的一部分，因此此條目描述的是「{{id}}」callout。已略過，您現有的「{{id}}」保持不變。",
	"import.err.idReserved":
		"ID「{{value}}」已被 Callout Studio 保留用於其自身的預覽，無法匯入。",
	"import.err.displayNameEmpty": "顯示名稱不能為空。",
	"import.err.displayNameTooLong":
		"顯示名稱長度為 {{length}} 個字元；最大值為 {{max}}。",
	"import.err.boolField": "「{{field}}」必須是布林值（true 或 false）。",
	"import.err.iconNotObject": "圖示必須是物件。",
	"import.err.iconTypeInvalid":
		"圖示類型「{{value}}」不是以下之一：{{types}}。",
	"import.warn.iconFieldIgnored":
		'"{{field}}" 僅適用於 Material 圖示，對於圖示類型 {{type}} 將被忽略。',
	"import.err.iconValueEmpty": "圖示值必須是非空字串。",
	"import.err.iconValueTooLong": "圖示值異常過長（{{length}} 個字元）。",
	"import.err.materialStyle":
		"Material 圖示樣式「{{value}}」不是以下之一：outlined、filled、rounded、sharp。",
	"import.err.materialWeight":
		"Material 圖示粗細「{{value}}」必須是 100 到 700 之間的整數，步長為 100。",
	"import.warn.iconRecolorIgnored":
		'"recolor" 僅適用於您自己的圖片，對於圖示類型 {{type}} 將被忽略。',
	"import.err.iconRecolorInvalid":
		'"recolor" 必須為 true 或 false（收到：「{{value}}」)。',
	"import.err.colorInvalid":
		"「{{field}}」必須是如「#448aff」的十六進位顏色（收到「{{value}}」）。",
	"import.err.numberRange":
		"「{{field}}」必須是 {{min}} 到 {{max}} 之間的數字（收到「{{value}}」）。",
	"import.err.iconSizeRange":
		"「{{field}}」必須是 {{min}} 到 {{max}} 之間的數字（收到「{{value}}」）。",
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": "「aliases」必須是字串陣列。",
	"import.err.aliasNotString": "別名必須是字串。",
	"import.err.aliasDup": "「{{value}}」別名在此條目中重複。",
	"import.err.tooManyIds":
		"ID 過多（{{count}} 個）；每個 callout 最多可以有 {{max}} 個 ID（主 ID + 別名）。",
	"import.err.metadataShape": "「metadata」必須是一個值全為字串的物件。",
	"import.warn.unknownFields": "忽略了未知欄位：{{fields}}。",
	"import.err.duplicateInFile":
		"ID/別名「{{value}}」已被此檔案中的條目 #{{first}} 使用。",
	"import.err.aliasConflict":
		"別名「{{value}}」已被 vault 中的另一個 callout（「{{other}}」）使用。",
	"import.warn.defaultFoldedAutofix":
		"「defaultFolded」為 true 而「foldable」為 false；defaultFolded 已重置為 false。",
	"import.warn.imageMissing":
		"此 Callout 使用的圖片不在檔案中也不在此 vault 中，因此將顯示佔位圖示，直到您提供新圖片。",
	"import.err.paletteIdInvalid":
		'"paletteId" 必須是非空文字 ID（收到了 "{{value}}")。',
	"import.warn.iconNameUnknown":
		'"{{value}}" 圖示在 {{type}} 中不存在，因此使用了預設圖示。',
	"import.warn.cmIconUnknownNew":
		'"{{value}}" 圖示在 Obsidian 中不存在，因此使用了預設圖示。',
	"import.warn.cmIconUnknownExisting":
		'"{{value}}" 圖示在 Obsidian 中不存在，因此 "{{id}}" 保留了原有的圖示。',
	"import.chooseSource": "從以下位置匯入",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc": "載入從 Callout Studio 匯出的 .json 檔案。",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"貼上您從 Callout Manager 的 Copy 按鈕複製的樣式。",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"從 Admonition 外掛匯入您的自訂 admonition。",
	"import.cmTitle": "從 Callout Manager 匯入",
	"import.cmFromVault": "本儲存庫",
	"import.cmVaultChecking": "正在尋找 Callout Manager 外掛…",
	"import.cmVaultFound": "找到 {{count}} 個自訂 callout。",
	"import.cmVaultNotFound": "在本儲存庫中找不到自訂 callout。",
	"import.cmPasteLabel": "或在此貼上從 Callout Manager 複製的樣式：",
	"import.cmInstructions":
		"在 Callout Manager 中，使用其 Copy 按鈕複製您自訂的 callout 樣式，然後將其貼到下方。",
	"import.cmPlaceholder": "在此貼上複製的樣式…",
	"import.cmBtnCancel": "取消",
	"import.cmBtnImport": "匯入",
	"import.err.cmNotRecognized":
		"無法辨識的檔案：應為 Callout Manager Copy 按鈕產生的樣式，或 Callout Manager 的 data.json。",
	"import.err.cmNoEntries": "找不到可匯入的自訂 callout。",
	"import.err.cmNoBlocksFound": "在貼上的文字中未找到 Callout Manager 樣式。",
	"import.err.cmNoColorForNew":
		'未找到適用於新 callout "{{value}}" 的可用顏色；已跳過。',
	"import.warn.cmNoColorDefault":
		"Callout Manager 未設定顏色，因此使用預設灰色。",
	"import.warn.cmThemeCondition":
		"此 callout 的顏色或圖示只為單一佈景主題設定。Callout Studio 不支援各主題獨立樣式，因此已套用至所有主題。",
	"import.warn.cmCustomStyles":
		"此 callout 在 Callout Manager 中還有自訂 CSS。該樣式不包含在匯入內容中，因此僅匯入其圖示與顏色。",
	"import.err.cmIdConflict":
		'ID "{{value}}" 已被另一個 callout ("{{other}}") 用作別名，已跳過。',

	// Import — Admonition
	"import.admTitle": "從 Admonition 匯入",
	"import.admInstructions":
		"每個 admonition 都會作為 callout 匯入，保留其名稱、圖示與顏色。Callout Studio " +
		"沒有對應功能的設定（命令、複製按鈕、隱藏標題）不會被匯入。",
	"import.admFromVault": "本儲存庫",
	"import.admVaultChecking": "正在尋找 Admonition 外掛…",
	"import.admVaultFound": "找到 {{count}} 個自訂 admonition。",
	"import.admVaultNotFound": "在本儲存庫中找不到自訂 admonition。",
	"import.admFromFile": "檔案",
	"import.admFromFileDesc": "admonitions.json 檔案，或共享的圖示包。",
	"import.admChooseFile": "選擇檔案…",
	"import.admPasteLabel": "或在此貼上 JSON：",
	"import.admPlaceholder": "在此貼上您的 admonition…",
	"import.admBtnCancel": "取消",
	"import.admBtnImport": "匯入",
	"import.err.admNotRecognized":
		"無法辨識的檔案：應為 admonition 清單或 Admonition 的 data.json。",
	"import.err.admNoEntries": "找不到可匯入的 admonition。",
	"import.err.admTypeMissing": '此 admonition 沒有 "type"，已略過。',
	"import.warn.admIconUnknown":
		'在所有圖示庫中都找不到名為 "{{value}}" 的圖示，已改用預設圖示。',
	"import.warn.admIconUnknownExisting":
		'在所有圖示庫中都找不到名為 "{{value}}" 的圖示，因此 "{{id}}" 保留了原有圖示。',
	"import.warn.admImageFailed": "無法讀取上傳的圖片，已改用預設圖示。",
	"import.warn.admIconWithCss":
		"此 admonition 在 Admonition 中由 CSS " +
		"片段設定樣式。該樣式不屬於匯入內容，因此僅匯入了名稱、圖示與顏色。",
	"import.warn.admNoColor": "未設定顏色，已使用預設的藍色。",
	"import.warn.admTitleTruncated":
		"標題長度為 {{length}} 個字元；已縮短至 {{max}}。",

	"footer.tagline": "有反饋、意見或建議？歡迎告訴我！",
	"footer.madeBy": "由 Niv 製作  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		"刪除色盤「{{name}}」？\n1 個 callout 正在使用它。它會保留原有色彩，你之後可以在其編輯器的顏色列重新連結。",
	"settings.deletePaletteConfirmLinked":
		"刪除色盤「{{name}}」？\n{{count}} 個 callout 正在使用它。它們會保留原有色彩，你之後可以在任一編輯器的顏色列重新連結。",
	"settings.unlinkedColors": "未連結色彩",
	"settings.unlinkedColorsDesc":
		"這些 callout 的已儲存色彩已被刪除。它們會保留原有色彩；還原會重新儲存該色彩並重新連結整個群組。",
	"settings.unlinkedColorOne": "1 個 callout",
	"settings.unlinkedColorCount": "{{count}} 個 callout",
	"settings.restoreColor": "還原",
	"settings.palettesMergedNotice":
		"已將 {{count}} 個匯入色盤合併到已儲存且色彩相同的色彩項目中。",
	"notice.palettesMerged":
		"已合併 {{count}} 個色彩完全相同的已儲存色彩：{{names}}。使用它們的 callout 會保留原有色彩，並已連結到保留的色彩。",
	"editor.colorsDescDeleted":
		"此 callout 的已儲存色彩已被刪除。你可以透過{{link}}重新儲存。",
	"editor.colorsDescDeletedOther":
		"此 callout 的已儲存色彩已被刪除。你可以透過{{link}}重新儲存——另外 1 個使用該色彩的 callout 也會重新連結。",
	"editor.colorsDescDeletedOthers":
		"此 callout 的已儲存色彩已被刪除。你可以透過{{link}}重新儲存——另外 {{count}} 個使用該色彩的 callout 也會重新連結。",
	"editor.colorsDescDeletedLink": "點這裡",
	"palette.colorExists":
		"這些色彩與「{{name}}」完全相同。兩個已儲存色彩不能相同——請修改一個色彩以區分它們。",
	"palette.colorExistsUse":
		"這些色彩與「{{name}}」完全相同。兩個已儲存色彩不能相同——請修改一個色彩，或{{link}}。",
	"palette.colorExistsUseLink": "使用現有色彩",
	"locale.downloading": "正在下載翻譯…",
	"locale.notDownloaded": "{{name}} 尚未下載",
	"locale.notDownloadedDesc":
		"在翻譯下載完成前，Callout Studio 會顯示英文。下次啟動 Obsidian 時會重試。",
	"locale.retry": "重試",
	"locale.diskWriteFailed":
		"Callout Studio 無法將翻譯儲存到磁碟，因此下次需要重新下載。",
	"notice.exportedCssCreated": "CSS 片段已儲存到 {{path}}",
	"notice.exportedCssUpdated": "CSS 片段已在 {{path}} 更新",
	"notice.exportedCssUnchanged": "CSS 片段已是最新版本。",
	"notice.exportCssEmpty": "沒有可匯出的自訂 callout。",
	"notice.exportCssFailed":
		"無法儲存 CSS 片段。請查看開發者主控台以瞭解詳情。",
	"notice.exportCssEnabled":
		"此片段已在此儲存庫中啟用。Callout Studio 已經為這些 callout 設定樣式，而片段保留匯出時的樣式。",
	"confirm.titleOverwriteSnippet": "覆寫 CSS 片段",
	"confirm.overwriteSnippet":
		"snippets 資料夾中的 CSS 片段自 Callout Studio 寫入後已變更。再次匯出會取代整個檔案。",
	"confirm.overwriteSnippetOk": "覆寫",
	"export.chooseFormat": "匯出為",
	"export.formatJson": "Callout Studio 備份",
	"export.formatJsonDesc":
		"包含 callout 和設定的 .json 檔案，可匯入其他儲存庫。",
	"export.formatCss": "CSS 片段",
	"export.formatCssDesc":
		"儲存在此儲存庫 snippets 資料夾中的 .css 檔案，可在未安裝 Callout Studio 的地方使用。僅涵蓋一般 callout，是一份快照；變更 callout 後請重新匯出。",
	"quickInsert.readingViewHint": "此筆記以閱讀模式開啟，因此無法插入任何內容。",
	"quickInsert.readingView": "切換到原始碼模式或即時預覽以插入 callout。",
	"quickInsert.noCursorHint": "此筆記中沒有游標，因此沒有可插入的位置。",
	"quickInsert.noCursor": "在筆記中將游標放在要插入 callout 的位置，然後重試。",
};
