export const cs: Record<string, string> = {
	"cmd.openSettings": "Otevřít nastavení",
	"cmd.createCallout": "Vytvořit nový typ callout",
	"cmd.insertEmptyCallout": "Vložit prázdný callout",
	"cmd.calloutWrap": "Zabalit do callout",
	"cmd.calloutUnwrap": "Odebrat callout",

	"cmd.customWrapBlock": "Zabalit do blokového callout {{name}}",
	"cmd.customInsertBlock": "Vložit blokový callout {{name}}",
	"cmd.customInsertHeading": "Vložit nadpisový callout {{name}} (H{{level}})",
	"cmd.customInsertInline": "Vložit vložený callout {{name}}",
	"cmd.openQuickInsert": "Rychlé vložení blokového callout",

	"autocomplete.createNew": 'Vytvořit nový callout: "{{name}}"',

	"settings.fallbackTag": "Výchozí",
	"settings.fallbackTagAuto": "Aut. výchozí",
	"settings.rescanVault": "Znovu prohledat vault",
	"settings.rescanVaultDesc":
		"Vyhledá nerozpoznaná ID callout v poznámkách a přidá je jako záložní řádky.",
	"settings.rescanVaultHintAction": "Prohledat nyní",
	"settings.rescanComplete":
		"Opětovné prohledávání dokončeno: přidáno {{count}} nových callout(ů).",
	"replaceModal.deleteWithoutReplaceSuffix": "(vrátí se na výchozí)",
	"replaceModal.titleDelete": "Smazat callout",
	"replaceModal.titleReplace": "Nahradit ve vaultu",

	"firstRun.title": "Najít existující callouts ve vaultu?",
	"firstRun.body":
		"Callout Studio může prohledat váš vault a objevit callouts, které již používáte, takže se zobrazí v seznamu nastavení a převezmou váš záložní styl.",
	"firstRun.heavyVaultNote":
		"Váš vault má {{count}} souborů Markdown — prohledání může trvat několik sekund.",
	"firstRun.laterHint":
		"Tuto operaci můžete spustit kdykoli z Nastavení → Statistiky a údržba vaultu → Znovu prohledat vault.",
	"firstRun.scanNow": "Prohledat nyní",
	"firstRun.noThanks": "Ne, díky",
	"firstRun.autoScanComplete":
		"Callout Studio prohledal váš vault a přidal {{count}} callout(ů).",
	"firstRun.scanning": "Prohledávání",
	"firstRun.autoScanFailed":
		"Callout Studio se nepodařilo prohledat váš vault. Zkuste to znovu z Nastavení → Statistiky a údržba vaultu → Znovu prohledat vault.",
	"firstRun.scanFailed":
		"Prohledávání se nedokončilo. Zkuste to znovu z Nastavení → Statistiky a údržba vaultu → Znovu prohledat vault.",

	"welcome.tooltip": "O aplikaci Callout Studio",
	"welcome.title": "Vítejte v Callout Studio!",
	"welcome.tagline":
		"Vaše komplexní řešení pro vytváření, stylování a správu calloutů v Obsidianu.",
	"welcome.previewTitle": "Podívejte se na to v akci",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Callout Studio vám umožňuje vytvářet callouty s vlastní ikonou, barvami a názvem.\n\n" +
		"Tento callout můžete použít **třemi** různými způsoby:\n\n" +
		"## [!{{id}}] Callout jako nadpis\n" +
		"Chcete-li proměnit jakýkoli nadpis v nadpis ve stylu callout, přidejte `[!type]` hned za `#`.\n\n" +
		"Chcete [!{{id}}]{vložený callout}, jako je tento? Stačí přidat `[!type]{text}` doprostřed věty, aniž byste přerušili plynulost textu.\n\n" +
		"> [!{{id}}] Blokový callout\n" +
		"> Klasický callout funguje se stejnou syntaxí, na kterou jste už zvyklí: `> [!type]`.\n\n" +
		"Callout Studio má mnohem víc co nabídnout! [Zjistit více]({{repoUrl}}).\n",

	"deleteModal.title": 'Smazat callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Tento callout se vyskytuje {{count}}krát v {{files}} souboru(ech).",
	"deleteModal.bodyInUseExplain":
		"Smazáním se tyto bloky převedou na prostý text — ztratí styl a nadpis callout.",
	"deleteModal.replaceHint":
		"Místo toho ho můžete nahradit jiným callout, čímž zachováte obsah vaultu jako stylizovaný callout.",
	"deleteModal.bodyUnused":
		'"{{name}}" se nepoužívá v žádné poznámce, ale je to vlastní callout, který jste vytvořili. Smazáním ho odstraníte z tohoto seznamu.',
	"deleteModal.replaceInstead": "Raději nahradit",
	"deleteModal.deleteInUse": "Smazat (převést na prostý text)",
	"deleteModal.deleteUnused": "Smazat callout",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Vymazat všechna použití "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"Toto je jeden z vestavěných callouts Obsidianu, takže samotný typ zůstává dostupný — mění se jen jeho výskyty ve vašich poznámkách.",
	"deleteModal.keepsRowTheme":
		"{{theme}} definuje tento typ callout, takže zůstává dostupný a zachovává si svůj vzhled. Callout Studio mění pouze poznámky ve vašem vaultu — ničeho, co patří vašemu tématu, se nedotýká.",
	"deleteModal.clearUsages": "Vymazat použití (převést na prostý text)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Moje typy callout",
	"settings.builtInCallouts": "Vestavěné callouts",
	"settings.contextMenu": "Kontextové menu",
	"settings.autocomplete": "Automatické doplňování",
	"settings.keyboardShortcuts": "Klávesové zkratky",
	"settings.language": "Jazyk",
	"settings.languageDesc":
		"Jazyk zobrazení Callout Studio. Ve výchozím nastavení odpovídá jazyku rozhraní Obsidianu.",
	"settings.languageAuto": "Automaticky (jako Obsidian)",
	"settings.importExport": "Import / export",
	"settings.import": "Importovat",
	"settings.export": "Exportovat",
	"settings.importDesc":
		"Importujte data Callout Studio z jiného vaultu pomocí souboru JSON.",
	"settings.exportDesc":
		"Uložte všechny vlastní typy callout ve formátu JSON.",
	"settings.importConflictNotice":
		"Importováno {{count}} typ(ů) callout; {{overwritten}} stávajících záznamů bylo přepsáno.",

	"settings.addNewCallout": "+ přidat callout",

	"settings.noCalloutsNow": "Momentálně žádné vlastní callouts.",

	"settings.editAria": "Upravit {{name}}",
	"settings.moreRowActionsAria": "Další akce pro {{name}}",
	"settings.usageInfo": "{{count}} použití v {{files}} souboru(ech)",
	"settings.replaceAction": "Nahradit ve vaultu",
	"settings.deleteAction": "Smazat",
	"settings.resetAction": "Obnovit výchozí",
	"settings.makeFallbackAction": "Použít výchozí záložní styl",

	"settings.colorSwatchAria": "Akcent: {{accent}} · Pozadí: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Stylizovat vlastním CSS",
	"settings.externalCssStopAction": "Nechat Callout Studio opět stylizovat",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "Vlastní CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callouts z vašeho tématu",
	"settings.themeCalloutsDesc":
		"{{theme}} tyto callouts dodává nebo přestylovává, takže je Callout Studio ponechává přesně tak, jak je vykresluje vaše téma, a nabízí je jen jako blokové callouts. Zobrazují se zde oba druhy: typy callout, které vaše téma přidává, a vestavěné callouts, jejichž vzhled nahrazuje. Typy callout přidané vaším tématem se zobrazují jen dokud je aktivní.",
	"settings.themeCalloutsDefaultTheme": "Vaše téma",
	"settings.themePreviewAria":
		'Náhled "{{name}}" — jak jej vykresluje vaše téma',
	"settings.clearUsesAction": "Vymazat použití ve vašich poznámkách",
	"settings.builtInAllThemeStyled":
		"{{theme}} přestylovává všechny vestavěné callouts, takže jsou všechny uvedeny výše a Callout Studio je nechává být. Chcete-li navrhnout vlastní, přidejte callout s jiným ID.",
	"settings.fallbackCallout": "Výchozí záložní callout",
	"settings.fallbackCalloutDesc":
		"Nerozpoznané typy callout ve vaultu zdědí styl tohoto callout.",

	"settings.globalStyle": "Globální styl callout",
	"settings.border": "Ohraničení",
	"settings.borderAll": "Vše",
	"settings.borderTop": "Nahoře",
	"settings.borderRight": "Vpravo",
	"settings.borderBottom": "Dole",
	"settings.borderLeft": "Vlevo",
	"settings.borderWidth": "Tloušťka ohraničení",
	"settings.fontScaleGroup": "Měřítko písma",
	"settings.titleScale": "Nadpis",
	"settings.contentScale": "Obsah",
	"settings.inlineTextScale": "Text",
	"settings.shapeGroup": "Tvar",
	"settings.borderRadius": "Zaoblení rohů",
	"settings.alignGroup": "Zarovnání",
	"settings.alignContent": "Zarovnat obsah s nadpisem",
	"settings.headingSpacingGroup": "Rozestupy nadpisu",
	"settings.headingPadVertical": "Svislé rozestupy",
	"settings.headingGap": "Mezera mezi nadpisy",
	"settings.headingFoldGroup": "Sbalení",
	"settings.headingFoldArrow": "Zobrazit šipku sbalení",
	"settings.styleDemoName": "Ukázka",
	"settings.previewTitle": "Náhled",

	// Settings — Saved color palettes
	"settings.customPalettes": "Uložené barevné palety",
	"settings.newPalette": "Nová paleta",
	"settings.customPalettesEmpty": "Momentálně žádné uložené palety.",
	"settings.editPaletteAria": "Upravit paletu {{name}}",
	"settings.deletePaletteAria": "Smazat paletu {{name}}",
	"settings.deletePaletteConfirm":
		'Smazat paletu "{{name}}"?\nCallouty používající její barvy nebudou ovlivněny.',
	"settings.enableAutocomplete": "Povolit automatické doplňování [!",
	"settings.enableAutocompleteDesc":
		'Zobrazuje návrhy při psaní "[!" v bloku citace v editoru. Vyberte typ callout ze seznamu a vložte úplnou hlavičku callout.',

	"settings.customCommands": "Příkazy a zkratky",
	"settings.customCommandsDesc":
		"Prohlédněte si všechny příkazy Callout Studio a zkratku, ke které je každý přiřazen, a vytvořte si vlastní příkazy pro callouty, které používáte nejčastěji. Ve výchozím nastavení nejsou přiřazeny žádné zkratky.",
	"settings.customCommandsButton": "Spravovat příkazy",

	"commandBuilder.title": "Příkazy a zkratky",
	"commandBuilder.desc":
		"Pomocí tlačítka + nastavte nebo změňte zkratku v nastavení klávesových zkratek Obsidian.",
	"commandBuilder.builtIn": "Vestavěné příkazy",
	"commandBuilder.toggleAria": "Zapnout nebo vypnout {{name}}",
	"commandBuilder.hotkeyBlank": "Prázdné",
	"commandBuilder.hotkeyAria": "Nastavit zkratku pro {{name}}",
	"commandBuilder.yourCommands": "Vaše příkazy",
	"commandBuilder.newCommand": "Nový příkaz",
	"commandBuilder.empty": "Zatím žádné vlastní příkazy.",
	"commandBuilder.unknownCommand": "tento příkaz",
	"commandBuilder.editAria": "Upravit {{name}}",
	"commandBuilder.deleteAria": "Smazat {{name}}",
	"commandBuilder.deleteConfirm":
		"Smazat příkaz {{name}}? Případná přiřazená zkratka přestane fungovat.",
	"commandBuilder.newTitle": "Nový příkaz",
	"commandBuilder.editTitle": "Upravit příkaz",
	"commandBuilder.format": "Formát callout",
	"commandBuilder.formatDesc": "Jaký druh callout příkaz zapisuje.",
	"commandBuilder.formatHeading": "Nadpis",
	"commandBuilder.formatInline": "Vložený",
	"commandBuilder.formatBlock": "Blokový",
	"commandBuilder.roleDisabled":
		"Tento formát je vypnutý, takže příkaz bude vkládat obyčejný text, dokud jej znovu nezapnete.",
	"commandBuilder.callout": "Typ callout",
	"commandBuilder.calloutDesc": "Callout, který tento příkaz vkládá.",
	"commandBuilder.headingLevel": "Úroveň nadpisu",
	"commandBuilder.headingLevelDesc": "Jakou úroveň nadpisu zapsat.",
	"commandBuilder.action": "Akce",
	"commandBuilder.actionDesc":
		"Zabalení promění výběr v callout; vložení přidá prázdný.",
	"commandBuilder.actionWrap": "Zabalit výběr",
	"commandBuilder.actionInsert": "Vložit nový",
	"commandBuilder.preview": "Název příkazu",
	"commandBuilder.duplicate": "Takový příkaz už máte.",
	"commandBuilder.noCallouts":
		"Zatím neexistují žádné typy callout, ze kterých by šlo příkaz vytvořit.",
	"commandBuilder.save": "Uložit",
	"commandBuilder.roleThemeOwned":
		"Tento callout dodává vaše téma, takže má pouze blokový formát.",
	"commandBuilder.commandSuspended":
		"Pozastaveno: tento callout dodává vaše téma, takže má pouze blokový formát. Tento příkaz bude znovu fungovat, jakmile jej téma přestane dodávat.",

	"settings.vaultMaintenance": "Statistiky a údržba vaultu",
	"settings.vaultStats": "Statistiky callout",
	"settings.vaultStatsDesc":
		"Počítá každý callout v poznámkách Markdown — blokový, nadpisový i vložený — a seskupuje je podle typu.",
	"settings.vaultStatsButton": "Zobrazit statistiky",
	"settings.vaultStatsScanning": "Prohledávání",
	"settings.resetAll": "Obnovit",
	"settings.resetAllDesc":
		"Odstraní všechny callouts uživatele, obnoví vestavěné callouts, globální styly (ohraničení, měřítko písma, tvar), uložené barevné palety, přizpůsobení kontextové nabídky a stažené SVG Material.",
	"settings.resetAllButton": "Obnovit vše",
	"settings.resetAllConfirm":
		"Tím se odstraní všechny vlastní callouts, obnoví vestavěné callouts, globální styly, uložené barevné palety, přizpůsobení kontextové nabídky a všechny SVG Material v mezipaměti. Tuto akci nelze vrátit zpět. Jste si jisti?",
	"notice.resetAllDone": "Vše bylo obnoveno na výchozí hodnoty.",

	"notice.customCommandsRemoved":
		"Odstraněno {{count}} vlastní(ch) příkaz(ů), jejichž typ callout již neexistuje.",
	"notice.customCommandMissingCallout":
		"Typ callout tohoto příkazu již neexistuje.",
	"notice.exported": "Callouts exportovány do callout-studio-export.json",
	"notice.importedJSON": "Importováno {{count}} typ(ů) callout z JSON.",
	"notice.importedSettings": "Importováno nastavení doplňku.",
	"notice.importedCalloutManager":
		"Importováno z Callout Manager: {{created}} vytvořeno, {{updated}} aktualizováno.",
	"notice.importedAdmonition":
		"Importováno z Admonition: {{created}} vytvořeno, {{updated}} " +
		"aktualizováno.",
	"notice.noNewJSON":
		"Žádné nové typy callout nebyly importovány (ID mohou již existovat).",
	"notice.iconDownloadFailed":
		'Ikonu Material "{{name}}" nelze stáhnout. Může být nedostupná pro tento styl/tloušťku nebo jste offline.',
	"notice.externalCssOn":
		'Callout Studio už nestylizuje "{{name}}" — jeho vzhled určuje vaše vlastní CSS. Jeho formáty Nadpis a Vložený se nebudou vykreslovat.',
	"notice.externalCssOff": 'Callout Studio nyní opět stylizuje "{{name}}".',
	"notice.nothingToWrap": "Není co zabalit.",
	"notice.cursorNotInsideCallout": "Kurzor není uvnitř callout.",
	"notice.autocompleteTargetMoved":
		"Nic nebylo vloženo — řádek se změnil, zatímco byl editor otevřený.",
	"notice.openHotkeysFailed":
		"Nelze otevřít nastavení klávesových zkratek Obsidian.",
	"notice.filterHotkeysFailed":
		"Klávesové zkratky Obsidian otevřeny, ale filtr Callout Studio nelze použít.",

	"editor.editCallout": "Upravit callout",
	"editor.newCallout": "Nový callout",
	"editor.displayName": "Zobrazovaný název",
	"editor.displayNameDesc": "Čitelný popis zobrazený v rozhraní",
	"editor.displayNameBuiltIn":
		"Zobrazovaný název vestavěných callouts nelze změnit",
	"editor.displayNamePlaceholder": "Můj callout",
	"editor.calloutIds": "ID callout",
	"editor.calloutIdsDesc":
		"Všechny identifikátory tohoto callout. Mezery jsou povoleny.\nStiskněte Enter nebo tlačítko + pro přidání.",
	"editor.calloutIdsPlaceholder": "Přidat ID",
	"editor.addId": "Přidat ID",
	"editor.idLinkedToName": "Propojeno se zobrazovaným názvem",
	"editor.idCannotDelete":
		"Toto ID je propojeno se zobrazovaným názvem a nelze ho smazat — upravte název, abyste ho změnili",
	"editor.icon": "Ikona",
	"editor.pickIcon": "Změnit ikonu",
	"editor.replaceIcon": "Nahradit ikonu",
	"editor.removeIcon": "Odebrat ikonu",
	"editor.noIcon": "Žádná ikona",
	"editor.resetIcon": "Obnovit ikonu na výchozí",
	"editor.livePreview": "Živý náhled",
	"editor.iconAdjustment": "Úprava ikony",
	"editor.picture": "Obrázek",
	"editor.size": "Velikost",
	"editor.horizontalOffset": "Horizontální posun",
	"editor.verticalOffset": "Vertikální posun",
	"editor.colors": "Barvy",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Obnovit barvy na výchozí",
	"editor.paletteDeleted": "Smazaná barva",
	"editor.paletteGroupObsidian": "Callouts Obsidian",
	"editor.paletteGroupPresets": "Barevné předvolby",
	"editor.paletteGroupCustom": "Vlastní",
	"editor.paletteNewColor": "Nová barva…",
	"editor.contrastWarning":
		"Nízký kontrast vůči pozadí — může být obtížně čitelné",
	"editor.foldable": "Sbalitelný",
	"editor.foldableDesc":
		"Vyberte, zda lze callout sbalit, a jaký výchozí stav se použije v celém vaultu.",
	"editor.foldOff": "Vypnuto",
	"editor.foldOpen": "Ve výchozím stavu otevřený",
	"editor.foldClosed": "Ve výchozím stavu zavřený",
	"editor.cancel": "Zrušit",
	"editor.saveChanges": "Uložit změny",
	"editor.createCallout": "Vytvořit callout",
	"editor.nameRequired":
		"Před vytvořením callout je vyžadován zobrazovaný název.",
	"editor.noChangesToSave": "Nebyly provedeny žádné změny.",
	"editor.downloadingIcon": "Stahování ikony",
	"editor.idEmpty": "Je vyžadováno alespoň jedno ID",
	"editor.idExists": "Callout s tímto ID již existuje",
	"editor.idConflict": "Toto ID je v konfliktu s existujícím callout",
	"editor.idDashConflict":
		"Obsidian zapisuje mezery jako pomlčky, takže toto ID koliduje s „{{other}}“",
	"editor.idFromTheme":
		"{{theme}} už poskytuje callout s tímto ID, takže ho Callout Studio nemůže stylizovat. Zvolte jiné ID.",
	"editor.idThemePattern":
		"Upozornění: vaše téma stylizuje každý callout odpovídající {{pattern}}, takže může přepsat vzhled tohoto.",
	"editor.untitledCallout": "Callout bez názvu",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Zde je vložená pilulka [!{id}] uvnitř odstavce.",
	"editor.previewReadOnly": "Živý náhled nelze upravovat",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — poskytnuto vaším tématem',
	"themePreview.owned":
		'{{theme}} poskytuje a stylizuje "{{name}}". Callout Studio ho nepřepisuje, takže jeho blokový callout vypadá přesně tak, jak jej vykresluje vaše téma.',
	"themePreview.readOnly":
		"To znamená, že jeho barvu, ikonu, název ani ID zde nelze změnit. Pokud chcete vlastní návrh, vytvořte nový callout s jiným ID.",
	"themePreview.blockOnly":
		"Formáty Nadpis a Vložený nejsou pro callouts poskytované vaším tématem k dispozici. Blokové callouts používají nativní styl tématu.",
	"themePreview.previewTitle": "Jak vypadá nyní",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Takto vypadá obsah tohoto callout.\n",
	"editor.externalStyleClose": "Rozumím",

	// Palette editor modal
	"palette.newTitle": "Nová barevná paleta",
	"palette.groupPalette": "Paleta",
	"palette.editTitle": "Upravit barevnou paletu",
	"palette.name": "Název",
	"palette.namePlaceholder": "Moje paleta",
	"palette.nameExists": "Paleta s tímto názvem již existuje",
	"palette.baseColor": "Základní barva",
	"palette.baseColorHint":
		"Barvu pozadí automaticky přizpůsobíme této barvě. Pokud chcete, můžete ji ovládat samostatně kliknutím na {{link}}.",
	"palette.baseColorHintLink": "zde",
	"palette.advancedColors": "Barvy",
	"palette.advancedColorsHint":
		"Úprava barev pro režim {{mode}} – druhý režim se aktualizuje automaticky. Přepněte motiv Obsidianu, abyste to ověřili.",
	"palette.revertHint":
		"Preferujete místo toho jednu základní barvu? {{link}}.",
	"palette.revertHintLink": "Vrátit zpět",
	"palette.lightMode": "Světlý",
	"palette.darkMode": "Tmavý",
	"palette.accentColor": "Zvýrazňovací barva",
	"palette.backgroundColorChannel": "Barva pozadí",
	"palette.textColorChannel": "Barva textu",
	"palette.bgIntensity": "Intenzita",
	"palette.bgStyle": "Styl",
	"palette.bgSolid": "Jednobarevný",
	"palette.bgGradient": "Přechod",
	"palette.bgTransparent": "Průhledné",
	"palette.gradientTo": "Druhá barva",
	"palette.gradientDirection": "Směr",
	"palette.gradientText": "Text nadpisu s přechodem",
	"palette.save": "Uložit",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Červená",
	"colorName.orange": "Oranžová",
	"colorName.amber": "Jantarová",
	"colorName.yellow": "Žlutá",
	"colorName.lime": "Limetková",
	"colorName.green": "Zelená",
	"colorName.teal": "Petrolejová",
	"colorName.cyan": "Azurová",
	"colorName.sky": "Nebeská",
	"colorName.blue": "Modrá",
	"colorName.indigo": "Indigová",
	"colorName.violet": "Fialová",
	"colorName.purple": "Purpurová",
	"colorName.pink": "Růžová",
	"colorName.rose": "Starorůžová",
	"colorName.brown": "Hnědá",
	"colorName.gray": "Šedá",
	"colorName.black": "Černá",
	"colorName.white": "Bílá",
	"colorName.crimson": "Karmínová",
	"colorName.coral": "Korálová",
	"colorName.grape": "Hroznová",
	"colorName.plum": "Švestková",
	"colorName.bubblegum": "Žvýkačka",

	"iconPicker.pickIcon": "Vybrat ikonu",
	"iconPicker.confirm": "Potvrdit",
	"iconPicker.cancel": "Zrušit",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "hledat ikony Lucide",
	"iconPicker.searchTabler": "hledat ikony Tabler",
	"iconPicker.tablerStyle": "Styl ikony",
	"iconPicker.tablerStyleOutline": "Obrys (Outline)",
	"iconPicker.tablerStyleFilled": "Plný (Filled)",
	"iconPicker.loadMore": "Načíst více",
	"iconPicker.materialStyle": "Styl ikony",
	"iconPicker.materialStyleOutlined": "Osnova (Outlined)",
	"iconPicker.materialStyleFilled": "Vyplněná (Filled)",
	"iconPicker.materialStyleRounded": "Zaoblená (Rounded)",
	"iconPicker.materialStyleSharp": "Ostrá (Sharp)",
	"iconPicker.materialWeight": "Tloušťka ikony",
	"iconPicker.materialWeight100": "Tenká (Thin)",
	"iconPicker.materialWeight200": "Extra lehká (Extra Light)",
	"iconPicker.materialWeight300": "Lehká (Light)",
	"iconPicker.materialWeight400": "Obyčejná (Regular)",
	"iconPicker.materialWeight500": "Střední (Medium)",
	"iconPicker.materialWeight600": "Poločerno (Semi Bold)",
	"iconPicker.materialWeight700": "Černá (Bold)",
	"iconPicker.materialFontFailed":
		"Nepodařilo se načíst náhledy ikon Material. Místo toho se zobrazují názvy ikon — vyhledávání i vybírání stále fungují.",
	"iconPicker.materialFontRetry": "Zkusit znovu",
	"iconPicker.searchMaterial": "hledat ikony Material",
	"iconPicker.searchEmoji": "Hledat emoji",
	"iconPicker.skinTone": "Tón pleti",
	"iconPicker.allCategories": "Všechny kategorie",
	"iconPicker.noIconSelected": "Není vybrána žádná ikona",
	"iconPicker.noResults": "Žádné ikony neodpovídají vašemu hledání.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Hledat v Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Hledat v Font Awesome",
	"iconPicker.faStyle": "Styl ikony",
	"iconPicker.faStyleSolid": "Plný (Solid)",
	"iconPicker.faStyleRegular": "Normální (Regular)",
	"iconPicker.faStyleBrands": "Značky (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Hledat v RPG Awesome",
	"iconPicker.image": "Vaše obrázky",
	"iconPicker.searchImage": "Hledat ve vašich obrázcích",
	"iconPicker.imageTooLarge":
		"{{name}} je příliš velký. Obrázky musí být menší než 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} není podporovaný formát obrázku. Použijte SVG, PNG, JPEG nebo WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} nelze načíst jako bezpečný SVG, proto nebyl přidán.",
	"iconPicker.imageDecodeFailed": "{{name}} nelze načíst jako obrázek.",
	"iconPicker.imageDuplicate":
		"{{name}} je již ve vašich obrázcích. Přejmenujte soubor nebo odstraňte stávající obrázek.",
	"iconPicker.imageAdd": "Přidat obrázky",
	"iconPicker.imageEmpty":
		"Zatím žádné obrázky. Přidejte soubor SVG, PNG, JPEG nebo WebP z počítače nebo jej sem přetáhněte.",
	"iconPicker.imageDelete": "Smazat",
	"iconPicker.imageDeleteConfirm": "Smazat „{{name}}“?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout(ů) používá tento obrázek. Zobrazí zástupnou ikonu, dokud neuvedete nový obrázek.",
	"iconPicker.imageRecolor": "Sledovat barvu Callout",
	"iconPicker.allSources": "Všechny zdroje",
	"iconPicker.searchAllSources": "Hledat ve všech zdrojích ikon",
	"iconPicker.sourcesNotDownloaded":
		"Zatím není součástí: {{names}}. Vyberte zdroj výše a stáhněte ho.",
	"iconPicker.chooseSource": "Vybrat zdroj",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "prohledávat všechny knihovny najednou",
	"iconPicker.descLucide": "vlastní sada Obsidian, vždy offline",
	"iconPicker.descTabler": "čisté a konzistentní UI ikony, obrys a plné",
	"iconPicker.descMaterial": "sada Google, čtyři styly a sedm tlouštěk",
	"iconPicker.descEmoji": "barevné glyfy, každý tón pleti",
	"iconPicker.descOcticons": "ikony rozhraní GitHub",
	"iconPicker.descFa": "plné, normální a značky",
	"iconPicker.descRpgAwesome": "ikony pro fantasy a stolní hry",
	"iconPicker.descImage": "obrázky přidané z vašeho počítače",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Přístupnost",
	"iconPicker.cat.Actions": "Akce",
	"iconPicker.cat.Activities": "Aktivity",
	"iconPicker.cat.Alert": "Upozornění",
	"iconPicker.cat.Alphabet": "Abeceda",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Zvířata",
	"iconPicker.cat.Arrows": "Šipky",
	"iconPicker.cat.Astronomy": "Astronomie",
	"iconPicker.cat.Audio&Video": "Audio a video",
	"iconPicker.cat.Automotive": "Automobily",
	"iconPicker.cat.Badges": "Odznaků",
	"iconPicker.cat.Brand": "Značky",
	"iconPicker.cat.Buildings": "Budovy",
	"iconPicker.cat.Business": "Byznys",
	"iconPicker.cat.Camping": "Kemping",
	"iconPicker.cat.Charity": "Charita",
	"iconPicker.cat.Charts": "Grafy",
	"iconPicker.cat.Charts + Diagrams": "Grafy a diagramy",
	"iconPicker.cat.Childhood": "Dětství",
	"iconPicker.cat.Clothing + Fashion": "Oblečení a móda",
	"iconPicker.cat.Coding": "Programování",
	"iconPicker.cat.Communicate": "Komunikace",
	"iconPicker.cat.Communication": "Komunikace",
	"iconPicker.cat.Computers": "Počítače",
	"iconPicker.cat.Connectivity": "Připojení",
	"iconPicker.cat.Construction": "Stavebnictví",
	"iconPicker.cat.Currencies": "Měny",
	"iconPicker.cat.Database": "Databáze",
	"iconPicker.cat.Design": "Design",
	"iconPicker.cat.Development": "Vývoj",
	"iconPicker.cat.Devices": "Zařízení",
	"iconPicker.cat.Devices + Hardware": "Zařízení a hardware",
	"iconPicker.cat.Disaster + Crisis": "Katastrófy a krize",
	"iconPicker.cat.Document": "Dokument",
	"iconPicker.cat.E-commerce": "E-commerce",
	"iconPicker.cat.Editing": "Úpravy",
	"iconPicker.cat.Education": "Vzdělání",
	"iconPicker.cat.Electrical": "Elektro",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energie",
	"iconPicker.cat.Extensions": "Rozšíření",
	"iconPicker.cat.Files": "Soubory",
	"iconPicker.cat.Film + Video": "Filmy a video",
	"iconPicker.cat.Food": "Jídlo",
	"iconPicker.cat.Food + Beverage": "Jídlo a nápoje",
	"iconPicker.cat.Fruits + Vegetables": "Ovoce a zelenina",
	"iconPicker.cat.Games": "Hry",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Pohlaví",
	"iconPicker.cat.Genders": "Pohlaví",
	"iconPicker.cat.Gestures": "Gesta",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Ruce",
	"iconPicker.cat.Hardware": "Hardware",
	"iconPicker.cat.Health": "Zdraví",
	"iconPicker.cat.Holidays": "Svátky",
	"iconPicker.cat.Home": "Domov",
	"iconPicker.cat.Household": "Domácnost",
	"iconPicker.cat.Humanitarian": "Humanitární",
	"iconPicker.cat.Images": "Obrázky",
	"iconPicker.cat.Laundry": "Praní",
	"iconPicker.cat.Letters": "Písmena",
	"iconPicker.cat.Logic": "Logika",
	"iconPicker.cat.Logistics": "Logistika",
	"iconPicker.cat.Map": "Mapa",
	"iconPicker.cat.Maps": "Mapy",
	"iconPicker.cat.Maritime": "Námořní",
	"iconPicker.cat.Marketing": "Marketing",
	"iconPicker.cat.Math": "Matematika",
	"iconPicker.cat.Mathematics": "Matematika",
	"iconPicker.cat.Media": "Média",
	"iconPicker.cat.Media Playback": "Přehrávání médií",
	"iconPicker.cat.Medical + Health": "Lékařství a zdraví",
	"iconPicker.cat.Money": "Peníze",
	"iconPicker.cat.Mood": "Nálada",
	"iconPicker.cat.Moving": "Stěhování",
	"iconPicker.cat.Music + Audio": "Hudba a zvuk",
	"iconPicker.cat.Nature": "Příroda",
	"iconPicker.cat.Numbers": "Čísla",
	"iconPicker.cat.Photography": "Fotografie",
	"iconPicker.cat.Photos + Images": "Fotografie a obrázky",
	"iconPicker.cat.Political": "Politické",
	"iconPicker.cat.Privacy": "Soukromí",
	"iconPicker.cat.Punctuation + Symbols": "Interpunkce a symboly",
	"iconPicker.cat.Religion": "Náboženství",
	"iconPicker.cat.Science": "Věda",
	"iconPicker.cat.Science Fiction": "Science fiction",
	"iconPicker.cat.Security": "Zabezpečení",
	"iconPicker.cat.Shapes": "Tvary",
	"iconPicker.cat.Shopping": "Nakupování",
	"iconPicker.cat.Social": "Sociální",
	"iconPicker.cat.Spinners": "Spinners",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sport a fitness",
	"iconPicker.cat.Symbols": "Symboly",
	"iconPicker.cat.System": "Systém",
	"iconPicker.cat.Text": "Text",
	"iconPicker.cat.Text Formatting": "Formátování textu",
	"iconPicker.cat.Time": "Čas",
	"iconPicker.cat.Toggle": "Přepínač",
	"iconPicker.cat.Transit": "Tranzit",
	"iconPicker.cat.Transportation": "Doprava",
	"iconPicker.cat.Travel": "Cestování",
	"iconPicker.cat.Travel + Hotel": "Cestování a hotely",
	"iconPicker.cat.UI actions": "Akce rozhraní",
	"iconPicker.cat.Users + People": "Uživatelé a lidé",
	"iconPicker.cat.Vehicles": "Vozidla",
	"iconPicker.cat.Version control": "Správa verzí",
	"iconPicker.cat.Weather": "Počasí",
	"iconPicker.cat.Writing": "Psaní",
	"iconPicker.cat.Zodiac": "Zvěrokruh",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} ještě nebylo staženo",
	"iconPack.downloadDetail":
		"{{count}} ikon · {{size}} · jednorázové stažení",
	"iconPack.download": "Stáhnout",
	"iconPack.downloading": "Stahování {{name}}…",
	"iconPack.downloadFailed":
		"{{name}} nelze stáhnout. Zkontrolujte připojení a zkuste to znovu.",
	"iconPack.retry": "Zkusit znovu",
	"iconPack.faBrandsNotice":
		"Ikony značek jsou ochranné známky příslušných vlastníků. Jejich zahrnutí neznamená schválení. Používejte je pouze k zastupování společnosti, produktu nebo služby, které představují.",
	"iconPack.artworkRestored": "Byla stažena kresba ikon pro {{names}}.",
	"iconPack.diskWriteFailed":
		"Callout Studio nemohlo uložit balíček ikon na disk, takže ho bude nutné příště stáhnout znovu. Vybrané ikony jsou stále uloženy ve vašem nastavení.",

	// Icon licences & credits
	"credits.title": "Licence ikon a poděkování",
	"credits.intro":
		"Callout Studio čerpá z několika otevřených knihoven ikon. Jejich licence jsou reprodukovány níže, spolu s tím, co bylo změněno pro jejich použití zde.",
	"credits.fullNotices": "Úplná oznámení třetích stran",
	"credits.pluginLicense":
		"Vlastní kód Callout Studio je pod licencí permissive; knihovny ikon si zachovávají své vlastní licence.",

	"contextMenu.editCallout": "Upravit nastavení callout",
	"contextMenu.copyMarkdown": "Kopírovat Markdown callout",
	"contextMenu.openSettings": "Otevřít nastavení Callout Studio",
	"contextMenu.setFoldClosed": "Nastavit callout jako zavřený (-)",
	"contextMenu.setFoldOpen": "Nastavit callout jako otevřený (+)",
	"contextMenu.setFoldNone": "Nastavit callout jako nesbalitelný",
	"contextMenu.cutSection": "Vyjmout sekci nadpisu",
	"contextMenu.copySection": "Kopírovat sekci nadpisu",
	"contextMenu.deleteSection": "Smazat sekci nadpisu",
	"heading.toggleFold": "Přepnout sbalení",
	"settings.globalSettings": "Možnosti stylu Callout Studio",
	"settings.globalSettingsScope":
		"Tvar, rozestupy a velikost pro callouts, které stylizuje Callout Studio. Callouts stylizované vaším tématem si zachovávají vlastní vzhled tématu.",
	"settings.globalSettingsRegularDesc":
		"Přidejte token callout do citace (např. `> [!type]`) a vykreslete tak nativní rámeček callout v Obsidianu. Můžete upravit jeho ohraničení, poloměr, měřítko písma a zarovnání.",
	"settings.globalSettingsHeadingDesc":
		"Přidejte token callout přímo za mřížky nadpisu (např. `## [!type]`) a vykreslete ho jako stylizovaný nadpis callout. Můžete upravit jeho ohraničení, tvar a svislé rozestupy.",
	"settings.globalSettingsInlineDesc":
		"Přidejte token callout kamkoli do řádku textu (např. `[!type]`) a vykreslete ho jako malou vloženou pilulku. Můžete upravit jeho ohraničení a tvar.",
	"settings.globalSettingsCustomize": "Přizpůsobit",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Callout nadpisu",
	"settings.calloutTypeInline": "Vložený callout",
	"settings.customizeMenu": "Přizpůsobit položky menu",
	"settings.customizeMenuDesc":
		"Vyberte, které akce kontextové nabídky se zobrazí pro každý typ callout, a změňte jejich pořadí. Funguje ve zdrojovém režimu a živém náhledu.",
	"settings.customizeMenuButton": "Přizpůsobit položky menu",
	"menuCustomize.title": "Přizpůsobit kontextovou nabídku",
	"menuCustomize.desc":
		"Zapínejte nebo vypínejte akce a přetažením úchytu je přeuspořádejte. Změny se ukládají automaticky.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Callout nadpisu",
	"menuCustomize.inline": "Vložený callout",
	"menuCustomize.dragHandle": "Přetažením změníte pořadí",
	"menuItem.edit": "Upravit callout",
	"menuItem.openSettings": "Otevřít nastavení",
	"menuItem.copyMarkdown": "Kopírovat Markdown",
	"menuItem.foldDefaults":
		"Výchozí stav sbalení (otevřeno / zavřeno / žádné)",
	"menuItem.cutSection": "Vyjmout sekci",
	"menuItem.copySection": "Kopírovat sekci",
	"menuItem.deleteSection": "Smazat sekci",

	"confirm.ok": "Smazat",
	"confirm.cancel": "Zrušit",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Smazat příkaz",
	"confirm.titleResetAll": "Obnovit všechny callouty",
	"confirm.titleResetCallout": "Obnovit callout",
	"confirm.titleDeletePalette": "Smazat paletu",
	"confirm.titleDeleteImage": "Smazat obrázek",

	"vault.filesUpdated":
		"Aktualizováno {{count}} odkazů na callout v souborech vaultu.",
	"vault.idsUpdated":
		"Aktualizováno {{count}} ID callout v souborech vaultu: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"Aktualizováno {{count}} nadpisů callout v souborech vaultu: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Nahradit za:",
	"vault.deleteWithout": "Smazat bez nahrazení",
	"vault.confirmDelete": "Potvrdit",
	"vault.confirmReplace": "Nahradit",
	"vault.replacePromptInUse":
		'"{{name}}" se používá {{count}}krát v {{files}} souboru(ech). Vyberte callout, kterým ho chcete nahradit:',
	"vault.replacePromptUnused":
		'Vyberte callout, kterým chcete nahradit "{{name}}":',
	"vault.noReplacementAvailable":
		"Nejsou k dispozici žádné jiné callouts pro nahrazení.",
	"vault.convertedToPlainText":
		"{{blocks}} bloků callout v {{files}} souboru(ech) převedeno na prostý text.",
	"vault.resetAliasWarning":
		"{{count}} odkazů v {{files}} souboru(ech) používá vlastní aliasy: {{aliases}}. Po obnovení přestanou fungovat. Pokračovat?",
	"vault.resetConfirm": "Obnovit",
	"vault.resetAllInUse":
		"⚠ {{count}} odkazů na callout v {{files}} souboru(ech) používá vlastní typy callout, které budou odstraněny.",

	"quickInsert.title": "Rychlé vložení blokového callout",
	"quickInsert.desc": "Vyberte callout pro vložení na pozici kurzoru. Pouze blokové callouty.",
	"quickInsert.searchPlaceholder": "Hledat callouty",
	"quickInsert.sourceAria": "Filtrovat podle zdroje callout",
	"quickInsert.sourceAll": "Vše",
	"quickInsert.sourceBuiltIn": "Vestavěný",
	"quickInsert.sourceUser": "Moje callouty",
	"quickInsert.editAria": "Upravit {{name}}",
	"quickInsert.insertAria": "Vložit {{name}} jako blokový callout",
	"quickInsert.noResults": "Nebyly nalezeny žádné callouty",
	"quickInsert.noUserCallouts": "Zatím jste nevytvořili žádný callout.",
	"quickInsert.noEditorHint": "Není otevřena žádná poznámka v režimu úprav, takže nelze nic vložit.",
	"quickInsert.noEditor": "Otevřete poznámku v režimu úprav pro vložení callout.",

	"vaultStats.title": "Statistiky callout",
	"vaultStats.totalCallouts": "Celkem callouts",
	"vaultStats.typesFound": "Nalezené typy",
	"vaultStats.filesWithCallouts": "Soubory s callouts",
	"vaultStats.filesScanned": "Prohledané soubory Markdown",
	"vaultStats.empty": "V poznámkách Markdown nebyly nalezeny žádné callouts.",
	"vaultStats.columnType": "Typ",
	"vaultStats.columnName": "Název",
	"vaultStats.columnSource": "Zdroj",
	"vaultStats.columnCount": "Počet",
	"vaultStats.columnFiles": "Soubory",
	"vaultStats.unknown": "Neznámý",
	"vaultStats.sourceBuiltIn": "Vestavěný",
	"vaultStats.sourceCustom": "Vlastní",
	"vaultStats.sourceAutoFallback": "Aut. záložní",
	"vaultStats.sourceTheme": "Fragment CSS",
	"vaultStats.sourceAlias": "Alias pro {{id}}",
	"vaultStats.sourceUnknown": "Neznámý",
	"vaultStats.byRole": "Zapsáno jako",
	"vaultStats.roleBlock": "Blok",
	"vaultStats.roleHeading": "Nadpis",
	"vaultStats.roleInline": "Vložený v textu",
	"vaultStats.defineUndefined": "Definovat {{count}} chybějících",
	"vaultStats.defineRunning": "Skenování",
	"vaultStats.defineDone": "Přidáno {{count}} typů callout.",
	"vaultStats.close": "Zavřít",

	"import.title": "Problémy s importem",
	"import.reportLeadIn":
		"Zdá se, že importovaný soubor byl pozměněn. Zde je seznam problémů:",
	"import.reportLeadInFatal":
		"Tento soubor nevypadá jako export Callout Studio. Nelze ho importovat:",
	"import.entryHeading": "Položka {{index}} — {{label}}",
	"import.summary":
		"{{valid}} z {{total}} položek je platných · nalezeno {{issues}} problémů.",
	"import.btnCancel": "Zrušit",
	"import.btnImportValid": "Importovat pouze platné ({{count}})",
	"import.err.notRecognized":
		"Nerozpoznaný soubor: očekávalo se pole definic callout nebo export z Callout Studia.",
	"import.warn.settingsIgnored":
		"Blok nastavení nebyl platným objektem a byl ignorován.",
	"import.warn.invalidGradient":
		"Přechod pozadí byl neplatný a byl ignorován.",
	"import.err.parseFailed": "Soubor není platný JSON a nelze ho analyzovat.",
	"import.err.entryNotObject": "Položka musí být objekt.",
	"import.err.requiredMissing":
		'Povinné pole "{{field}}" chybí nebo má nesprávný typ.',
	"import.err.idEmpty": "ID nesmí být prázdné.",
	"import.err.idTooLong":
		'ID "{{value}}" má {{length}} znaků; maximum je {{max}}.',
	"import.err.idBadChar":
		'ID "{{value}}" obsahuje neplatné znaky ("|", "[", "]", tabulátory a konce řádků nejsou povoleny).',
	"import.err.idMetadata":
		'ID "{{value}}" obsahuje "|". V Obsidianu je vše za prvním "|" metadata calloutu, nikoli součást typu, takže tento záznam popisuje callout "{{id}}". Přeskočeno, aby vaše stávající "{{id}}" zůstalo beze změny.',
	"import.err.idReserved":
		'ID "{{value}}" je vyhrazeno pro Callout Studio a jeho vlastní náhledy a nelze je importovat.',
	"import.err.displayNameEmpty": "Zobrazovaný název nesmí být prázdný.",
	"import.err.displayNameTooLong":
		"Zobrazovaný název má {{length}} znaků; maximum je {{max}}.",
	"import.err.boolField":
		'"{{field}}" musí být booleovská hodnota (true nebo false).',
	"import.err.iconNotObject": "Ikona musí být objekt.",
	"import.err.iconTypeInvalid":
		'Typ ikony "{{value}}" není jedním z: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" se vztahuje pouze na ikony Material a je ignorováno pro typ ikony {{type}}.',
	"import.err.iconValueEmpty": "Hodnota ikony musí být neprázdný řetězec.",
	"import.err.iconValueTooLong":
		"Hodnota ikony je neobvykle dlouhá ({{length}} znaků).",
	"import.err.materialStyle":
		'Styl ikony Material "{{value}}" není jedním z: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Tloušťka ikony Material "{{value}}" musí být celé číslo mezi 100 a 700, po 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" se vztahuje pouze na vaše vlastní obrázky a je ignorováno pro typ ikony {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" musí být true nebo false (získáno: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" musí být hexadecimální barva jako "#448aff" (obdrženo "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" musí být číslo mezi {{min}} a {{max}} (obdrženo "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" musí být číslo mezi {{min}} a {{max}} (obdrženo "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" musí být pole řetězců.',
	"import.err.aliasNotString": "Alias musí být řetězec.",
	"import.err.aliasDup": 'Alias "{{value}}" je v této položce duplikován.',
	"import.err.tooManyIds":
		"Příliš mnoho ID ({{count}}); každý callout může mít nejvýše {{max}} ID (primární + aliasy).",
	"import.err.metadataShape":
		'"metadata" musí být objekt, jehož všechny hodnoty jsou řetězce.',
	"import.warn.unknownFields": "Neznámá pole ignorována: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/alias "{{value}}" již používá položka #{{first}} v tomto souboru.',
	"import.err.aliasConflict":
		'Alias "{{value}}" již používá jiný callout ("{{other}}") ve vašem vaultu.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" bylo true, zatímco "foldable" bylo false; defaultFolded bylo obnoveno na false.',
	"import.warn.imageMissing":
		"Tento Callout používá obrázek, který není v souboru ani v tomto vault, proto zobrazí zástupnou ikonu, dokud neuvedete nový.",

	"import.err.paletteIdInvalid":
		'"paletteId" musí být neprázdný textový identifikátor (obdrženo "{{value}}").',
	"import.warn.iconNameUnknown":
		'Ikona "{{value}}" v {{type}} neexistuje, proto byla použita výchozí ikona.',
	"import.warn.cmIconUnknownNew":
		'Ikona "{{value}}" není v tomto trezoru dostupná, proto byla použita výchozí ikona.',
	"import.warn.cmIconUnknownExisting":
		'Ikona "{{value}}" není v tomto trezoru dostupná, proto "{{id}}" si ponechalo ikonu, kterou již mělo.',
	"import.chooseSource": "Importovat z",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Načíst soubor .json exportovaný z Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Přeneste své přizpůsobené callouty z pluginu Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Přeneste své vlastní admonition z pluginu Admonition.",
	"import.cmTitle": "Import z Callout Manager",
	"import.cmInstructions":
		"Každý přizpůsobený callout se přenese se svou ikonou a barvou. Styly " +
		"pro jednotlivá témata a vlastní CSS zde nemají obdobu a nepřenášejí se.",
	"import.cmFromVault": "Tento trezor",
	"import.cmVaultChecking": "Hledání pluginu Callout Manager…",
	"import.cmVaultFound": "Nalezeno přizpůsobených calloutů: {{count}}.",
	"import.cmVaultNotFound":
		"V tomto trezoru nebyly nalezeny žádné přizpůsobené callouty.",
	"import.cmPasteLabel":
		"Nebo sem vložte styly zkopírované z Callout Manager:",
	"import.cmPlaceholder":
		"Vložte zkopírované styly nebo soubor data.json sem…",
	"import.cmBtnCancel": "Zrušit",
	"import.cmBtnImport": "Importovat",
	"import.err.cmNoBlocksFound":
		"Ve vloženém textu nebyly nalezeny žádné styly Callout Manager.",
	"import.err.cmNotRecognized":
		"Nerozpoznaný soubor: očekávány byly styly generované tlačítkem Copy " +
		"v Callout Manager, nebo soubor data.json z Callout Manager.",
	"import.err.cmNoEntries":
		"Nebyly nalezeny žádné přizpůsobené callouty k importu.",
	"import.err.cmNoColorForNew":
		'Pro nový callout "{{value}}" nebyla nalezena použitelná barva; byl přeskočen.',
	"import.err.cmIdConflict":
		'ID "{{value}}" je již používáno jako alias jiným calloutem ("{{other}}") a bylo přeskočeno.',
	"import.warn.cmNoColorDefault":
		"V Callout Manager nebyla nastavena barva, proto byla použita výchozí " +
		"šedá.",
	"import.warn.cmThemeCondition":
		"Barva nebo ikona tohoto calloutu byla nastavena jen pro jedno téma. " +
		"Callout Studio nemá styly pro jednotlivá témata, proto byla přenesena " +
		"pro všechna témata.",
	"import.warn.cmCustomStyles":
		"Tento callout má v Callout Manager i vlastní CSS. Tento styl není " +
		"součástí importu, proto se přenesla jen jeho ikona a barva.",

	// Import — Admonition
	"import.admTitle": "Import z Admonition",
	"import.admInstructions":
		"Každý admonition sem přijde jako callout s názvem, ikonou a " +
		"barvou. Nastavení, která v Callout Studiu nemají obdobu (příkaz, " +
		"tlačítko kopírování, skrytý nadpis), zůstanou stranou.",
	"import.admFromVault": "Tento trezor",
	"import.admVaultChecking": "Hledám plugin Admonition…",
	"import.admVaultFound": "Nalezeno {{count}} vlastních admonition.",
	"import.admVaultNotFound":
		"V tomto trezoru nebyly nalezeny žádné vlastní admonition.",
	"import.admFromFile": "Soubor",
	"import.admFromFileDesc": "Soubor admonitions.json nebo sdílený balíček.",
	"import.admChooseFile": "Vybrat soubor…",
	"import.admPasteLabel": "Nebo sem vložte JSON:",
	"import.admPlaceholder": "Vložte sem své admonition…",
	"import.admBtnCancel": "Zrušit",
	"import.admBtnImport": "Importovat",
	"import.err.admNotRecognized":
		"Nerozpoznaný soubor: očekáván seznam admonition nebo data.json " +
		"pluginu Admonition.",
	"import.err.admNoEntries": "Nebyly nalezeny žádné admonition k importu.",
	"import.err.admTypeMissing":
		'Tento admonition nemá "type" a byl přeskočen.',
	"import.warn.admIconUnknown":
		'V žádné knihovně ikon není ikona s názvem "{{value}}", proto ' +
		"byla použita výchozí ikona.",
	"import.warn.admIconUnknownExisting":
		'V žádné knihovně ikon není ikona s názvem "{{value}}", proto si ' +
		'"{{id}}" ponechal svou dosavadní ikonu.',
	"import.warn.admImageFailed":
		"Nahraný obrázek se nepodařilo načíst, proto byla použita výchozí " +
		"ikona.",
	"import.warn.admIconWithCss":
		"Tento admonition je v pluginu Admonition stylován úryvkem CSS. " +
		"Ten není součástí importu, takže se přenesl jen název, ikona a " +
		"barva.",
	"import.warn.admNoColor":
		"Nebyla nastavena žádná barva, proto byla použita výchozí modrá.",
	"import.warn.admTitleTruncated":
		"Název má {{length}} znaků; byl zkrácen na {{max}}.",

	"footer.tagline":
		"Máte zpětnou vazbu, komentáře nebo návrhy? Rád je uslyším!",
	"footer.madeBy": "Vytvořil Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Smazat paletu "{{name}}"?\nPoužívá ji 1 callout. Zachová si své barvy a později ho můžete znovu propojit z řádku Barva v jeho editoru.',
	"settings.deletePaletteConfirmLinked":
		'Smazat paletu "{{name}}"?\nPoužívá ji {{count}} calloutů. Zachovají si své barvy a později je můžete znovu propojit z řádku Barva v kterémkoli z jejich editorů.',
	"settings.unlinkedColors": "Nepropojené barvy",
	"settings.unlinkedColorsDesc":
		"Callouty, jejichž uložená barva byla smazána. Zachovají barvy, které měly; obnovení barvu znovu uloží a propojí celou skupinu.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} calloutů",
	"settings.restoreColor": "Obnovit",
	"settings.palettesMergedNotice":
		"Sloučeno {{count}} importovaných palet do uložených barev, které už měly stejné barvy.",
	"notice.palettesMerged":
		"Sloučeno {{count}} uložených barev se stejnými barvami: {{names}}. Callouty, které je používají, si ponechají své barvy a nyní jsou propojené se zbývající barvou.",
	"editor.colorsDescDeleted":
		"Uložená barva tohoto calloutu byla smazána. Můžete ji znovu uložit {{link}}.",
	"editor.colorsDescDeletedOther":
		"Uložená barva tohoto calloutu byla smazána. Můžete ji znovu uložit {{link}} — znovu se propojí také 1 další callout, který ji používá.",
	"editor.colorsDescDeletedOthers":
		"Uložená barva tohoto calloutu byla smazána. Můžete ji znovu uložit {{link}} — znovu se propojí také {{count}} dalších calloutů, které ji používají.",
	"editor.colorsDescDeletedLink": "kliknutím sem",
	"palette.colorExists":
		'Tyto barvy jsou stejné jako "{{name}}". Dvě uložené barvy nemohou být stejné — změňte jednu barvu, aby se odlišily.',
	"palette.colorExistsUse":
		'Tyto barvy jsou stejné jako "{{name}}". Dvě uložené barvy nemohou být stejné — změňte barvu, nebo {{link}}.',
	"palette.colorExistsUseLink": "použít existující",
	"locale.downloading": "Stahování překladu…",
	"locale.notDownloaded": "{{name}} zatím není stažen",
	"locale.notDownloadedDesc":
		"Callout Studio zobrazuje angličtinu, dokud nebude možné stáhnout překlad. Zkusí to znovu při příštím spuštění Obsidianu.",
	"locale.retry": "Zkusit znovu",
	"locale.diskWriteFailed":
		"Callout Studio nemohl uložit překlad na disk, takže jej bude nutné příště stáhnout znovu.",
	"notice.exportedCssCreated": "CSS fragment byl uložen do {{path}}",
	"notice.exportedCssUpdated": "CSS fragment byl aktualizován v {{path}}",
	"notice.exportedCssUnchanged": "CSS fragment je již aktuální.",
	"notice.exportCssEmpty": "Nejsou žádné vlastní callouty k exportu.",
	"notice.exportCssFailed":
		"CSS fragment nelze uložit. Podrobnosti najdete v konzoli pro vývojáře.",
	"notice.exportCssEnabled":
		"Tento fragment je v tomto vaultu zapnutý. Callout Studio tyto callouty již styluje a fragment zachovává podobu z doby exportu.",
	"confirm.titleOverwriteSnippet": "Přepsat CSS fragment",
	"confirm.overwriteSnippet":
		"CSS fragment ve složce snippets se od posledního zápisu Callout Studiem změnil. Další export nahradí celý soubor.",
	"confirm.overwriteSnippetOk": "Přepsat",
	"export.chooseFormat": "Exportovat jako",
	"export.formatJson": "Záloha Callout Studio",
	"export.formatJsonDesc":
		"Soubor .json s callouty a nastavením pro import do jiného vaultu.",
	"export.formatCss": "CSS fragment",
	"export.formatCssDesc":
		"Soubor .css uložený ve složce snippets tohoto vaultu pro použití tam, kde není Callout Studio nainstalováno. Pokrývá pouze běžné callouty a je snímkem; po změně calloutu jej exportujte znovu.",
	"quickInsert.readingViewHint": "Tato poznámka je otevřena v režimu čtení, takže nelze nic vložit.",
	"quickInsert.readingView": "Přepněte do zdrojového režimu nebo živého náhledu a vložte callout.",
	"quickInsert.noCursorHint": "V této poznámce není žádný kurzor, takže není kam vložit.",
	"quickInsert.noCursor": "Umístěte kurzor v poznámce tam, kam chcete vložit callout, a zkuste to znovu.",
};
