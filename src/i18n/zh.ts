export const zh: Record<string, string> = {
	"cmd.openSettings": "打开设置",
	"cmd.createCallout": "创建新的 callout 类型",
	"cmd.insertEmptyCallout": "插入空 callout",
	"cmd.calloutWrap": "用 callout 包裹",
	"cmd.calloutUnwrap": "从 callout 中解包",

	"cmd.customWrapBlock": "用 {{name}} 块 callout 包裹",
	"cmd.customInsertBlock": "插入 {{name}} 块 callout",
	"cmd.customInsertHeading": "插入 H{{level}} {{name}} 标题 callout",
	"cmd.customInsertInline": "插入 {{name}} 行内 callout",
	"cmd.openQuickInsert": "快速插入块级 callout",

	"autocomplete.createNew": '创建新 callout："{{name}}"',

	"settings.fallbackTag": "默认",
	"settings.fallbackTagAuto": "自动默认",
	"settings.rescanVault": "重新扫描库",
	"settings.rescanVaultDesc":
		"查找笔记中未识别的 callout ID 并将其添加为回退行。",
	"settings.rescanVaultHintAction": "立即扫描",
	"settings.rescanComplete": "重新扫描完成：已添加 {{count}} 个新 callout。",
	"replaceModal.deleteWithoutReplaceSuffix": "（回退到默认值）",
	"replaceModal.titleDelete": "删除 callout",
	"replaceModal.titleReplace": "在库中替换",

	"firstRun.title": "在库中查找现有的 callout？",
	"firstRun.body":
		"Callout Studio 可以扫描您的库以发现您已在使用的 callout，使其出现在设置列表中并采用您的回退样式。",
	"firstRun.heavyVaultNote":
		"您的库中有 {{count}} 个 Markdown 文件——扫描可能需要几秒钟。",
	"firstRun.laterHint":
		"您随时可以从「设置 → 库洞察与维护 → 重新扫描库」运行此操作。",
	"firstRun.scanNow": "立即扫描",
	"firstRun.noThanks": "不，谢谢",
	"firstRun.autoScanComplete":
		"Callout Studio 已扫描您的库并添加了 {{count}} 个 callout。",
	"firstRun.scanning": "扫描中",
	"firstRun.autoScanFailed":
		"Callout Studio 未能扫描您的库。您可以从「设置 → 库洞察与维护 → 重新扫描库」重试。",
	"firstRun.scanFailed":
		"扫描未完成。您可以从「设置 → 库洞察与维护 → 重新扫描库」重试。",

	"welcome.tooltip": "关于 Callout Studio",
	"welcome.title": "欢迎使用 Callout Studio",
	"welcome.tagline": "管理 Obsidian callout 的完整解决方案。",
	"welcome.previewTitle": "查看实际效果",
	"welcome.sample":
		"Callout Studio 让您可以创建带有自定义图标、颜色和名称的 callout。\n\n" +
		"同一个 callout 可以用**三**种不同的方式使用：\n\n" +
		"## [!tip] 作为标题\n" +
		"要把任意标题变成 callout 样式的标题，只需在 `#` 后面直接加上 `[!type]`。\n\n" +
		"想要像这样的行内 callout [!warning] 吗？只需在句子中加入 `[!type]`，不会打断您的写作。\n\n" +
		"> [!note] 常规 callout\n" +
		"> 当然，经典的 callout 依然使用您熟悉的语法：`> [!type]`。\n\n" +
		"Callout Studio 还有更多功能等您发现！[了解更多]({{repoUrl}})。\n",

	"deleteModal.title": '删除 callout "{{name}}"？',
	"deleteModal.bodyInUse":
		"此 callout 在 {{files}} 个文件中出现了 {{count}} 次。",
	"deleteModal.bodyInUseExplain":
		"删除后这些块将转换为纯文本——它们将失去样式和 callout 标题。",
	"deleteModal.replaceHint":
		"您可以用另一个 callout 替换它，这样库内容仍保持为带样式的 callout。",
	"deleteModal.bodyUnused":
		'"{{name}}" 未在任何笔记中使用，但它是您自定义的 callout。删除将从列表中移除它。',
	"deleteModal.replaceInstead": "改为替换",
	"deleteModal.deleteInUse": "删除（转为纯文本）",
	"deleteModal.deleteUnused": "删除 callout",

	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": '清除所有 "{{name}}" 的使用？',
	"deleteModal.keepsRowBuiltIn":
		"这是 Obsidian 的内置 callout 之一，因此该类型本身仍可用——只有它在您笔记中的使用会改变。",
	"deleteModal.keepsRowTheme":
		"{{theme}} 定义了此 callout 类型，因此它仍可用并保留其外观。Callout Studio 只更改您库中的笔记——不会触及任何属于您主题的内容。",
	"deleteModal.clearUsages": "清除使用（转换为纯文本）",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "我的 callout 类型",
	"settings.builtInCallouts": "内置 callout",
	"settings.contextMenu": "右键菜单",
	"settings.autocomplete": "自动完成",
	"settings.keyboardShortcuts": "键盘快捷键",
	"settings.language": "语言",
	"settings.languageDesc":
		"Callout Studio 的显示语言。默认跟随 Obsidian 的界面语言。",
	"settings.languageAuto": "自动（跟随 Obsidian）",
	"settings.importExport": "导入 / 导出",
	"settings.import": "导入",
	"settings.export": "导出",
	"settings.importDesc":
		"使用 JSON 文件从另一个库导入您的 Callout Studio 数据。",
	"settings.exportDesc": "以 JSON 格式保存所有自定义 callout 类型。",
	"settings.importConflictNotice":
		"已导入 {{count}} 个 callout 类型；{{overwritten}} 个现有条目已被覆盖。",

	"settings.addNewCallout": "+ 添加新 callout",

	"settings.noCalloutsNow": "当前没有自定义 callout。",

	"settings.editAria": "编辑 {{name}}",
	"settings.moreRowActionsAria": "{{name}} 的更多操作",
	"settings.usageInfo": "在 {{files}} 个文件中使用了 {{count}} 次",
	"settings.replaceAction": "在库中替换",
	"settings.deleteAction": "删除",
	"settings.resetAction": "重置为默认值",
	"settings.makeFallbackAction": "使用默认回退样式",

	"settings.colorSwatchAria": "强调色：{{accent}} · 背景：{{bg}}",

	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "用我自己的 CSS 设置样式",
	"settings.externalCssStopAction": "让 Callout Studio 重新为此设置样式",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "外部 CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "来自主题的 callout",
	"settings.themeCalloutsDesc":
		"{{theme}} 提供或重新设置了这些 callout 的样式，因此 Callout Studio 完全按照主题绘制的样子保留它们，并仅将它们作为 Block callout 提供。这里会显示两种情况：主题添加的 callout 类型，以及主题替换了外观的内置 callout。主题添加的 callout 类型仅在该主题启用时列出。",
	"settings.themeCalloutsDefaultTheme": "您的主题",
	"settings.themePreviewAria": '预览 "{{name}}" — 查看您的主题如何绘制它',
	"settings.clearUsesAction": "清除笔记中的使用",
	"settings.builtInAllThemeStyled":
		"{{theme}} 重新设置了每个内置 callout 的样式，因此它们全部列在上方，Callout Studio 不会干预它们。要设计您自己的样式，请添加一个使用不同 ID 的 callout。",

	"settings.fallbackCallout": "默认回退 callout",
	"settings.fallbackCalloutDesc":
		"库中无法识别的 callout 类型将继承此 callout 的样式。",

	"settings.globalStyle": "全局 callout 样式",
	"settings.border": "边框",
	"settings.borderAll": "全部",
	"settings.borderTop": "顶部",
	"settings.borderRight": "右侧",
	"settings.borderBottom": "底部",
	"settings.borderLeft": "左侧",
	"settings.borderWidth": "边框粗细",
	"settings.fontScaleGroup": "字体缩放",
	"settings.titleScale": "标题",
	"settings.contentScale": "内容",
	"settings.inlineTextScale": "文本",
	"settings.shapeGroup": "形状",
	"settings.borderRadius": "圆角",
	"settings.alignGroup": "对齐",
	"settings.alignContent": "将内容与标题对齐",
	"settings.headingSpacingGroup": "标题间距",
	"settings.headingPadVertical": "垂直间距",
	"settings.headingGap": "标题间距",
	"settings.headingFoldGroup": "折叠",
	"settings.headingFoldArrow": "显示折叠箭头",
	"settings.styleDemoName": "示例",
	"settings.previewTitle": "预览",

	// Settings — Saved color palettes
	"settings.customPalettes": "已保存的调色板",
	"settings.newPalette": "新建调色板",
	"settings.customPalettesEmpty": "当前没有已保存的调色板。",
	"settings.editPaletteAria": "编辑调色板 {{name}}",
	"settings.deletePaletteAria": "删除调色板 {{name}}",
	"settings.deletePaletteConfirm":
		'删除调色板 "{{name}}"？\n使用其颜色的 callout 不受影响。',
	"settings.enableAutocomplete": "启用 [! 自动完成",
	"settings.enableAutocompleteDesc":
		'在编辑器块引用中输入"[!"时显示建议。从列表中选择 callout 类型以插入完整的 callout 标题。',

	"settings.customCommands": "命令与快捷键",
	"settings.customCommandsDesc":
		"查看每个 Callout Studio 命令及其绑定的快捷键，并为您最常用的 callout 创建自己的命令。默认不分配快捷键。",
	"settings.customCommandsButton": "管理命令",

	"commandBuilder.title": "命令与快捷键",
	"commandBuilder.desc":
		"点击「+」按钮以在 Obsidian 的快捷键设置中设置或更改快捷键。",
	"commandBuilder.builtIn": "内置命令",
	"commandBuilder.toggleAria": "开启或关闭 {{name}}",
	"commandBuilder.hotkeyBlank": "空",
	"commandBuilder.hotkeyAria": "为 {{name}} 设置快捷键",
	"commandBuilder.yourCommands": "您的命令",
	"commandBuilder.newCommand": "新建命令",
	"commandBuilder.empty": "还没有自定义命令。",
	"commandBuilder.unknownCommand": "此命令",
	"commandBuilder.editAria": "编辑 {{name}}",
	"commandBuilder.deleteAria": "删除 {{name}}",
	"commandBuilder.deleteConfirm":
		"删除命令 {{name}}？为其分配的快捷键将停止生效。",
	"commandBuilder.newTitle": "新建命令",
	"commandBuilder.editTitle": "编辑命令",
	"commandBuilder.format": "Callout 格式",
	"commandBuilder.formatDesc": "此命令写入的 callout 类型。",
	"commandBuilder.formatHeading": "标题",
	"commandBuilder.formatInline": "行内",
	"commandBuilder.formatBlock": "块",
	"commandBuilder.roleDisabled":
		"此格式已关闭，因此在您重新开启之前，该命令将插入纯文本。",
	"commandBuilder.callout": "Callout 类型",
	"commandBuilder.calloutDesc": "此命令插入的 callout。",
	"commandBuilder.headingLevel": "标题级别",
	"commandBuilder.headingLevelDesc": "要写入的标题级别。",
	"commandBuilder.action": "操作",
	"commandBuilder.actionDesc":
		"「包裹」将选中内容转换为 callout；「插入」添加一个空 callout。",
	"commandBuilder.actionWrap": "包裹所选内容",
	"commandBuilder.actionInsert": "插入新的",
	"commandBuilder.preview": "命令名称",
	"commandBuilder.duplicate": "您已经有一个执行完全相同操作的命令。",
	"commandBuilder.noCallouts": "目前还没有可用于创建命令的 callout 类型。",
	"commandBuilder.save": "保存",

	"commandBuilder.roleThemeOwned":
		"您的主题提供了此 callout，因此它只有 Block 格式。",
	"commandBuilder.commandSuspended":
		"已暂停：您的主题提供了此 callout，因此它只有 Block 格式。当主题不再提供它时，此命令将重新生效。",

	"settings.vaultMaintenance": "库洞察与维护",
	"settings.vaultStats": "Callout 统计",
	"settings.vaultStatsDesc":
		"统计 Markdown 笔记中的每个 callout（块级、标题和行内）并按类型分组。",
	"settings.vaultStatsButton": "查看统计",
	"settings.vaultStatsScanning": "扫描中",
	"settings.resetAll": "重置",
	"settings.resetAllDesc":
		"删除所有用户 callout，重置内置 callout、全局样式（边框、字体缩放、形状）、已保存的调色板、右键菜单自定义设置和已下载的 Material SVG。",
	"settings.resetAllButton": "重置所有内容",
	"settings.resetAllConfirm":
		"此操作将删除所有自定义 callout，重置内置 callout、全局样式、已保存的调色板、右键菜单自定义设置和所有缓存的 Material SVG。此操作无法撤销。确定吗？",
	"notice.resetAllDone": "所有内容已重置为默认值。",

	"notice.customCommandsRemoved":
		"已移除 {{count}} 个 callout 类型已不存在的自定义命令。",
	"notice.customCommandMissingCallout": "该命令的 callout 类型已不存在。",
	"notice.exported": "Callout 已导出到 callout-studio-export.json",
	"notice.importedJSON": "已从 JSON 导入 {{count}} 个 callout 类型。",
	"notice.importedSettings": "已导入插件设置。",
	"notice.importedCalloutManager":
		"已从 Callout Manager 导入：创建了 {{created}} 个，更新了 {{updated}} 个。",
	"notice.importedAdmonition":
		"已从 Admonition 导入：新建 {{created}} 个，更新 {{updated}} 个。",
	"notice.noNewJSON": "未导入新的 callout 类型（ID 可能已存在）。",
	"notice.iconDownloadFailed":
		'无法下载 Material 图标"{{name}}"。该图标可能不支持此样式/字重，或您的网络连接已断开。',

	"notice.externalCssOn":
		'Callout Studio 不再为 "{{name}}" 设置样式——由您自己的 CSS 决定它的外观。它的标题 callout 和行内 callout 形式将不会渲染。',
	"notice.externalCssOff": 'Callout Studio 现在再次为 "{{name}}" 设置样式。',

	"notice.nothingToWrap": "没有可包裹的内容。",
	"notice.cursorNotInsideCallout": "光标不在 callout 内部。",
	"notice.autocompleteTargetMoved":
		"未插入任何内容 — 编辑器打开期间该行已更改。",
	"notice.openHotkeysFailed": "无法打开 Obsidian 快捷键设置。",
	"notice.filterHotkeysFailed":
		"已打开 Obsidian 快捷键，但无法应用 Callout Studio 过滤器。",

	"editor.editCallout": "编辑 callout",
	"editor.newCallout": "新建 callout",
	"editor.displayName": "显示名称",
	"editor.displayNameDesc": "在 UI 中显示的可读标签",
	"editor.displayNameBuiltIn": "内置 callout 的显示名称无法更改",
	"editor.displayNamePlaceholder": "我的 callout",
	"editor.calloutIds": "Callout ID",
	"editor.calloutIdsDesc":
		"此 callout 的所有标识符。允许使用空格。\n按 Enter 或 + 按钮添加。",
	"editor.calloutIdsPlaceholder": "添加 ID",
	"editor.addId": "添加 ID",
	"editor.idLinkedToName": "已关联到显示名称",
	"editor.idCannotDelete":
		"此 ID 已关联到显示名称，无法删除——请编辑名称以更改",
	"editor.icon": "图标",
	"editor.pickIcon": "更改图标",
	"editor.replaceIcon": "替换图标",
	"editor.removeIcon": "移除图标",
	"editor.noIcon": "无图标",
	"editor.resetIcon": "重置图标为默认",
	"editor.livePreview": "实时预览",
	"editor.iconAdjustment": "图标调整",
	"editor.picture": "图片",
	"editor.size": "大小",
	"editor.horizontalOffset": "水平偏移",
	"editor.verticalOffset": "垂直偏移",
	"editor.colors": "颜色",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "重置颜色为默认",
	"editor.paletteDeleted": "已删除的颜色",
	"editor.paletteGroupObsidian": "Obsidian callout",
	"editor.paletteGroupPresets": "颜色预设",
	"editor.paletteGroupCustom": "自定义",
	"editor.paletteNewColor": "新建颜色…",
	"editor.contrastWarning": "与背景对比度过低——可能难以阅读",
	"editor.foldable": "可折叠",
	"editor.foldableDesc":
		"选择 callout 是否可折叠以及在整个库中应用的默认状态。",
	"editor.foldOff": "关闭",
	"editor.foldOpen": "默认展开",
	"editor.foldClosed": "默认折叠",
	"editor.cancel": "取消",
	"editor.saveChanges": "保存更改",
	"editor.createCallout": "创建 callout",
	"editor.nameRequired": "创建 callout 前需要提供显示名称。",
	"editor.noChangesToSave": "没有做任何更改。",
	"editor.downloadingIcon": "正在下载图标",
	"editor.idEmpty": "至少需要一个 ID",
	"editor.idExists": "已存在具有此 ID 的 callout",
	"editor.idConflict": "此 ID 与现有 callout 冲突",
	"editor.idDashConflict":
		'Obsidian 会将空格写为连字符，因此此 ID 与 "{{other}}" 冲突',

	"editor.idFromTheme":
		"{{theme}} 已经提供了具有此 ID 的 callout，因此 Callout Studio 无法为其设置样式。请选择其他 ID。",
	"editor.idThemePattern":
		"提示：您的主题会为每个匹配 {{pattern}} 的 callout 设置样式，因此它可能会覆盖此 callout 的外观。",

	"editor.untitledCallout": "未命名 Callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet，consectetur adipiscing elit。",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet，consectetur adipiscing elit。",
	"editor.sampleInlineText": "这是一个嵌入在段落中的行内 [!{id}] 徽标。",
	"editor.previewReadOnly": "实时预览无法编辑",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — 由您的主题提供',
	"themePreview.owned":
		'{{theme}} 提供并设置了 "{{name}}" 的样式。Callout Studio 不会覆盖它，因此其 Block callout 的外观与您主题绘制的完全一致。',
	"themePreview.readOnly":
		"这意味着它的颜色、图标、名称和 ID 在此处无法更改。如果您想要自己的设计，请创建一个使用不同 ID 的新 callout。",
	"themePreview.blockOnly":
		"标题和行内格式不适用于您主题提供的 callout。Block callout 使用主题的原生样式。",
	"themePreview.previewTitle": "当前的渲染效果",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> 这是该 callout 内容的显示效果。\n",

	"editor.externalStyleClose": "知道了",

	// Palette editor modal
	"palette.newTitle": "新建调色板",
	"palette.groupPalette": "调色板",
	"palette.editTitle": "编辑调色板",
	"palette.name": "名称",
	"palette.namePlaceholder": "我的调色板",
	"palette.nameExists": "已存在同名的调色板",
	"palette.baseColor": "基础颜色",
	"palette.baseColorHint":
		"我们会自动将背景颜色与之匹配。如果需要，您可以通过{{link}}单独控制它。",
	"palette.baseColorHintLink": "点击此处",
	"palette.advancedColors": "颜色",
	"palette.advancedColorsHint":
		"正在编辑{{mode}}模式的颜色 - 另一模式会自动更新。切换 Obsidian 主题以进行检查。",
	"palette.revertHint": "更喜欢使用单一基础颜色？{{link}}。",
	"palette.revertHintLink": "还原",
	"palette.lightMode": "浅色",
	"palette.darkMode": "深色",
	"palette.accentColor": "强调色",
	"palette.backgroundColorChannel": "背景颜色",
	"palette.textColorChannel": "文本颜色",
	"palette.bgIntensity": "强度",
	"palette.bgStyle": "样式",
	"palette.bgSolid": "纯色",
	"palette.bgGradient": "渐变",
	"palette.bgTransparent": "透明",
	"palette.gradientTo": "第二种颜色",
	"palette.gradientDirection": "方向",
	"palette.gradientText": "标题文字渐变",
	"palette.save": "保存",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "红色",
	"colorName.orange": "橙色",
	"colorName.amber": "琥珀色",
	"colorName.yellow": "黄色",
	"colorName.lime": "青柠色",
	"colorName.green": "绿色",
	"colorName.teal": "蓝绿色",
	"colorName.cyan": "青色",
	"colorName.sky": "天蓝色",
	"colorName.blue": "蓝色",
	"colorName.indigo": "靛蓝色",
	"colorName.violet": "紫罗兰色",
	"colorName.purple": "紫色",
	"colorName.pink": "粉色",
	"colorName.rose": "玫瑰色",
	"colorName.brown": "棕色",
	"colorName.gray": "灰色",
	"colorName.black": "黑色",
	"colorName.white": "白色",
	"colorName.crimson": "深红色",
	"colorName.coral": "珊瑚色",
	"colorName.grape": "葡萄色",
	"colorName.plum": "梅子色",
	"colorName.bubblegum": "泡泡糖色",

	"iconPicker.pickIcon": "选择图标",
	"iconPicker.confirm": "确认",
	"iconPicker.cancel": "取消",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "搜索 Lucide 图标",
	"iconPicker.searchTabler": "搜索 Tabler 图标",
	"iconPicker.tablerStyle": "图标样式",
	"iconPicker.tablerStyleOutline": "线框",
	"iconPicker.tablerStyleFilled": "实心",
	"iconPicker.loadMore": "加载更多",
	"iconPicker.materialStyle": "图标样式",
	"iconPicker.materialStyleOutlined": "线框 (Outlined)",
	"iconPicker.materialStyleFilled": "实心 (Filled)",
	"iconPicker.materialStyleRounded": "圆润 (Rounded)",
	"iconPicker.materialStyleSharp": "尖锐 (Sharp)",
	"iconPicker.materialWeight": "图标粗细",
	"iconPicker.materialWeight100": "纤细 (Thin)",
	"iconPicker.materialWeight200": "特细 (Extra Light)",
	"iconPicker.materialWeight300": "细 (Light)",
	"iconPicker.materialWeight400": "常规 (Regular)",
	"iconPicker.materialWeight500": "中等 (Medium)",
	"iconPicker.materialWeight600": "半粗 (Semi Bold)",
	"iconPicker.materialWeight700": "粗体 (Bold)",
	"iconPicker.materialFontFailed":
		"无法加载 Material 图标预览。将改为显示图标名称——搜索和选择仍可正常工作。",
	"iconPicker.materialFontRetry": "重试",
	"iconPicker.searchMaterial": "搜索 Material 图标",
	"iconPicker.searchEmoji": "搜索表情符号",
	"iconPicker.skinTone": "肤色",
	"iconPicker.allCategories": "所有分类",
	"iconPicker.noIconSelected": "未选择图标",
	"iconPicker.noResults": "没有图标匹配您的搜索。",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "搜索 Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "搜索 Font Awesome",
	"iconPicker.faStyle": "图标样式",
	"iconPicker.faStyleSolid": "实心",
	"iconPicker.faStyleRegular": "常规",
	"iconPicker.faStyleBrands": "品牌",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "搜索 RPG Awesome",
	"iconPicker.image": "您的图片",
	"iconPicker.searchImage": "搜索您的图片",
	"iconPicker.imageTooLarge": "{{name}} 太大。图片必须小于 5 MB。",
	"iconPicker.imageUnsupported":
		"{{name}} 不是受支持的图片格式。请使用 SVG、PNG、JPEG 或 WebP。",
	"iconPicker.imageInvalidSvg":
		"{{name}} 无法作为安全的 SVG 读取，因此未添加。",
	"iconPicker.imageDecodeFailed": "{{name}} 无法作为图片读取。",
	"iconPicker.imageDuplicate":
		"{{name}} 已在您的图片中。请重命名文件或删除已有的图片。",
	"iconPicker.imageAdd": "添加图片",
	"iconPicker.imageEmpty":
		"还没有图片。从您的计算机添加 SVG、PNG、JPEG 或 WebP 文件，或将其拖到此处。",
	"iconPicker.imageDelete": "删除",
	"iconPicker.imageDeleteConfirm": "删除“{{name}}”？",
	"iconPicker.imageDeleteInUse":
		"{{count}} 个 callout 使用了这张图片。在您提供新图片之前，它们将显示占位图标。",
	"iconPicker.imageRecolor": "跟随 Callout 颜色",
	"iconPicker.allSources": "所有来源",
	"iconPicker.searchAllSources": "搜索所有图标来源",
	"iconPicker.sourcesNotDownloaded":
		"尚未包含：{{names}}。请在上方选择来源以下载。",
	"iconPicker.chooseSource": "选择来源",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "同时搜索所有图标库",
	"iconPicker.descLucide": "Obsidian 自有图标集，始终离线可用",
	"iconPicker.descTabler": "简洁统一的界面图标，线框和实心",
	"iconPicker.descMaterial": "Google 图标集，四种样式和七种粗细",
	"iconPicker.descEmoji": "彩色字形，每种肤色",
	"iconPicker.descOcticons": "GitHub 界面图标",
	"iconPicker.descFa": "实心、常规和品牌",
	"iconPicker.descRpgAwesome": "奇幻和桌游图标",
	"iconPicker.descImage": "从您的计算机添加的图片",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "无障碍功能",
	"iconPicker.cat.Actions": "操作",
	"iconPicker.cat.Activities": "活动",
	"iconPicker.cat.Alert": "警报",
	"iconPicker.cat.Alphabet": "字母",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "动物",
	"iconPicker.cat.Arrows": "箭头",
	"iconPicker.cat.Astronomy": "天文学",
	"iconPicker.cat.Audio&Video": "音频与视频",
	"iconPicker.cat.Automotive": "汽车",
	"iconPicker.cat.Badges": "徽章",
	"iconPicker.cat.Brand": "品牌",
	"iconPicker.cat.Buildings": "建筑",
	"iconPicker.cat.Business": "商务",
	"iconPicker.cat.Camping": "露营",
	"iconPicker.cat.Charity": "慈善",
	"iconPicker.cat.Charts": "图表",
	"iconPicker.cat.Charts + Diagrams": "图表与示意图",
	"iconPicker.cat.Childhood": "童年",
	"iconPicker.cat.Clothing + Fashion": "服装与时尚",
	"iconPicker.cat.Coding": "编程",
	"iconPicker.cat.Communicate": "交流",
	"iconPicker.cat.Communication": "通讯",
	"iconPicker.cat.Computers": "电脑",
	"iconPicker.cat.Connectivity": "连接",
	"iconPicker.cat.Construction": "建筑施工",
	"iconPicker.cat.Currencies": "货币",
	"iconPicker.cat.Database": "数据库",
	"iconPicker.cat.Design": "设计",
	"iconPicker.cat.Development": "开发",
	"iconPicker.cat.Devices": "设备",
	"iconPicker.cat.Devices + Hardware": "设备与硬件",
	"iconPicker.cat.Disaster + Crisis": "灾难与危机",
	"iconPicker.cat.Document": "文档",
	"iconPicker.cat.E-commerce": "电子商务",
	"iconPicker.cat.Editing": "编辑",
	"iconPicker.cat.Education": "教育",
	"iconPicker.cat.Electrical": "电气",
	"iconPicker.cat.Emoji": "表情符号",
	"iconPicker.cat.Energy": "能源",
	"iconPicker.cat.Extensions": "扩展",
	"iconPicker.cat.Files": "文件",
	"iconPicker.cat.Film + Video": "影视",
	"iconPicker.cat.Food": "食物",
	"iconPicker.cat.Food + Beverage": "食品与饮料",
	"iconPicker.cat.Fruits + Vegetables": "水果与蔬菜",
	"iconPicker.cat.Games": "游戏",
	"iconPicker.cat.Gaming": "游戏娱乐",
	"iconPicker.cat.Gender": "性别",
	"iconPicker.cat.Genders": "性别",
	"iconPicker.cat.Gestures": "手势",
	"iconPicker.cat.Halloween": "万圣节",
	"iconPicker.cat.Hands": "手",
	"iconPicker.cat.Hardware": "硬件",
	"iconPicker.cat.Health": "健康",
	"iconPicker.cat.Holidays": "节日",
	"iconPicker.cat.Home": "家庭",
	"iconPicker.cat.Household": "家居",
	"iconPicker.cat.Humanitarian": "人道主义",
	"iconPicker.cat.Images": "图片",
	"iconPicker.cat.Laundry": "洗衣",
	"iconPicker.cat.Letters": "字母",
	"iconPicker.cat.Logic": "逻辑",
	"iconPicker.cat.Logistics": "物流",
	"iconPicker.cat.Map": "地图",
	"iconPicker.cat.Maps": "地图",
	"iconPicker.cat.Maritime": "航海",
	"iconPicker.cat.Marketing": "营销",
	"iconPicker.cat.Math": "数学",
	"iconPicker.cat.Mathematics": "数学",
	"iconPicker.cat.Media": "媒体",
	"iconPicker.cat.Media Playback": "媒体播放",
	"iconPicker.cat.Medical + Health": "医疗与健康",
	"iconPicker.cat.Money": "金钱",
	"iconPicker.cat.Mood": "情绪",
	"iconPicker.cat.Moving": "搬家",
	"iconPicker.cat.Music + Audio": "音乐与音频",
	"iconPicker.cat.Nature": "自然",
	"iconPicker.cat.Numbers": "数字",
	"iconPicker.cat.Photography": "摄影",
	"iconPicker.cat.Photos + Images": "照片与图片",
	"iconPicker.cat.Political": "政治",
	"iconPicker.cat.Privacy": "隐私",
	"iconPicker.cat.Punctuation + Symbols": "标点与符号",
	"iconPicker.cat.Religion": "宗教",
	"iconPicker.cat.Science": "科学",
	"iconPicker.cat.Science Fiction": "科幻",
	"iconPicker.cat.Security": "安全",
	"iconPicker.cat.Shapes": "形状",
	"iconPicker.cat.Shopping": "购物",
	"iconPicker.cat.Social": "社交媒体",
	"iconPicker.cat.Spinners": "加载图标",
	"iconPicker.cat.Sport": "运动",
	"iconPicker.cat.Sports + Fitness": "运动与健身",
	"iconPicker.cat.Symbols": "符号",
	"iconPicker.cat.System": "系统",
	"iconPicker.cat.Text": "文本",
	"iconPicker.cat.Text Formatting": "文本格式",
	"iconPicker.cat.Time": "时间",
	"iconPicker.cat.Toggle": "切换",
	"iconPicker.cat.Transit": "公共交通",
	"iconPicker.cat.Transportation": "交通运输",
	"iconPicker.cat.Travel": "旅行",
	"iconPicker.cat.Travel + Hotel": "旅行与酒店",
	"iconPicker.cat.UI actions": "界面操作",
	"iconPicker.cat.Users + People": "用户与人物",
	"iconPicker.cat.Vehicles": "车辆",
	"iconPicker.cat.Version control": "版本控制",
	"iconPicker.cat.Weather": "天气",
	"iconPicker.cat.Writing": "写作",
	"iconPicker.cat.Zodiac": "星座",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} 尚未下载",
	"iconPack.downloadDetail": "{{count}} 个图标 · {{size}} · 一次性下载",
	"iconPack.download": "下载",
	"iconPack.downloading": "正在下载 {{name}}…",
	"iconPack.downloadFailed": "无法下载 {{name}}。请检查网络连接后重试。",
	"iconPack.retry": "重试",
	"iconPack.faBrandsNotice":
		"品牌图标是其各自所有者的商标。包含这些图标并不表示认可。请仅将其用于代表所指的公司、产品或服务。",
	"iconPack.artworkRestored": "已下载 {{names}} 的图标图稿。",
	"iconPack.diskWriteFailed":
		"Callout Studio 无法将图标包保存到磁盘，下次需要重新下载。您选择的图标仍已保存在您的设置中。",

	// Icon licences & credits
	"credits.title": "图标许可证与致谢",
	"credits.intro":
		"Callout Studio 使用了多个开源图标库。其许可证以及为在此使用所做的更改均已在下方列出。",
	"credits.fullNotices": "完整的第三方声明",
	"credits.pluginLicense":
		"Callout Studio 自身代码采用 permissive 许可证；图标库保留各自的许可证。",

	"contextMenu.editCallout": "编辑 callout 设置",
	"contextMenu.copyMarkdown": "复制 callout Markdown",
	"contextMenu.openSettings": "打开 Callout Studio 设置",
	"contextMenu.setFoldClosed": "将 callout 设置为关闭 (-)",
	"contextMenu.setFoldOpen": "将 callout 设置为打开 (+)",
	"contextMenu.setFoldNone": "使 callout 不可折叠",
	"contextMenu.cutSection": "剪切标题部分",
	"contextMenu.copySection": "复制标题部分",
	"contextMenu.deleteSection": "删除标题部分",

	"heading.toggleFold": "切换折叠",

	"settings.globalSettings": "Callout Studio 样式选项",
	"settings.globalSettingsScope":
		"Callout Studio 所设置样式的 callout 的形状、间距和大小。您主题设置样式的 callout 保留主题自身的设计。",
	"settings.globalSettingsRegularDesc":
		"在引用块中添加 callout 标记（例如 `> [!type]`）以显示为 Obsidian 原生的 callout 框。您可以调整其边框、圆角、字体缩放和对齐方式。",
	"settings.globalSettingsHeadingDesc":
		"在标题井号后直接添加 callout 标记（例如 `## [!type]`）以将其显示为带样式的 callout 标题。您可以调整其边框、形状和垂直间距。",
	"settings.globalSettingsInlineDesc":
		"在文本行中的任意位置添加 callout 标记（例如 `[!type]`）以将其显示为小型行内徽标。您可以调整其边框和形状。",
	"settings.globalSettingsCustomize": "自定义",

	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "标题 callout",
	"settings.calloutTypeInline": "行内 callout",

	"settings.customizeMenu": "自定义菜单项",
	"settings.customizeMenuDesc":
		"选择每种 callout 类型显示哪些右键操作，并调整它们的顺序。 在源代码模式和实时预览中均有效。",
	"settings.customizeMenuButton": "自定义菜单项",
	"menuCustomize.title": "自定义右键菜单",
	"menuCustomize.desc":
		"启用或禁用操作，并拖动手柄调整顺序。更改会自动保存。",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "标题 callout",
	"menuCustomize.inline": "行内 callout",
	"menuCustomize.dragHandle": "拖动以重新排序",
	"menuItem.edit": "编辑 callout",
	"menuItem.openSettings": "打开设置",
	"menuItem.copyMarkdown": "复制 Markdown",
	"menuItem.foldDefaults": "折叠默认值（展开 / 折叠 / 无）",
	"menuItem.cutSection": "剪切部分",
	"menuItem.copySection": "复制部分",
	"menuItem.deleteSection": "删除部分",

	"confirm.ok": "删除",
	"confirm.cancel": "取消",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "删除命令",
	"confirm.titleResetAll": "重置所有 callout",
	"confirm.titleResetCallout": "重置 callout",
	"confirm.titleDeletePalette": "删除调色板",
	"confirm.titleDeleteImage": "删除图片",

	"vault.filesUpdated": "已更新库文件中的 {{count}} 个 callout 引用。",
	"vault.idsUpdated":
		"已更新库文件中的 {{count}} 个 callout ID：{{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"已更新库文件中的 {{count}} 个 callout 标题：{{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "替换为：",
	"vault.deleteWithout": "直接删除",
	"vault.confirmDelete": "确认",
	"vault.confirmReplace": "替换",
	"vault.replacePromptInUse":
		'"{{name}}" 在 {{files}} 个文件中被使用了 {{count}} 次。选择替换它的 callout：',
	"vault.replacePromptUnused": '选择替换"{{name}}"的 callout：',
	"vault.noReplacementAvailable": "没有其他可用的 callout 来替换此项。",
	"vault.convertedToPlainText":
		"已将 {{files}} 个文件中的 {{blocks}} 个 callout 块转换为纯文本。",
	"vault.resetAliasWarning":
		"{{files}} 个文件中有 {{count}} 个引用使用了自定义别名：{{aliases}}。重置后这些别名将失效。继续？",
	"vault.resetConfirm": "重置",
	"vault.resetAllInUse":
		"⚠ {{files}} 个文件中有 {{count}} 个 callout 引用使用了将被删除的自定义 callout 类型。",

	"quickInsert.title": "快速插入块级 callout",
	"quickInsert.desc": "选择要插入光标位置的 callout。仅限块级 callout。",
	"quickInsert.searchPlaceholder": "搜索 callout",
	"quickInsert.sourceAria": "按 callout 来源筛选",
	"quickInsert.sourceAll": "全部",
	"quickInsert.sourceBuiltIn": "内置",
	"quickInsert.sourceUser": "我的 callout",
	"quickInsert.editAria": "编辑 {{name}}",
	"quickInsert.insertAria": "将 {{name}} 作为块级 callout 插入",
	"quickInsert.noResults": "未找到 callout",
	"quickInsert.noUserCallouts": "您还没有创建任何 callout。",
	"quickInsert.noEditorHint": "没有笔记以编辑模式打开，因此无法插入任何内容。",
	"quickInsert.noEditor": "以编辑模式打开一篇笔记来插入 callout。",

	"vaultStats.title": "Callout 统计",
	"vaultStats.totalCallouts": "Callout 总数",
	"vaultStats.typesFound": "发现的类型",
	"vaultStats.filesWithCallouts": "包含 callout 的文件",
	"vaultStats.filesScanned": "已扫描的 Markdown 文件",
	"vaultStats.empty": "在 Markdown 笔记中未找到 callout。",
	"vaultStats.columnType": "类型",
	"vaultStats.columnName": "名称",
	"vaultStats.columnSource": "来源",
	"vaultStats.columnCount": "数量",
	"vaultStats.columnFiles": "文件",
	"vaultStats.unknown": "未知",
	"vaultStats.sourceBuiltIn": "内置",
	"vaultStats.sourceCustom": "自定义",
	"vaultStats.sourceAutoFallback": "自动回退",
	"vaultStats.sourceTheme": "CSS 片段",
	"vaultStats.sourceAlias": "{{id}} 的别名",
	"vaultStats.sourceUnknown": "未知",
	"vaultStats.byRole": "写作形式",
	"vaultStats.roleBlock": "块级",
	"vaultStats.roleHeading": "标题",
	"vaultStats.roleInline": "行内",
	"vaultStats.defineUndefined": "定义 {{count}} 个缺失项",
	"vaultStats.defineRunning": "扫描中",
	"vaultStats.defineDone": "已添加 {{count}} 种 callout 类型。",
	"vaultStats.close": "关闭",

	"import.title": "导入问题",
	"import.reportLeadIn": "看起来您导入的文件已被修改。以下是问题列表：",
	"import.reportLeadInFatal":
		"此文件看起来不像 Callout Studio 的导出文件，无法导入：",
	"import.entryHeading": "条目 {{index}} — {{label}}",
	"import.summary":
		"{{total}} 个条目中 {{valid}} 个有效 · 发现 {{issues}} 个问题。",
	"import.btnCancel": "取消",
	"import.btnImportValid": "仅导入有效项（{{count}} 个）",
	"import.err.notRecognized":
		"无法识别的文件：应为 callout 定义数组或 Callout Studio 导出文件。",
	"import.warn.settingsIgnored": "设置块不是有效的对象，已被忽略。",
	"import.warn.invalidGradient": "背景渐变无效，已被忽略。",
	"import.err.parseFailed": "文件不是有效的 JSON，无法解析。",
	"import.err.entryNotObject": "条目必须是对象。",
	"import.err.requiredMissing": '必填字段"{{field}}"缺失或类型错误。',
	"import.err.idEmpty": "ID 不能为空。",
	"import.err.idTooLong":
		'ID"{{value}}"长度为 {{length}} 个字符；最大值为 {{max}}。',
	"import.err.idBadChar":
		'ID"{{value}}"包含无效字符（不允许使用"|"、"["、"]"、制表符和换行符）。',
	"import.err.idMetadata":
		'ID"{{value}}"包含"|"。在 Obsidian 中，第一个"|"后面的所有内容都是 callout 元数据，而非类型的一部分，因此此条目描述的是“{{id}}”callout。已跳过，您现有的“{{id}}”保持不变。',
	"import.err.displayNameEmpty": "显示名称不能为空。",
	"import.err.displayNameTooLong":
		"显示名称长度为 {{length}} 个字符；最大值为 {{max}}。",
	"import.err.boolField": '"{{field}}"必须是布尔值（true 或 false）。',
	"import.err.iconNotObject": "图标必须是对象。",
	"import.err.iconTypeInvalid":
		"图标类型“{{value}}”不是以下之一：{{types}}。",
	"import.warn.iconFieldIgnored":
		'"{{field}}" 仅适用于 Material 图标，对于图标类型 {{type}} 将被忽略。',
	"import.err.iconValueEmpty": "图标值必须是非空字符串。",
	"import.err.iconValueTooLong": "图标值异常过长（{{length}} 个字符）。",
	"import.err.materialStyle":
		'Material 图标样式"{{value}}"不是以下之一：outlined、filled、rounded、sharp。',
	"import.err.materialWeight":
		'Material 图标粗细"{{value}}"必须是 100 到 700 之间的整数，步长为 100。',
	"import.warn.iconRecolorIgnored":
		'"recolor" 仅适用于您自己的图片，对于图标类型 {{type}} 将被忽略。',
	"import.err.iconRecolorInvalid":
		'"recolor" 必须为 true 或 false（收到：“{{value}}”)。',
	"import.err.colorInvalid":
		'"{{field}}"必须是如"#448aff"的十六进制颜色（收到"{{value}}"）。',
	"import.err.numberRange":
		'"{{field}}"必须是 {{min}} 到 {{max}} 之间的数字（收到"{{value}}"）。',
	"import.err.iconSizeRange":
		'"{{field}}"必须是 {{min}} 到 {{max}} 之间的数字（收到"{{value}}"）。',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases"必须是字符串数组。',
	"import.err.aliasNotString": "别名必须是字符串。",
	"import.err.aliasDup": '"{{value}}"别名在此条目中重复。',
	"import.err.tooManyIds":
		"ID 过多（{{count}} 个）；每个 callout 最多可以有 {{max}} 个 ID（主 ID + 别名）。",
	"import.err.metadataShape": '"metadata"必须是一个值全为字符串的对象。',
	"import.warn.unknownFields": "忽略了未知字段：{{fields}}。",
	"import.err.duplicateInFile":
		'ID/别名"{{value}}"已被此文件中的条目 #{{first}} 使用。',
	"import.err.aliasConflict":
		'别名"{{value}}"已被库中的另一个 callout（"{{other}}"）使用。',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded"为 true 而"foldable"为 false；defaultFolded 已重置为 false。',
	"import.warn.imageMissing":
		"此 Callout 使用的图片不在文件中也不在此 vault 中，因此将显示占位图标，直到您提供新图片。",

	"import.err.paletteIdInvalid":
		'"paletteId" 必须是非空文本 ID（收到了 "{{value}}")。',
	"import.warn.iconNameUnknown":
		'"{{value}}" 图标在 {{type}} 中不存在，因此使用了默认图标。',
	"import.warn.cmIconUnknownNew":
		'"{{value}}" 图标在此 vault 中不可用，因此使用了默认图标。',
	"import.warn.cmIconUnknownExisting":
		'"{{value}}" 图标在此 vault 中不可用，因此 "{{id}}" 保留了它原有的图标。',
	"import.chooseSource": "从以下位置导入",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc": "加载从 Callout Studio 导出的 .json 文件。",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"从 Callout Manager 插件导入您自定义的 callout。",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"从 Admonition 插件中导入您的自定义 admonition。",
	"import.cmTitle": "从 Callout Manager 导入",
	"import.cmInstructions":
		"每个自定义 callout 都会连同其图标和颜色一起导入。分主题样式和自定义 CSS 在此没有对应项，不会被导入。",
	"import.cmFromVault": "此 vault",
	"import.cmVaultChecking": "正在查找 Callout Manager 插件…",
	"import.cmVaultFound": "找到 {{count}} 个自定义 callout。",
	"import.cmVaultNotFound": "在此 vault 中未找到任何自定义 callout。",
	"import.cmPasteLabel": "或将 Callout Manager 复制的样式粘贴到此处：",
	"import.cmPlaceholder": "在此粘贴复制的样式，或一个 data.json 文件…",
	"import.cmBtnCancel": "取消",
	"import.cmBtnImport": "导入",
	"import.err.cmNoBlocksFound": "在粘贴的文本中未找到 Callout Manager 样式。",
	"import.err.cmNotRecognized":
		"无法识别的文件：应为 Callout Manager 的 Copy 按钮生成的样式，或一个 Callout Manager 的 data.json 文件。",
	"import.err.cmNoEntries": "未找到可导入的自定义 callout。",
	"import.err.cmNoColorForNew":
		'未找到适用于新 callout "{{value}}" 的可用颜色；已跳过。',
	"import.err.cmIdConflict":
		'ID "{{value}}" 已被另一个 callout ("{{other}}") 用作别名，已跳过。',
	"import.warn.cmNoColorDefault":
		"Callout Manager 中未设置颜色，因此使用了默认的灰色。",
	"import.warn.cmThemeCondition":
		"此 callout 的颜色或图标仅针对一个主题设置。Callout Studio 没有分主题样式，因此已将其应用于所有主题。",
	"import.warn.cmCustomStyles":
		"此 callout 在 Callout Manager 中还有自定义 CSS。该样式不在导入范围内，因此仅导入了图标和颜色。",

	// Import — Admonition
	"import.admTitle": "从 Admonition 导入",
	"import.admInstructions":
		"每个 admonition 都会作为 callout 导入，保留其名称、图标和颜色。Callout Studio " +
		"没有对应功能的设置（命令、复制按钮、隐藏标题）不会被导入。",
	"import.admFromVault": "本仓库",
	"import.admVaultChecking": "正在查找 Admonition 插件…",
	"import.admVaultFound": "找到 {{count}} 个自定义 admonition。",
	"import.admVaultNotFound": "在本仓库中未找到自定义 admonition。",
	"import.admFromFile": "文件",
	"import.admFromFileDesc": "admonitions.json 文件，或共享的图标包。",
	"import.admChooseFile": "选择文件…",
	"import.admPasteLabel": "或在此粘贴 JSON：",
	"import.admPlaceholder": "在此粘贴您的 admonition…",
	"import.admBtnCancel": "取消",
	"import.admBtnImport": "导入",
	"import.err.admNotRecognized":
		"无法识别的文件：应为 admonition 列表或 Admonition 的 data.json。",
	"import.err.admNoEntries": "未找到可导入的 admonition。",
	"import.err.admTypeMissing": '此 admonition 没有 "type"，已跳过。',
	"import.warn.admIconUnknown":
		'在所有图标库中都未找到名为 "{{value}}" 的图标，已改用默认图标。',
	"import.warn.admIconUnknownExisting":
		'在所有图标库中都未找到名为 "{{value}}" 的图标，因此 "{{id}}" 保留了原有图标。',
	"import.warn.admImageFailed": "无法读取上传的图片，已改用默认图标。",
	"import.warn.admIconWithCss":
		"此 admonition 在 Admonition 中由 CSS " +
		"片段设置样式。该样式不属于导入内容，因此仅导入了名称、图标和颜色。",
	"import.warn.admNoColor": "未设置颜色，已使用默认的蓝色。",
	"import.warn.admTitleTruncated":
		"标题长度为 {{length}} 个字符；已缩短至 {{max}}。",

	"footer.tagline": "有反馈、意见或建议？欢迎告诉我！",
	"footer.madeBy": "由 Niv 制作  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		"删除调色板“{{name}}”？\n1 个 callout 正在使用它。它会保留原有颜色，你之后可以在其编辑器的颜色行重新关联。",
	"settings.deletePaletteConfirmLinked":
		"删除调色板“{{name}}”？\n{{count}} 个 callout 正在使用它。它们会保留原有颜色，你之后可以在任一编辑器的颜色行重新关联。",
	"settings.unlinkedColors": "未关联颜色",
	"settings.unlinkedColorsDesc":
		"这些 callout 的已保存颜色已被删除。它们会保留原有颜色；恢复会重新保存该颜色并重新关联整个组。",
	"settings.unlinkedColorOne": "1 个 callout",
	"settings.unlinkedColorCount": "{{count}} 个 callout",
	"settings.restoreColor": "恢复",
	"settings.palettesMergedNotice":
		"已将 {{count}} 个导入调色板合并到已保存且颜色相同的颜色项中。",
	"notice.palettesMerged":
		"已合并 {{count}} 个颜色完全相同的已保存颜色：{{names}}。使用它们的 callout 会保留原有颜色，并已关联到保留的颜色。",
	"editor.colorsDescDeleted":
		"此 callout 的已保存颜色已被删除。你可以通过{{link}}重新保存。",
	"editor.colorsDescDeletedOther":
		"此 callout 的已保存颜色已被删除。你可以通过{{link}}重新保存——另外 1 个使用该颜色的 callout 也会重新关联。",
	"editor.colorsDescDeletedOthers":
		"此 callout 的已保存颜色已被删除。你可以通过{{link}}重新保存——另外 {{count}} 个使用该颜色的 callout 也会重新关联。",
	"editor.colorsDescDeletedLink": "点击这里",
	"palette.colorExists":
		"这些颜色与“{{name}}”完全相同。两个已保存颜色不能相同——请修改一个颜色以区分它们。",
	"palette.colorExistsUse":
		"这些颜色与“{{name}}”完全相同。两个已保存颜色不能相同——请修改一个颜色，或{{link}}。",
	"palette.colorExistsUseLink": "使用现有颜色",
	"locale.downloading": "正在下载翻译…",
	"locale.notDownloaded": "{{name}} 尚未下载",
	"locale.notDownloadedDesc":
		"在翻译下载完成前，Callout Studio 将显示英文。下次启动 Obsidian 时会重试。",
	"locale.retry": "重试",
	"locale.diskWriteFailed":
		"Callout Studio 无法将翻译保存到磁盘，因此下次需要重新下载。",
	"notice.exportedCssCreated": "CSS 片段已保存到 {{path}}",
	"notice.exportedCssUpdated": "CSS 片段已在 {{path}} 更新",
	"notice.exportedCssUnchanged": "CSS 片段已经是最新版本。",
	"notice.exportCssEmpty": "没有可导出的自定义 callout。",
	"notice.exportCssFailed": "无法保存 CSS 片段。请查看开发者控制台了解详情。",
	"notice.exportCssEnabled":
		"此片段已在此 vault 中启用。Callout Studio 已经为这些 callout 设置样式，而片段保留导出时的样式。",
	"confirm.titleOverwriteSnippet": "覆盖 CSS 片段",
	"confirm.overwriteSnippet":
		"snippets 文件夹中的 CSS 片段自 Callout Studio 写入后已发生变化。再次导出会替换整个文件。",
	"confirm.overwriteSnippetOk": "覆盖",
	"export.chooseFormat": "导出为",
	"export.formatJson": "Callout Studio 备份",
	"export.formatJsonDesc":
		"包含 callout 和设置的 .json 文件，可导入到其他 vault。",
	"export.formatCss": "CSS 片段",
	"export.formatCssDesc":
		"保存在此 vault 的 snippets 文件夹中的 .css 文件，可在未安装 Callout Studio 的地方使用。仅涵盖普通 callout，是一个快照；更改 callout 后请重新导出。",
	"quickInsert.readingViewHint": "此笔记以阅读模式打开，因此无法插入任何内容。",
	"quickInsert.readingView": "切换到源代码模式或实时预览以插入 callout。",
	"quickInsert.noCursorHint": "此笔记中没有光标，因此没有可插入的位置。",
	"quickInsert.noCursor": "在笔记中将光标放在要插入 callout 的位置，然后重试。",
};
