export const bg: Record<string, string> = {
	"cmd.openSettings": "Отваряне на настройките",
	"cmd.createCallout": "Създаване на нов тип callout",
	"cmd.insertEmptyCallout": "Вмъкване на празен callout",
	"cmd.calloutWrap": "Обвиване в callout",
	"cmd.calloutUnwrap": "Премахване на callout",
	"cmd.customWrapBlock": "Обвиване в блоков callout {{name}}",
	"cmd.customInsertBlock": "Вмъкване на блоков callout {{name}}",
	"cmd.customInsertHeading":
		"Вмъкване на заглавен callout {{name}} (H{{level}})",
	"cmd.customInsertInline": "Вмъкване на вграден callout {{name}}",
	"cmd.openQuickInsert": "Бързо вмъкване на блоков callout",
	"autocomplete.createNew": 'Създаване на нов callout: "{{name}}"',
	"settings.fallbackTag": "По подразбиране",
	"settings.fallbackTagAuto": "Авт. по подразбиране",
	"settings.autoDiscover": "Автоматично откриване на извиквания във вашето хранилище",
	"settings.autoDiscoverDesc":
		"Забелязва типовете извиквания, написани в бележките ви, и ги добавя автоматично в списъка. Изключването оставя вече наличните извиквания непроменени — можете да ги добавите сами или да използвате „Повторно сканиране на хранилището“ по-долу.",
	"settings.rescanVault": "Повторно сканиране на хранилището",
	"settings.rescanVaultDesc":
		"Търси непознати ID-та на callout в бележките и ги добавя като резервни редове.",
	"settings.rescanVaultHintAction": "Сканирай сега",
	"settings.rescanComplete":
		"Повторното сканиране завърши: добавени са {{count}} нови callout(а).",
	"replaceModal.deleteWithoutReplaceSuffix": "(връща се към стандартното)",
	"replaceModal.titleDelete": "Изтриване на callout",
	"replaceModal.titleReplace": "Замяна в хранилището",
	"firstRun.title": "Намиране на съществуващи callout-и в хранилището?",
	"firstRun.body":
		"Callout Studio може да сканира хранилището ви, за да открие callout-и, които вече използвате, така че да се показват в списъка с настройки и да приемат вашия резервен стил.",
	"firstRun.heavyVaultNote":
		"Хранилището ви има {{count}} Markdown файла — сканирането може да отнеме няколко секунди.",
	"firstRun.laterHint":
		"Можете винаги да го стартирате по-късно от Настройки → Прегледи и поддръжка на хранилището → Повторно сканиране.",
	"firstRun.scanNow": "Сканирай сега",
	"firstRun.noThanks": "Не, благодаря",
	"firstRun.autoScanComplete":
		"Callout Studio сканира хранилището ви и добави {{count}} callout(а).",
	"firstRun.scanning": "Сканиране",
	"firstRun.autoScanFailed":
		"Callout Studio не успя да сканира хранилището ви. Можете да опитате отново от Настройки → Прегледи и поддръжка на хранилището → Повторно сканиране.",
	"firstRun.scanFailed":
		"Сканирането не завърши. Можете да опитате отново от Настройки → Прегледи и поддръжка на хранилището → Повторно сканиране.",

	"welcome.tooltip": "За Callout Studio",
	"welcome.title": "Добре дошли в Callout Studio!",
	"welcome.tagline":
		"Вашето цялостно решение за създаване, стилизиране и управление на callout-и в Obsidian.",
	"welcome.previewTitle": "Вижте го в действие",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Callout Studio ви позволява да създавате callout-и със собствена икона, цветове и име.\n\n" +
		"Можете да използвате този callout по **три** различни начина:\n\n" +
		"## [!{{id}}] Callout като заглавие\n" +
		"За да превърнете произволно заглавие в заглавие в стил callout, добавете `[!type]` веднага след `#`-овете.\n\n" +
		"Искате [!{{id}}]{вграден callout} като този? Просто добавете `[!type]{text}` в средата на изречение, без да прекъсвате написаното.\n\n" +
		"> [!{{id}}] Блоков callout\n" +
		"> Класическият callout работи с абсолютно същия синтаксис, с който вече сте свикнали: `> [!type]`.\n\n" +
		"Callout Studio предлага много повече! [Научете повече]({{repoUrl}}).\n",

	"deleteModal.title": 'Изтриване на callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Този callout се появява {{count}} пъти в {{files}} файл(а).",
	"deleteModal.bodyInUseExplain":
		"Изтриването ще преобразува тези блокове в обикновен текст — те ще загубят стила и заглавието на callout.",
	"deleteModal.replaceHint":
		"Можете да го замените с друг callout, като запазите съдържанието на хранилището като стилизиран callout.",
	"deleteModal.bodyUnused":
		'"{{name}}" не се използва в нито една бележка, но е персонализиран callout, който сте създали. Изтриването ще го премахне от списъка.',
	"deleteModal.replaceInstead": "Замяна вместо това",
	"deleteModal.deleteInUse": "Изтриване (преобразуване в обикновен текст)",
	"deleteModal.deleteUnused": "Изтриване на callout",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Изчистване на всички употреби на "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"Това е един от вградените callout-и на Obsidian, затова самият тип остава наличен — променят се само неговите употреби в бележките ви.",
	"deleteModal.keepsRowTheme":
		"{{theme}} дефинира този тип callout, затова той остава наличен и запазва външния си вид. Callout Studio променя само бележки във вашето хранилище — нищо, принадлежащо на темата ви, не се засяга.",
	"deleteModal.clearUsages": "Изчистване на употребите (преобразуване в обикновен текст)",
	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Моите типове callout",
	"settings.builtInCallouts": "Вградени callout-и",
	"settings.contextMenu": "Контекстно меню",
	"settings.autocomplete": "Автоматично довършване",
	"settings.keyboardShortcuts": "Клавишни комбинации",
	"settings.language": "Език",
	"settings.languageDesc":
		"Език на показване за Callout Studio. По подразбиране следва езика на интерфейса на Obsidian.",
	"settings.languageAuto": "Автоматично (като Obsidian)",
	"settings.importExport": "Импорт / Eкспорт",
	"settings.import": "Импортиране",
	"settings.export": "Експортиране",
	"settings.importDesc":
		"Импортирайте данните на Callout Studio от друго хранилище с JSON файл.",
	"settings.exportDesc":
		"Запазете всички персонализирани типове callout в JSON формат.",
	"settings.importConflictNotice":
		"Импортирани са {{count}} тип(а) callout; {{overwritten}} съществуващ(и) запис(а) са презаписани.",
	"settings.addNewCallout": "+ добавяне на callout",
	"settings.noCalloutsNow": "Засега няма персонализирани callout-и.",
	"settings.editAria": "Редактиране на {{name}}",
	"settings.moreRowActionsAria": "Още действия за {{name}}",
	"settings.usageInfo": "{{count}} употреби в {{files}} файл(а)",
	"settings.replaceAction": "Замяна в хранилището",
	"settings.deleteAction": "Изтриване",
	"settings.resetAction": "Нулиране до стандартното",
	"settings.makeFallbackAction": "Използване на стандартния резервен стил",
	"settings.colorSwatchAria": "Акцент: {{accent}} · Фон: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Стилизиране с моя собствен CSS",
	"settings.externalCssStopAction": "Callout Studio да стилизира отново това",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "Външен CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callout-и от вашата тема",
	"settings.themeCalloutsDesc":
		"{{theme}} предоставя или преоформя тези callout-и, затова Callout Studio ги оставя точно както темата ви ги изобразява и ги предлага само като блокови callout-и. Тук се показват и двата вида: типове callout, добавени от темата ви, и вградени callout-и, чийто вид тя заменя. Типовете callout, добавени от темата ви, се показват само докато тя е активна.",
	"settings.themeCalloutsDefaultTheme": "Вашата тема",
	"settings.themePreviewAria":
		'Преглед на "{{name}}" — вижте как темата ви го изобразява',
	"settings.clearUsesAction": "Изчистване на употребите в бележките ви",
	"settings.builtInAllThemeStyled":
		"{{theme}} преоформя всички вградени callout-и, затова те всички са изброени по-горе и Callout Studio не ги пипа. За да проектирате свой собствен, добавете callout с различно ID.",
	"settings.fallbackCallout": "Стандартен резервен callout",
	"settings.fallbackCalloutDesc":
		"Непознатите типове callout в хранилището ви ще наследят стила на този callout.",
	"settings.globalStyle": "Глобален стил на callout",
	"settings.border": "Граници",
	"settings.borderAll": "Всички",
	"settings.borderTop": "Горе",
	"settings.borderRight": "Дясно",
	"settings.borderBottom": "Долу",
	"settings.borderLeft": "Ляво",
	"settings.borderWidth": "Дебелина на границата",
	"settings.fontScaleGroup": "Мащаб на шрифта",
	"settings.titleScale": "Заглавие",
	"settings.contentScale": "Съдържание",
	"settings.inlineTextScale": "Текст",
	"settings.shapeGroup": "Форма",
	"settings.borderRadius": "Закръгляне на ъглите",
	"settings.alignGroup": "Подравняване",
	"settings.alignContent": "Подравни съдържанието с заглавието",
	"settings.headingSpacingGroup": "Разстояние на заглавието",
	"settings.headingPadVertical": "Вертикално разстояние",
	"settings.headingGap": "Разстояние между заглавията",
	"settings.headingFoldGroup": "Сгъване",
	"settings.headingFoldArrow": "Показване на стрелка за сгъване",
	"settings.styleDemoName": "Пример",
	"settings.previewTitle": "Преглед",
	// Settings — Saved color palettes
	"settings.customPalettes": "Запазени цветови палитри",
	"settings.newPalette": "Нова палитра",
	"settings.customPalettesEmpty": "Засега няма запазени палитри.",
	"settings.editPaletteAria": "Редактиране на палитра {{name}}",
	"settings.deletePaletteAria": "Изтриване на палитра {{name}}",
	"settings.deletePaletteConfirm":
		'Изтриване на палитра "{{name}}"?\nCallout-ите, които използват нейните цветове, няма да бъдат засегнати.',
	"settings.enableAutocomplete": "Активиране на автоматично довършване [!",
	"settings.enableAutocompleteDesc":
		'Показва предложения при въвеждане на "[!" в блоков цитат в редактора. Изберете тип callout от списъка, за да вмъкнете пълно заглавие на callout.',
	"settings.customCommands": "Команди и клавишни комбинации",
	"settings.customCommandsDesc":
		"Вижте всяка команда на Callout Studio и клавишната комбинация, към която е обвързана, и създайте свои команди за callout-ите, които използвате най-често. По подразбиране не са зададени комбинации.",
	"settings.customCommandsButton": "Управление на командите",
	"commandBuilder.title": "Команди и клавишни комбинации",
	"commandBuilder.desc":
		"Използвайте бутона +, за да зададете или промените клавишна комбинация в настройките на Obsidian.",
	"commandBuilder.builtIn": "Вградени команди",
	"commandBuilder.toggleAria": "Включване или изключване на {{name}}",
	"commandBuilder.hotkeyBlank": "Празно",
	"commandBuilder.hotkeyAria": "Задаване на комбинация за {{name}}",
	"commandBuilder.yourCommands": "Вашите команди",
	"commandBuilder.newCommand": "Нова команда",
	"commandBuilder.empty": "Все още няма персонализирани команди.",
	"commandBuilder.unknownCommand": "тази команда",
	"commandBuilder.editAria": "Редактиране на {{name}}",
	"commandBuilder.deleteAria": "Изтриване на {{name}}",
	"commandBuilder.deleteConfirm":
		"Изтриване на командата {{name}}? Всяка зададена ѝ комбинация ще спре да работи.",
	"commandBuilder.newTitle": "Нова команда",
	"commandBuilder.editTitle": "Редактиране на команда",
	"commandBuilder.format": "Формат на callout",
	"commandBuilder.formatDesc": "Какъв вид callout записва командата.",
	"commandBuilder.formatHeading": "Заглавие",
	"commandBuilder.formatInline": "Вграден",
	"commandBuilder.formatBlock": "Блоков",
	"commandBuilder.roleDisabled":
		"Този формат е изключен, затова командата ще вмъква обикновен текст, докато не го включите отново.",
	"commandBuilder.callout": "Тип callout",
	"commandBuilder.calloutDesc": "Callout-ът, който вмъква тази команда.",
	"commandBuilder.headingLevel": "Ниво на заглавие",
	"commandBuilder.headingLevelDesc": "На кое ниво да се запише заглавието.",
	"commandBuilder.action": "Действие",
	"commandBuilder.actionDesc":
		"Обвиването превръща избора в callout; вмъкването добавя празен.",
	"commandBuilder.actionWrap": "Обвиване на избора",
	"commandBuilder.actionInsert": "Вмъкване на нов",
	"commandBuilder.preview": "Име на командата",
	"commandBuilder.duplicate": "Вече имате команда, която прави точно това.",
	"commandBuilder.noCallouts":
		"Все още няма типове callout, от които да се създаде команда.",
	"commandBuilder.save": "Запазване",
	"commandBuilder.roleThemeOwned":
		"Вашата тема предоставя този callout, затова той има само блоков формат.",
	"commandBuilder.commandSuspended":
		"На пауза: вашата тема предоставя този callout, затова той има само блоков формат. Тази команда ще проработи отново, когато темата спре да го предоставя.",
	"settings.vaultMaintenance": "Прегледи и поддръжка на хранилището",
	"settings.vaultStats": "Статистика за callout",
	"settings.vaultStatsDesc":
		"Брои всеки callout в бележките Markdown — блок, заглавие и вграден — и ги групира по тип.",
	"settings.vaultStatsButton": "Преглед на статистиката",
	"settings.vaultStatsScanning": "Сканиране",
	"settings.resetAll": "Нулиране",
	"settings.resetAllDesc":
		"Изтрива всички callout-и на потребителя, нулира вградените callout-и, глобалните стилове, запазените цветови палитри, персонализирането на контекстното меню и изтеглените SVG файлове на Material.",
	"settings.resetAllButton": "Нулиране на всичко",
	"settings.resetAllConfirm":
		"Това ще изтрие всички персонализирани callout-и, ще нулира вградените callout-и, глобалните стилове, запазените цветови палитри, персонализирането на контекстното меню и всички кеширани SVG файлове на Material. Действието не може да бъде отменено. Сигурни ли сте?",
	"notice.resetAllDone": "Всичко е нулирано до стандартните стойности.",
	"notice.customCommandsRemoved":
		"Премахнати са {{count}} персонализирана(и) команда(и), чийто тип callout вече не съществува.",
	"notice.customCommandMissingCallout":
		"Типът callout на тази команда вече не съществува.",
	"notice.exported":
		"Callout-ите са експортирани в callout-studio-export.json",
	"notice.importedJSON": "Импортирани са {{count}} тип(а) callout от JSON.",
	"notice.importedSettings": "Импортирани са настройките на приставката.",
	"notice.importedCalloutManager":
		"Импортирано от Callout Manager: {{created}} създадени, {{updated}} обновени.",
	"notice.importedAdmonition":
		"Внесено от Admonition: {{created}} създадени, {{updated}} " +
		"обновени.",
	"notice.noNewJSON":
		"Не са импортирани нови типове callout (ID-тата може вече да съществуват).",
	"notice.iconDownloadFailed":
		'Неуспешно изтегляне на икона Material "{{name}}". Може да е недостъпна за този стил/тегло или да нямате интернет връзка.',
	"notice.externalCssOn":
		'Callout Studio вече не стилизира "{{name}}" — собственият ви CSS решава как изглежда. Формите му Заглавие и Вграден callout няма да се визуализират.',
	"notice.externalCssOff": 'Callout Studio отново стилизира "{{name}}".',
	"notice.vaultRewritePartial":
		"{{count}} бележка(и) не можаха да бъдат актуализирани и останаха непроменени. Вижте конзолата за разработчици за подробности.",
	"notice.settingsUnreadable":
		"Callout Studio не можа да прочете файла си с настройки, затова типовете ви callout липсват в тази сесия. Нищо не е записано и файлът на диска е непроменен — презаредете Obsidian, за да опитате отново.",
	"notice.settingsMissing":
		"Файлът с настройки на Callout Studio липсва, затова типовете ви callout липсват в тази сесия. Нищо не е записано — ако синхронизирате това хранилище, изчакайте синхронизацията да завърши и презаредете Obsidian, преди да правите промени.",
	"notice.settingsMissingAction": "Започни отначало на това устройство",
	"notice.nothingToWrap": "Няма какво да се обвие.",
	"notice.cursorNotInsideCallout": "Курсорът не е вътре в callout.",
	"notice.autocompleteTargetMoved":
		"Нищо не беше вмъкнато — редът се промени, докато редакторът беше отворен.",
	"notice.openHotkeysFailed":
		"Не може да се отворят настройките за клавишни комбинации на Obsidian.",
	"notice.filterHotkeysFailed":
		"Клавишните комбинации на Obsidian са отворени, но не може да се приложи филтърът на Callout Studio.",
	"editor.editCallout": "Редактиране на callout",
	"editor.newCallout": "Нов callout",
	"editor.displayName": "Показвано име",
	"editor.displayNameDesc": "Четимият етикет, показван в интерфейса",
	"editor.displayNameBuiltIn":
		"Показваното име не може да се промени за вградените callout-и",
	"editor.displayNamePlaceholder": "Моят callout",
	"editor.calloutIds": "ID-та на callout",
	"editor.calloutIdsDesc":
		"Всички идентификатори за този callout. Разрешени са интервали.\nНатиснете Enter или бутона + за добавяне.",
	"editor.calloutIdsPlaceholder": "Добавяне на ID",
	"editor.addId": "Добавяне на ID",
	"editor.idLinkedToName": "Свързано с показваното име",
	"editor.idCannotDelete":
		"Това ID е свързано с показваното име и не може да бъде изтрито — редактирайте името, за да го промените",
	"editor.icon": "Икона",
	"editor.pickIcon": "Смяна на икона",
	"editor.replaceIcon": "Замяна на икона",
	"editor.removeIcon": "Премахване на икона",
	"editor.noIcon": "Без икона",
	"editor.resetIcon": "Нулиране на иконата по подразбиране",
	"editor.livePreview": "Преглед на живо",
	"editor.iconAdjustment": "Настройка на иконата",
	"editor.picture": "Изображение",
	"editor.size": "Размер",
	"editor.horizontalOffset": "Хоризонтално отместване",
	"editor.verticalOffset": "Вертикално отместване",
	"editor.colors": "Цветове",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Нулиране на цветовете по подразбиране",
	"editor.paletteDeleted": "Изтрит цвят",
	"editor.paletteGroupObsidian": "Callout-и на Obsidian",
	"editor.paletteGroupPresets": "Цветови предварителни настройки",
	"editor.paletteGroupCustom": "Персонализирани",
	"editor.paletteNewColor": "Нов цвят…",
	"editor.contrastWarning":
		"Нисък контраст спрямо фона — може да бъде труден за четене",
	"editor.foldable": "Сгъваем",
	"editor.foldableDesc":
		"Изберете дали callout може да се сгъва и коe е стандартното състояние за цялото хранилище.",
	"editor.foldOff": "Изключено",
	"editor.foldOpen": "Отворен по подразбиране",
	"editor.foldClosed": "Затворен по подразбиране",
	"editor.cancel": "Отказ",
	"editor.saveChanges": "Запазване на промените",
	"editor.createCallout": "Създаване на callout",
	"editor.nameRequired":
		"Необходимо е показвано име преди създаването на callout.",
	"editor.noChangesToSave": "Не са направени промени.",
	"editor.downloadingIcon": "Изтегляне на икона",
	"editor.idEmpty": "Необходимо е поне едно ID",
	"editor.idExists": "Вече съществува callout с това ID",
	"editor.idConflict": "Това ID е в конфликт с вече съществуващ callout",
	"editor.idDashConflict":
		"Obsidian записва интервалите като тирета, затова това ID се сблъсква с „{{other}}“",
	"editor.idFromTheme":
		"{{theme}} вече предоставя callout с това ID, затова Callout Studio не може да го стилизира. Изберете друго ID.",
	"editor.idThemePattern":
		"Внимание: темата ви стилизира всеки callout, съвпадащ с {{pattern}}, затова може да промени как изглежда този.",
	"editor.untitledCallout": "Callout без заглавие",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText": "Ето вградена [!{id}] капсула вътре в абзац.",
	"editor.previewReadOnly": "Прегледът на живо не може да се редактира",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — предоставен от вашата тема',
	"themePreview.owned":
		'{{theme}} предоставя и стилизира "{{name}}". Callout Studio не го променя, затова блоковият му callout изглежда точно както темата ви го изобразява.',
	"themePreview.readOnly":
		"Това означава, че цветът, иконата, името и ID-то му не могат да се променят оттук. Ако искате собствен дизайн, създайте нов callout с различно ID.",
	"themePreview.blockOnly":
		"Форматите Заглавие и Вграден не са налични за callout-и, предоставени от вашата тема. Блоковите callout-и използват нативния стил на темата.",
	"themePreview.previewTitle": "Как изглежда в момента",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Ето как изглежда съдържанието на callout-а.\n",
	"editor.externalStyleClose": "Разбрах",
	// Palette editor modal
	"palette.newTitle": "Нова цветова палитра",
	"palette.groupPalette": "Палитра",
	"palette.editTitle": "Редактиране на цветова палитра",
	"palette.name": "Име",
	"palette.namePlaceholder": "Моята палитра",
	"palette.nameExists": "Вече съществува палитра с това име",
	"palette.baseColor": "Основен цвят",
	"palette.baseColorHint":
		"Автоматично ще съпоставим цвета на фона с него. Ако желаете, можете да го контролирате отделно чрез {{link}}.",
	"palette.baseColorHintLink": "щракнете тук",
	"palette.advancedColors": "Цветове",
	"palette.advancedColorsHint":
		"Редактиране на цветовете за режим {{mode}} — другият режим се актуализира автоматично. Превключете темата на Obsidian, за да проверите.",
	"palette.revertHint":
		"Предпочитате един основен цвят вместо това? {{link}}.",
	"palette.revertHintLink": "Възстанови",
	"palette.lightMode": "Светъл",
	"palette.darkMode": "Тъмен",
	"palette.accentColor": "Акцентен цвят",
	"palette.backgroundColorChannel": "Цвят на фона",
	"palette.textColorChannel": "Цвят на текста",
	"palette.bgIntensity": "Интензивност",
	"palette.bgStyle": "Стил",
	"palette.bgSolid": "Плътен цвят",
	"palette.bgGradient": "Градиент",
	"palette.bgTransparent": "Прозрачен",
	"palette.gradientTo": "Втори цвят",
	"palette.gradientDirection": "Посока",
	"palette.gradientText": "Текст на заглавието с градиент",
	"palette.save": "Запазване",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Червено",
	"colorName.orange": "Оранжево",
	"colorName.amber": "Кехлибарено",
	"colorName.yellow": "Жълто",
	"colorName.lime": "Лайм",
	"colorName.green": "Зелено",
	"colorName.teal": "Тюркоазено",
	"colorName.cyan": "Циан",
	"colorName.sky": "Небесносиньо",
	"colorName.blue": "Синьо",
	"colorName.indigo": "Индиго",
	"colorName.violet": "Виолетово",
	"colorName.purple": "Пурпурно",
	"colorName.pink": "Розово",
	"colorName.rose": "Малиново",
	"colorName.brown": "Кафяво",
	"colorName.gray": "Сиво",
	"colorName.black": "Черно",
	"colorName.white": "Бяло",
	"colorName.crimson": "Тъмночервено",
	"colorName.coral": "Коралово",
	"colorName.grape": "Гроздов",
	"colorName.plum": "Сливов",
	"colorName.bubblegum": "Дъвка",

	"iconPicker.pickIcon": "Избор на икона",
	"iconPicker.confirm": "Потвърждаване",
	"iconPicker.cancel": "Отказ",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "търсене на икони Lucide",
	"iconPicker.searchTabler": "търсене на икони Tabler",
	"iconPicker.tablerStyle": "Стил на иконата",
	"iconPicker.tablerStyleOutline": "Контур (Outline)",
	"iconPicker.tablerStyleFilled": "Запълнен (Filled)",
	"iconPicker.loadMore": "Зареждане на още",
	"iconPicker.materialStyle": "Стил на иконата",
	"iconPicker.materialStyleOutlined": "Контурен (Outlined)",
	"iconPicker.materialStyleFilled": "Запълнен (Filled)",
	"iconPicker.materialStyleRounded": "Заоблен (Rounded)",
	"iconPicker.materialStyleSharp": "Остър (Sharp)",
	"iconPicker.materialWeight": "Тегло на иконата",
	"iconPicker.materialWeight100": "Тънък (Thin)",
	"iconPicker.materialWeight200": "Много лек (Extra Light)",
	"iconPicker.materialWeight300": "Лек (Light)",
	"iconPicker.materialWeight400": "Обикновен (Regular)",
	"iconPicker.materialWeight500": "Среден (Medium)",
	"iconPicker.materialWeight600": "Полунаситен (Semi Bold)",
	"iconPicker.materialWeight700": "Наситен (Bold)",
	"iconPicker.materialFontFailed":
		"Не можа да се заредят прегледите на иконите от Material. Вместо това се показват имената на иконите — търсенето и изборът продължават да работят.",
	"iconPicker.materialFontRetry": "Опитай отново",
	"iconPicker.searchMaterial": "търсене на икони Material",
	"iconPicker.searchEmoji": "Търси емоджи",
	"iconPicker.skinTone": "Тон на кожата",
	"iconPicker.allCategories": "Всички категории",
	"iconPicker.noIconSelected": "Не е избрана икона",
	"iconPicker.noResults": "Няма икони, отговарящи на търсенето ви.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Търсене в Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Търсене в Font Awesome",
	"iconPicker.faStyle": "Стил на иконата",
	"iconPicker.faStyleSolid": "Плътен (Solid)",
	"iconPicker.faStyleRegular": "Редовен (Regular)",
	"iconPicker.faStyleBrands": "Марки (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Търсене в RPG Awesome",
	"iconPicker.image": "Вашите изображения",
	"iconPicker.searchImage": "Търсене в изображенията",
	"iconPicker.imageTooLarge":
		"{{name}} е твърде голям. Изображенията трябва да са под 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} не е поддържан формат на изображение. Използвайте SVG, PNG, JPEG или WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} не може да бъде прочетен като сигурен SVG, затова не беше добавен.",
	"iconPicker.imageDecodeFailed":
		"{{name}} не може да бъде прочетен като изображение.",
	"iconPicker.imageDuplicate":
		"{{name}} вече е в изображенията ви. Преименувайте файла или изтрийте съществуващото изображение.",
	"iconPicker.imageAdd": "Добавяне на изображения",
	"iconPicker.imageEmpty":
		"Все още няма изображения. Добавете SVG, PNG, JPEG или WebP файл от компютъра си или го пуснете тук.",
	"iconPicker.imageDelete": "Изтриване",
	"iconPicker.imageDeleteConfirm": "Изтриване на „{{name}}“?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout(s) използва(т) това изображение. Ще показват заместваща иконка, докато не добавите нова.",
	"iconPicker.imageRecolor": "Следване цвета на Callout",
	"iconPicker.allSources": "Всички източници",
	"iconPicker.searchAllSources": "Търсене във всички източници на икони",
	"iconPicker.sourcesNotDownloaded":
		"Все още не е включен: {{names}}. Изберете източник по-горе, за да го изтеглите.",
	"iconPicker.chooseSource": "Изберете източник",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "търсене в всички библиотеки едновременно",
	"iconPicker.descLucide": "собствената колекция на Obsidian, винаги офлайн",
	"iconPicker.descTabler":
		"чисти и последователни UI икони, контур и запълнени",
	"iconPicker.descMaterial":
		"колекцията на Google, четири стила и седем тегла",
	"iconPicker.descEmoji": "цветни глифове, всеки нюанс кожа",
	"iconPicker.descOcticons": "иконите на интерфейса на GitHub",
	"iconPicker.descFa": "плътни, редовни и марки",
	"iconPicker.descRpgAwesome": "фентъзи и настолни игри икони",
	"iconPicker.descImage": "изображения, добавени от компютъра ви",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Достъпност",
	"iconPicker.cat.Actions": "Действия",
	"iconPicker.cat.Activities": "Дейности",
	"iconPicker.cat.Alert": "Сигнал",
	"iconPicker.cat.Alphabet": "Азбука",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Животни",
	"iconPicker.cat.Arrows": "Стрелки",
	"iconPicker.cat.Astronomy": "Астрономия",
	"iconPicker.cat.Audio&Video": "Аудио и видео",
	"iconPicker.cat.Automotive": "Автомобили",
	"iconPicker.cat.Badges": "Значки",
	"iconPicker.cat.Brand": "Марки",
	"iconPicker.cat.Buildings": "Сгради",
	"iconPicker.cat.Business": "Бизнес",
	"iconPicker.cat.Camping": "Къмпинг",
	"iconPicker.cat.Charity": "Благотворителност",
	"iconPicker.cat.Charts": "Диаграми",
	"iconPicker.cat.Charts + Diagrams": "Диаграми и схеми",
	"iconPicker.cat.Childhood": "Детство",
	"iconPicker.cat.Clothing + Fashion": "Дрехи и мода",
	"iconPicker.cat.Coding": "Програмиране",
	"iconPicker.cat.Communicate": "Общуване",
	"iconPicker.cat.Communication": "Комуникация",
	"iconPicker.cat.Computers": "Компютри",
	"iconPicker.cat.Connectivity": "Свързаност",
	"iconPicker.cat.Construction": "Строителство",
	"iconPicker.cat.Currencies": "Валути",
	"iconPicker.cat.Database": "База данни",
	"iconPicker.cat.Design": "Дизайн",
	"iconPicker.cat.Development": "Разработка",
	"iconPicker.cat.Devices": "Устройства",
	"iconPicker.cat.Devices + Hardware": "Устройства и хардуер",
	"iconPicker.cat.Disaster + Crisis": "Бедствия и кризи",
	"iconPicker.cat.Document": "Документ",
	"iconPicker.cat.E-commerce": "Електронна търговия",
	"iconPicker.cat.Editing": "Редактиране",
	"iconPicker.cat.Education": "Образование",
	"iconPicker.cat.Electrical": "Електрически",
	"iconPicker.cat.Emoji": "Емоджи",
	"iconPicker.cat.Energy": "Енергия",
	"iconPicker.cat.Extensions": "Разширения",
	"iconPicker.cat.Files": "Файлове",
	"iconPicker.cat.Film + Video": "Филми и видео",
	"iconPicker.cat.Food": "Храна",
	"iconPicker.cat.Food + Beverage": "Храна и напитки",
	"iconPicker.cat.Fruits + Vegetables": "Плодове и зеленчуци",
	"iconPicker.cat.Games": "Игри",
	"iconPicker.cat.Gaming": "Гейминг",
	"iconPicker.cat.Gender": "Пол",
	"iconPicker.cat.Genders": "Полове",
	"iconPicker.cat.Gestures": "Жестове",
	"iconPicker.cat.Halloween": "Хелоуин",
	"iconPicker.cat.Hands": "Ръце",
	"iconPicker.cat.Hardware": "Хардуер",
	"iconPicker.cat.Health": "Здраве",
	"iconPicker.cat.Holidays": "Празници",
	"iconPicker.cat.Home": "Дом",
	"iconPicker.cat.Household": "Домакинство",
	"iconPicker.cat.Humanitarian": "Хуманитарно",
	"iconPicker.cat.Images": "Изображения",
	"iconPicker.cat.Laundry": "Пране",
	"iconPicker.cat.Letters": "Букви",
	"iconPicker.cat.Logic": "Логика",
	"iconPicker.cat.Logistics": "Логистика",
	"iconPicker.cat.Map": "Карта",
	"iconPicker.cat.Maps": "Карти",
	"iconPicker.cat.Maritime": "Морски",
	"iconPicker.cat.Marketing": "Маркетинг",
	"iconPicker.cat.Math": "Математика",
	"iconPicker.cat.Mathematics": "Математика",
	"iconPicker.cat.Media": "Медия",
	"iconPicker.cat.Media Playback": "Възпроизвеждане",
	"iconPicker.cat.Medical + Health": "Медицина и здраве",
	"iconPicker.cat.Money": "Пари",
	"iconPicker.cat.Mood": "Настроение",
	"iconPicker.cat.Moving": "Преместване",
	"iconPicker.cat.Music + Audio": "Музика и звук",
	"iconPicker.cat.Nature": "Природа",
	"iconPicker.cat.Numbers": "Числа",
	"iconPicker.cat.Photography": "Фотография",
	"iconPicker.cat.Photos + Images": "Снимки и изображения",
	"iconPicker.cat.Political": "Политически",
	"iconPicker.cat.Privacy": "Поверителност",
	"iconPicker.cat.Punctuation + Symbols": "Пунктуация и символи",
	"iconPicker.cat.Religion": "Религия",
	"iconPicker.cat.Science": "Наука",
	"iconPicker.cat.Science Fiction": "Научна фантастика",
	"iconPicker.cat.Security": "Сигурност",
	"iconPicker.cat.Shapes": "Форми",
	"iconPicker.cat.Shopping": "Пазаруване",
	"iconPicker.cat.Social": "Социални",
	"iconPicker.cat.Spinners": "Спинъри",
	"iconPicker.cat.Sport": "Спорт",
	"iconPicker.cat.Sports + Fitness": "Спорт и фитнес",
	"iconPicker.cat.Symbols": "Символи",
	"iconPicker.cat.System": "Система",
	"iconPicker.cat.Text": "Текст",
	"iconPicker.cat.Text Formatting": "Форматиране на текст",
	"iconPicker.cat.Time": "Време",
	"iconPicker.cat.Toggle": "Превключване",
	"iconPicker.cat.Transit": "Транзит",
	"iconPicker.cat.Transportation": "Транспорт",
	"iconPicker.cat.Travel": "Пътуване",
	"iconPicker.cat.Travel + Hotel": "Пътуване и хотели",
	"iconPicker.cat.UI actions": "Действия в интерфейса",
	"iconPicker.cat.Users + People": "Потребители и хора",
	"iconPicker.cat.Vehicles": "Превозни средства",
	"iconPicker.cat.Version control": "Контрол на версии",
	"iconPicker.cat.Weather": "Времето",
	"iconPicker.cat.Writing": "Писане",
	"iconPicker.cat.Zodiac": "Зодиак",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} все още не е изтеглен",
	"iconPack.downloadDetail":
		"{{count}} икони · {{size}} · еднократно изтегляне",
	"iconPack.download": "Изтегляне",
	"iconPack.downloading": "Изтегляне на {{name}}…",
	"iconPack.downloadFailed":
		"{{name}} не може да бъде изтеглен. Проверете връзката и опитайте отново.",
	"iconPack.retry": "Повторен опит",
	"iconPack.faBrandsNotice":
		"Иконките на марките са търговски марки на съответните им собственици. Включването им не означава одобрение. Моля, използвайте ги само за представяне на компанията, продукта или услугата, за която се отнасят.",
	"iconPack.artworkRestored":
		"Изтеглени са графиките на иконите за {{names}}.",
	"iconPack.diskWriteFailed":
		"Callout Studio не успя да запази пакета с икони на диска, затова ще трябва да бъде изтеглен отново следващия път. Избраните от вас икони са все още запазени с настройките ви.",

	// Icon licences & credits
	"credits.title": "Лицензи на икони и авторски права",
	"credits.intro":
		"Callout Studio използва няколко отворени библиотеки с икони. Техните лицензи са възпроизведени по-долу, заедно с промените за използването им тук.",
	"credits.fullNotices": "Пълни известия за трети страни",
	"credits.pluginLicense":
		"Собственият код на Callout Studio е под лиценз permissive; библиотеките с икони запазват своите собствени лицензи.",
	"contextMenu.editCallout": "Редактиране на настройките на callout",
	"contextMenu.copyMarkdown": "Копиране на Markdown на callout",
	"contextMenu.openSettings": "Отваряне на настройките на Callout Studio",
	"contextMenu.setFoldClosed": "Задаване на callout като затворен (-)",
	"contextMenu.setFoldOpen": "Задаване на callout като отворен (+)",
	"contextMenu.setFoldNone": "Задаване на callout като несгъваем",
	"contextMenu.cutSection": "Изрязване на раздел на заглавие",
	"contextMenu.copySection": "Копиране на раздел на заглавие",
	"contextMenu.deleteSection": "Изтриване на раздел на заглавие",
	"heading.toggleFold": "Превключване на сгъването",
	"settings.globalSettings": "Глобални опции за стил на Callout Studio",
	"settings.globalSettingsScope":
		"Това са глобални настройки: всяка от тях наведнъж променя формата, разстоянието и размера на всеки callout, стилизиран от Callout Studio. Callout-ите, стилизирани от темата ви, запазват собствения дизайн на темата.",
	"settings.globalSettingsRegularDesc":
		"Регулирайте границата, радиуса, мащаба на шрифта и подравняването на всеки блоков callout в трезора ви.",
	"settings.globalSettingsHeadingDesc":
		"Регулирайте границата, формата и вертикалното разстояние на всеки заглавен callout в трезора ви.",
	"settings.globalSettingsInlineDesc":
		"Регулирайте границата и формата на всеки вграден callout в трезора ви.",
	"settings.globalSettingsCustomize": "Персонализиране",
	"settings.calloutTypeRegular": "Block Callout",
	"settings.calloutTypeHeading": "Callout-заглавие",
	"settings.calloutTypeInline": "Вграден callout",
	"settings.customizeMenu": "Персонализиране на елементите на менюто",
	"settings.customizeMenuDesc":
		"Изберете кои действия от контекстното меню да се показват за всеки тип callout и променете реда им. Работи в режим на изходен код и Live Preview.",
	"settings.customizeMenuButton": "Персонализиране на елементите на менюто",
	"menuCustomize.title": "Персонализиране на контекстното меню",
	"menuCustomize.desc":
		"Включвайте или изключвайте действията и плъзгайте дръжката, за да ги пренаредите. Промените се запазват автоматично.",
	"menuCustomize.regular": "Block Callout",
	"menuCustomize.heading": "Callout-заглавие",
	"menuCustomize.inline": "Вграден callout",
	"menuCustomize.dragHandle": "Плъзгане за пренареждане",
	"menuItem.edit": "Редактиране на callout",
	"menuItem.openSettings": "Отваряне на настройките",
	"menuItem.copyMarkdown": "Копиране на Markdown",
	"menuItem.foldDefaults":
		"Стандартно състояние на сгъване (отворен / затворен / без)",
	"menuItem.cutSection": "Изрязване на раздел",
	"menuItem.copySection": "Копиране на раздел",
	"menuItem.deleteSection": "Изтриване на раздел",
	"confirm.ok": "Изтриване",
	"confirm.cancel": "Отказ",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Изтриване на команда",
	"confirm.titleResetAll": "Нулиране на всички callouts",
	"confirm.titleResetCallout": "Нулиране на callout",
	"confirm.titleDeletePalette": "Изтриване на палитра",
	"confirm.titleDeleteImage": "Изтриване на изображение",
	"vault.filesUpdated":
		"Актуализирани са {{count}} препратка/и към callout в файловете на хранилището.",
	"vault.idsUpdated":
		"Актуализирани са {{count}} ID/та на callout в файловете на хранилището: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"Актуализирани са {{count}} заглавие/а на callout в файловете на хранилището: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Замяна с:",
	"vault.deleteWithout": "Изтриване без замяна",
	"vault.confirmDelete": "Потвърждаване",
	"vault.confirmReplace": "Замяна",
	"vault.replacePromptInUse":
		'"{{name}}" се използва {{count}} пъти в {{files}} файл(а). Изберете callout за замяна:',
	"vault.replacePromptUnused": 'Изберете callout за замяна на "{{name}}":',
	"vault.noReplacementAvailable": "Няма налични callout-и за замяна.",
	"vault.convertedToPlainText":
		"{{blocks}} блок(а) callout в {{files}} файл(а) са преобразувани в обикновен текст.",
	"vault.resetAliasWarning":
		"{{count}} препратка/и в {{files}} файл(а) използват персонализирани псевдоними: {{aliases}}. Те ще спрат да работят след нулиране. Продължаване?",
	"vault.resetConfirm": "Нулиране",
	"vault.resetAllInUse":
		"⚠ {{count}} препратка/и към callout в {{files}} файл(а) използват персонализирани типове callout, които ще бъдат изтрити.",
	"quickInsert.title": "Бързо вмъкване на блоков callout",
	"quickInsert.desc": "Изберете callout за вмъкване на позицията на курсора. Само блокови callout.",
	"quickInsert.searchPlaceholder": "Търсене на callout",
	"quickInsert.sourceAria": "Филтриране по източник на callout",
	"quickInsert.sourceAll": "Всички",
	"quickInsert.sourceBuiltIn": "Вграден",
	"quickInsert.sourceUser": "Моите callout",
	"quickInsert.editAria": "Редактиране на {{name}}",
	"quickInsert.insertAria": "Вмъкване на {{name}} като блоков callout",
	"quickInsert.noResults": "Не бяха намерени callout",
	"quickInsert.noUserCallouts": "Все още не сте създали никакви callout.",
	"quickInsert.noEditorHint": "Няма отворена бележка в режим на редактиране, затова нищо не може да бъде вмъкнато.",
	"quickInsert.noEditor": "Отворете бележка в режим на редактиране, за да вмъкнете callout.",

	"vaultStats.title": "Статистика за callout",
	"vaultStats.totalCallouts": "Общо callout-и",
	"vaultStats.typesFound": "Намерени типове",
	"vaultStats.filesWithCallouts": "Файлове с callout-и",
	"vaultStats.filesScanned": "Сканирани Markdown файлове",
	"vaultStats.empty": "Не са намерени callout-и в бележките Markdown.",
	"vaultStats.columnType": "Тип",
	"vaultStats.columnName": "Име",
	"vaultStats.columnSource": "Източник",
	"vaultStats.columnCount": "Брой",
	"vaultStats.columnFiles": "Файлове",
	"vaultStats.unknown": "Непознат",
	"vaultStats.sourceBuiltIn": "Вграден",
	"vaultStats.sourceCustom": "Персонализиран",
	"vaultStats.sourceAutoFallback": "Авт. резервен",
	"vaultStats.sourceTheme": "CSS фрагмент",
	"vaultStats.sourceAlias": "Псевдоним на {{id}}",
	"vaultStats.sourceUnknown": "Непознат",
	"vaultStats.byRole": "Записан като",
	"vaultStats.roleBlock": "Блок",
	"vaultStats.roleHeading": "Заглавие",
	"vaultStats.roleInline": "Вграден в текста",
	"vaultStats.defineUndefined": "Дефиниране на {{count}} липсващи",
	"vaultStats.defineRunning": "Сканиране",
	"vaultStats.defineDone": "Добавени бяха {{count}} типа callout.",
	"vaultStats.close": "Затваряне",
	"import.title": "Проблеми с импортирането",
	"import.reportLeadIn":
		"Изглежда, че импортираният файл е бил модифициран. Ето списъка с проблеми:",
	"import.reportLeadInFatal":
		"Този файл не изглежда като експорт на Callout Studio. Не може да бъде импортиран:",
	"import.entryHeading": "Запис {{index}} — {{label}}",
	"import.summary":
		"{{valid}} от {{total}} записа са валидни · намерени са {{issues}} проблема/и.",
	"import.btnCancel": "Отказ",
	"import.btnImportValid": "Импортиране само на валидните ({{count}})",
	"import.err.notRecognized":
		"Неразпознат файл: очакваше се масив от дефиниции на callout или експорт от Callout Studio.",
	"import.warn.settingsIgnored":
		"Блокът с настройки не беше валиден обект и беше игнориран.",
	"import.warn.invalidGradient":
		"Градиентът на фона беше невалиден и беше игнориран.",
	"import.err.parseFailed":
		"Файлът не е валиден JSON и не може да бъде анализиран.",
	"import.err.entryNotObject": "Записът трябва да е обект.",
	"import.err.requiredMissing":
		'Задължителното поле "{{field}}" липсва или е от грешен тип.',
	"import.err.idEmpty": "ID-то не трябва да е празно.",
	"import.err.idTooLong":
		'ID-то "{{value}}" е {{length}} символа; максимумът е {{max}}.',
	"import.err.idBadChar":
		'ID-то "{{value}}" съдържа невалидни символи ("|", "[", "]", табулации и нови редове не се разрешават).',
	"import.err.idMetadata":
		'ID-то "{{value}}" съдържа "|". В Obsidian всичко след първото "|" е метаданни на callout-а, а не част от типа, така че този запис описва callout-а "{{id}}". Пропуснат, за да остане съществуващият ви "{{id}}" непроменен.',
	"import.err.idReserved":
		'ID-то "{{value}}" е запазено от Callout Studio за собствените му прегледи и не може да бъде импортирано.',
	"import.err.displayNameEmpty": "Показваното име не трябва да е празно.",
	"import.err.displayNameTooLong":
		"Показваното име е {{length}} символа; максимумът е {{max}}.",
	"import.err.boolField":
		'"{{field}}" трябва да е булева стойност (true или false).',
	"import.err.iconNotObject": "Иконата трябва да е обект.",
	"import.err.iconTypeInvalid":
		'Типът на иконата "{{value}}" не е едно от: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" се прилага само за икони на Material и се игнорира за тип икона {{type}}.',
	"import.err.iconValueEmpty":
		"Стойността на иконата трябва да е непразен низ.",
	"import.err.iconValueTooLong":
		"Стойността на иконата е необичайно дълга ({{length}} символа).",
	"import.err.materialStyle":
		'Стилът на иконата Material "{{value}}" не е едно от: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Теглото на иконата Material "{{value}}" трябва да е цяло число между 100 и 700, на стъпки от 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" се прилага само за ваши собствени изображения и се игнорира за тип икона {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" трябва да е true или false (получено: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" трябва да е hex цвят като "#448aff" (получено "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" трябва да е число между {{min}} и {{max}} (получено "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" трябва да е число между {{min}} и {{max}} (получено "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" трябва да е масив от низове.',
	"import.err.aliasNotString": "Псевдонимът трябва да е низ.",
	"import.err.aliasDup": 'Псевдонимът "{{value}}" е дублиран в този запис.',
	"import.err.tooManyIds":
		"Прекалено много ID-та ({{count}}); всеки callout може да има максимум {{max}} ID-та (основно + псевдоними).",
	"import.err.metadataShape":
		'"metadata" трябва да е обект, чиито всички стойности са низове.',
	"import.warn.unknownFields": "Непознати полета игнорирани: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/псевдонимът "{{value}}" вече се използва от запис #{{first}} в този файл.',
	"import.err.aliasConflict":
		'Псевдонимът "{{value}}" вече се използва от друг callout ("{{other}}") в хранилището ви.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" беше true, докато "foldable" беше false; defaultFolded е нулирано до false.',
	"import.warn.imageMissing":
		"Този Callout използва изображение, което не е в файла и не е в това vault, затова ще показва заместваща иконка, докато не добавите нова.",
	"import.err.paletteIdInvalid":
		'"paletteId" трябва да е непразен текстов идентификатор (получено "{{value}}").',
	"import.warn.iconNameUnknown":
		'Няма икона "{{value}}" в {{type}}, затова беше използвана иконата по подразбиране.',
	"import.warn.cmIconUnknownNew":
		'Иконата "{{value}}" не е налична в това хранилище, затова беше използвана иконата по подразбиране.',
	"import.warn.cmIconUnknownExisting":
		'Иконата "{{value}}" не е налична в това хранилище, затова "{{id}}" запази иконата, която вече имаше.',
	"import.chooseSource": "Импортиране от",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Зареди .json файл, експортиран от Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Пренесете персонализираните си callout-и от приставката Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Пренесете своите персонализирани admonition от приставката " +
		"Admonition.",
	"import.cmTitle": "Импортиране от Callout Manager",
	"import.cmInstructions":
		"Всеки персонализиран callout се пренася с иконата и цвета си. Стиловете " +
		"по теми и персонализираният CSS нямат съответствие тук и не се пренасят.",
	"import.cmFromVault": "Това хранилище",
	"import.cmVaultChecking": "Търсене на приставката Callout Manager…",
	"import.cmVaultFound": "Намерени са {{count}} персонализирани callout-и.",
	"import.cmVaultNotFound":
		"В това хранилище не бяха намерени персонализирани callout-и.",
	"import.cmPasteLabel":
		"Или поставете копираните от Callout Manager стилове тук:",
	"import.cmPlaceholder":
		"Поставете копираните стилове или файл data.json тук…",
	"import.cmBtnCancel": "Отказ",
	"import.cmBtnImport": "Импортиране",
	"import.err.cmNoBlocksFound":
		"Не бяха намерени стилове на Callout Manager в поставения текст.",
	"import.err.cmNotRecognized":
		"Непознат файл: очакваха се стиловете, генерирани от бутона Copy " +
		"на Callout Manager, или файл data.json на Callout Manager.",
	"import.err.cmNoEntries":
		"Не бяха намерени персонализирани callout-и за импортиране.",
	"import.err.cmNoColorForNew":
		'Не беше намерен използваем цвят за новия callout "{{value}}"; той беше пропуснат.',
	"import.err.cmIdConflict":
		'ID "{{value}}" вече се използва като псевдоним от друг callout ("{{other}}") и беше пропуснат.',
	"import.warn.cmNoColorDefault":
		"В Callout Manager не беше зададен цвят, затова беше използвано " +
		"стандартното сиво.",
	"import.warn.cmThemeCondition":
		"Цветът или иконата на този callout бяха зададени само за една тема. " +
		"Callout Studio няма стилове по теми, затова той беше пренесен за " +
		"всички теми.",
	"import.warn.cmCustomStyles":
		"Този callout има и персонализиран CSS в Callout Manager. Този стил не " +
		"е част от импортирането, затова бяха пренесени само иконата и цветът.",

	// Import — Admonition
	"import.admTitle": "Внасяне от Admonition",
	"import.admInstructions":
		"Всеки admonition идва тук като callout с името, иконата и цвета " +
		"си. Настройки без съответствие в Callout Studio (команда, бутон " +
		"за копиране, скрито заглавие) не се пренасят.",
	"import.admFromVault": "Този трезор",
	"import.admVaultChecking": "Търсене на приставката Admonition…",
	"import.admVaultFound": "Намерени са {{count}} персонализирани admonition.",
	"import.admVaultNotFound":
		"В този трезор не са намерени персонализирани admonition.",
	"import.admFromFile": "Файл",
	"import.admFromFileDesc": "Файл admonitions.json или споделен пакет.",
	"import.admChooseFile": "Избор на файл…",
	"import.admPasteLabel": "Или поставете JSON тук:",
	"import.admPlaceholder": "Поставете своите admonition тук…",
	"import.admBtnCancel": "Отказ",
	"import.admBtnImport": "Импортиране",
	"import.err.admNotRecognized":
		"Неразпознат файл: очакваше се списък с admonition или data.json " +
		"на Admonition.",
	"import.err.admNoEntries": "Не са намерени admonition за внасяне.",
	"import.err.admTypeMissing":
		'Този admonition няма "type" и беше пропуснат.',
	"import.warn.admIconUnknown":
		'В никоя библиотека с икони няма икона с име "{{value}}", затова ' +
		"беше използвана иконата по подразбиране.",
	"import.warn.admIconUnknownExisting":
		'В никоя библиотека с икони няма икона с име "{{value}}", затова ' +
		'"{{id}}" запази досегашната си икона.',
	"import.warn.admImageFailed":
		"Каченото изображение не можа да бъде прочетено, затова беше " +
		"използвана иконата по подразбиране.",
	"import.warn.admIconWithCss":
		"Този admonition получава вида си от CSS фрагмент в Admonition. " +
		"Този вид не е част от внасянето, затова дойдоха само името, " +
		"иконата и цветът.",
	"import.warn.admNoColor":
		"Не беше зададен цвят, затова беше използвано синьото по " +
		"подразбиране.",
	"import.warn.admTitleTruncated":
		"Заглавието е {{length}} знака; беше съкратено до {{max}}.",

	"footer.tagline":
		"Имате коментари, забележки или предложения? Ще се радвам да ги чуя!",
	"footer.madeBy": "Създадено от Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Да изтрия ли палитрата "{{name}}"?\n1 callout я използва. Той запазва цветовете си и можете да го свържете отново по-късно от реда „Цвят“ в редактора му.',
	"settings.deletePaletteConfirmLinked":
		'Да изтрия ли палитрата "{{name}}"?\n{{count}} callout-а я използват. Те запазват цветовете си и можете да ги свържете отново по-късно от реда „Цвят“ в който и да е от редакторите им.',
	"settings.unlinkedColors": "Несвързани цветове",
	"settings.unlinkedColorsDesc":
		"Callout-и, чийто запазен цвят е изтрит. Те запазват цветовете, които са имали; възстановяването записва цвета отново и свързва цялата група.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callout-а",
	"settings.restoreColor": "Възстанови",
	"settings.palettesMergedNotice":
		"Сля {{count}} импортирани палитри със запазени цветове, които вече имаха същите цветове.",
	"notice.palettesMerged":
		"Сля {{count}} запазени цвята с еднакви цветове: {{names}}. Callout-ите, които ги използват, запазват цветовете си и сега са свързани с останалия цвят.",
	"editor.colorsDescDeleted":
		"Запазеният цвят на този callout беше изтрит. Можете да го запишете отново чрез {{link}}.",
	"editor.colorsDescDeletedOther":
		"Запазеният цвят на този callout беше изтрит. Можете да го запишете отново чрез {{link}} — още 1 друг callout, който го използва, също ще бъде свързан отново.",
	"editor.colorsDescDeletedOthers":
		"Запазеният цвят на този callout беше изтрит. Можете да го запишете отново чрез {{link}} — още {{count}} други callout-и, които го използват, също ще бъдат свързани отново.",
	"editor.colorsDescDeletedLink": "като щракнете тук",
	"palette.colorExists":
		'Тези цветове са идентични с "{{name}}". Два запазени цвята не могат да бъдат еднакви — променете цвят, за да ги различите.',
	"palette.colorExistsUse":
		'Тези цветове са идентични с "{{name}}". Два запазени цвята не могат да бъдат еднакви — променете цвят или {{link}}.',
	"palette.colorExistsUseLink": "използвайте съществуващия",
	"locale.downloading": "Изтегляне на превода…",
	"locale.notDownloaded": "{{name}} още не е изтеглен",
	"locale.notDownloadedDesc":
		"Callout Studio показва английски, докато преводът бъде изтеглен. Ще опита отново при следващото стартиране на Obsidian.",
	"locale.retry": "Опитай отново",
	"locale.diskWriteFailed":
		"Callout Studio не успя да запази превода на диска, затова ще трябва да бъде изтеглен отново следващия път.",
	"notice.exportedCssCreated": "CSS фрагментът е записан в {{path}}",
	"notice.exportedCssUpdated": "CSS фрагментът е обновен в {{path}}",
	"notice.exportedCssUnchanged": "CSS фрагментът вече е актуален.",
	"notice.exportCssEmpty": "Няма персонализирани callout-и за експортиране.",
	"notice.exportCssFailed":
		"CSS фрагментът не може да бъде записан. Проверете конзолата за разработчици за подробности.",
	"notice.exportCssEnabled":
		"Този фрагмент е включен в тази vault. Callout Studio вече стилизира тези callout-и, а фрагментът запазва стила от момента на експортиране.",
	"confirm.titleOverwriteSnippet": "Замяна на CSS фрагмент",
	"confirm.overwriteSnippet":
		"CSS фрагментът в папката със snippets е променен, след като Callout Studio го записа. Новият експорт ще замени целия файл.",
	"confirm.overwriteSnippetOk": "Замени",
	"export.chooseFormat": "Експортиране като",
	"export.formatJson": "Архив на Callout Studio",
	"export.formatJsonDesc":
		".json файл с вашите callout-и и настройки за импортиране в друга vault.",
	"export.formatCss": "CSS фрагмент",
	"export.formatCssDesc":
		".css файл, записан в папката със snippets на тази vault, за използване там, където Callout Studio не е инсталиран. Обхваща само обикновени callout-и и е моментна снимка; експортирайте отново след промяна.",
	"quickInsert.readingViewHint": "Тази бележка е отворена в режим на четене, затова нищо не може да бъде вмъкнато.",
	"quickInsert.readingView": "Превключете към режим на изходен код или Live Preview, за да вмъкнете callout.",
	"quickInsert.noCursorHint": "В тази бележка няма курсор, затова няма къде да се вмъкне.",
	"quickInsert.noCursor": "Поставете курсора в бележката там, където искате да вмъкнете callout, след което опитайте отново.",
};
