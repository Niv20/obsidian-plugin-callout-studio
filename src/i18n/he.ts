/**
 * i18n/he.ts — Hebrew translation strings.
 *
 * Right-to-left locale file. Mirrors all keys from en.ts with Hebrew
 * translations. Missing keys automatically fall back to the English value
 * at runtime (handled by i18n/index.ts). Imported by i18n/index.ts.
 */
export const he: Record<string, string> = {
	// Commands
	"cmd.openSettings": "פתיחת הגדרות",
	"cmd.createCallout": "יצירת סוג תיבת־הבלטה חדש",
	"cmd.insertEmptyCallout": "הוספת callout ריק",
	"cmd.calloutWrap": "עטיפה ב־callout",
	"cmd.calloutUnwrap": "חילוץ מתוך callout",

	// Commands — names generated for the user's own commands
	"cmd.customWrapBlock": "עטיפה בתיבת־הבלטה בלוקית {{name}}",
	"cmd.customInsertBlock": "הוספת תיבת־הבלטה בלוקית {{name}}",
	"cmd.customInsertHeading": "הוספת כותרת H{{level}} מסוג {{name}}",
	"cmd.customInsertInline": "הוספת תיבת־הבלטה מוטבעת {{name}}",
	"cmd.openQuickInsert": "הוספה מהירה של תיבת־הבלטה מסוג בלוק",

	// Autocomplete
	"autocomplete.createNew": 'יצירת תיבת־הבלטה חדשה: "{{name}}"',

	// Vault scan / fallback / delete
	"settings.fallbackTag": "ברירת־מחדל",
	"settings.fallbackTagAuto": "ברירת־מחדל אוטומטית",
	"settings.rescanVault": "סריקה מחדש של הכספת",
	"settings.rescanVaultDesc":
		"חיפוש מזהים של תיבות־הבלטה לא מוכרות ברחבי הכספת והוספתם כשורות ברירת־מחדל.",
	"settings.rescanVaultHintAction": "סריקה עכשיו",
	"settings.rescanComplete": "הסריקה הסתיימה: נוספו {{count}} בלוקים חדשים.",
	"replaceModal.deleteWithoutReplaceSuffix": "(החלה של ברירת־מחדל)",
	"replaceModal.titleDelete": "מחיקת תיבת־ההבלטה",
	"replaceModal.titleReplace": "החלפה בכספת",

	// פופאפ סריקה ראשונית (מוצג פעם אחת בהתקנה ראשונה ל-Vault גדול)
	"firstRun.title": "לזהות תיבות־הבלטה קיימות בכספת שלכם?",
	"firstRun.body":
		"Callout Studio יכול לסרוק את הכספת ולגלות תיבות־הבלטה שכבר בשימוש, כך שיופיעו ברשימת ההגדרות ויקבלו את עיצוב ברירת־המחדל.",
	"firstRun.heavyVaultNote":
		"בכספת שלכם יש {{count}} קובצי Markdown — הסריקה עשויה להימשך מספר שניות.",
	"firstRun.laterHint":
		"תמיד אפשר להריץ סריקה מאוחר יותר דרך ההגדרות ← סקירה ותחזוקה של הכספת ← סריקה מחדש של הכספת.",
	"firstRun.scanNow": "סריקה עכשיו",
	"firstRun.noThanks": "לא כרגע, תודה",
	"firstRun.autoScanComplete":
		"Callout Studio סרק את הכספת והוסיף {{count}} תיבות־הבלטה.",
	"firstRun.scanning": "סורק...",

	// Welcome / splash screen (shown once on first load; reopen via header icon)
	"welcome.tooltip": "אודות Callout Studio",
	"welcome.title": "ברוכים הבאים ל־Callout Studio",
	"welcome.tagline": "הפתרון המלא שלכם לניהול תיבות־הבלטה ב־Obsidian.",
	"welcome.previewTitle": "לראות איך זה עובד",
	"welcome.sample":
		"Callout Studio מאפשר לכם ליצור תיבות־הבלטה עם אייקון, צבעים ושם מותאמים אישית.\n\n" +
		"אפשר להשתמש באותה תיבת־הבלטה ב־**שלוש** דרכים שונות:\n\n" +
		"## [!tip] ככותרת\n" +
		"כדי להפוך כל כותרת לכותרת בסגנון תיבת־הבלטה, הוסיפו `[!type]` מיד אחרי סימני ה־`#`.\n\n" +
		"רוצים תיבת־הבלטה מוטבעת כמו זו [!warning]? פשוט הוסיפו `[!type]` באמצע משפט, בלי לשבור את הזרימה.\n\n" +
		"> [!note] תיבת־הבלטה רגילה\n" +
		"> כמובן, תיבת־ההבלטה הקלאסית פועלת לפי אותו תחביר בדיוק שאתם כבר מכירים: `> [!type]`.\n\n" +
		"ל־Callout Studio יש עוד הרבה מה להציע! [למידע נוסף]({{repoUrl}}).\n",

	// Delete-callout modal (trash button on user rows)
	"deleteModal.title": 'למחוק את תיבת־ההבלטה "{{name}}"?',
	"deleteModal.bodyInUse":
		"תיבת־הבלטה זו מופיעה {{count}} פעמים ב־{{files}} קבצים.",
	"deleteModal.bodyInUseExplain":
		"המחיקה תהפוך את הבלוקים הללו לטקסט רגיל — הם יאבדו את העיצוב ואת הכותרת של תיבת־ההבלטה.",
	"deleteModal.replaceHint":
		"לחלופין, אפשר להחליפה בתיבת־הבלטה אחרת, וכך לשמור על התוכן בכספת בתור תיבת־הבלטה מעוצבת.",
	"deleteModal.bodyUnused":
		'"{{name}}" אינה מופיעה באף פתק, אך היא תיבת־הבלטה מותאמת־אישית שיצרתם. מחיקתה תסיר אותה מהרשימה.',
	"deleteModal.replaceInstead": "החלפה במקום",
	"deleteModal.deleteInUse": "מחיקה (המרה לטקסט רגיל)",
	"deleteModal.deleteUnused": "מחיקת תיבת־ההבלטה",

	// Settings — Section headings
	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "סוגי תיבות־ההבלטה שלי",
	"settings.builtInCallouts": "תיבות־הבלטה מובנות",
	"settings.contextMenu": "תפריט ההקשר",
	"settings.autocomplete": "השלמה אוטומטית",
	"settings.keyboardShortcuts": "קיצורי מקלדת",
	"settings.language": "שפה",
	"settings.languageDesc":
		"שפת התצוגה של Callout Studio. ברירת־המחדל היא שפת הממשק של Obsidian.",
	"settings.languageAuto": "אוטומטי (לפי Obsidian)",
	"settings.importExport": "ייבוא / ייצוא",
	"settings.import": "ייבוא",
	"settings.export": "ייצוא",
	"settings.importDesc":
		"ייבאו את ההגדרות שלכם ב־Callout Studio מכספת אחרת, או העבירו את תיבות־ההבלטה שלכם מתוסף אחר.",
	"settings.exportDesc":
		"הייצוא שומר את כל סוגי תיבות־ההבלטה המותאמות־אישית שלכם בפורמט JSON.",
	"settings.importConflictNotice":
		"יובאו {{count}} תיבות־הבלטה; {{overwritten}} רשומות קיימות עודכנו.",

	// Settings — Toolbar
	"settings.addNewCallout": "+ הוספת תיבת־הבלטה חדשה",

	// Settings — Empty states
	"settings.noCalloutsNow": "כרגע אין תיבות־הבלטה מותאמות־אישית.",

	// Settings — Row actions
	"settings.editAria": "עריכת {{name}}",
	"settings.moreRowActionsAria": "פעולות נוספות עבור {{name}}",
	"settings.usageInfo": "בשימוש {{count}} פעמים ב־{{files}} קבצים",
	"settings.replaceAction": "החלפה בכספת",
	"settings.deleteAction": "מחיקה",
	"settings.resetAction": "איפוס לברירת־מחדל",
	"settings.makeFallbackAction": "החלת עיצוב ברירת־המחדל",

	// Settings — Fallback callout
	"settings.colorSwatchAria": "הדגשה: {{accent}} · רקע: {{bg}}",
	"settings.externalStyleTag": "עיצוב חיצוני",
	"settings.externalStyleAction": "שימוש בעיצוב חיצוני (ערכת נושא או CSS)",
	"settings.externalStyleBlocked":
		"זוהי תיבת־ההבלטה לברירת המחדל, יש לבחור אחרת קודם",
	"settings.fallbackCallout": "ברירת־מחדל לתיבות־הבלטה",
	"settings.fallbackCalloutDesc":
		"סוגי תיבות־הבלטה לא מוכרות יקבלו את העיצוב של תיבת־הבלטה זו.",

	// Settings — Global style
	"settings.globalStyle": "עיצוב גלובלי לתיבות־הבלטה",
	"settings.border": "מסגרות",
	"settings.borderAll": "הכול",
	"settings.borderTop": "עליונה",
	"settings.borderRight": "ימנית",
	"settings.borderBottom": "תחתונה",
	"settings.borderLeft": "שמאלית",
	"settings.borderWidth": "עובי המסגרת",
	"settings.fontScaleGroup": "קנה־מידה לגופנים",
	"settings.titleScale": "כותרת",
	"settings.contentScale": "תוכן",
	"settings.inlineTextScale": "טקסט",
	"settings.shapeGroup": "צורה",
	"settings.borderRadius": "עיגול הפינות",
	"settings.alignGroup": "יישור",
	"settings.alignContent": "יישור התוכן לכותרת",
	"settings.headingSpacingGroup": "ריווח הכותרת",
	"settings.headingPadVertical": "ריווח אנכי",
	"settings.headingGap": "מרווח בין כותרות",
	"settings.headingFoldGroup": "קיפול",
	"settings.headingFoldArrow": "הצגת חץ הקיפול",
	"settings.styleDemoName": "דוגמה",
	"settings.previewTitle": "תצוגה מקדימה",

	// Settings — Saved color palettes
	"settings.customPalettes": "פלטות צבעים שמורות",
	"settings.newPalette": "פלטה חדשה",
	"settings.customPalettesEmpty": "כרגע אין פלטות צבעים שמורות.",
	// Settings — Autocomplete
	"settings.editPaletteAria": "עריכת פלטה {{name}}",
	"settings.deletePaletteAria": "מחיקת פלטה {{name}}",
	"settings.deletePaletteConfirm":
		'למחוק את הפלטה "{{name}}"?\nתיבות־הבלטה שמשתמשות בצבעים שלה לא יושפעו.',
	"settings.enableAutocomplete": "השלמה אוטומטית בעת הקלדת [!",
	"settings.enableAutocompleteDesc":
		'מציג הצעות בעת הקלדת "[!" בתוך בלוק ציטוט בעורך. בחירה של סוג מתוך הרשימה תשלים אוטומטית את כותרת תיבת־ההבלטה.',

	// Settings — Keyboard shortcuts
	"settings.customCommands": "פקודות וקיצורי מקלדת",
	"settings.customCommandsDesc":
		"צפו בכל פקודה של Callout Studio ובקיצור המקלדת המשויך לה, וצרו פקודות משלכם לתיבות־ההבלטה שבהן אתם משתמשים הכי הרבה. כברירת־מחדל, לא מוגדרים קיצורי מקלדת.",
	"settings.customCommandsButton": "ניהול פקודות",

	// Command builder
	"commandBuilder.title": "פקודות וקיצורי מקלדת",
	"commandBuilder.desc":
		"השתמשו בכפתור + כדי להגדיר או לשנות קיצור מקלדת בהגדרות קיצורי המקלדת של Obsidian.",
	"commandBuilder.builtIn": "פקודות מובנות",
	"commandBuilder.toggleAria": "הפעלה או כיבוי של {{name}}",
	"commandBuilder.hotkeyBlank": "ריק",
	"commandBuilder.hotkeyAria": "הגדרת קיצור מקלדת עבור {{name}}",
	"commandBuilder.yourCommands": "הפקודות שלכם",
	"commandBuilder.newCommand": "פקודה חדשה",
	"commandBuilder.empty": "אין עדיין פקודות מותאמות־אישית.",
	"commandBuilder.unknownCommand": "הפקודה הזו",
	"commandBuilder.editAria": "עריכת {{name}}",
	"commandBuilder.deleteAria": "מחיקת {{name}}",
	"commandBuilder.deleteConfirm":
		"למחוק את הפקודה {{name}}? כל קיצור מקלדת שהוגדר עבורה יפסיק לפעול.",
	"commandBuilder.newTitle": "פקודה חדשה",
	"commandBuilder.editTitle": "עריכת פקודה",
	"commandBuilder.format": "פורמט תיבת־הבלטה",
	"commandBuilder.formatDesc": "איזה סוג תיבת־הבלטה הפקודה כותבת.",
	"commandBuilder.formatHeading": "כותרת",
	"commandBuilder.formatInline": "מוטבעת",
	"commandBuilder.formatBlock": "בלוק",
	"commandBuilder.roleDisabled":
		"הפורמט הזה כבוי, כך שהפקודה תוסיף טקסט רגיל עד שתפעילו אותו מחדש.",
	"commandBuilder.callout": "סוג תיבת־הבלטה",
	"commandBuilder.calloutDesc": "תיבת־ההבלטה שהפקודה הזו מוסיפה.",
	"commandBuilder.headingLevel": "רמת כותרת",
	"commandBuilder.headingLevelDesc": "איזו רמת כותרת לכתוב.",
	"commandBuilder.action": "פעולה",
	"commandBuilder.actionDesc":
		"עטיפה הופכת את הבחירה לתיבת־הבלטה; הוספה מוסיפה תיבה ריקה.",
	"commandBuilder.actionWrap": "עטיפת הבחירה",
	"commandBuilder.actionInsert": "הוספת חדשה",
	"commandBuilder.preview": "שם הפקודה",
	"commandBuilder.duplicate": "כבר יש לכם פקודה שעושה בדיוק את זה.",
	"commandBuilder.noCallouts":
		"אין עדיין סוגי תיבות־הבלטה שניתן לבנות מהם פקודה.",
	"commandBuilder.save": "שמירה",

	// Settings — Reset
	"settings.vaultMaintenance": "סקירה ותחזוקה של הכספת",
	"settings.vaultStats": "סטטיסטיקת תיבות־הבלטה",
	"settings.vaultStatsDesc":
		"ספירת כל תיבת־הבלטה בקובצי Markdown — בלוק, כותרת ומוטבעת — וחלוקה לפי סוג.",
	"settings.vaultStatsButton": "צפייה בסטטיסטיקה",
	"settings.vaultStatsScanning": "בסריקה...",
	"settings.resetAll": "איפוס",
	"settings.resetAllDesc":
		"מחיקת כל תיבות־ההבלטה, איפוס תיבות מובנות, איפוס סגנונות גלובליים (מסגרות, קנה־מידה, צורה), מחיקת פלטות צבעים שמורות, איפוס התאמת תפריט הקליק־הימני ומחיקת קובצי Material SVG שהורדו.",
	"settings.resetAllButton": "איפוס הכול",
	"settings.resetAllConfirm":
		"פעולה זו תמחק תיבות־הבלטה מותאמות־אישית, תאפס תיבות מובנות, סגנונות גלובליים, פלטות צבעים שמורות, התאמת תפריט הקליק־הימני ותמחק קובצי Material SVG שהורדו. לא ניתן לבטל פעולה זו. להמשיך?",
	"notice.resetAllDone": "הכול אופס לברירות־המחדל.",

	"notice.customCommandsRemoved":
		"הוסרו {{count}} פקודות מותאמות־אישית שסוג תיבת־ההבלטה שלהן כבר לא קיים.",
	"notice.customCommandMissingCallout":
		"סוג תיבת־ההבלטה של הפקודה הזו כבר לא קיים.",

	// Notices
	"notice.exported": "תיבות־ההבלטה יוצאו לקובץ callout-studio-export.json",
	"notice.importedJSON": "יובאו {{count}} סוגי תיבות־הבלטה מתוך JSON.",
	"notice.importedSettings": "הגדרות התוסף יובאו.",
	"notice.importedCalloutManager":
		"יובא מתוך Callout Manager: {{created}} נוצרו, {{updated}} עודכנו.",
	"notice.importedAdmonition":
		"יובא מתוך Admonition: {{created}} נוצרו, {{updated}} עודכנו.",
	"notice.noNewJSON":
		"לא יובאו תיבות־הבלטה חדשות (ייתכן שהמזהים כבר קיימים).",
	"notice.iconDownloadFailed":
		'לא ניתן להוריד את אייקון Material "{{name}}". ייתכן שאינו זמין בסגנון/משקל הזה, או שאין חיבור לאינטרנט.',
	"notice.externalStyleOn":
		'"{{name}}" מעוצבת כעת על ידי ערכת הנושא או קטע ה-CSS שלכם.',
	"notice.externalStyleOff": 'Callout Studio חוזרת לעצב את "{{name}}".',
	"notice.nothingToWrap": "אין תוכן לעטוף.",
	"notice.cursorNotInsideCallout": "הסמן אינו נמצא בתוך תיבת־הבלטה.",
	"notice.autocompleteTargetMoved":
		"לא נוסף דבר — השורה השתנתה בזמן שהעורך היה פתוח.",
	"notice.openHotkeysFailed":
		"לא ניתן לפתוח את מסך קיצורי המקלדת של Obsidian.",
	"notice.filterHotkeysFailed":
		"מסך קיצורי המקלדת נפתח, אך לא ניתן היה לסנן עבור Callout Studio.",

	// Callout Editor
	"editor.editCallout": "עריכת תיבת־הבלטה",
	"editor.newCallout": "תיבת־הבלטה חדשה",
	"editor.displayName": "שם לתצוגה",
	"editor.displayNameDesc": "התווית שתוצג ברחבי הממשק",
	"editor.displayNameBuiltIn":
		"לא ניתן לשנות את שם התצוגה של תיבות־הבלטה מובנות",
	"editor.displayNamePlaceholder": "תיבת־ההבלטה שלי",
	"editor.calloutIds": "מזהי תיבת־הבלטה (IDs)",
	"editor.calloutIdsDesc":
		"כל המזהים המשויכים לתיבת־הבלטה זו. ניתן להשתמש ברווחים.\nלחצו על Enter או על כפתור ה־+ כדי להוסיף.",
	"editor.calloutIdsPlaceholder": "הוספת מזהה",
	"editor.addId": "הוספת מזהה",
	"editor.idLinkedToName": "מקושר לשם התצוגה",
	"editor.idCannotDelete":
		"לא ניתן למחוק מזהה זה — הוא מקושר לשם התצוגה. כדי לשנותו, ערכו את השם",
	"editor.icon": "אייקון",
	"editor.pickIcon": "שנה אייקון",
	"editor.replaceIcon": "החלף אייקון",
	"editor.removeIcon": "הסר אייקון",
	"editor.noIcon": "ללא אייקון",
	"editor.resetIcon": "אפס אייקון לברירת המחדל",
	"editor.livePreview": "תצוגה מקדימה בזמן אמת",
	"editor.iconAdjustment": "התאמת אייקון",
	"editor.picture": "תמונה",
	"editor.size": "גודל",
	"editor.horizontalOffset": "היסט אופקי",
	"editor.verticalOffset": "היסט אנכי",
	"editor.colors": "צבעים",
	"editor.colorsDesc": "קובע את צבעי המסגרת, הרקע והטקסט של הקאלאוט הזה.",
	"editor.resetColors": "אפס צבעים לברירת המחדל",
	"editor.paletteDeleted": "צבע שנמחק",
	"editor.paletteGroupObsidian": "תיבות־הבלטה של Obsidian",
	"editor.paletteGroupPresets": "תבניות צבע",
	"editor.paletteGroupCustom": "מותאם אישית",
	"editor.paletteNewColor": "צבע חדש…",
	"editor.contrastWarning":
		"ניגודיות נמוכה מול הרקע — הטקסט עלול להיות קשה לקריאה",
	"editor.foldable": "ניתן לקיפול",
	"editor.foldableDesc":
		"האם תיבת־ההבלטה ניתנת לקיפול ומה יהיה מצב ברירת־המחדל שלה ברחבי הכספת.",
	"editor.foldOff": "ללא קיפול",
	"editor.foldOpen": "פתוח כברירת־מחדל",
	"editor.foldClosed": "סגור כברירת־מחדל",
	"editor.cancel": "ביטול",
	"editor.saveChanges": "שמירת שינויים",
	"editor.createCallout": "יצירת תיבת־הבלטה",
	"editor.nameRequired": "יש להזין שם לתצוגה לפני יצירת תיבת־הבלטה.",
	"editor.noChangesToSave": "לא בוצעו שינויים.",
	"editor.downloadingIcon": "מוריד אייקון...",
	"editor.idEmpty": "נדרש לפחות מזהה אחד",
	"editor.idExists": "תיבת־הבלטה עם מזהה זה כבר קיימת",
	"editor.idConflict": "מזהה זה מתנגש עם תיבת־הבלטה קיימת",
	"editor.idDashConflict":
		'אובסידיאן ממיר רווחים למקפים, ולכן מזהה זה מתנגש עם "{{other}}"',
	"editor.untitledCallout": "תיבת־הבלטה ללא שם",
	"editor.loremIpsum":
		"לורם איפסום דולור סיט אמט, קונסקטורר אדיפיסינג אלית. סד דו איוסמוד טמפור אינסידידונט אוט לבורה את דולורה מגנה אליקווה.",
	"editor.loremIpsumShort":
		"לורם איפסום דולור סיט אמט, קונסקטורר אדיפיסינג אלית.",
	"editor.sampleInlineText": "כאן יש תגית [!{id}] מוטבעת בתוך פסקה.",
	"editor.previewReadOnly": "לא ניתן לערוך את התצוגה המקדימה",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleTitle": "מעוצבת מחוץ ל-Callout Studio",
	"editor.externalStyleBody":
		"Callout Studio לא מחילה שום עיצוב על {{id}}. המראה שלה מגיע מערכת הנושא, קטע CSS, או ברירות המחדל של Obsidian.",
	"editor.externalStyleWhat": "מה זה אומר",
	"editor.externalStyleWhatHeading":
		"תיבת כותרת כמו ## [!{{id}}] כותרת לא תיוצג — הטקסט יישאר כפי שנכתב.",
	"editor.externalStyleWhatInline":
		"וגם לא תיבה מוטבעת, כמו מילה [!{{id}}] מילה.",
	"editor.externalStyleWhatGlobal":
		"הגדרות עיצוב גלובליות (מסגרת, רדיוס, גודל טקסט) לא חלות עליה.",
	"editor.externalStylePreviewTitle": "איך היא מוצגת כעת",
	"editor.externalStyleSample":
		"## [!{{id}}] כותרת\n\n" +
		"כך נראה משפט עם [!{{id}}] בתוכו.\n\n" +
		"> [!{{id}}] {{name}}\n" +
		"> כך נראה תוכן התיבה.\n",
	"editor.externalStyleResume": "החזרת העיצוב",
	"editor.externalStyleClose": "הבנתי",

	// Icon Picker
	// Palette editor modal
	"palette.newTitle": "פלטת צבעים חדשה",
	"palette.groupPalette": "פלטה",
	"palette.editTitle": "עריכת פלטת צבעים",
	"palette.name": "שם",
	"palette.namePlaceholder": "הפלטה שלי",
	"palette.nameExists": "כבר קיימת פלטה בשם הזה",
	"palette.baseColor": "צבע בסיס",
	"palette.baseColorHint":
		"נתאים את צבע הרקע לצבע הזה באופן אוטומטי. אם תרצו, אפשר לשלוט בזה בנפרד על ידי {{link}}.",
	"palette.baseColorHintLink": "לחיצה כאן",
	"palette.advancedColors": "צבעים",
	"palette.advancedColorsHint":
		"עריכת הצבעים למצב {{mode}} — המצב השני מתעדכן אוטומטית. אפשר להחליף את ערכת הנושא של Obsidian כדי לבדוק אותו.",
	"palette.revertHint": "מעדיפים צבע בסיס אחד? {{link}}.",
	"palette.revertHintLink": "חזרה",
	"palette.lightMode": "בהיר",
	"palette.darkMode": "כהה",
	"palette.accentColor": "צבע הדגשה",
	"palette.backgroundColorChannel": "צבע רקע",
	"palette.textColorChannel": "צבע טקסט",
	"palette.bgIntensity": "עוצמה",
	"palette.bgStyle": "סגנון",
	"palette.bgSolid": "אחיד",
	"palette.bgGradient": "גרדיאנט",
	"palette.bgTransparent": "שקוף",
	"palette.gradientTo": "צבע שני",
	"palette.gradientDirection": "כיוון",
	"palette.gradientText": "טקסט כותרת בגרדיאנט",
	"palette.save": "שמירה",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "אדום",
	"colorName.orange": "כתום",
	"colorName.amber": "ענבר",
	"colorName.yellow": "צהוב",
	"colorName.lime": "ליים",
	"colorName.green": "ירוק",
	"colorName.teal": "טורקיז",
	"colorName.cyan": "ציאן",
	"colorName.sky": "תכלת",
	"colorName.blue": "כחול",
	"colorName.indigo": "אינדיגו",
	"colorName.violet": "סגול",
	"colorName.purple": "ארגמן",
	"colorName.pink": "ורוד",
	"colorName.rose": "ורדרד",
	"colorName.brown": "חום",
	"colorName.gray": "אפור",
	"colorName.black": "שחור",
	"colorName.white": "לבן",
	"colorName.crimson": "קרמזון",
	"colorName.coral": "קורל",
	"colorName.grape": "ענבים",
	"colorName.plum": "שזיף",
	"colorName.bubblegum": "מסטיק",

	"iconPicker.pickIcon": "בחירת אייקון",
	"iconPicker.confirm": "אישור",
	"iconPicker.cancel": "ביטול",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "אימוג'י",
	"iconPicker.searchLucide": "חיפוש אייקוני Lucide",
	"iconPicker.searchTabler": "חיפוש אייקוני Tabler",
	"iconPicker.tablerStyle": "סגנון האייקון",
	"iconPicker.tablerStyleOutline": "מתאר (Outline)",
	"iconPicker.tablerStyleFilled": "מלא (Filled)",
	"iconPicker.loadMore": "טעינת עוד אייקונים",
	"iconPicker.materialStyle": "סגנון האייקון",
	"iconPicker.materialStyleOutlined": "מתאר (Outlined)",
	"iconPicker.materialStyleFilled": "מלא (Filled)",
	"iconPicker.materialStyleRounded": "מעוגל (Rounded)",
	"iconPicker.materialStyleSharp": "חד (Sharp)",
	"iconPicker.materialWeight": "עובי האייקון",
	"iconPicker.materialWeight100": "דק (Thin)",
	"iconPicker.materialWeight200": "עדין (Extra Light)",
	"iconPicker.materialWeight300": "קל (Light)",
	"iconPicker.materialWeight400": "רגיל (Regular)",
	"iconPicker.materialWeight500": "בינוני (Medium)",
	"iconPicker.materialWeight600": "חצי-שמן (Semi Bold)",
	"iconPicker.materialWeight700": "שמן (Bold)",
	"iconPicker.materialFontFailed":
		"לא הצלחנו לטעון את תצוגת האייקונים של Material. במקומם מוצגים שמות האייקונים — חיפוש ובחירה עדיין עובדים.",
	"iconPicker.materialFontRetry": "ניסיון חוזר",
	"iconPicker.searchMaterial": "חיפוש אייקוני Material",
	"iconPicker.searchEmoji": "חיפוש אימוג'י",
	"iconPicker.skinTone": "גוון עור",
	"iconPicker.allCategories": "כל הקטגוריות",
	"iconPicker.noIconSelected": "לא נבחר אייקון",
	"iconPicker.noResults": "לא נמצאו אייקונים התואמים לחיפוש.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "חיפוש אייקוני Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "חיפוש ב־Font Awesome",
	"iconPicker.faStyle": "סגנון האייקון",
	"iconPicker.faStyleSolid": "מלא (Solid)",
	"iconPicker.faStyleRegular": "מתאר (Regular)",
	"iconPicker.faStyleBrands": "מותגים (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "חיפוש ב־RPG Awesome",
	"iconPicker.image": "התמונות שלי",
	"iconPicker.searchImage": "חיפוש בתמונות שלי",
	"iconPicker.imageTooLarge":
		"{{name}} גדולה מדי. תמונות חייבות להיות עד 5MB.",
	"iconPicker.imageUnsupported":
		"{{name}} אינה סוג תמונה נתמך. יש להשתמש ב־SVG, PNG, JPEG או WebP.",
	"iconPicker.imageInvalidSvg":
		"לא ניתן לקרוא את {{name}} כקובץ SVG בטוח, ולכן היא לא נוספה.",
	"iconPicker.imageDecodeFailed": "לא ניתן לקרוא את {{name}} כתמונה.",
	"iconPicker.imageDuplicate":
		"{{name}} כבר נמצאת בתמונות שלך. אפשר לשנות את שם הקובץ, " +
		"או למחוק את התמונה הקיימת.",
	"iconPicker.imageAdd": "הוספת תמונות",
	"iconPicker.imageEmpty":
		"עדיין אין תמונות. אפשר להוסיף קובץ SVG, PNG, JPEG או WebP מהמחשב, " +
		"או פשוט לגרור אותו לכאן.",
	"iconPicker.imageDelete": "מחיקה",
	"iconPicker.imageDeleteConfirm": "למחוק את „{{name}}”?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callouts משתמשים בתמונה הזו. הם יחזרו לאייקון ברירת מחדל " +
		"עד שייבחר להם אייקון חדש.",
	"iconPicker.imageRecolor": "לצבוע בצבע ה־callout",
	"iconPicker.allSources": "כל המקורות",
	"iconPicker.searchAllSources": "חיפוש בכל מקורות האייקונים",
	"iconPicker.sourcesNotDownloaded":
		"עדיין לא נכללים: {{names}}. בחרו מקור מהרשימה למעלה כדי להוריד אותו.",
	"iconPicker.chooseSource": "בחירת מקור",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "חיפוש בכל הספריות בבת אחת",
	"iconPicker.descLucide": "הספרייה המובנית של אובסידיאן, תמיד זמינה",
	"iconPicker.descTabler": "אייקוני ממשק נקיים ועקביים, מתאר ומלאים",
	"iconPicker.descMaterial": "הספרייה של גוגל, ארבעה סגנונות ושבעה משקלים",
	"iconPicker.descEmoji": "אייקונים צבעוניים, בכל גווני העור",
	"iconPicker.descOcticons": "אייקוני הממשק של GitHub",
	"iconPicker.descFa": "אייקונים מלאים, מתאר וסמלי מותגים",
	"iconPicker.descRpgAwesome": "אייקוני פנטזיה ומשחקי תפקידים",
	"iconPicker.descImage": "תמונות שהוספת מהמחשב שלך",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "נגישות",
	"iconPicker.cat.Actions": "פעולות",
	"iconPicker.cat.Activities": "פעילויות",
	"iconPicker.cat.Alert": "התראות",
	"iconPicker.cat.Alphabet": "אלפבית",
	"iconPicker.cat.Android": "אנדרואיד",
	"iconPicker.cat.Animals": "חיות",
	"iconPicker.cat.Arrows": "חיצים",
	"iconPicker.cat.Astronomy": "אסטרונומיה",
	"iconPicker.cat.Audio&Video": "אודיו ווידאו",
	"iconPicker.cat.Automotive": "רכב",
	"iconPicker.cat.Badges": "תגים",
	"iconPicker.cat.Brand": "מותגים",
	"iconPicker.cat.Buildings": "מבנים",
	"iconPicker.cat.Business": "עסקים",
	"iconPicker.cat.Camping": "קמפינג",
	"iconPicker.cat.Charity": "צדקה",
	"iconPicker.cat.Charts": "תרשימים",
	"iconPicker.cat.Charts + Diagrams": "תרשימים ודיאגרמות",
	"iconPicker.cat.Childhood": "ילדות",
	"iconPicker.cat.Clothing + Fashion": "ביגוד ואופנה",
	"iconPicker.cat.Coding": "תכנות",
	"iconPicker.cat.Communicate": "תקשורת",
	"iconPicker.cat.Communication": "תקשורת",
	"iconPicker.cat.Computers": "מחשבים",
	"iconPicker.cat.Connectivity": "קישוריות",
	"iconPicker.cat.Construction": "בנייה",
	"iconPicker.cat.Currencies": "מטבעות",
	"iconPicker.cat.Database": "מסד נתונים",
	"iconPicker.cat.Design": "עיצוב",
	"iconPicker.cat.Development": "פיתוח",
	"iconPicker.cat.Devices": "מכשירים",
	"iconPicker.cat.Devices + Hardware": "מכשירים וחומרה",
	"iconPicker.cat.Disaster + Crisis": "אסון ומשבר",
	"iconPicker.cat.Document": "מסמך",
	"iconPicker.cat.E-commerce": "מסחר אלקטרוני",
	"iconPicker.cat.Editing": "עריכה",
	"iconPicker.cat.Education": "חינוך",
	"iconPicker.cat.Electrical": "חשמל",
	"iconPicker.cat.Emoji": "אימוג'י",
	"iconPicker.cat.Energy": "אנרגיה",
	"iconPicker.cat.Extensions": "הרחבות",
	"iconPicker.cat.Files": "קבצים",
	"iconPicker.cat.Film + Video": "סרטים ווידאו",
	"iconPicker.cat.Food": "אוכל",
	"iconPicker.cat.Food + Beverage": "אוכל ושתייה",
	"iconPicker.cat.Fruits + Vegetables": "פירות וירקות",
	"iconPicker.cat.Games": "משחקים",
	"iconPicker.cat.Gaming": "גיימינג",
	"iconPicker.cat.Gender": "מגדר",
	"iconPicker.cat.Genders": "מגדרים",
	"iconPicker.cat.Gestures": "תנועות יד",
	"iconPicker.cat.Halloween": "ליל כל הקדושים",
	"iconPicker.cat.Hands": "ידיים",
	"iconPicker.cat.Hardware": "חומרה",
	"iconPicker.cat.Health": "בריאות",
	"iconPicker.cat.Holidays": "חגים",
	"iconPicker.cat.Home": "בית",
	"iconPicker.cat.Household": "משק בית",
	"iconPicker.cat.Humanitarian": "הומניטרי",
	"iconPicker.cat.Images": "תמונות",
	"iconPicker.cat.Laundry": "כביסה",
	"iconPicker.cat.Letters": "אותיות",
	"iconPicker.cat.Logic": "לוגיקה",
	"iconPicker.cat.Logistics": "לוגיסטיקה",
	"iconPicker.cat.Map": "מפה",
	"iconPicker.cat.Maps": "מפות",
	"iconPicker.cat.Maritime": "ימאות",
	"iconPicker.cat.Marketing": "שיווק",
	"iconPicker.cat.Math": "מתמטיקה",
	"iconPicker.cat.Mathematics": "מתמטיקה",
	"iconPicker.cat.Media": "מדיה",
	"iconPicker.cat.Media Playback": "ניגון מדיה",
	"iconPicker.cat.Medical + Health": "רפואה ובריאות",
	"iconPicker.cat.Money": "כסף",
	"iconPicker.cat.Mood": "מצב רוח",
	"iconPicker.cat.Moving": "מעבר דירה",
	"iconPicker.cat.Music + Audio": "מוזיקה ואודיו",
	"iconPicker.cat.Nature": "טבע",
	"iconPicker.cat.Numbers": "מספרים",
	"iconPicker.cat.Photography": "צילום",
	"iconPicker.cat.Photos + Images": "תמונות",
	"iconPicker.cat.Political": "פוליטיקה",
	"iconPicker.cat.Privacy": "פרטיות",
	"iconPicker.cat.Punctuation + Symbols": "פיסוק ואייקונים",
	"iconPicker.cat.Religion": "דת",
	"iconPicker.cat.Science": "מדע",
	"iconPicker.cat.Science Fiction": "מדע בדיוני",
	"iconPicker.cat.Security": "אבטחה",
	"iconPicker.cat.Shapes": "צורות",
	"iconPicker.cat.Shopping": "קניות",
	"iconPicker.cat.Social": "רשתות חברתיות",
	"iconPicker.cat.Spinners": "ספינרים",
	"iconPicker.cat.Sport": "ספורט",
	"iconPicker.cat.Sports + Fitness": "ספורט וכושר",
	"iconPicker.cat.Symbols": "אייקונים",
	"iconPicker.cat.System": "מערכת",
	"iconPicker.cat.Text": "טקסט",
	"iconPicker.cat.Text Formatting": "עיצוב טקסט",
	"iconPicker.cat.Time": "זמן",
	"iconPicker.cat.Toggle": "מתג",
	"iconPicker.cat.Transit": "תחבורה ציבורית",
	"iconPicker.cat.Transportation": "תחבורה",
	"iconPicker.cat.Travel": "נסיעות",
	"iconPicker.cat.Travel + Hotel": "נסיעות ומלונות",
	"iconPicker.cat.UI actions": "פעולות ממשק",
	"iconPicker.cat.Users + People": "משתמשים ואנשים",
	"iconPicker.cat.Vehicles": "כלי רכב",
	"iconPicker.cat.Version control": "בקרת גרסאות",
	"iconPicker.cat.Weather": "מזג אוויר",
	"iconPicker.cat.Writing": "כתיבה",
	"iconPicker.cat.Zodiac": "גלגל המזלות",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} עדיין לא הורדה",
	"iconPack.downloadDetail": "{{count}} אייקונים · {{size}} · הורדה חד־פעמית",
	"iconPack.download": "הורדה",
	"iconPack.downloading": "מוריד את {{name}}…",
	"iconPack.downloadFailed":
		"לא ניתן היה להוריד את {{name}}. בדקו את החיבור לאינטרנט ונסו שוב.",
	"iconPack.retry": "נסו שוב",
	"iconPack.faBrandsNotice":
		"אייקוני המותגים הם סימני מסחר של בעליהם. הכללתם כאן אינה מהווה חסות או אישור מצדם. אנא השתמשו בהם רק כדי לייצג את החברה, המוצר או השירות שאליהם הם מתייחסים.",
	"iconPack.artworkRestored": "האייקונים של {{names}} הורדו.",
	"iconPack.diskWriteFailed":
		"Callout Studio לא הצליח לשמור את חבילת האייקונים לדיסק, ולכן היא תידרש להורדה מחדש בפעם הבאה. האייקונים שבחרתם עדיין נשמרים יחד עם ההגדרות.",

	// Icon licences & credits
	"credits.title": "רישיונות וקרדיטים לאייקונים",
	"credits.intro":
		"Callout Studio נעזר בכמה ספריות אייקונים פתוחות. הרישיונות שלהן מופיעים כאן, יחד עם פירוט השינויים שנעשו כדי לשלב אותן.",
	"credits.fullNotices": "הודעות צד־שלישי המלאות",
	"credits.pluginLicense":
		"הקוד של Callout Studio עצמו מופץ ברישיון permissive; ספריות האייקונים שומרות על הרישיונות שלהן.",

	// Context Menu
	"contextMenu.editCallout": "עריכת הגדרות תיבת־הבלטה",
	"contextMenu.copyMarkdown": "העתקת קוד Markdown",
	"contextMenu.openSettings": "פתיחת הגדרות של Callout Studio",
	"contextMenu.setFoldClosed": "הגדרת תיבת־ההבלטה כסגורה (-)",
	"contextMenu.setFoldOpen": "הגדרת תיבת־ההבלטה כפתוחה (+)",
	"contextMenu.setFoldNone": "הפיכת תיבת־ההבלטה לבלתי ניתנת לקיפול",
	"contextMenu.cutSection": "גזירת מקטע הכותרת",
	"contextMenu.copySection": "העתקת מקטע הכותרת",
	"contextMenu.deleteSection": "מחיקת מקטע הכותרת",

	// Heading callouts
	"heading.toggleFold": "החלפת מצב קיפול",

	// Global settings section (per-role style popups)
	"settings.globalSettings": "הגדרות גלובליות",
	"settings.globalSettingsRegularDesc":
		"הוספת סימון תיבת־הבלטה לתוך ציטוט (למשל, `> [!type]`) תציג את תיבת־ההבלטה המובנית של Obsidian. ניתן להתאים את המסגרת, עיגול הפינות, קנה־המידה של הגופן והיישור.",
	"settings.globalSettingsHeadingDesc":
		"הוספת סימון תיבת־הבלטה מיד אחרי הסולמיות של הכותרת (למשל, `## [!type]`) תציג אותה ככותרת מעוצבת. ניתן להתאים את המסגרת, הצורה והריווח האנכי.",
	"settings.globalSettingsInlineDesc":
		"הוספת סימון תיבת־הבלטה בכל מקום בתוך שורת טקסט (למשל, `[!type]`) תציג אותה כגלולה קטנה מוטבעת. ניתן להתאים את המסגרת והצורה שלה.",
	"settings.globalSettingsCustomize": "התאמה אישית",

	// Callout types section
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "תיבת־הבלטה ככותרת",
	"settings.calloutTypeInline": "תיבת־הבלטה מוטבעת",

	// Context menu customization
	"settings.customizeMenu": "התאמת פריטי התפריט",
	"settings.customizeMenuDesc":
		"בחירה אילו פעולות קליק־ימני יופיעו לכל סוג תיבת־הבלטה ושינוי סדרן. פועל ב־Source mode וב־Live Preview.",
	"settings.customizeMenuButton": "התאמת פריטי התפריט",
	"menuCustomize.title": "התאמת תפריט הקליק־הימני",
	"menuCustomize.desc":
		"הפעלה או כיבוי של פעולות וגרירת הידית כדי לשנות את סדרן. השינויים נשמרים אוטומטית.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "תיבת־הבלטה ככותרת",
	"menuCustomize.inline": "תיבת־הבלטה מוטבעת",
	"menuCustomize.dragHandle": "גררו כדי לשנות סדר",
	"menuItem.edit": "עריכת תיבת־ההבלטה",
	"menuItem.openSettings": "פתיחת ההגדרות",
	"menuItem.copyMarkdown": "העתקת Markdown",
	"menuItem.foldDefaults": "ברירות מחדל לקיפול (פתוח / סגור / ללא)",
	"menuItem.cutSection": "גזירת המקטע",
	"menuItem.copySection": "העתקת המקטע",
	"menuItem.deleteSection": "מחיקת המקטע",

	// Confirm modal
	"confirm.ok": "מחיקה",
	"confirm.cancel": "ביטול",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "מחיקת פקודה",
	"confirm.titleResetAll": "איפוס כל תיבות ההבלטה",
	"confirm.titleResetCallout": "איפוס תיבת הבלטה",
	"confirm.titleDeletePalette": "מחיקת פלטה",
	"confirm.titleDeleteImage": "מחיקת תמונה",

	// Vault edge-case modals
	"vault.filesUpdated": "עודכנו {{count}} הפניות בקובצי הכספת.",
	// The arrow stays "→" although the sentence is RTL: it sits between two
	// callout ids, which are normally Latin, so the bidi algorithm resolves that
	// fragment left-to-right and a mirrored "←" would point from the new id back
	// to the old one. Prose paths such as `firstRun.laterHint` do mirror.
	"vault.idsUpdated":
		"עודכנו {{count}} מזהים של תיבות־הבלטה בקובצי הכספת: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"עודכנו {{count}} כותרות של תיבות־הבלטה בקובצי הכספת: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "החלפה ב:",
	"vault.deleteWithout": "מחיקה ללא החלפה",
	"vault.confirmDelete": "אישור",
	"vault.confirmReplace": "החלפה",
	"vault.replacePromptInUse":
		'"{{name}}" מופיעה {{count}} פעמים ב־{{files}} קבצים. בחרו תיבת־הבלטה חלופית:',
	"vault.replacePromptUnused": 'בחרו תיבת־הבלטה להחלפת "{{name}}":',
	"vault.noReplacementAvailable": "אין תיבות־הבלטה אחרות הזמינות להחלפה.",
	"vault.convertedToPlainText":
		"הומרו {{blocks}} בלוקים של תיבות־הבלטה ב־{{files}} קבצים לטקסט רגיל.",
	"vault.resetAliasWarning":
		"{{count}} הפניות ב־{{files}} קבצים משתמשות בכינויים מותאמים־אישית: {{aliases}}. הכינויים הללו יפסיקו לעבוד לאחר איפוס. להמשיך?",
	"vault.resetConfirm": "איפוס",
	"vault.resetAllInUse":
		"⚠ {{count}} הפניות ב־{{files}} קבצים משתמשות בסוגי תיבות־הבלטה שעומדות להימחק.",

	// Vault statistics modal
	"quickInsert.title": "הוספה מהירה של תיבת־הבלטה מסוג בלוק",
	"quickInsert.desc": "בחרו תיבת־הבלטה להוספה במיקום הסמן. תיבות־הבלטה מסוג בלוק בלבד.",
	"quickInsert.searchPlaceholder": "חיפוש תיבות־הבלטה",
	"quickInsert.sourceAria": "סינון לפי מקור תיבת־הבלטה",
	"quickInsert.sourceAll": "הכול",
	"quickInsert.sourceBuiltIn": "מובנה",
	"quickInsert.sourceUser": "תיבות־ההבלטה שלי",
	"quickInsert.editAria": "עריכת {{name}}",
	"quickInsert.insertAria": "הוספת {{name}} כתיבת־הבלטה מסוג בלוק",
	"quickInsert.noResults": "לא נמצאו תיבות־הבלטה",
	"quickInsert.noUserCallouts": "עדיין לא יצרתם אף תיבת־הבלטה.",
	"quickInsert.noEditorHint": "אין פתק פתוח במצב עריכה, ולכן לא ניתן להוסיף דבר.",
	"quickInsert.noEditor": "פתחו פתק במצב עריכה כדי להוסיף תיבת־הבלטה.",

	"vaultStats.title": "סטטיסטיקת תיבות־הבלטה",
	"vaultStats.totalCallouts": "סך הכול תיבות־הבלטה",
	"vaultStats.typesFound": "סוגים שנמצאו",
	"vaultStats.filesWithCallouts": "קבצים המכילים תיבות־הבלטה",
	"vaultStats.filesScanned": "קובצי Markdown שנסרקו",
	"vaultStats.empty": "לא נמצאו תיבות־הבלטה בקובצי Markdown.",
	"vaultStats.columnType": "סוג",
	"vaultStats.columnName": "שם",
	"vaultStats.columnSource": "מקור",
	"vaultStats.columnCount": "כמות",
	"vaultStats.columnFiles": "קבצים",
	"vaultStats.unknown": "לא מוכר",
	"vaultStats.sourceBuiltIn": "מובנה",
	"vaultStats.sourceCustom": "מותאם־אישית",
	"vaultStats.sourceAutoFallback": "ברירת־מחדל אוטומטית",
	"vaultStats.sourceTheme": "מקטע CSS",
	"vaultStats.sourceAlias": "כינוי של {{id}}",
	"vaultStats.sourceUnknown": "לא מוכר",
	"vaultStats.byRole": "נכתב כ־",
	"vaultStats.roleBlock": "בלוק",
	"vaultStats.roleHeading": "כותרת",
	"vaultStats.roleInline": "מוטבע",
	"vaultStats.defineUndefined": "הגדרת {{count}} חסרים",
	"vaultStats.defineRunning": "סורק",
	"vaultStats.defineDone": "נוספו {{count}} סוגי תיבת־הבלטה.",
	"vaultStats.close": "סגירה",

	// Import validation
	"import.title": "בעיות בייבוא",
	"import.reportLeadIn":
		"נראה שהקובץ שניסיתם לייבא מכיל כמה שגיאות. הנה רשימת הבעיות:",
	"import.reportLeadInFatal":
		"הקובץ הזה לא נראה כמו קובץ ייצוא של Callout Studio ולכן לא ניתן לייבא אותו:",
	"import.entryHeading": "רשומה {{index}} — {{label}}",
	"import.summary":
		"{{valid}} מתוך {{total}} רשומות נמצאו תקינות · התגלו {{issues}} בעיות.",
	"import.btnCancel": "ביטול",
	"import.btnImportValid": "ייבוא הרשומות התקינות בלבד ({{count}})",
	"import.err.notRecognized":
		"קובץ לא מזוהה: נדרש מערך של הגדרות תיבת־הבלטה או קובץ ייצוא של Callout Studio.",
	"import.warn.settingsIgnored":
		"מקטע ההגדרות לא היה אובייקט תקין ולכן לא יובא.",
	"import.warn.invalidGradient":
		"גרדיאנט הרקע לא היה תקין ולכן לא נלקח בחשבון.",
	"import.err.parseFailed": "הקובץ אינו JSON תקין ולכן לא ניתן לפענח אותו.",
	"import.err.entryNotObject": "כל רשומה חייבת להיות אובייקט (Object).",
	"import.err.requiredMissing": 'שדה החובה "{{field}}" חסר או שסוגו שגוי.',
	"import.err.idEmpty": "ה־ID לא יכול להיות ריק.",
	"import.err.idTooLong":
		'ה־ID "{{value}}" ארוך מדי ({{length}} תווים); המקסימום המותר הוא {{max}}.',
	"import.err.idBadChar":
		'ה־ID "{{value}}" מכיל תווים לא חוקיים ("|", "[", "]", טאבים ומעברי שורה אינם מורשים).',
	"import.err.idMetadata":
		'ה־ID "{{value}}" מכיל "|". באובסידיאן כל מה שבא אחרי ה־"|" הראשון הוא מטא־דאטה של ה־callout ולא חלק מהסוג, ולכן הרשומה הזאת מתארת את ה־callout "{{id}}". הרשומה דולגה, כך שה־"{{id}}" הקיים שלך נשאר ללא שינוי.',
	"import.err.displayNameEmpty": "שם התצוגה לא יכול להיות ריק.",
	"import.err.displayNameTooLong":
		"שם התצוגה ארוך מדי ({{length}} תווים); המקסימום המותר הוא {{max}}.",
	"import.err.boolField":
		'"{{field}}" חייב להיות ערך בוליאני (true או false).',
	"import.err.iconNotObject": "icon חייב להיות אובייקט (Object).",
	"import.err.iconTypeInvalid":
		'סוג האייקון "{{value}}" אינו חוקי (חייב להיות אחד מ־{{types}}).',
	"import.warn.iconFieldIgnored":
		'השדה "{{field}}" רלוונטי רק לאייקוני Material, ולכן מתעלמים ממנו עבור סוג אייקון {{type}}.',
	"import.err.iconValueEmpty":
		"ערך האייקון חייב להיות מחרוזת (String) שאינה ריקה.",
	"import.err.iconValueTooLong":
		"ערך האייקון חורג מהאורך המקסימלי ({{length}} תווים).",
	"import.err.materialStyle":
		'סגנון אייקון Material "{{value}}" אינו חוקי (חייב להיות אחד מ־outlined, filled, rounded או sharp).',
	"import.err.materialWeight":
		'משקל אייקון Material "{{value}}" חייב להיות מספר שלם בין 100 ל־700 (בקפיצות של 100).',
	"import.warn.iconRecolorIgnored":
		'השדה "recolor" רלוונטי רק לתמונות שלך, ולכן מתעלמים ממנו עבור סוג אייקון {{type}}.',
	"import.err.iconRecolorInvalid":
		'השדה "recolor" חייב להיות true או false (התקבל "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" חייב להיות בצבע hex בפורמט "#448aff" (התקבל "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" חייב להיות מספר בין {{min}} ל־{{max}} (התקבל "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" חייב להיות מספר בין {{min}} ל־{{max}} (התקבל "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" חייב להיות אובייקט הממפה סוג תיבת־הבלטה ("regular", "heading", "inline") לגודל האייקון ולהיסטים שלו.',
	"import.err.aliasesNotArray":
		'"aliases" חייב להיות מערך (Array) של מחרוזות (Strings).',
	"import.err.aliasNotString": "כינוי (Alias) חייב להיות מחרוזת (String).",
	"import.err.aliasDup":
		'הכינוי "{{value}}" מופיע יותר מפעם אחת באותה רשומה.',
	"import.err.tooManyIds":
		"יותר מדי ID־ים ({{count}}); לכל תיבת־הבלטה מותרים עד {{max}} ID־ים (ראשי + כינויים).",
	"import.err.metadataShape":
		'"metadata" חייב להיות אובייקט (Object) שכל ערכיו הם מחרוזות.',
	"import.warn.unknownFields": "שדות לא מוכרים הוסרו מהייבוא: {{fields}}.",
	"import.err.duplicateInFile":
		'ה־ID או הכינוי "{{value}}" כבר נמצא בשימוש ברשומה #{{first}} בקובץ זה.',
	"import.err.aliasConflict":
		'הכינוי "{{value}}" כבר נמצא בשימוש בתיבת־הבלטה אחרת ("{{other}}") בכספת שלכם.',
	// Footer
	"footer.tagline": "יש לכם משוב, הערות או הצעות? אשמח לשמוע!",
	"footer.madeBy": "נוצר על־ידי ניב  •  ",

	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" הוגדר כ־true למרות ש־"foldable" הוגדר כ־false; לכן defaultFolded אופס בחזרה ל־false.',
	"import.warn.imageMissing":
		"ה־callout הזה משתמש בתמונה שאינה בקובץ ואינה בכספת הזו, ולכן יוצג " +
		"אייקון ברירת מחדל עד שייבחר לו אייקון חדש.",
	"import.err.paletteIdInvalid":
		'"paletteId" חייב להיות מזהה טקסט שאינו ריק (התקבל "{{value}}").',
	"import.warn.iconNameUnknown":
		'אין אייקון בשם "{{value}}" ב־{{type}}, ולכן נעשה שימוש באייקון ברירת המחדל.',
	"import.warn.cmIconUnknownNew":
		'אין אייקון בשם "{{value}}" באובסידיאן, ולכן נעשה שימוש באייקון ברירת המחדל.',
	"import.warn.cmIconUnknownExisting":
		'אין אייקון בשם "{{value}}" באובסידיאן, ולכן "{{id}}" נשאר עם האייקון הקיים שלו.',

	// ייבוא — בחירת מקור
	"import.chooseSource": "ייבוא מתוך",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc": "טעינת קובץ ‎.json שיוצא מתוך Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"הדביקו את הסגנונות שהעתקתם מכפתור ה־Copy של Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"העבירו את ההתראות המותאמות־אישית שלכם מהתוסף Admonition.",

	// ייבוא — הדבקה מתוך Callout Manager
	"import.cmTitle": "ייבוא מתוך Callout Manager",
	"import.cmFromVault": "הכספת הזו",
	"import.cmVaultChecking": "מחפש את התוסף Callout Manager…",
	"import.cmVaultFound": "נמצאו {{count}} תיבות־הבלטה מותאמות־אישית.",
	"import.cmVaultNotFound": "לא נמצאו תיבות־הבלטה מותאמות־אישית בכספת הזו.",
	"import.cmPasteLabel":
		"או הדביקו כאן את הסגנונות שהועתקו מ־Callout Manager:",
	"import.cmInstructions":
		"ב־Callout Manager, השתמשו בכפתור ה־Copy שלו כדי להעתיק את סגנונות " +
		"תיבות־ההבלטה המותאמות־אישית שלכם, ואז הדביקו אותם למטה.",
	"import.cmPlaceholder": "הדביקו כאן את הסגנונות שהועתקו…",
	"import.cmBtnCancel": "ביטול",
	"import.cmBtnImport": "ייבוא",
	"import.err.cmNoBlocksFound":
		"לא נמצאו סגנונות של Callout Manager בטקסט שהודבק.",
	"import.err.cmNotRecognized":
		"קובץ לא מזוהה: נדרשו הסגנונות שנוצרים באמצעות כפתור ה־Copy של Callout Manager, או קובץ data.json של Callout Manager.",
	"import.err.cmNoEntries": "לא נמצאו תיבות־הבלטה מותאמות־אישית לייבוא.",
	"import.err.cmNoColorForNew":
		'לא נמצא צבע תקין עבור תיבת־ההבלטה החדשה "{{value}}"; היא דולגה.',
	"import.err.cmIdConflict":
		'המזהה "{{value}}" כבר משמש ככינוי (alias) עבור תיבת־הבלטה אחרת ("{{other}}"), ולכן דולג.',
	"import.warn.cmNoColorDefault":
		"לא הוגדר צבע ב־Callout Manager, ולכן נעשה שימוש באפור ברירת־המחדל.",
	"import.warn.cmThemeCondition":
		"הצבע או הסמל של תיבת־הבלטה זו הוגדרו עבור ערכת נושא אחת בלבד. Callout Studio אינו תומך בעיצוב נפרד לכל ערכת נושא, ולכן הם הועברו לכל ערכות הנושא.",
	"import.warn.cmCustomStyles":
		"לתיבת־הבלטה הזו יש גם CSS מותאם־אישית ב־Callout Manager. הסגנון הזה אינו חלק מהייבוא, ולכן הועברו רק הסמל והצבע.",

	// Import — Admonition
	"import.admTitle": "ייבוא מתוך Admonition",
	"import.admInstructions":
		"כל התראה עוברת לתיבת־הבלטה עם השם, האייקון והצבע שלה. הגדרות " +
		"שאין להן מקבילה ב־Callout Studio (פקודה, כפתור העתקה, הסתרת " +
		"כותרת) נשארות מאחור.",
	"import.admFromVault": "הכספת הזו",
	"import.admVaultChecking": "מחפש את התוסף Admonition…",
	"import.admVaultFound": "נמצאו {{count}} התראות מותאמות־אישית.",
	"import.admVaultNotFound": "לא נמצאו התראות מותאמות־אישית בכספת הזו.",
	"import.admFromFile": "קובץ",
	"import.admFromFileDesc": "קובץ admonitions.json, או חבילה משותפת.",
	"import.admChooseFile": "בחירת קובץ…",
	"import.admPasteLabel": "או הדביקו כאן את ה־JSON:",
	"import.admPlaceholder": "הדביקו כאן את ההתראות שלכם…",
	"import.admBtnCancel": "ביטול",
	"import.admBtnImport": "ייבוא",
	"import.err.admNotRecognized":
		"קובץ לא מזוהה: ציפינו לרשימת התראות, או לקובץ data.json של " +
		"Admonition.",
	"import.err.admNoEntries": "לא נמצאו התראות לייבוא.",
	"import.err.admTypeMissing": 'להתראה הזו אין "type", ולכן היא דולגה.',
	"import.warn.admIconUnknown":
		'לא נמצא אייקון בשם "{{value}}" באף ספריית אייקונים, ולכן נעשה ' +
		"שימוש באייקון ברירת המחדל.",
	"import.warn.admIconUnknownExisting":
		'לא נמצא אייקון בשם "{{value}}" באף ספריית אייקונים, ולכן ' +
		'"{{id}}" נשאר עם האייקון הקיים שלו.',
	"import.warn.admImageFailed":
		"לא ניתן היה לקרוא את התמונה שהועלתה, ולכן נעשה שימוש באייקון " +
		"ברירת המחדל.",
	"import.warn.admIconWithCss":
		"ההתראה הזו מעוצבת על־ידי קטע CSS ב־Admonition. העיצוב הזה אינו " +
		"חלק מהייבוא, ולכן עברו רק השם, האייקון והצבע.",
	"import.warn.admNoColor":
		"לא הוגדר צבע, ולכן נעשה שימוש בכחול ברירת המחדל.",
	"import.warn.admTitleTruncated":
		"הכותרת באורך {{length}} תווים; היא קוצרה ל־{{max}}.",
	"settings.deletePaletteConfirmLinkedOne":
		'האם למחוק את הפלטה "{{name}}"?\nתיבת־הבלטה אחת משתמשת בה. הצבעים שלה נשמרים, ואפשר לחבר אותה שוב אחר כך משורת הצבע בעורך שלה.',
	"settings.deletePaletteConfirmLinked":
		'האם למחוק את הפלטה "{{name}}"?\n{{count}} תיבות־הבלטה משתמשות בה. הצבעים שלהן נשמרים, ואפשר לחבר אותן שוב אחר כך משורת הצבע בכל אחד מהעורכים שלהן.',
	"settings.unlinkedColors": "צבעים מנותקים",
	"settings.unlinkedColorsDesc":
		"תיבות־הבלטה שהצבע השמור שלהן נמחק. הן שומרות על הצבעים שהיו להן; שחזור ישמור שוב את הצבע ויחבר מחדש את כל הקבוצה.",
	"settings.unlinkedColorOne": "תיבת־הבלטה אחת",
	"settings.unlinkedColorCount": "{{count}} תיבות־הבלטה",
	"settings.restoreColor": "שחזור",
	"settings.palettesMergedNotice":
		"מוזגו {{count}} פלטות מיובאות לתוך צבעים שמורים שכבר היו באותם צבעים.",
	"notice.palettesMerged":
		"מוזגו {{count}} צבעים שמורים שהיו עם צבעים זהים: {{names}}. תיבות־ההבלטה שמשתמשות בהם שומרות על הצבעים שלהן וכעת מקושרות לצבע שנשאר.",
	"editor.colorsDescDeleted":
		"הצבע השמור של תיבת־הבלטה זו נמחק. אפשר לשמור אותו מחדש על ידי {{link}}.",
	"editor.colorsDescDeletedOther":
		"הצבע השמור של תיבת־הבלטה זו נמחק. אפשר לשמור אותו מחדש על ידי {{link}} — גם תיבת־הבלטה אחת נוספת שמשתמשת בו תחובר מחדש.",
	"editor.colorsDescDeletedOthers":
		"הצבע השמור של תיבת־הבלטה זו נמחק. אפשר לשמור אותו מחדש על ידי {{link}} — גם {{count}} תיבות־הבלטה נוספות שמשתמשות בו יחוברו מחדש.",
	"editor.colorsDescDeletedLink": "לחיצה כאן",
	"palette.colorExists":
		'הצבעים האלה זהים ל־"{{name}}". שני צבעים שמורים לא יכולים להיות זהים — שנה צבע כדי להבדיל ביניהם.',
	"palette.colorExistsUse":
		'הצבעים האלה זהים ל־"{{name}}". שני צבעים שמורים לא יכולים להיות זהים — שנה צבע, או {{link}}.',
	"palette.colorExistsUseLink": "להשתמש בקיים",
	"locale.downloading": "מוריד את התרגום…",
	"locale.notDownloaded": "{{name}} עדיין לא הורדה",
	"locale.notDownloadedDesc":
		"Callout Studio מציג באנגלית עד שניתן יהיה להוריד את התרגום. הניסיון יחזור בהפעלה הבאה של Obsidian.",
	"locale.retry": "ניסיון חוזר",
	"locale.diskWriteFailed":
		"Callout Studio לא הצליח לשמור את התרגום בדיסק, ולכן יהיה צורך להוריד אותו שוב בפעם הבאה.",
	"notice.exportedCssCreated": "קטע ה־CSS נשמר ב־{{path}}",
	"notice.exportedCssUpdated": "קטע ה־CSS עודכן ב־{{path}}",
	"notice.exportedCssUnchanged": "קטע ה־CSS כבר מעודכן.",
	"notice.exportCssEmpty": "אין תיבות־הבלטה מותאמות־אישית לייצוא.",
	"notice.exportCssFailed":
		"לא ניתן לשמור את קטע ה־CSS. בדקו את קונסולת המפתחים לפרטים.",
	"notice.exportCssEnabled":
		"קטע זה מופעל בכספת הזו. Callout Studio כבר מעצב כאן את תיבות־ההבלטה, והקטע שומר את העיצוב שהיה בעת הייצוא.",
	"confirm.titleOverwriteSnippet": "שכתוב קטע CSS",
	"confirm.overwriteSnippet":
		"קטע ה־CSS בתיקיית הקטעים השתנה מאז ש־Callout Studio כתב אותו. ייצוא נוסף יחליף את כל הקובץ.",
	"confirm.overwriteSnippetOk": "שכתוב",
	"export.chooseFormat": "ייצוא בתור",
	"export.formatJson": "גיבוי של Callout Studio",
	"export.formatJsonDesc":
		"קובץ ‎.json עם תיבות־ההבלטה וההגדרות שלכם, לייבוא בכספת אחרת.",
	"export.formatCss": "קטע CSS",
	"export.formatCssDesc":
		"קובץ ‎.css שנשמר בתיקיית הקטעים של הכספת הזו, לשימוש במקום שבו Callout Studio אינו מותקן. הוא מכסה תיבות־הבלטה רגילות בלבד ומהווה תמונת מצב; ייצאו אותו שוב לאחר שינוי.",
};
