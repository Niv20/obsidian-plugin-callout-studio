export const sv: Record<string, string> = {
	"cmd.openSettings": "Öppna inställningar",
	"cmd.createCallout": "Skapa ny callout-typ",
	"cmd.insertEmptyCallout": "Infoga tom callout",
	"cmd.calloutWrap": "Lägg i callout",
	"cmd.calloutUnwrap": "Ta bort callout",

	"cmd.customWrapBlock": "Lägg i blockcallout {{name}}",
	"cmd.customInsertBlock": "Infoga blockcallout {{name}}",
	"cmd.customInsertHeading": "Infoga H{{level}}-rubrikcallout {{name}}",
	"cmd.customInsertInline": "Infoga infogad callout {{name}}",
	"cmd.openQuickInsert": "Snabbinfoga block-callout",

	"autocomplete.createNew": 'Skapa ny callout: "{{name}}"',

	"settings.fallbackTag": "Standard",
	"settings.fallbackTagAuto": "Automatisk standard",
	"settings.rescanVault": "Skanna vault igen",
	"settings.rescanVaultDesc":
		"Hittar okända callout-ID:n i anteckningar och lägger till dem som reservrader.",
	"settings.rescanVaultHintAction": "Skanna nu",
	"settings.rescanComplete":
		"Omskanningen klar: {{count}} ny(a) callout(s) tillagd(a).",
	"replaceModal.deleteWithoutReplaceSuffix":
		"(faller tillbaka till standard)",
	"replaceModal.titleDelete": "Ta bort callout",
	"replaceModal.titleReplace": "Ersätt i vault",

	"firstRun.title": "Hitta befintliga callouts i ditt vault?",
	"firstRun.body":
		"Callout Studio kan skanna ditt vault för att hitta callouts du redan använder, så att de visas i inställningslistan och antar din reservstil.",
	"firstRun.heavyVaultNote":
		"Ditt vault har {{count}} Markdown-filer — skanningen kan ta några sekunder.",
	"firstRun.laterHint":
		"Du kan alltid köra detta senare från Inställningar → Vault-insikter och underhåll → Skanna vault igen.",
	"firstRun.scanNow": "Skanna nu",
	"firstRun.noThanks": "Nej tack",
	"firstRun.autoScanComplete":
		"Callout Studio skannade ditt vault och lade till {{count}} callout(s).",
	"firstRun.scanning": "Skannar",
	"firstRun.autoScanFailed":
		"Callout Studio kunde inte skanna ditt vault. Du kan försöka igen från Inställningar → Vault-insikter och underhåll → Skanna vault igen.",
	"firstRun.scanFailed":
		"Skanningen slutfördes inte. Du kan försöka igen från Inställningar → Vault-insikter och underhåll → Skanna vault igen.",

	"welcome.tooltip": "Om Callout Studio",
	"welcome.title": "Välkommen till Callout Studio!",
	"welcome.tagline":
		"Din kompletta lösning för att skapa, utforma och hantera Obsidian-callouts.",
	"welcome.previewTitle": "Se det i action",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Med Callout Studio kan du skapa callouts med egen ikon, färger och namn.\n\n" +
		"Du kan använda den här callouten på **tre** olika sätt:\n\n" +
		"## [!{{id}}] Callout som rubrik\n" +
		"För att göra en rubrik till en rubrik i callout-stil, lägg till `[!type]` direkt efter `#`-tecknen.\n\n" +
		"Vill du ha en [!{{id}}]{infogad callout} som denna? Lägg bara till `[!type]{text}` mitt i en mening, utan att bryta ditt flyt.\n\n" +
		"> [!{{id}}] Block-callout\n" +
		"> Den klassiska callouten fungerar med exakt samma syntax som du redan är van vid: `> [!type]`.\n\n" +
		"Callout Studio har mycket mer att erbjuda! [Läs mer]({{repoUrl}}).\n",

	"deleteModal.title": 'Ta bort callout "{{name}}"?',
	"deleteModal.bodyInUse":
		"Denna callout förekommer {{count}} gång(er) i {{files}} fil(er).",
	"deleteModal.bodyInUseExplain":
		"Borttagning konverterar dessa block till vanlig text — de förlorar sin stil och callout-rubrik.",
	"deleteModal.replaceHint":
		"Du kan ersätta den med en annan callout, vilket bevarar vault-innehållet som en stilad callout.",
	"deleteModal.bodyUnused":
		'"{{name}}" används inte i någon anteckning, men är en anpassad callout du skapat. Borttagning tar bort den från den här listan.',
	"deleteModal.replaceInstead": "Ersätt istället",
	"deleteModal.deleteInUse": "Ta bort (konvertera till vanlig text)",
	"deleteModal.deleteUnused": "Ta bort callout",
	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Rensa alla användningar av "{{name}}"?',
	"deleteModal.keepsRowBuiltIn":
		"Detta är en av Obsidians inbyggda callouts, så själva typen förblir tillgänglig — bara dess användningar i dina anteckningar ändras.",
	"deleteModal.keepsRowTheme":
		"{{theme}} definierar denna callout-typ, så den förblir tillgänglig och behåller sitt utseende. Callout Studio ändrar bara anteckningar i ditt vault — inget som tillhör ditt tema rörs.",
	"deleteModal.clearUsages": "Rensa användningar (konvertera till vanlig text)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Mina callout-typer",
	"settings.builtInCallouts": "Inbyggda callouts",
	"settings.contextMenu": "Snabbmeny",
	"settings.autocomplete": "Autokomplettera",
	"settings.keyboardShortcuts": "Tangentbordsgenvägar",
	"settings.language": "Språk",
	"settings.languageDesc":
		"Visningsspråk för Callout Studio. Följer som standard Obsidians gränssnittsspråk.",
	"settings.languageAuto": "Automatiskt (samma som Obsidian)",
	"settings.importExport": "Importera / exportera",
	"settings.import": "Importera",
	"settings.export": "Exportera",
	"settings.importDesc":
		"Importera dina Callout Studio-data från ett annat vault med en JSON-fil.",
	"settings.exportDesc":
		"Spara alla dina anpassade callout-typer i JSON-format.",
	"settings.importConflictNotice":
		"{{count}} callout-typ(er) importerade; {{overwritten}} befintlig(a) post(er) skrevs över.",

	"settings.addNewCallout": "+ lägg till callout",

	"settings.noCalloutsNow": "Inga anpassade callouts för tillfället.",

	"settings.editAria": "Redigera {{name}}",
	"settings.moreRowActionsAria": "Fler åtgärder för {{name}}",
	"settings.usageInfo": "{{count}} användning(ar) i {{files}} fil(er)",
	"settings.replaceAction": "Ersätt i vault",
	"settings.deleteAction": "Ta bort",
	"settings.resetAction": "Återställ till standard",
	"settings.makeFallbackAction": "Använd standard reservstil",
	"settings.colorSwatchAria": "Accent: {{accent}} · Bakgrund: {{bg}}",
	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Style med min egen CSS",
	"settings.externalCssStopAction": "Låt Callout Studio style detta igen",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "Extern CSS",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callouts från ditt tema",
	"settings.themeCalloutsDesc":
		"{{theme}} tillhandahåller eller stylar om dessa, så Callout Studio lämnar dem exakt som ditt tema ritar dem och erbjuder dem endast som block-callouts. Båda typerna visas här: callout-typer ditt tema lägger till, och inbyggda callouts vars utseende det ersätter. Callout-typer som ditt tema lägger till listas bara medan det är aktivt.",
	"settings.themeCalloutsDefaultTheme": "Ditt tema",
	"settings.themePreviewAria":
		'Förhandsvisa "{{name}}" — se hur ditt tema ritar den',
	"settings.clearUsesAction": "Rensa användningar i dina anteckningar",
	"settings.builtInAllThemeStyled":
		"{{theme}} stylar om varje inbyggd callout, så de listas alla ovan och Callout Studio låter dem vara. Lägg till en callout med ett annat ID för att designa en egen.",

	"settings.fallbackCallout": "Standard reservcallout",
	"settings.fallbackCalloutDesc":
		"Okända callout-typer i ditt vault ärver stilen från denna callout.",

	"settings.globalStyle": "Global callout-stil",
	"settings.border": "Kanter",
	"settings.borderAll": "Alla",
	"settings.borderTop": "Topp",
	"settings.borderRight": "Höger",
	"settings.borderBottom": "Botten",
	"settings.borderLeft": "Vänster",
	"settings.borderWidth": "Kanttjocklek",
	"settings.fontScaleGroup": "Typsnittsskala",
	"settings.titleScale": "Rubrik",
	"settings.contentScale": "Innehåll",
	"settings.inlineTextScale": "Text",
	"settings.shapeGroup": "Form",
	"settings.borderRadius": "Hörnrundning",
	"settings.alignGroup": "Justering",
	"settings.alignContent": "Justera innehåll med rubrik",
	"settings.headingSpacingGroup": "Rubrikavstånd",
	"settings.headingPadVertical": "Vertikalt avstånd",
	"settings.headingGap": "Avstånd mellan rubriker",
	"settings.headingFoldGroup": "Hopfällning",
	"settings.headingFoldArrow": "Visa hopfällningspil",
	"settings.styleDemoName": "Exempel",
	"settings.previewTitle": "Förhandsvisning",

	// Settings — Saved color palettes
	"settings.customPalettes": "Sparade färgpaletter",
	"settings.newPalette": "Ny palett",
	"settings.customPalettesEmpty": "Inga sparade paletter för tillfället.",
	"settings.editPaletteAria": "Redigera palett {{name}}",
	"settings.deletePaletteAria": "Ta bort palett {{name}}",
	"settings.deletePaletteConfirm":
		'Ta bort paletten "{{name}}"?\nCallouts som använder dess färger påverkas inte.',
	"settings.enableAutocomplete": "Aktivera [! autokomplettering",
	"settings.enableAutocompleteDesc":
		'Visar förslag när du skriver "[!" i ett blockcitat i editorn. Välj en callout-typ från listan för att infoga en komplett callout-rubrik.',

	"settings.customCommands": "Kommandon och genvägar",
	"settings.customCommandsDesc":
		"Se alla Callout Studio-kommandon och genvägen de är bundna till, och skapa egna kommandon för de callouts du använder mest. Inga genvägar tilldelas som standard.",
	"settings.customCommandsButton": "Hantera kommandon",

	"commandBuilder.title": "Kommandon och genvägar",
	"commandBuilder.desc":
		"Använd +-knappen för att ställa in eller ändra en genväg i Obsidians genväginställningar.",
	"commandBuilder.builtIn": "Inbyggda kommandon",
	"commandBuilder.toggleAria": "Slå på eller av {{name}}",
	"commandBuilder.hotkeyBlank": "Tom",
	"commandBuilder.hotkeyAria": "Ställ in en genväg för {{name}}",
	"commandBuilder.yourCommands": "Dina kommandon",
	"commandBuilder.newCommand": "Nytt kommando",
	"commandBuilder.empty": "Inga egna kommandon än.",
	"commandBuilder.unknownCommand": "detta kommando",
	"commandBuilder.editAria": "Redigera {{name}}",
	"commandBuilder.deleteAria": "Ta bort {{name}}",
	"commandBuilder.deleteConfirm":
		"Ta bort kommandot {{name}}? Eventuell genväg som tilldelats det slutar fungera.",
	"commandBuilder.newTitle": "Nytt kommando",
	"commandBuilder.editTitle": "Redigera kommando",
	"commandBuilder.format": "Callout-format",
	"commandBuilder.formatDesc": "Vilken typ av callout kommandot skriver.",
	"commandBuilder.formatHeading": "Rubrik",
	"commandBuilder.formatInline": "Infogad",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"Detta format är avstängt, så kommandot infogar vanlig text tills du slår på det igen.",
	"commandBuilder.roleThemeOwned":
		"Ditt tema tillhandahåller denna callout, så den har bara ett block-format.",
	"commandBuilder.commandSuspended":
		"Pausad: ditt tema tillhandahåller denna callout, så den har bara ett block-format. Kommandot fungerar igen när temat slutar tillhandahålla den.",
	"commandBuilder.callout": "Callout-typ",
	"commandBuilder.calloutDesc": "Callouten kommandot infogar.",
	"commandBuilder.headingLevel": "Rubriknivå",
	"commandBuilder.headingLevelDesc": "Vilken rubriknivå som ska skrivas.",
	"commandBuilder.action": "Åtgärd",
	"commandBuilder.actionDesc":
		"Lägg i omvandlar markeringen till en callout; infoga lägger till en tom.",
	"commandBuilder.actionWrap": "Lägg i markering",
	"commandBuilder.actionInsert": "Infoga ny",
	"commandBuilder.preview": "Kommandonamn",
	"commandBuilder.duplicate":
		"Du har redan ett kommando som gör exakt detta.",
	"commandBuilder.noCallouts":
		"Det finns inga callout-typer att bygga ett kommando från än.",
	"commandBuilder.save": "Spara",

	"settings.vaultMaintenance": "Vault-insikter och underhåll",
	"settings.vaultStats": "Callout-statistik",
	"settings.vaultStatsDesc":
		"Räknar alla callouts i dina Markdown-anteckningar — block, rubrik och inline — och grupperar dem efter typ.",
	"settings.vaultStatsButton": "Visa statistik",
	"settings.vaultStatsScanning": "Skannar",
	"settings.resetAll": "Återställ",
	"settings.resetAllDesc":
		"Tar bort alla användarcallouts, återställer inbyggda callouts, globala stilar (kanter, typsnittsskala, form), sparade färgpaletter, anpassningen av högerklicksmenyn och nedladdade Material-SVG:er.",
	"settings.resetAllButton": "Återställ allt",
	"settings.resetAllConfirm":
		"Detta tar bort alla anpassade callouts, återställer inbyggda callouts, globala stilar, sparade färgpaletter, anpassningen av högerklicksmenyn och alla cachade Material-SVG:er. Åtgärden kan inte ångras. Är du säker?",
	"notice.resetAllDone": "Allt har återställts till standard.",

	"notice.customCommandsRemoved":
		"{{count}} eget kommando/egna kommandon vars callout-typ inte längre finns togs bort.",
	"notice.customCommandMissingCallout":
		"Kommandots callout-typ finns inte längre.",
	"notice.exported": "Callouts exporterade till callout-studio-export.json",
	"notice.importedJSON": "{{count}} callout-typ(er) importerade från JSON.",
	"notice.importedSettings": "Tilläggets inställningar importerade.",
	"notice.importedCalloutManager":
		"Importerat från Callout Manager: {{created}} skapade, {{updated}} uppdaterade.",
	"notice.importedAdmonition":
		"Importerat från Admonition: {{created}} skapade, {{updated}} " +
		"uppdaterade.",
	"notice.noNewJSON":
		"Inga nya callout-typer importerades (ID:n kan redan finnas).",
	"notice.iconDownloadFailed":
		'Det gick inte att ladda ned Material-ikonen "{{name}}". Den kanske inte är tillgänglig för den här stilen/vikten, eller så är anslutningen offline.',
	"notice.externalCssOn":
		'Callout Studio stylar inte längre "{{name}}" — din egen CSS avgör hur den ser ut. Dess Rubrik-callout- och Infogad callout-format renderas inte.',
	"notice.externalCssOff": 'Callout Studio stylar nu "{{name}}" igen.',
	"notice.nothingToWrap": "Inget att lägga i callout.",
	"notice.cursorNotInsideCallout": "Markören är inte inne i en callout.",
	"notice.autocompleteTargetMoved":
		"Ingenting infogades — raden ändrades medan redigeraren var öppen.",
	"notice.openHotkeysFailed":
		"Det gick inte att öppna Obsidians genväginställningar.",
	"notice.filterHotkeysFailed":
		"Obsidians genvägar öppnades, men Callout Studio-filtret kunde inte tillämpas.",

	"editor.editCallout": "Redigera callout",
	"editor.newCallout": "Ny callout",
	"editor.displayName": "Visningsnamn",
	"editor.displayNameDesc": "Den läsbara etiketten som visas i gränssnittet",
	"editor.displayNameBuiltIn":
		"Visningsnamnet kan inte ändras för inbyggda callouts",
	"editor.displayNamePlaceholder": "Min callout",
	"editor.calloutIds": "Callout-ID:n",
	"editor.calloutIdsDesc":
		"Alla identifierare för denna callout. Blanksteg är tillåtna.\nTryck Enter eller +-knappen för att lägga till.",
	"editor.calloutIdsPlaceholder": "Lägg till ID",
	"editor.addId": "Lägg till ID",
	"editor.idLinkedToName": "Länkad till visningsnamnet",
	"editor.idCannotDelete":
		"Detta ID är länkat till visningsnamnet och kan inte tas bort — redigera namnet för att ändra det",
	"editor.icon": "Ikon",
	"editor.pickIcon": "Ändra ikon",
	"editor.replaceIcon": "Ersätt ikon",
	"editor.removeIcon": "Ta bort ikon",
	"editor.noIcon": "Ingen ikon",
	"editor.resetIcon": "Återställ ikon till standard",
	"editor.livePreview": "Live-förhandsvisning",
	"editor.iconAdjustment": "Ikonjustering",
	"editor.picture": "Bild",
	"editor.size": "Storlek",
	"editor.horizontalOffset": "Horisontell förskjutning",
	"editor.verticalOffset": "Vertikal förskjutning",
	"editor.colors": "Färger",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Återställ färger till standard",
	"editor.paletteDeleted": "Borttagen färg",
	"editor.paletteGroupObsidian": "Obsidian-callouts",
	"editor.paletteGroupPresets": "Färgförinställningar",
	"editor.paletteGroupCustom": "Anpassad",
	"editor.paletteNewColor": "Ny färg…",
	"editor.contrastWarning":
		"Låg kontrast mot bakgrunden — kan vara svårt att läsa",
	"editor.foldable": "Vikbar",
	"editor.foldableDesc":
		"Välj om callout kan vikas och vilket standardläge som ska gälla i hela vault.",
	"editor.foldOff": "Av",
	"editor.foldOpen": "Öppen som standard",
	"editor.foldClosed": "Stängd som standard",
	"editor.cancel": "Avbryt",
	"editor.saveChanges": "Spara ändringar",
	"editor.createCallout": "Skapa callout",
	"editor.nameRequired": "Ett visningsnamn krävs innan du skapar en callout.",
	"editor.noChangesToSave": "Inga ändringar gjordes.",
	"editor.downloadingIcon": "Laddar ned ikon",
	"editor.idEmpty": "Minst ett ID krävs",
	"editor.idExists": "En callout med detta ID finns redan",
	"editor.idConflict": "Detta ID krockar med en befintlig callout",
	"editor.idDashConflict":
		'Obsidian skriver mellanslag som bindestreck, så detta ID krockar med "{{other}}"',
	"editor.idFromTheme":
		"{{theme}} tillhandahåller redan en callout med detta ID, så Callout Studio kan inte stila den. Välj ett annat ID.",
	"editor.idThemePattern":
		"Obs: ditt tema stilar alla callouts som matchar {{pattern}}, så det kan påverka hur den här ser ut.",
	"editor.untitledCallout": "Namnlös Callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Här är en infogad [!{id}]-pill inuti ett stycke.",
	"editor.previewReadOnly": "Livevyn kan inte redigeras",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} – tillhandahålls av ditt tema',
	"themePreview.owned":
		'{{theme}} tillhandahåller och stilar "{{name}}". Callout Studio åsidosätter den inte, så blockcalloutens utseende är exakt som ditt tema ritar den.',
	"themePreview.readOnly":
		"Det betyder att dess färg, ikon, namn och ID inte kan ändras här. Om du vill ha en egen design, skapa en ny callout med ett annat ID.",
	"themePreview.blockOnly":
		"Rubrik- och inline-format är inte tillgängliga för callouts som tillhandahålls av ditt tema. Blockcallouts använder temats egen stil.",
	"themePreview.previewTitle": "Så ser den ut nu",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Så här ser calloutens innehåll ut.\n",
	"editor.externalStyleClose": "Förstått",

	// Palette editor modal
	"palette.newTitle": "Ny färgpalett",
	"palette.groupPalette": "Palett",
	"palette.editTitle": "Redigera färgpalett",
	"palette.name": "Namn",
	"palette.namePlaceholder": "Min palett",
	"palette.nameExists": "En palett med detta namn finns redan",
	"palette.baseColor": "Basfärg",
	"palette.baseColorHint":
		"Vi matchar automatiskt bakgrundsfärgen till den. Om du vill kan du styra den separat genom att {{link}}.",
	"palette.baseColorHintLink": "klicka här",
	"palette.advancedColors": "Färger",
	"palette.advancedColorsHint":
		"Redigerar färger för {{mode}}-läge - det andra läget uppdateras automatiskt. Byt Obsidian-tema för att kontrollera det.",
	"palette.revertHint": "Föredrar du en enda basfärg istället? {{link}}.",
	"palette.revertHintLink": "Återställ",
	"palette.lightMode": "Ljust",
	"palette.darkMode": "Mörkt",
	"palette.accentColor": "Accentfärg",
	"palette.backgroundColorChannel": "Bakgrundsfärg",
	"palette.textColorChannel": "Textfärg",
	"palette.bgIntensity": "Intensitet",
	"palette.bgStyle": "Stil",
	"palette.bgSolid": "Enfärgad",
	"palette.bgGradient": "Gradient",
	"palette.bgTransparent": "Genomskinlig",
	"palette.gradientTo": "Andra färgen",
	"palette.gradientDirection": "Riktning",
	"palette.gradientText": "Titeltext med gradient",
	"palette.save": "Spara",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Röd",
	"colorName.orange": "Orange",
	"colorName.amber": "Bärnsten",
	"colorName.yellow": "Gul",
	"colorName.lime": "Lime",
	"colorName.green": "Grön",
	"colorName.teal": "Petrol",
	"colorName.cyan": "Cyan",
	"colorName.sky": "Himmelsblå",
	"colorName.blue": "Blå",
	"colorName.indigo": "Indigo",
	"colorName.violet": "Violett",
	"colorName.purple": "Lila",
	"colorName.pink": "Rosa",
	"colorName.rose": "Cerise",
	"colorName.brown": "Brun",
	"colorName.gray": "Grå",
	"colorName.black": "Svart",
	"colorName.white": "Vit",
	"colorName.crimson": "Karmosinröd",
	"colorName.coral": "Korall",
	"colorName.grape": "Druva",
	"colorName.plum": "Plommon",
	"colorName.bubblegum": "Tuggummi",

	"iconPicker.pickIcon": "Välj en ikon",
	"iconPicker.confirm": "Bekräfta",
	"iconPicker.cancel": "Avbryt",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "sök Lucide-ikoner",
	"iconPicker.searchTabler": "sök Tabler-ikoner",
	"iconPicker.tablerStyle": "Ikonstil",
	"iconPicker.tablerStyleOutline": "Kontur",
	"iconPicker.tablerStyleFilled": "Fylld",
	"iconPicker.loadMore": "Ladda fler",
	"iconPicker.materialStyle": "Ikonstil",
	"iconPicker.materialStyleOutlined": "Konturerad (Outlined)",
	"iconPicker.materialStyleFilled": "Fylld (Filled)",
	"iconPicker.materialStyleRounded": "Rundad (Rounded)",
	"iconPicker.materialStyleSharp": "Skarp (Sharp)",
	"iconPicker.materialWeight": "Ikontjocklek",
	"iconPicker.materialWeight100": "Tunn (Thin)",
	"iconPicker.materialWeight200": "Extra lätt (Extra Light)",
	"iconPicker.materialWeight300": "Lätt (Light)",
	"iconPicker.materialWeight400": "Normal (Regular)",
	"iconPicker.materialWeight500": "Medel (Medium)",
	"iconPicker.materialWeight600": "Halvfet (Semi Bold)",
	"iconPicker.materialWeight700": "Fet (Bold)",
	"iconPicker.materialFontFailed":
		"Det gick inte att läsa in förhandsgranskningarna av Material-ikonerna. I stället visas ikonernas namn — sökning och val fungerar fortfarande.",
	"iconPicker.materialFontRetry": "Försök igen",
	"iconPicker.searchMaterial": "sök Material-ikoner",
	"iconPicker.searchEmoji": "Sök emoji",
	"iconPicker.skinTone": "Hudton",
	"iconPicker.allCategories": "Alla kategorier",
	"iconPicker.noIconSelected": "Ingen ikon vald",
	"iconPicker.noResults": "Inga ikoner matchar din sökning.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Sök i Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Sök i Font Awesome",
	"iconPicker.faStyle": "Ikonstil",
	"iconPicker.faStyleSolid": "Solid",
	"iconPicker.faStyleRegular": "Regular",
	"iconPicker.faStyleBrands": "Varumärken",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Sök i RPG Awesome",
	"iconPicker.image": "Dina bilder",
	"iconPicker.searchImage": "Sök i dina bilder",
	"iconPicker.imageTooLarge":
		"{{name}} är för stor. Bilder måste vara under 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} är inte ett format som stöds. Använd SVG, PNG, JPEG eller WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} kunde inte läsas som en säker SVG och lades inte till.",
	"iconPicker.imageDecodeFailed": "{{name}} kunde inte läsas som en bild.",
	"iconPicker.imageDuplicate":
		"{{name}} finns redan i dina bilder. Byt namn på filen eller ta bort den befintliga bilden.",
	"iconPicker.imageAdd": "Lägg till bilder",
	"iconPicker.imageEmpty":
		"Inga bilder ännu. Lägg till en SVG-, PNG-, JPEG- eller WebP-fil från din dator eller dra den hit.",
	"iconPicker.imageDelete": "Ta bort",
	"iconPicker.imageDeleteConfirm": "Ta bort „{{name}}“?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callouts använder den här bilden. De visar en platshållarikon tills du ger dem en ny.",
	"iconPicker.imageRecolor": "Följ Callout-färg",
	"iconPicker.allSources": "Alla källor",
	"iconPicker.searchAllSources": "Sök i alla ikonfontskällor",
	"iconPicker.sourcesNotDownloaded":
		"Inte inkluderat ännu: {{names}}. Välj en källa ovan för att ladda ner den.",
	"iconPicker.chooseSource": "Välj källa",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "sök i alla bibliotek på en gång",
	"iconPicker.descLucide": "Obsidians eget set, alltid offline",
	"iconPicker.descTabler": "rena och konsekventa UI-ikoner, kontur och fylld",
	"iconPicker.descMaterial": "Googles set, fyra stilar och sju tjocklekar",
	"iconPicker.descEmoji": "färgglada glyfer, alla hudtoner",
	"iconPicker.descOcticons": "GitHubs gränssnittsikoner",
	"iconPicker.descFa": "solid, regular och varumärken",
	"iconPicker.descRpgAwesome": "fantasy- och sällskapsspelsikoner",
	"iconPicker.descImage": "bilder du lägger till från din dator",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Tillgänglighet",
	"iconPicker.cat.Actions": "Åtgärder",
	"iconPicker.cat.Activities": "Aktiviteter",
	"iconPicker.cat.Alert": "Varning",
	"iconPicker.cat.Alphabet": "Alfabet",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Djur",
	"iconPicker.cat.Arrows": "Pilar",
	"iconPicker.cat.Astronomy": "Astronomi",
	"iconPicker.cat.Audio&Video": "Ljud och video",
	"iconPicker.cat.Automotive": "Bilar",
	"iconPicker.cat.Badges": "Märken",
	"iconPicker.cat.Brand": "Varumärke",
	"iconPicker.cat.Buildings": "Byggnader",
	"iconPicker.cat.Business": "Näringsliv",
	"iconPicker.cat.Camping": "Camping",
	"iconPicker.cat.Charity": "Välgörenhet",
	"iconPicker.cat.Charts": "Diagram",
	"iconPicker.cat.Charts + Diagrams": "Diagram och grafer",
	"iconPicker.cat.Childhood": "Barndom",
	"iconPicker.cat.Clothing + Fashion": "Kläder och mode",
	"iconPicker.cat.Coding": "Programmering",
	"iconPicker.cat.Communicate": "Kommunicera",
	"iconPicker.cat.Communication": "Kommunikation",
	"iconPicker.cat.Computers": "Datorer",
	"iconPicker.cat.Connectivity": "Anslutning",
	"iconPicker.cat.Construction": "Byggnation",
	"iconPicker.cat.Currencies": "Valutor",
	"iconPicker.cat.Database": "Databas",
	"iconPicker.cat.Design": "Design",
	"iconPicker.cat.Development": "Utveckling",
	"iconPicker.cat.Devices": "Enheter",
	"iconPicker.cat.Devices + Hardware": "Enheter och hårdvara",
	"iconPicker.cat.Disaster + Crisis": "Katastrofer och kriser",
	"iconPicker.cat.Document": "Dokument",
	"iconPicker.cat.E-commerce": "E-handel",
	"iconPicker.cat.Editing": "Redigering",
	"iconPicker.cat.Education": "Utbildning",
	"iconPicker.cat.Electrical": "Elektrisk",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Energi",
	"iconPicker.cat.Extensions": "Tillägg",
	"iconPicker.cat.Files": "Filer",
	"iconPicker.cat.Film + Video": "Film och video",
	"iconPicker.cat.Food": "Mat",
	"iconPicker.cat.Food + Beverage": "Mat och dryck",
	"iconPicker.cat.Fruits + Vegetables": "Frukt och grönsaker",
	"iconPicker.cat.Games": "Spel",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Kön",
	"iconPicker.cat.Genders": "Kön",
	"iconPicker.cat.Gestures": "Gester",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Händer",
	"iconPicker.cat.Hardware": "Hårdvara",
	"iconPicker.cat.Health": "Hälsa",
	"iconPicker.cat.Holidays": "Högtider",
	"iconPicker.cat.Home": "Hem",
	"iconPicker.cat.Household": "Hushåll",
	"iconPicker.cat.Humanitarian": "Humanitär",
	"iconPicker.cat.Images": "Bilder",
	"iconPicker.cat.Laundry": "Tvätt",
	"iconPicker.cat.Letters": "Bokstäver",
	"iconPicker.cat.Logic": "Logik",
	"iconPicker.cat.Logistics": "Logistik",
	"iconPicker.cat.Map": "Karta",
	"iconPicker.cat.Maps": "Kartor",
	"iconPicker.cat.Maritime": "Maritim",
	"iconPicker.cat.Marketing": "Marknadsföring",
	"iconPicker.cat.Math": "Matematik",
	"iconPicker.cat.Mathematics": "Matematik",
	"iconPicker.cat.Media": "Media",
	"iconPicker.cat.Media Playback": "Mediauppspelning",
	"iconPicker.cat.Medical + Health": "Medicin och hälsa",
	"iconPicker.cat.Money": "Pengar",
	"iconPicker.cat.Mood": "Humör",
	"iconPicker.cat.Moving": "Flytt",
	"iconPicker.cat.Music + Audio": "Musik och ljud",
	"iconPicker.cat.Nature": "Natur",
	"iconPicker.cat.Numbers": "Siffror",
	"iconPicker.cat.Photography": "Fotografering",
	"iconPicker.cat.Photos + Images": "Foton och bilder",
	"iconPicker.cat.Political": "Politisk",
	"iconPicker.cat.Privacy": "Integritet",
	"iconPicker.cat.Punctuation + Symbols": "Skiljetecken och symboler",
	"iconPicker.cat.Religion": "Religion",
	"iconPicker.cat.Science": "Vetenskap",
	"iconPicker.cat.Science Fiction": "Science fiction",
	"iconPicker.cat.Security": "Säkerhet",
	"iconPicker.cat.Shapes": "Former",
	"iconPicker.cat.Shopping": "Shopping",
	"iconPicker.cat.Social": "Sociala medier",
	"iconPicker.cat.Spinners": "Snurror",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sport och träning",
	"iconPicker.cat.Symbols": "Symboler",
	"iconPicker.cat.System": "System",
	"iconPicker.cat.Text": "Text",
	"iconPicker.cat.Text Formatting": "Textformatering",
	"iconPicker.cat.Time": "Tid",
	"iconPicker.cat.Toggle": "Växla",
	"iconPicker.cat.Transit": "Kollektivtrafik",
	"iconPicker.cat.Transportation": "Transport",
	"iconPicker.cat.Travel": "Resor",
	"iconPicker.cat.Travel + Hotel": "Resor och hotell",
	"iconPicker.cat.UI actions": "Gränssnittsåtgärder",
	"iconPicker.cat.Users + People": "Användare och personer",
	"iconPicker.cat.Vehicles": "Fordon",
	"iconPicker.cat.Version control": "Versionshantering",
	"iconPicker.cat.Weather": "Väder",
	"iconPicker.cat.Writing": "Skrivande",
	"iconPicker.cat.Zodiac": "Stjärntecken",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} har inte laddats ner än",
	"iconPack.downloadDetail":
		"{{count}} ikoner · {{size}} · engångsnerladdning",
	"iconPack.download": "Ladda ner",
	"iconPack.downloading": "Laddar ner {{name}}…",
	"iconPack.downloadFailed":
		"Kunde inte ladda ner {{name}}. Kontrollera din anslutning och försök igen.",
	"iconPack.retry": "Försök igen",
	"iconPack.faBrandsNotice":
		"Varumärkesikoner är varumärken som tillhör respektive ägare. Deras inkludering indikerar inte ett godkännande. Använd dem bara för att representera det företag, den produkt eller tjänst de hänvisar till.",
	"iconPack.artworkRestored": "Ikonbilderna för {{names}} har laddats ner.",
	"iconPack.diskWriteFailed":
		"Callout Studio kunde inte spara ikonpaketet på disk, så det måste laddas ner igen nästa gång. Ikonerna du väljer sparas fortfarande med dina inställningar.",

	// Icon licences & credits
	"credits.title": "Ikonlicenser och erkännanden",
	"credits.intro":
		"Callout Studio använder flera öppna ikonbibliotek. Deras licenser återges nedan, tillsammans med vad som ändrades för att använda dem här.",
	"credits.fullNotices": "Fullständiga tredjepartsmeddelanden",
	"credits.pluginLicense":
		"Callout Studios egen kod är under en permissiv licens; ikonbiblioteken behåller sina egna licenser.",

	"contextMenu.editCallout": "Redigera callout-inställningar",
	"contextMenu.copyMarkdown": "Kopiera callout Markdown",
	"contextMenu.openSettings": "Öppna Callout Studio-inställningar",
	"contextMenu.setFoldClosed": "Ställ in callout som stängd (-)",
	"contextMenu.setFoldOpen": "Ställ in callout som öppen (+)",
	"contextMenu.setFoldNone": "Gör callout icke-vikbar",
	"contextMenu.cutSection": "Klipp ut rubriksektion",
	"contextMenu.copySection": "Kopiera rubriksektion",
	"contextMenu.deleteSection": "Ta bort rubriksektion",
	"heading.toggleFold": "Växla vikning",
	"settings.globalSettings": "Stilalternativ för Callout Studio",
	"settings.globalSettingsScope":
		"Form, avstånd och storlek för de callouts som Callout Studio stilar. Callouts som ditt tema stilar behåller temats egen design.",
	"settings.globalSettingsRegularDesc":
		"Lägg till en callout-token i ett citat (t.ex. `> [!type]`) för att rendera Obsidians inbyggda callout-ruta. Du kan justera dess kant, hörnrundning, typsnittsskala och justering.",
	"settings.globalSettingsHeadingDesc":
		"Lägg till en callout-token direkt efter rubrikens fyrkanter (t.ex. `## [!type]`) för att rendera den som en stiliserad callout-rubrik. Du kan justera dess kant, form och vertikalt mellanrum.",
	"settings.globalSettingsInlineDesc":
		"Lägg till en callout-token var som helst i en textrad (t.ex. `[!type]`) för att rendera den som en liten infogad pill. Du kan justera dess kant och form.",
	"settings.globalSettingsCustomize": "Anpassa",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Rubrik-callout",
	"settings.calloutTypeInline": "Infogad callout",
	"settings.customizeMenu": "Anpassa menyalternativ",
	"settings.customizeMenuDesc":
		"Välj vilka högerklicksåtgärder som visas för varje callout-typ och ändra deras ordning. Fungerar i källäge och Live Preview.",
	"settings.customizeMenuButton": "Anpassa menyalternativ",
	"menuCustomize.title": "Anpassa högerklicksmenyn",
	"menuCustomize.desc":
		"Aktivera eller inaktivera åtgärder och dra i handtaget för att ändra ordningen. Ändringar sparas automatiskt.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Rubrik-callout",
	"menuCustomize.inline": "Infogad callout",
	"menuCustomize.dragHandle": "Dra för att ändra ordning",
	"menuItem.edit": "Redigera callout",
	"menuItem.openSettings": "Öppna inställningar",
	"menuItem.copyMarkdown": "Kopiera Markdown",
	"menuItem.foldDefaults": "Standardvikning (öppen / stängd / ingen)",
	"menuItem.cutSection": "Klipp ut sektion",
	"menuItem.copySection": "Kopiera sektion",
	"menuItem.deleteSection": "Ta bort sektion",

	"confirm.ok": "Ta bort",
	"confirm.cancel": "Avbryt",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Ta bort kommando",
	"confirm.titleResetAll": "Återställ alla callouts",
	"confirm.titleResetCallout": "Återställ callout",
	"confirm.titleDeletePalette": "Ta bort palett",
	"confirm.titleDeleteImage": "Ta bort bild",

	"vault.filesUpdated":
		"{{count}} callout-referens(er) uppdaterade i vault-filer.",
	"vault.idsUpdated":
		"{{count}} callout-ID:n uppdaterade i vault-filer: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"{{count}} callout-rubrik(er) uppdaterade i vault-filer: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Ersätt med:",
	"vault.deleteWithout": "Ta bort utan att ersätta",
	"vault.confirmDelete": "Bekräfta",
	"vault.confirmReplace": "Ersätt",
	"vault.replacePromptInUse":
		'"{{name}}" används {{count}} gång(er) i {{files}} fil(er). Välj en callout att ersätta den med:',
	"vault.replacePromptUnused": 'Välj en callout att ersätta "{{name}}" med:',
	"vault.noReplacementAvailable":
		"Inga andra callouts tillgängliga för att ersätta denna.",
	"vault.convertedToPlainText":
		"{{blocks}} callout-block i {{files}} fil(er) konverterade till vanlig text.",
	"vault.resetAliasWarning":
		"{{count}} referens(er) i {{files}} fil(er) använder anpassade alias: {{aliases}}. Dessa slutar fungera efter återställning. Fortsätta?",
	"vault.resetConfirm": "Återställ",
	"vault.resetAllInUse":
		"⚠ {{count}} callout-referens(er) i {{files}} fil(er) använder anpassade callout-typer som tas bort.",

	"quickInsert.title": "Snabbinfoga block-callout",
	"quickInsert.desc": "Välj en callout att infoga vid markören. Endast block-callouts.",
	"quickInsert.searchPlaceholder": "Sök callouts",
	"quickInsert.sourceAria": "Filtrera efter callout-källa",
	"quickInsert.sourceAll": "Alla",
	"quickInsert.sourceBuiltIn": "Inbyggd",
	"quickInsert.sourceUser": "Mina callouts",
	"quickInsert.editAria": "Redigera {{name}}",
	"quickInsert.insertAria": "Infoga {{name}} som block-callout",
	"quickInsert.noResults": "Inga callouts hittades",
	"quickInsert.noUserCallouts": "Du har inte skapat några callouts än.",
	"quickInsert.noEditorHint": "Ingen anteckning är öppen i redigeringsläge, så inget kan infogas.",
	"quickInsert.noEditor": "Öppna en anteckning i redigeringsläge för att infoga en callout.",

	"vaultStats.title": "Callout-statistik",
	"vaultStats.totalCallouts": "Totalt callouts",
	"vaultStats.typesFound": "Hittade typer",
	"vaultStats.filesWithCallouts": "Filer med callouts",
	"vaultStats.filesScanned": "Skannade Markdown-filer",
	"vaultStats.empty": "Inga callouts hittades i Markdown-anteckningar.",
	"vaultStats.columnType": "Typ",
	"vaultStats.columnName": "Namn",
	"vaultStats.columnSource": "Källa",
	"vaultStats.columnCount": "Antal",
	"vaultStats.columnFiles": "Filer",
	"vaultStats.unknown": "Okänd",
	"vaultStats.sourceBuiltIn": "Inbyggd",
	"vaultStats.sourceCustom": "Anpassad",
	"vaultStats.sourceAutoFallback": "Automatisk reserv",
	"vaultStats.sourceTheme": "CSS-kodavsnitt",
	"vaultStats.sourceAlias": "Alias för {{id}}",
	"vaultStats.sourceUnknown": "Okänd",
	"vaultStats.byRole": "Skriven som",
	"vaultStats.roleBlock": "Block",
	"vaultStats.roleHeading": "Rubrik",
	"vaultStats.roleInline": "Infogad",
	"vaultStats.defineUndefined": "Definiera {{count}} saknade",
	"vaultStats.defineRunning": "Skannar",
	"vaultStats.defineDone": "Lade till {{count}} callout-typer.",
	"vaultStats.close": "Stäng",

	"import.title": "Importproblem",
	"import.reportLeadIn":
		"Det verkar som att den importerade filen har ändrats. Här är problemlistan:",
	"import.reportLeadInFatal":
		"Den här filen ser inte ut som en Callout Studio-export. Den kan inte importeras:",
	"import.entryHeading": "Post {{index}} — {{label}}",
	"import.summary":
		"{{valid}} av {{total}} poster är giltiga · {{issues}} problem hittades.",
	"import.btnCancel": "Avbryt",
	"import.btnImportValid": "Importera bara giltiga ({{count}})",
	"import.err.notRecognized":
		"Okänd fil: en array med callout-definitioner eller en Callout Studio-export förväntades.",
	"import.warn.settingsIgnored":
		"Inställningsblocket var inte ett giltigt objekt och ignorerades.",
	"import.warn.invalidGradient":
		"Bakgrundsgradienten var ogiltig och ignorerades.",
	"import.err.parseFailed":
		"Filen är inte giltig JSON och kunde inte tolkas.",
	"import.err.entryNotObject": "Posten måste vara ett objekt.",
	"import.err.requiredMissing":
		'Det obligatoriska fältet "{{field}}" saknas eller har fel typ.',
	"import.err.idEmpty": "ID:t får inte vara tomt.",
	"import.err.idTooLong":
		'ID:t "{{value}}" är {{length}} tecken; maxvärdet är {{max}}.',
	"import.err.idBadChar":
		'ID:t "{{value}}" innehåller ogiltiga tecken ("|", "[", "]", tabbar och radbrytningar är inte tillåtna).',
	"import.err.idMetadata":
		'ID:t "{{value}}" innehåller ett "|". I Obsidian är allt efter det första "|" callout-metadata, inte en del av typen, så den här posten beskriver callouten "{{id}}". Hoppades över, så att ditt befintliga "{{id}}" lämnas oförändrat.',
	"import.err.idReserved":
		'ID:t "{{value}}" är reserverat av Callout Studio för dess egna förhandsvisningar och kan inte importeras.',
	"import.err.displayNameEmpty": "Visningsnamnet får inte vara tomt.",
	"import.err.displayNameTooLong":
		"Visningsnamnet är {{length}} tecken; maxvärdet är {{max}}.",
	"import.err.boolField":
		'"{{field}}" måste vara ett booleskt värde (true eller false).',
	"import.err.iconNotObject": "Ikonen måste vara ett objekt.",
	"import.err.iconTypeInvalid":
		'Ikontypen "{{value}}" är inte en av: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" gäller bara för Material-ikoner och ignoreras för ikontyp {{type}}.',
	"import.err.iconValueEmpty": "Ikonvärdet måste vara en icke-tom sträng.",
	"import.err.iconValueTooLong":
		"Ikonvärdet är ovanligt långt ({{length}} tecken).",
	"import.err.materialStyle":
		'Material-ikonstilen "{{value}}" är inte en av: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Material-ikontjockleken "{{value}}" måste vara ett heltal mellan 100 och 700, i steg om 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" gäller bara för egna bilder och ignoreras för ikontyp {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" måste vara true eller false (fick "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" måste vara en hexadecimal färg som "#448aff" (fick "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" måste vara ett tal mellan {{min}} och {{max}} (fick "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" måste vara ett tal mellan {{min}} och {{max}} (fick "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" måste vara en array av strängar.',
	"import.err.aliasNotString": "Aliaset måste vara en sträng.",
	"import.err.aliasDup":
		'Aliaset "{{value}}" är duplicerat inom den här posten.',
	"import.err.tooManyIds":
		"För många ID:n ({{count}}); varje callout kan ha högst {{max}} ID:n (primärt + alias).",
	"import.err.metadataShape":
		'"metadata" måste vara ett objekt vars alla värden är strängar.',
	"import.warn.unknownFields": "Okända fält ignorerades: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/aliaset "{{value}}" används redan av post #{{first}} i den här filen.',
	"import.err.aliasConflict":
		'Aliaset "{{value}}" används redan av en annan callout ("{{other}}") i ditt vault.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" var true medan "foldable" var false; defaultFolded återställdes till false.',
	"import.warn.imageMissing":
		"Den här Callout använder en bild som inte finns i filen och inte i det här vault, så den visar en platshållarikon tills du ger den en ny.",

	"import.err.paletteIdInvalid":
		'"paletteId" måste vara ett icke-tomt text-ID (fick "{{value}}").',
	"import.warn.iconNameUnknown":
		'Det finns ingen "{{value}}" ikon i {{type}}, så standardikonen användes istället.',
	"import.warn.cmIconUnknownNew":
		'Ikonen "{{value}}" finns inte i det här valvet, så standardikonen användes istället.',
	"import.warn.cmIconUnknownExisting":
		'Ikonen "{{value}}" finns inte i det här valvet, så "{{id}}" behöll ikonen det redan hade.',
	"import.chooseSource": "Importera från",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Läs in en .json-fil exporterad från Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Ta med dina anpassade callouts från tillägget Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Hämta dina egna admonitions från Admonition-tillägget.",
	"import.cmTitle": "Importera från Callout Manager",
	"import.cmInstructions":
		"Varje anpassad callout tas med tillsammans med sin ikon och färg. Temaspecifik " +
		"styling och egen CSS har ingen motsvarighet här och lämnas kvar.",
	"import.cmFromVault": "Det här valvet",
	"import.cmVaultChecking": "Söker efter tillägget Callout Manager…",
	"import.cmVaultFound": "{{count}} anpassad(e) callout(s) hittades.",
	"import.cmVaultNotFound":
		"Inga anpassade callouts hittades i det här valvet.",
	"import.cmPasteLabel":
		"Eller klistra in Callout Managers kopierade stilar här:",
	"import.cmPlaceholder":
		"Klistra in de kopierade stilarna, eller en data.json, här…",
	"import.cmBtnCancel": "Avbryt",
	"import.cmBtnImport": "Importera",
	"import.err.cmNoBlocksFound":
		"Inga Callout Manager-stilar hittades i den inklistrade texten.",
	"import.err.cmNotRecognized":
		"Filen kändes inte igen: förväntade stilarna från Callout Managers Copy-knapp, " +
		"eller en data.json från Callout Manager.",
	"import.err.cmNoEntries": "Inga anpassade callouts hittades att importera.",
	"import.err.cmNoColorForNew":
		'Ingen användbar färg hittades för den nya callouten "{{value}}"; den hoppades över.',
	"import.err.cmIdConflict":
		'ID "{{value}}" används redan som ett alias av en annan callout ("{{other}}") och hoppades över.',
	"import.warn.cmNoColorDefault":
		"Ingen färg var angiven i Callout Manager, så dess standardgrå användes.",
	"import.warn.cmThemeCondition":
		"Den här calloutens färg eller ikon var bara angiven för ett tema. Callout " +
		"Studio har ingen temaspecifik styling, så den togs med för alla teman.",
	"import.warn.cmCustomStyles":
		"Den här callouten har också egen CSS i Callout Manager. Den stylingen är " +
		"inte en del av importen, så bara dess ikon och färg togs med.",

	// Import — Admonition
	"import.admTitle": "Importera från Admonition",
	"import.admInstructions":
		"Varje admonition kommer över som en callout med namn, ikon och " +
		"färg. Inställningar utan motsvarighet i Callout Studio " +
		"(kommando, kopieringsknapp, dold titel) lämnas kvar.",
	"import.admFromVault": "Det här valvet",
	"import.admVaultChecking": "Letar efter Admonition-tillägget…",
	"import.admVaultFound": "{{count}} egna admonitions hittades.",
	"import.admVaultNotFound":
		"Inga egna admonitions hittades i det här valvet.",
	"import.admFromFile": "En fil",
	"import.admFromFileDesc": "En admonitions.json-fil eller ett delat paket.",
	"import.admChooseFile": "Välj fil…",
	"import.admPasteLabel": "Eller klistra in JSON här:",
	"import.admPlaceholder": "Klistra in dina admonitions här…",
	"import.admBtnCancel": "Avbryt",
	"import.admBtnImport": "Importera",
	"import.err.admNotRecognized":
		"Filen känns inte igen: en lista med admonitions eller en " +
		"data.json från Admonition förväntades.",
	"import.err.admNoEntries": "Inga admonitions att importera hittades.",
	"import.err.admTypeMissing":
		'Den här admonitionen saknar "type" och hoppades över.',
	"import.warn.admIconUnknown":
		'Ingen ikon med namnet "{{value}}" hittades i något ' +
		"ikonbibliotek, så standardikonen användes.",
	"import.warn.admIconUnknownExisting":
		'Ingen ikon med namnet "{{value}}" hittades i något ' +
		'ikonbibliotek, så "{{id}}" behöll ikonen den redan hade.',
	"import.warn.admImageFailed":
		"Den uppladdade bilden gick inte att läsa, så standardikonen " +
		"användes.",
	"import.warn.admIconWithCss":
		"Den här admonitionen formges av ett CSS-snutt i Admonition. Den " +
		"formgivningen ingår inte i importen, så bara namn, ikon och färg " +
		"följde med.",
	"import.warn.admNoColor":
		"Ingen färg var angiven, så standardblått användes.",
	"import.warn.admTitleTruncated":
		"Titeln är {{length}} tecken; den kortades till {{max}}.",

	"footer.tagline":
		"Har du feedback, kommentarer eller förslag? Jag vill gärna höra!",
	"footer.madeBy": "Skapad av Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Ta bort paletten "{{name}}"?\n1 callout använder den. Den behåller sina färger, och du kan återansluta den senare från färgraden i redigeraren.',
	"settings.deletePaletteConfirmLinked":
		'Ta bort paletten "{{name}}"?\n{{count}} callouts använder den. De behåller sina färger, och du kan återansluta dem senare från färgraden i någon av deras redigerare.',
	"settings.unlinkedColors": "Frånkopplade färger",
	"settings.unlinkedColorsDesc":
		"Callouts vars sparade färg togs bort. De behåller färgerna de hade; återställning sparar färgen igen och återansluter hela gruppen.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callouts",
	"settings.restoreColor": "Återställ",
	"settings.palettesMergedNotice":
		"Slog ihop {{count}} importerade palett(er) med sparade färger som redan hade samma färger.",
	"notice.palettesMerged":
		"Slog ihop {{count}} sparade färg(er) som hade identiska färger: {{names}}. Callouts som använder dem behåller sina färger och är nu länkade till färgen som blev kvar.",
	"editor.colorsDescDeleted":
		"Den sparade färgen för denna callout togs bort. Du kan spara den igen genom {{link}}.",
	"editor.colorsDescDeletedOther":
		"Den sparade färgen för denna callout togs bort. Du kan spara den igen genom {{link}} — 1 annan callout som använder den återansluts också.",
	"editor.colorsDescDeletedOthers":
		"Den sparade färgen för denna callout togs bort. Du kan spara den igen genom {{link}} — {{count}} andra callouts som använder den återansluts också.",
	"editor.colorsDescDeletedLink": "att klicka här",
	"palette.colorExists":
		'Dessa färger är identiska med "{{name}}". Två sparade färger kan inte vara samma — ändra en färg för att skilja dem åt.',
	"palette.colorExistsUse":
		'Dessa färger är identiska med "{{name}}". Två sparade färger kan inte vara samma — ändra en färg, eller {{link}}.',
	"palette.colorExistsUseLink": "använda den befintliga",
	"locale.downloading": "Laddar ner översättning…",
	"locale.notDownloaded": "{{name}} har inte laddats ner än",
	"locale.notDownloadedDesc":
		"Callout Studio visar engelska tills översättningen kan laddas ner. Det försöker igen nästa gång Obsidian startar.",
	"locale.retry": "Försök igen",
	"locale.diskWriteFailed":
		"Callout Studio kunde inte spara översättningen på disken, så den måste laddas ner igen nästa gång.",
	"notice.exportedCssCreated": "CSS-utdrag sparat i {{path}}",
	"notice.exportedCssUpdated": "CSS-utdrag uppdaterat i {{path}}",
	"notice.exportedCssUnchanged": "CSS-utdraget är redan uppdaterat.",
	"notice.exportCssEmpty": "Det finns inga anpassade callouts att exportera.",
	"notice.exportCssFailed":
		"CSS-utdraget kunde inte sparas. Kontrollera utvecklarkonsolen för mer information.",
	"notice.exportCssEnabled":
		"Det här utdraget är aktiverat i den här vaulten. Callout Studio formger redan dessa callouts och utdraget behåller stilen från exporten.",
	"confirm.titleOverwriteSnippet": "Skriv över CSS-utdrag",
	"confirm.overwriteSnippet":
		"CSS-utdraget i snippets-mappen har ändrats sedan Callout Studio skrev det. En ny export ersätter hela filen.",
	"confirm.overwriteSnippetOk": "Skriv över",
	"export.chooseFormat": "Exportera som",
	"export.formatJson": "Callout Studio-säkerhetskopia",
	"export.formatJsonDesc":
		"En .json-fil med dina callouts och inställningar för import till en annan vault.",
	"export.formatCss": "CSS-utdrag",
	"export.formatCssDesc":
		"En .css-fil som sparas i den här vaultens snippets-mapp för användning där Callout Studio inte är installerat. Den omfattar bara vanliga callouts och är en ögonblicksbild; exportera igen efter ändringar.",
	"quickInsert.readingViewHint": "Den här anteckningen är öppen i läsläge, så inget kan infogas.",
	"quickInsert.readingView": "Växla till källäge eller Live Preview för att infoga en callout.",
	"quickInsert.noCursorHint": "Det finns ingen markör i den här anteckningen, så det finns ingenstans att infoga.",
	"quickInsert.noCursor": "Placera markören i anteckningen där du vill infoga callouten och försök igen.",
};
