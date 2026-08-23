export const el: Record<string, string> = {
	"cmd.openSettings": "Άνοιγμα ρυθμίσεων",
	"cmd.createCallout": "Δημιουργία νέου τύπου callout",
	"cmd.insertEmptyCallout": "Εισαγωγή κενού callout",
	"cmd.calloutWrap": "Αναδίπλωση σε callout",
	"cmd.calloutUnwrap": "Αφαίρεση callout",
	"cmd.customWrapBlock": "Αναδίπλωση σε callout μπλοκ {{name}}",
	"cmd.customInsertBlock": "Εισαγωγή callout μπλοκ {{name}}",
	"cmd.customInsertHeading":
		"Εισαγωγή callout επικεφαλίδας H{{level}} {{name}}",
	"cmd.customInsertInline": "Εισαγωγή ενσωματωμένου callout {{name}}",
	"cmd.openQuickInsert": "Γρήγορη εισαγωγή callout μπλοκ",
	"autocomplete.createNew": 'Δημιουργία νέου callout: "{{name}}"',
	"settings.fallbackTag": "Προεπιλογή",
	"settings.fallbackTagAuto": "Αυτόματη προεπιλογή",
	"settings.rescanVault": "Επανασάρωση vault",
	"settings.rescanVaultDesc":
		"Βρίσκει άγνωστα IDs callout σε σημειώσεις και τα προσθέτει ως εφεδρικές γραμμές.",
	"settings.rescanVaultHintAction": "Σάρωση τώρα",
	"settings.rescanComplete":
		"Η επανασάρωση ολοκληρώθηκε: προστέθηκαν {{count}} νέα callout(s).",
	"replaceModal.deleteWithoutReplaceSuffix": "(επιστρέφει στην προεπιλογή)",
	"replaceModal.titleDelete": "Διαγραφή callout",
	"replaceModal.titleReplace": "Αντικατάσταση στο vault",
	"firstRun.title": "Εύρεση υπαρχόντων callouts στο vault;",
	"firstRun.body":
		"Το Callout Studio μπορεί να σαρώσει το vault σας για να ανακαλύψει callouts που ήδη χρησιμοποιείτε, ώστε να εμφανίζονται στη λίστα ρυθμίσεων και να υιοθετούν το εφεδρικό σας στυλ.",
	"firstRun.heavyVaultNote":
		"Το vault σας έχει {{count}} αρχεία Markdown — η σάρωση μπορεί να διαρκέσει μερικά δευτερόλεπτα.",
	"firstRun.laterHint":
		"Μπορείτε πάντα να το εκτελέσετε αργότερα από Ρυθμίσεις → Πληροφορίες vault και συντήρηση → Επανασάρωση vault.",
	"firstRun.scanNow": "Σάρωση τώρα",
	"firstRun.noThanks": "Όχι, ευχαριστώ",
	"firstRun.autoScanComplete":
		"Το Callout Studio σάρωσε το vault σας και πρόσθεσε {{count}} callout(s).",
	"firstRun.scanning": "Σάρωση",

	"welcome.tooltip": "Σχετικά με το Callout Studio",
	"welcome.title": "Καλώς ήρθατε στο Callout Studio",
	"welcome.tagline":
		"Η ολοκληρωμένη λύση σας για τη διαχείριση callouts στο Obsidian.",
	"welcome.previewTitle": "Δείτε το σε δράση",
	"welcome.sample":
		"Το Callout Studio σάς επιτρέπει να δημιουργείτε callouts με προσαρμοσμένο εικονίδιο, χρώματα και όνομα.\n\n" +
		"Μπορείτε να χρησιμοποιήσετε το ίδιο callout με **τρεις** διαφορετικούς τρόπους:\n\n" +
		"## [!tip] Ως επικεφαλίδα\n" +
		"Για να μετατρέψετε οποιαδήποτε επικεφαλίδα σε επικεφαλίδα στυλ callout, προσθέστε `[!type]` αμέσως μετά τα `#`.\n\n" +
		"Θέλετε ένα ενσωματωμένο callout σαν κι αυτό [!warning]; Απλώς προσθέστε `[!type]` στη μέση μιας πρότασης, χωρίς να διακόψετε τη ροή σας.\n\n" +
		"> [!note] Κανονικό callout\n" +
		"> Φυσικά, το κλασικό callout λειτουργεί με ακριβώς την ίδια σύνταξη που ήδη γνωρίζετε: `> [!type]`.\n\n" +
		"Το Callout Studio έχει πολλά περισσότερα να προσφέρει! [Μάθετε περισσότερα]({{repoUrl}}).\n",

	"deleteModal.title": 'Διαγραφή callout "{{name}}";',
	"deleteModal.bodyInUse":
		"Αυτό το callout εμφανίζεται {{count}} φορά/φορές σε {{files}} αρχείο/α.",
	"deleteModal.bodyInUseExplain":
		"Η διαγραφή θα μετατρέψει αυτά τα μπλοκ σε απλό κείμενο — θα χάσουν το στυλ και την επικεφαλίδα callout.",
	"deleteModal.replaceHint":
		"Μπορείτε να το αντικαταστήσετε με άλλο callout, διατηρώντας το περιεχόμενο του vault ως στυλιζαρισμένο callout.",
	"deleteModal.bodyUnused":
		'"{{name}}" δεν χρησιμοποιείται σε καμία σημείωση, αλλά είναι ένα προσαρμοσμένο callout που δημιουργήσατε. Η διαγραφή θα το αφαιρέσει από αυτήν τη λίστα.',
	"deleteModal.replaceInstead": "Αντικατάσταση αντ’ αυτού",
	"deleteModal.deleteInUse": "Διαγραφή (μετατροπή σε απλό κείμενο)",
	"deleteModal.deleteUnused": "Διαγραφή callout",
	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Οι τύποι callout μου",
	"settings.builtInCallouts": "Ενσωματωμένα callouts",
	"settings.contextMenu": "Μενού περιβάλλοντος",
	"settings.autocomplete": "Αυτόματη συμπλήρωση",
	"settings.keyboardShortcuts": "Συντομεύσεις πληκτρολογίου",
	"settings.language": "Γλώσσα",
	"settings.languageDesc":
		"Γλώσσα εμφάνισης για το Callout Studio. Ακολουθεί από προεπιλογή τη γλώσσα διεπαφής του Obsidian.",
	"settings.languageAuto": "Αυτόματα (όπως το Obsidian)",
	"settings.importExport": "Εισαγωγή / εξαγωγή",
	"settings.import": "Εισαγωγή",
	"settings.export": "Εξαγωγή",
	"settings.importDesc":
		"Εισάγετε τα δεδομένα Callout Studio από άλλο vault χρησιμοποιώντας αρχείο JSON.",
	"settings.exportDesc":
		"Αποθηκεύστε όλους τους προσαρμοσμένους τύπους callout σε μορφή JSON.",
	"settings.importConflictNotice":
		"Εισήχθησαν {{count}} τύπος/τύποι callout· {{overwritten}} υπάρχουσα/-ες καταχώρηση/-εις αντικαταστάθηκε/-αν.",
	"settings.addNewCallout": "+ προσθήκη callout",
	"settings.noCalloutsNow":
		"Δεν υπάρχουν προσαρμοσμένα callouts προς το παρόν.",
	"settings.editAria": "Επεξεργασία {{name}}",
	"settings.moreRowActionsAria": "Περισσότερες ενέργειες για {{name}}",
	"settings.usageInfo": "{{count}} χρήση/χρήσεις σε {{files}} αρχείο/α",
	"settings.replaceAction": "Αντικατάσταση στο vault",
	"settings.deleteAction": "Διαγραφή",
	"settings.resetAction": "Επαναφορά στις προεπιλογές",
	"settings.makeFallbackAction": "Χρήση προεπιλεγμένου εφεδρικού στυλ",
	"settings.colorSwatchAria": "Έμφαση: {{accent}} · Φόντο: {{bg}}",
	"settings.externalStyleTag": "Εξωτερικό στιλ",
	"settings.externalStyleAction": "Χρήση εξωτερικού στιλ (θέμα ή CSS)",
	"settings.externalStyleBlocked":
		"αυτό είναι το προεπιλεγμένο callout εφεδρείας, επιλέξτε πρώτα ένα άλλο",
	"settings.fallbackCallout": "Προεπιλεγμένο εφεδρικό callout",
	"settings.fallbackCalloutDesc":
		"Οι άγνωστοι τύποι callout στο vault σας θα κληρονομήσουν το στυλ αυτού του callout.",
	"settings.globalStyle": "Καθολικό στυλ callout",
	"settings.border": "Περιγράμματα",
	"settings.borderAll": "Όλες",
	"settings.borderTop": "Πάνω",
	"settings.borderRight": "Δεξιά",
	"settings.borderBottom": "Κάτω",
	"settings.borderLeft": "Αριστερά",
	"settings.borderWidth": "Πάχος περιγράμματος",
	"settings.fontScaleGroup": "Κλίμακα γραμματοσειράς",
	"settings.titleScale": "Τίτλος",
	"settings.contentScale": "Περιεχόμενο",
	"settings.inlineTextScale": "Κείμενο",
	"settings.shapeGroup": "Σχήμα",
	"settings.borderRadius": "Στρογγυλοποίηση γωνιών",
	"settings.alignGroup": "Στοίχιση",
	"settings.alignContent": "Στοίχιση περιεχομένου με τον τίτλο",
	"settings.headingSpacingGroup": "Απόσταση τίτλου",
	"settings.headingPadVertical": "Κατακόρυφη απόσταση",
	"settings.headingGap": "Απόσταση μεταξύ επικεφαλίδων",
	"settings.headingFoldGroup": "Σύμπτυξη",
	"settings.headingFoldArrow": "Εμφάνιση βέλους σύμπτυξης",
	"settings.styleDemoName": "Παράδειγμα",
	"settings.previewTitle": "Προεπισκόπηση",
	// Settings — Saved color palettes
	"settings.customPalettes": "Αποθηκευμένες παλέτες χρωμάτων",
	"settings.newPalette": "Νέα παλέτα",
	"settings.customPalettesEmpty":
		"Δεν υπάρχουν αποθηκευμένες παλέτες προς το παρόν.",
	"settings.editPaletteAria": "Επεξεργασία παλέτας {{name}}",
	"settings.deletePaletteAria": "Διαγραφή παλέτας {{name}}",
	"settings.deletePaletteConfirm":
		'Διαγραφή παλέτας "{{name}}";\nΤα callout που χρησιμοποιούν τα χρώματά της δεν επηρεάζονται.',
	"settings.enableAutocomplete": "Ενεργοποίηση αυτόματης συμπλήρωσης [!",
	"settings.enableAutocompleteDesc":
		'Εμφανίζει προτάσεις όταν πληκτρολογείτε "[!" μέσα σε αποσπασματική παράθεση στον επεξεργαστή. Επιλέξτε τύπο callout από τη λίστα για εισαγωγή πλήρους επικεφαλίδας callout.',
	"settings.customCommands": "Εντολές και συντομεύσεις",
	"settings.customCommandsDesc":
		"Δείτε κάθε εντολή του Callout Studio και τη συντόμευση στην οποία είναι δεσμευμένη, και δημιουργήστε τις δικές σας εντολές για τα callouts που χρησιμοποιείτε περισσότερο. Καμία συντόμευση δεν έχει ανατεθεί από προεπιλογή.",
	"settings.customCommandsButton": "Διαχείριση εντολών",
	"commandBuilder.title": "Εντολές και συντομεύσεις",
	"commandBuilder.desc":
		"Χρησιμοποιήστε το κουμπί + για να ορίσετε ή να αλλάξετε μια συντόμευση στις ρυθμίσεις συντομεύσεων του Obsidian.",
	"commandBuilder.builtIn": "Ενσωματωμένες εντολές",
	"commandBuilder.toggleAria": "Ενεργοποίηση ή απενεργοποίηση του {{name}}",
	"commandBuilder.hotkeyBlank": "Κενό",
	"commandBuilder.hotkeyAria": "Ορισμός συντόμευσης για {{name}}",
	"commandBuilder.yourCommands": "Οι εντολές σας",
	"commandBuilder.newCommand": "Νέα εντολή",
	"commandBuilder.empty": "Δεν υπάρχουν ακόμη προσαρμοσμένες εντολές.",
	"commandBuilder.unknownCommand": "αυτή την εντολή",
	"commandBuilder.editAria": "Επεξεργασία {{name}}",
	"commandBuilder.deleteAria": "Διαγραφή {{name}}",
	"commandBuilder.deleteConfirm":
		"Διαγραφή της εντολής {{name}}; Τυχόν συντόμευση που της έχει ανατεθεί θα σταματήσει να λειτουργεί.",
	"commandBuilder.newTitle": "Νέα εντολή",
	"commandBuilder.editTitle": "Επεξεργασία εντολής",
	"commandBuilder.format": "Μορφή callout",
	"commandBuilder.formatDesc": "Τι είδους callout γράφει η εντολή.",
	"commandBuilder.formatHeading": "Επικεφαλίδα",
	"commandBuilder.formatInline": "Ενσωματωμένο",
	"commandBuilder.formatBlock": "Μπλοκ",
	"commandBuilder.roleDisabled":
		"Αυτή η μορφή είναι απενεργοποιημένη, οπότε η εντολή θα εισάγει απλό κείμενο μέχρι να την ενεργοποιήσετε ξανά.",
	"commandBuilder.callout": "Τύπος callout",
	"commandBuilder.calloutDesc": "Το callout που εισάγει αυτή η εντολή.",
	"commandBuilder.headingLevel": "Επίπεδο επικεφαλίδας",
	"commandBuilder.headingLevelDesc": "Ποιο επίπεδο επικεφαλίδας θα γραφτεί.",
	"commandBuilder.action": "Ενέργεια",
	"commandBuilder.actionDesc":
		"Η αναδίπλωση μετατρέπει την επιλογή σε callout· η εισαγωγή προσθέτει ένα κενό.",
	"commandBuilder.actionWrap": "Αναδίπλωση επιλογής",
	"commandBuilder.actionInsert": "Εισαγωγή νέου",
	"commandBuilder.preview": "Όνομα εντολής",
	"commandBuilder.duplicate": "Έχετε ήδη μια εντολή που κάνει ακριβώς αυτό.",
	"commandBuilder.noCallouts":
		"Δεν υπάρχουν ακόμη τύποι callout για να δημιουργήσετε μια εντολή.",
	"commandBuilder.save": "Αποθήκευση",
	"settings.vaultMaintenance": "Πληροφορίες vault και συντήρηση",
	"settings.vaultStats": "Στατιστικά callout",
	"settings.vaultStatsDesc":
		"Μετράει κάθε callout στις σημειώσεις Markdown — μπλοκ, επικεφαλίδας και ενσωματωμένο — και τα ομαδοποιεί ανά τύπο.",
	"settings.vaultStatsButton": "Προβολή στατιστικών",
	"settings.vaultStatsScanning": "Σάρωση",
	"settings.resetAll": "Επαναφορά",
	"settings.resetAllDesc":
		"Διαγράφει όλα τα callout χρήστη, επαναφέρει τα ενσωματωμένα callouts, τα καθολικά στυλ, τις αποθηκευμένες παλέτες χρωμάτων, την προσαρμογή του μενού δεξιού κλικ και τα ληφθέντα SVG Material.",
	"settings.resetAllButton": "Επαναφορά όλων",
	"settings.resetAllConfirm":
		"Αυτό θα διαγράψει όλα τα προσαρμοσμένα callouts, θα επαναφέρει τα ενσωματωμένα callouts, τα καθολικά στυλ, τις αποθηκευμένες παλέτες χρωμάτων, την προσαρμογή του μενού δεξιού κλικ και όλα τα αποθηκευμένα SVG Material. Η ενέργεια δεν μπορεί να αναιρεθεί. Είστε σίγουροι;",
	"notice.resetAllDone": "Όλα επαναφέρθηκαν στις προεπιλογές.",
	"notice.customCommandsRemoved":
		"Αφαιρέθηκαν {{count}} προσαρμοσμένη(-ες) εντολή(-ές) των οποίων ο τύπος callout δεν υπάρχει πια.",
	"notice.customCommandMissingCallout":
		"Ο τύπος callout αυτής της εντολής δεν υπάρχει πια.",
	"notice.exported": "Τα callouts εξήχθησαν στο callout-studio-export.json",
	"notice.importedJSON": "Εισήχθησαν {{count}} τύπος/τύποι callout από JSON.",
	"notice.importedSettings": "Οι ρυθμίσεις του προσθέτου εισήχθησαν.",
	"notice.importedCalloutManager":
		"Εισήχθη από Callout Manager: {{created}} δημιουργήθηκαν, {{updated}} ενημερώθηκαν.",
	"notice.importedAdmonition":
		"Έγινε εισαγωγή από το Admonition: {{created}} δημιουργήθηκαν, " +
		"{{updated}} ενημερώθηκαν.",
	"notice.noNewJSON":
		"Δεν εισήχθησαν νέοι τύποι callout (τα IDs μπορεί να υπάρχουν ήδη).",
	"notice.iconDownloadFailed":
		'Αποτυχία λήψης εικονιδίου Material "{{name}}". Ενδέχεται να μην είναι διαθέσιμο για αυτό το στυλ/βάρος ή η σύνδεσή σας να είναι εκτός σύνδεσης.',
	"notice.externalStyleOn":
		'Το "{{name}}" μορφοποιείται πλέον από το θέμα ή το απόσπασμα CSS σας.',
	"notice.externalStyleOff":
		'Το Callout Studio μορφοποιεί ξανά το "{{name}}".',
	"notice.nothingToWrap": "Δεν υπάρχει τίποτα για αναδίπλωση.",
	"notice.cursorNotInsideCallout":
		"Ο κέρσορας δεν βρίσκεται μέσα σε callout.",
	"notice.autocompleteTargetMoved":
		"Δεν εισήχθη τίποτα — η γραμμή άλλαξε ενώ ο επεξεργαστής ήταν ανοιχτός.",
	"notice.openHotkeysFailed":
		"Αδυναμία ανοίγματος ρυθμίσεων συντομεύσεων Obsidian.",
	"notice.filterHotkeysFailed":
		"Οι συντομεύσεις Obsidian ανοίχτηκαν, αλλά δεν ήταν δυνατή η εφαρμογή του φίλτρου Callout Studio.",
	"editor.editCallout": "Επεξεργασία callout",
	"editor.newCallout": "Νέο callout",
	"editor.displayName": "Εμφανιζόμενο όνομα",
	"editor.displayNameDesc":
		"Η αναγνώσιμη ετικέτα που εμφανίζεται στη διεπαφή",
	"editor.displayNameBuiltIn":
		"Το εμφανιζόμενο όνομα δεν μπορεί να αλλαχθεί για τα ενσωματωμένα callouts",
	"editor.displayNamePlaceholder": "Το callout μου",
	"editor.calloutIds": "IDs callout",
	"editor.calloutIdsDesc":
		"Όλα τα αναγνωριστικά για αυτό το callout. Επιτρέπονται κενά.\nΠατήστε Enter ή το κουμπί + για προσθήκη.",
	"editor.calloutIdsPlaceholder": "Προσθήκη ID",
	"editor.addId": "Προσθήκη ID",
	"editor.idLinkedToName": "Συνδεδεμένο με το εμφανιζόμενο όνομα",
	"editor.idCannotDelete":
		"Αυτό το ID είναι συνδεδεμένο με το εμφανιζόμενο όνομα και δεν μπορεί να διαγραφεί — επεξεργαστείτε το όνομα για να το αλλάξετε",
	"editor.icon": "Εικονίδιο",
	"editor.pickIcon": "Αλλαγή εικονιδίου",
	"editor.replaceIcon": "Αντικατάσταση εικονιδίου",
	"editor.removeIcon": "Αφαίρεση εικονιδίου",
	"editor.noIcon": "Χωρίς εικονίδιο",
	"editor.resetIcon": "Επαναφορά εικονιδίου στην προεπιλογή",
	"editor.livePreview": "Ζωντανή προεπισκόπηση",
	"editor.iconAdjustment": "Ρύθμιση εικονιδίου",
	"editor.picture": "Εικόνα",
	"editor.size": "Μέγεθος",
	"editor.horizontalOffset": "Οριζόντια μετατόπιση",
	"editor.verticalOffset": "Κατακόρυφη μετατόπιση",
	"editor.colors": "Χρώματα",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Επαναφορά χρωμάτων στην προεπιλογή",
	"editor.paletteDeleted": "Διαγραμμένο χρώμα",
	"editor.paletteGroupObsidian": "Callouts Obsidian",
	"editor.paletteGroupPresets": "Προεπιλογές χρωμάτων",
	"editor.paletteGroupCustom": "Προσαρμοσμένο",
	"editor.paletteNewColor": "Νέο χρώμα…",
	"editor.contrastWarning":
		"Χαμηλή αντίθεση με το φόντο — ενδέχεται να είναι δύσκολο να διαβαστεί",
	"editor.foldable": "Αναδιπλούμενο",
	"editor.foldableDesc":
		"Επιλέξτε αν το callout μπορεί να αναδιπλωθεί και ποια προεπιλεγμένη κατάσταση εφαρμόζεται στο vault.",
	"editor.foldOff": "Ανενεργό",
	"editor.foldOpen": "Ανοιχτό από προεπιλογή",
	"editor.foldClosed": "Κλειστό από προεπιλογή",
	"editor.cancel": "Ακύρωση",
	"editor.saveChanges": "Αποθήκευση αλλαγών",
	"editor.createCallout": "Δημιουργία callout",
	"editor.nameRequired":
		"Απαιτείται εμφανιζόμενο όνομα πριν τη δημιουργία callout.",
	"editor.noChangesToSave": "Δεν έγιναν αλλαγές.",
	"editor.downloadingIcon": "Λήψη εικονιδίου",
	"editor.idEmpty": "Απαιτείται τουλάχιστον ένα ID",
	"editor.idExists": "Υπάρχει ήδη callout με αυτό το ID",
	"editor.idConflict": "Αυτό το ID έρχεται σε σύγκρουση με υπάρχον callout",
	"editor.idDashConflict":
		"Το Obsidian γράφει τα κενά ως παύλες, επομένως αυτό το ID συγκρούεται με το «{{other}}»",
	"editor.untitledCallout": "Callout χωρίς τίτλο",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Εδώ υπάρχει ένα ενσωματωμένο [!{id}] χάπι μέσα σε μια παράγραφο.",
	"editor.previewReadOnly":
		"Η ζωντανή προεπισκόπηση δεν μπορεί να επεξεργαστεί",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleTitle": "Μορφοποιημένο εκτός Callout Studio",
	"editor.externalStyleBody":
		"Το Callout Studio δεν εφαρμόζει κανένα στιλ στο {{id}}. Η εμφάνισή του προέρχεται από το θέμα σας, ένα απόσπασμα CSS ή τις προεπιλογές του Obsidian.",
	"editor.externalStyleWhat": "Τι σημαίνει αυτό",
	"editor.externalStyleWhatHeading":
		"Ένα callout επικεφαλίδας όπως ## [!{{id}}] Τίτλος δεν θα αποδοθεί — το κείμενο παραμένει όπως γράφτηκε.",
	"editor.externalStyleWhatInline":
		"Ούτε ένα ενσωματωμένο, όπως λέξη [!{{id}}] λέξη.",
	"editor.externalStyleWhatGlobal":
		"Οι καθολικές ρυθμίσεις στιλ (περίγραμμα, ακτίνα, μέγεθος κειμένου) δεν ισχύουν γι' αυτό.",
	"editor.externalStylePreviewTitle": "Πώς αποδίδεται τώρα",
	"editor.externalStyleSample":
		"## [!{{id}}] Τίτλος\n\n" +
		"Έτσι φαίνεται μια πρόταση με [!{{id}}] μέσα της.\n\n" +
		"> [!{{id}}] {{name}}\n" +
		"> Έτσι φαίνεται το περιεχόμενο του callout.\n",
	"editor.externalStyleResume": "Επαναφορά μορφοποίησης",
	"editor.externalStyleClose": "Το κατάλαβα",
	// Palette editor modal
	"palette.newTitle": "Νέα παλέτα χρωμάτων",
	"palette.groupPalette": "Παλέτα",
	"palette.editTitle": "Επεξεργασία παλέτας χρωμάτων",
	"palette.name": "Όνομα",
	"palette.namePlaceholder": "Η παλέτα μου",
	"palette.nameExists": "Υπάρχει ήδη παλέτα με αυτό το όνομα",
	"palette.baseColor": "Βασικό χρώμα",
	"palette.baseColorHint":
		"Θα ταιριάξουμε αυτόματα το χρώμα φόντου με αυτό. Αν θέλετε, μπορείτε να το ελέγξετε ξεχωριστά κάνοντας {{link}}.",
	"palette.baseColorHintLink": "κλικ εδώ",
	"palette.advancedColors": "Χρώματα",
	"palette.advancedColorsHint":
		"Επεξεργασία χρωμάτων για τη λειτουργία {{mode}} - η άλλη λειτουργία ενημερώνεται αυτόματα. Αλλάξτε το θέμα του Obsidian για να το ελέγξετε.",
	"palette.revertHint":
		"Προτιμάτε ένα ενιαίο βασικό χρώμα αντ' αυτού; {{link}}.",
	"palette.revertHintLink": "Επαναφορά",
	"palette.lightMode": "Φωτεινό",
	"palette.darkMode": "Σκοτεινό",
	"palette.accentColor": "Χρώμα έμφασης",
	"palette.backgroundColorChannel": "Χρώμα φόντου",
	"palette.textColorChannel": "Χρώμα κειμένου",
	"palette.bgIntensity": "Ένταση",
	"palette.bgStyle": "Στυλ",
	"palette.bgSolid": "Συμπαγές",
	"palette.bgGradient": "Διαβάθμιση",
	"palette.bgTransparent": "Διαφανές",
	"palette.gradientTo": "Δεύτερο χρώμα",
	"palette.gradientDirection": "Κατεύθυνση",
	"palette.gradientText": "Κείμενο τίτλου με διαβάθμιση",
	"palette.save": "Αποθήκευση",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Κόκκινο",
	"colorName.orange": "Πορτοκαλί",
	"colorName.amber": "Κεχριμπαρί",
	"colorName.yellow": "Κίτρινο",
	"colorName.lime": "Λαχανί",
	"colorName.green": "Πράσινο",
	"colorName.teal": "Πετρόλ",
	"colorName.cyan": "Κυανό",
	"colorName.sky": "Ουρανί",
	"colorName.blue": "Μπλε",
	"colorName.indigo": "Λουλακί",
	"colorName.violet": "Βιολετί",
	"colorName.purple": "Μωβ",
	"colorName.pink": "Ροζ",
	"colorName.rose": "Ροδί",
	"colorName.brown": "Καφέ",
	"colorName.gray": "Γκρι",
	"colorName.black": "Μαύρο",
	"colorName.white": "Λευκό",
	"colorName.crimson": "Βυσσινί",
	"colorName.coral": "Κοραλί",
	"colorName.grape": "Σταφύλι",
	"colorName.plum": "Δαμάσκηνο",
	"colorName.bubblegum": "Τσίχλα",

	"iconPicker.pickIcon": "Επιλογή εικονιδίου",
	"iconPicker.confirm": "Επιβεβαίωση",
	"iconPicker.cancel": "Ακύρωση",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "αναζήτηση εικονιδίων Lucide",
	"iconPicker.searchTabler": "αναζήτηση εικονιδίων Tabler",
	"iconPicker.tablerStyle": "Στυλ εικονιδίου",
	"iconPicker.tablerStyleOutline": "Περίγραμμα (Outline)",
	"iconPicker.tablerStyleFilled": "Γεμιστό (Filled)",
	"iconPicker.loadMore": "Φόρτωση περισσότερων",
	"iconPicker.materialStyle": "Στυλ εικονιδίου",
	"iconPicker.materialStyleOutlined": "Περίγραμμα (Outlined)",
	"iconPicker.materialStyleFilled": "Γεμάτο (Filled)",
	"iconPicker.materialStyleRounded": "Στρογγυλο (Rounded)",
	"iconPicker.materialStyleSharp": "Αιχμηρό (Sharp)",
	"iconPicker.materialWeight": "Βάρος εικονιδίου",
	"iconPicker.materialWeight100": "Λεπτό (Thin)",
	"iconPicker.materialWeight200": "Εξαιρετικά ελαφρύ (Extra Light)",
	"iconPicker.materialWeight300": "Ελαφρύ (Light)",
	"iconPicker.materialWeight400": "Κανονικό (Regular)",
	"iconPicker.materialWeight500": "Μεσαίο (Medium)",
	"iconPicker.materialWeight600": "Ημιέξτρα (Semi Bold)",
	"iconPicker.materialWeight700": "Έξτρα (Bold)",
	"iconPicker.materialFontFailed":
		"Δεν ήταν δυνατή η φόρτωση των προεπισκοπήσεων εικονιδίων Material. Αντί γι' αυτό εμφανίζονται τα ονόματα των εικονιδίων — η αναζήτηση και η επιλογή εξακολουθούν να λειτουργούν.",
	"iconPicker.materialFontRetry": "Δοκιμάστε ξανά",
	"iconPicker.searchMaterial": "αναζήτηση εικονιδίων Material",
	"iconPicker.searchEmoji": "Αναζήτηση emoji",
	"iconPicker.skinTone": "Χρώμα δέρματος",
	"iconPicker.allCategories": "Όλες οι κατηγορίες",
	"iconPicker.noIconSelected": "Δεν επιλέχθηκε εικονίδιο",
	"iconPicker.noResults":
		"Κανένα εικονίδιο δεν ταιριάζει στην αναζήτησή σας.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Αναζήτηση στα Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Αναζήτηση στο Font Awesome",
	"iconPicker.faStyle": "Στυλ εικονιδίου",
	"iconPicker.faStyleSolid": "Συμπαγές (Solid)",
	"iconPicker.faStyleRegular": "Κανονικό (Regular)",
	"iconPicker.faStyleBrands": "Εμπορικά σήματα (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Αναζήτηση στο RPG Awesome",
	"iconPicker.image": "Οι εικόνες σας",
	"iconPicker.searchImage": "Αναζήτηση στις εικόνες σας",
	"iconPicker.imageTooLarge":
		"{{name}} είναι πολύ μεγάλο. Οι εικόνες πρέπει να είναι κάτω από 5 MB.",
	"iconPicker.imageUnsupported":
		"{{name}} δεν είναι υποστηριζόμενη μορφή εικόνας. Χρησιμοποιήστε SVG, PNG, JPEG ή WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} δεν ήταν δυνατή η ανάγνωσή του ως ασφαλές SVG, γι' αυτό δεν προστέθηκε.",
	"iconPicker.imageDecodeFailed":
		"{{name}} δεν ήταν δυνατή η ανάγνωσή του ως εικόνα.",
	"iconPicker.imageDuplicate":
		"{{name}} υπάρχει ήδη στις εικόνες σας. Μετονομάστε το αρχείο ή διαγράψτε την υπάρχουσα εικόνα.",
	"iconPicker.imageAdd": "Προσθήκη εικόνων",
	"iconPicker.imageEmpty":
		"Δεν υπάρχουν εικόνες ακόμα. Προσθέστε ένα αρχείο SVG, PNG, JPEG ή WebP από τον υπολογιστή σας ή σύρτε το εδώ.",
	"iconPicker.imageDelete": "Διαγραφή",
	"iconPicker.imageDeleteConfirm": "Διαγραφή “{{name}}”;",
	"iconPicker.imageDeleteInUse":
		"{{count}} callouts χρησιμοποιούν αυτή την εικόνα. Θα εμφανίσουν ένα εικονίδιο κράτησης θέσης έως ότου δώσετε νέο.",
	"iconPicker.imageRecolor": "Παρακολούθηση χρώματος Callout",
	"iconPicker.allSources": "Όλες οι πηγές",
	"iconPicker.searchAllSources": "Αναζήτηση σε όλες τις πηγές εικονιδίων",
	"iconPicker.sourcesNotDownloaded":
		"Δεν έχει ληφθεί ακόμα: {{names}}. Επιλέξτε μια πηγή παραπάνω για να τη λάβετε.",
	"iconPicker.chooseSource": "Επιλογή πηγής",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "αναζήτηση σε όλες τις βιβλιοθήκες ταυτόχρονα",
	"iconPicker.descLucide":
		"η δική σύνθεση του Obsidian, πάντα εκτός σύνδεσης",
	"iconPicker.descTabler":
		"καθαρά και συνεπή εικονίδια UI, περίγραμμα και γεμιστά",
	"iconPicker.descMaterial":
		"η σύνθεση της Google, τέσσερα στυλ και επτά βάρη",
	"iconPicker.descEmoji": "έγχρωμα σχήματα, κάθε τόνος δέρματος",
	"iconPicker.descOcticons": "εικονίδια διεπαφής του GitHub",
	"iconPicker.descFa": "συμπαγές, κανονικό και εμπορικά σήματα",
	"iconPicker.descRpgAwesome":
		"εικονίδια φαντασίας και επιτραπέζιων παιχνιδιών",
	"iconPicker.descImage": "εικόνες που προσθέτετε από τον υπολογιστή σας",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Προσβασιμότητα",
	"iconPicker.cat.Actions": "Ενέργειες",
	"iconPicker.cat.Activities": "Δραστηριότητες",
	"iconPicker.cat.Alert": "Προειδοποίηση",
	"iconPicker.cat.Alphabet": "Αλφάβητο",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Ζώα",
	"iconPicker.cat.Arrows": "Βέλη",
	"iconPicker.cat.Astronomy": "Αστρονομία",
	"iconPicker.cat.Audio&Video": "Ήχος και βίντεο",
	"iconPicker.cat.Automotive": "Αυτοκίνητα",
	"iconPicker.cat.Badges": "Διακριτικά",
	"iconPicker.cat.Brand": "Εμπορικές μάρκες",
	"iconPicker.cat.Buildings": "Κτίρια",
	"iconPicker.cat.Business": "Επιχειρήσεις",
	"iconPicker.cat.Camping": "Κατασκήνωση",
	"iconPicker.cat.Charity": "Φιλανθρωπία",
	"iconPicker.cat.Charts": "Γραφήματα",
	"iconPicker.cat.Charts + Diagrams": "Γραφήματα και διαγράμματα",
	"iconPicker.cat.Childhood": "Παιδική ηλικία",
	"iconPicker.cat.Clothing + Fashion": "Ρούχα και μόδα",
	"iconPicker.cat.Coding": "Προγραμματισμός",
	"iconPicker.cat.Communicate": "Επικοινωνία",
	"iconPicker.cat.Communication": "Επικοινωνία",
	"iconPicker.cat.Computers": "Υπολογιστές",
	"iconPicker.cat.Connectivity": "Συνδεσιμότητα",
	"iconPicker.cat.Construction": "Κατασκευή",
	"iconPicker.cat.Currencies": "Νομίσματα",
	"iconPicker.cat.Database": "Βάση δεδομένων",
	"iconPicker.cat.Design": "Σχεδιασμός",
	"iconPicker.cat.Development": "Ανάπτυξη",
	"iconPicker.cat.Devices": "Συσκευές",
	"iconPicker.cat.Devices + Hardware": "Συσκευές και υλικό",
	"iconPicker.cat.Disaster + Crisis": "Καταστροφές και κρίσεις",
	"iconPicker.cat.Document": "Έγγραφο",
	"iconPicker.cat.E-commerce": "Ηλεκτρονικό εμπόριο",
	"iconPicker.cat.Editing": "Επεξεργασία",
	"iconPicker.cat.Education": "Εκπαίδευση",
	"iconPicker.cat.Electrical": "Ηλεκτρικό",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Ενέργεια",
	"iconPicker.cat.Extensions": "Επεκτάσεις",
	"iconPicker.cat.Files": "Αρχεία",
	"iconPicker.cat.Film + Video": "Ταινίες και βίντεο",
	"iconPicker.cat.Food": "Φαγητό",
	"iconPicker.cat.Food + Beverage": "Φαγητό και ποτά",
	"iconPicker.cat.Fruits + Vegetables": "Φρούτα και λαχανικά",
	"iconPicker.cat.Games": "Παιχνίδια",
	"iconPicker.cat.Gaming": "Γκέιμινγ",
	"iconPicker.cat.Gender": "Φύλο",
	"iconPicker.cat.Genders": "Φύλα",
	"iconPicker.cat.Gestures": "Θυμικές κινήσεις",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Χέρια",
	"iconPicker.cat.Hardware": "Υλικό",
	"iconPicker.cat.Health": "Υγεία",
	"iconPicker.cat.Holidays": "Αργίες",
	"iconPicker.cat.Home": "Σπίτι",
	"iconPicker.cat.Household": "Νοικοκυριά",
	"iconPicker.cat.Humanitarian": "Ανθρωπιστικό",
	"iconPicker.cat.Images": "Εικόνες",
	"iconPicker.cat.Laundry": "Πλύσιμο",
	"iconPicker.cat.Letters": "Γράμματα",
	"iconPicker.cat.Logic": "Λογική",
	"iconPicker.cat.Logistics": "Λογιστική",
	"iconPicker.cat.Map": "Χάρτης",
	"iconPicker.cat.Maps": "Χάρτες",
	"iconPicker.cat.Maritime": "Ναυτιλία",
	"iconPicker.cat.Marketing": "Μάρκετινγ",
	"iconPicker.cat.Math": "Μαθηματικά",
	"iconPicker.cat.Mathematics": "Μαθηματικά",
	"iconPicker.cat.Media": "Μέσα",
	"iconPicker.cat.Media Playback": "Αναπαραγωγή μέσων",
	"iconPicker.cat.Medical + Health": "Ιατρική και υγεία",
	"iconPicker.cat.Money": "Χρήματα",
	"iconPicker.cat.Mood": "Διάθεση",
	"iconPicker.cat.Moving": "Μετακόμιση",
	"iconPicker.cat.Music + Audio": "Μουσική και ήχος",
	"iconPicker.cat.Nature": "Φύση",
	"iconPicker.cat.Numbers": "Αριθμοί",
	"iconPicker.cat.Photography": "Φωτογραφία",
	"iconPicker.cat.Photos + Images": "Φωτογραφίες και εικόνες",
	"iconPicker.cat.Political": "Πολιτικά",
	"iconPicker.cat.Privacy": "Προστασία δεδομένων",
	"iconPicker.cat.Punctuation + Symbols": "Στίξη και σύμβολα",
	"iconPicker.cat.Religion": "Θρησκεία",
	"iconPicker.cat.Science": "Επιστήμη",
	"iconPicker.cat.Science Fiction": "Επιστημονική φαντασία",
	"iconPicker.cat.Security": "Ασφάλεια",
	"iconPicker.cat.Shapes": "Σχήματα",
	"iconPicker.cat.Shopping": "Ψώνια",
	"iconPicker.cat.Social": "Κοινωνικά μέσα",
	"iconPicker.cat.Spinners": "Σπινάρες",
	"iconPicker.cat.Sport": "Αθλητισμός",
	"iconPicker.cat.Sports + Fitness": "Αθλητισμός και γυμναστική",
	"iconPicker.cat.Symbols": "Σύμβολα",
	"iconPicker.cat.System": "Σύστημα",
	"iconPicker.cat.Text": "Κείμενο",
	"iconPicker.cat.Text Formatting": "Μορφοποίηση κειμένου",
	"iconPicker.cat.Time": "Χρόνος",
	"iconPicker.cat.Toggle": "Διακόπτης",
	"iconPicker.cat.Transit": "Τρανζίτ",
	"iconPicker.cat.Transportation": "Μεταφορές",
	"iconPicker.cat.Travel": "Ταξίδι",
	"iconPicker.cat.Travel + Hotel": "Ταξίδι και ξενοδοχεία",
	"iconPicker.cat.UI actions": "Ενέργειες διεπαφής",
	"iconPicker.cat.Users + People": "Χρήστες και άνθρωποι",
	"iconPicker.cat.Vehicles": "Οχήματα",
	"iconPicker.cat.Version control": "Ελεγχος εκδόσεων",
	"iconPicker.cat.Weather": "Καιρός",
	"iconPicker.cat.Writing": "Γραφή",
	"iconPicker.cat.Zodiac": "Ζωδιακός κύκλος",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} δεν έχει ληφθεί ακόμα",
	"iconPack.downloadDetail": "{{count}} εικονίδια · {{size}} · εφάπαξ λήψη",
	"iconPack.download": "Λήψη",
	"iconPack.downloading": "Λήψη {{name}}…",
	"iconPack.downloadFailed":
		"Δεν ήταν δυνατή η λήψη του {{name}}. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.",
	"iconPack.retry": "Επανάληψη",
	"iconPack.faBrandsNotice":
		"Τα εικονίδια μαρκών αποτελούν εμπορικά σήματα των αντίστοιχων ιδιοκτητών τους. Η συμπερίληψή τους δεν υποδηλώνει έγκριση. Παρακαλώ χρησιμοποιήστε τα μόνο για την αντιπροσώπευση της εταιρείας, του προϊόντος ή της υπηρεσίας που αναφέρουν.",
	"iconPack.artworkRestored": "Λήψη γραφικών εικονιδίων για {{names}}.",
	"iconPack.diskWriteFailed":
		"Το Callout Studio δεν μπόρεσε να αποθηκεύσει το πακέτο εικονιδίων στο δίσκο, οπότε θα χρειαστεί να γίνει λήψη ξανά την επόμενη φορά. Τα εικονίδια που επιλέγετε αποθηκεύονται στις ρυθμίσεις σας.",

	// Icon licences & credits
	"credits.title": "Άδειες εικονιδίων και αναφορές",
	"credits.intro":
		"Το Callout Studio αντλεί από αρκετές ανοιχτές βιβλιοθήκες εικονιδίων. Οι άδειές τους αναπαράγονται παρακάτω, μαζί με ό,τι άλλαξε για τη χρήση τους εδώ.",
	"credits.fullNotices": "Πλήρεις ανακοινώσεις τρίτων μερών",
	"credits.pluginLicense":
		"Ο κώδικας του Callout Studio είναι υπό μια permissive άδεια· οι βιβλιοθήκες εικονιδίων διατηρούν τις δικές τους άδειες.",
	"contextMenu.editCallout": "Επεξεργασία ρυθμίσεων callout",
	"contextMenu.copyMarkdown": "Αντιγραφή Markdown callout",
	"contextMenu.openSettings": "Άνοιγμα ρυθμίσεων Callout Studio",
	"contextMenu.setFoldClosed": "Ορισμός callout ως κλειστού (-)",
	"contextMenu.setFoldOpen": "Ορισμός callout ως ανοιχτού (+)",
	"contextMenu.setFoldNone": "Ορισμός callout ως μη αναδιπλούμενου",
	"contextMenu.cutSection": "Αποκοπή ενότητας επικεφαλίδας",
	"contextMenu.copySection": "Αντιγραφή ενότητας επικεφαλίδας",
	"contextMenu.deleteSection": "Διαγραφή ενότητας επικεφαλίδας",
	"heading.toggleFold": "Εναλλαγή αναδίπλωσης",
	"settings.globalSettings": "Καθολικές ρυθμίσεις",
	"settings.globalSettingsRegularDesc":
		"Προσθέστε ένα token callout σε μια παράθεση (π.χ. `> [!type]`) για να εμφανιστεί το εγγενές πλαίσιο callout του Obsidian. Μπορείτε να προσαρμόσετε το περίγραμμα, την ακτίνα, την κλίμακα γραμματοσειράς και τη στοίχισή του.",
	"settings.globalSettingsHeadingDesc":
		"Προσθέστε ένα token callout αμέσως μετά τα σύμβολα δίεσης της επικεφαλίδας (π.χ. `## [!type]`) για να εμφανιστεί ως στυλιζαρισμένη επικεφαλίδα callout. Μπορείτε να προσαρμόσετε το περίγραμμα, το σχήμα και την κατακόρυφη απόσταση.",
	"settings.globalSettingsInlineDesc":
		"Προσθέστε ένα token callout οπουδήποτε μέσα σε μια γραμμή κειμένου (π.χ. `[!type]`) για να εμφανιστεί ως μικρό ενσωματωμένο χάπι. Μπορείτε να προσαρμόσετε το περίγραμμά του και το σχήμα του.",
	"settings.globalSettingsCustomize": "Προσαρμογή",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Callout επικεφαλίδας",
	"settings.calloutTypeInline": "Ενσωματωμένο callout",
	"settings.customizeMenu": "Προσαρμογή στοιχείων μενού",
	"settings.customizeMenuDesc":
		"Επιλέξτε ποιες ενέργειες δεξιού κλικ εμφανίζονται για κάθε τύπο callout και αλλάξτε τη σειρά τους. Λειτουργεί στη λειτουργία πηγής και στην Ζωντανή Προεπισκόπηση.",
	"settings.customizeMenuButton": "Προσαρμογή στοιχείων μενού",
	"menuCustomize.title": "Προσαρμογή μενού δεξιού κλικ",
	"menuCustomize.desc":
		"Ενεργοποιήστε ή απενεργοποιήστε ενέργειες και σύρετε τη λαβή για να τις αναδιατάξετε. Οι αλλαγές αποθηκεύονται αυτόματα.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Callout επικεφαλίδας",
	"menuCustomize.inline": "Ενσωματωμένο callout",
	"menuCustomize.dragHandle": "Σύρετε για αναδιάταξη",
	"menuItem.edit": "Επεξεργασία callout",
	"menuItem.openSettings": "Άνοιγμα ρυθμίσεων",
	"menuItem.copyMarkdown": "Αντιγραφή Markdown",
	"menuItem.foldDefaults":
		"Προεπιλεγμένη αναδίπλωση (ανοιχτό / κλειστό / καμία)",
	"menuItem.cutSection": "Αποκοπή ενότητας",
	"menuItem.copySection": "Αντιγραφή ενότητας",
	"menuItem.deleteSection": "Διαγραφή ενότητας",
	"confirm.ok": "Διαγραφή",
	"confirm.cancel": "Ακύρωση",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Διαγραφή εντολής",
	"confirm.titleResetAll": "Επαναφορά όλων των callouts",
	"confirm.titleResetCallout": "Επαναφορά callout",
	"confirm.titleDeletePalette": "Διαγραφή παλέτας",
	"confirm.titleDeleteImage": "Διαγραφή εικόνας",
	"vault.filesUpdated":
		"Ενημερώθηκαν {{count}} αναφορές callout σε αρχεία vault.",
	"vault.idsUpdated":
		"Ενημερώθηκαν {{count}} IDs callout σε αρχεία vault: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"Ενημερώθηκαν {{count}} τίτλος/τίτλοι callout σε αρχεία vault: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Αντικατάσταση με:",
	"vault.deleteWithout": "Διαγραφή χωρίς αντικατάσταση",
	"vault.confirmDelete": "Επιβεβαίωση",
	"vault.confirmReplace": "Αντικατάσταση",
	"vault.replacePromptInUse":
		'"{{name}}" χρησιμοποιείται {{count}} φορά/φορές σε {{files}} αρχείο/α. Επιλέξτε callout για αντικατάσταση:',
	"vault.replacePromptUnused":
		'Επιλέξτε callout για αντικατάσταση του "{{name}}":',
	"vault.noReplacementAvailable":
		"Δεν υπάρχουν διαθέσιμα callouts για αντικατάσταση.",
	"vault.convertedToPlainText":
		"{{blocks}} μπλοκ callout σε {{files}} αρχείο/α μετατράπηκαν σε απλό κείμενο.",
	"vault.resetAliasWarning":
		"{{count}} αναφορές σε {{files}} αρχείο/α χρησιμοποιούν προσαρμοσμένα ψευδώνυμα: {{aliases}}. Αυτά θα σταματήσουν να λειτουργούν μετά την επαναφορά. Συνέχεια;",
	"vault.resetConfirm": "Επαναφορά",
	"vault.resetAllInUse":
		"⚠ {{count}} αναφορές callout σε {{files}} αρχείο/α χρησιμοποιούν προσαρμοσμένους τύπους callout που θα διαγραφούν.",
	"quickInsert.title": "Γρήγορη εισαγωγή callout μπλοκ",
	"quickInsert.desc": "Επιλέξτε ένα callout για εισαγωγή στη θέση του δρομέα. Μόνο callout τύπου μπλοκ.",
	"quickInsert.searchPlaceholder": "Αναζήτηση callout",
	"quickInsert.sourceAria": "Φιλτράρισμα κατά πηγή callout",
	"quickInsert.sourceAll": "Όλα",
	"quickInsert.sourceBuiltIn": "Ενσωματωμένο",
	"quickInsert.sourceUser": "Τα callout μου",
	"quickInsert.editAria": "Επεξεργασία {{name}}",
	"quickInsert.insertAria": "Εισαγωγή {{name}} ως callout μπλοκ",
	"quickInsert.noResults": "Δεν βρέθηκαν callout",
	"quickInsert.noUserCallouts": "Δεν έχετε δημιουργήσει ακόμα κανένα callout.",
	"quickInsert.noEditorHint": "Δεν υπάρχει ανοιχτή σημείωση σε λειτουργία επεξεργασίας, οπότε δεν μπορεί να γίνει εισαγωγή.",
	"quickInsert.noEditor": "Ανοίξτε μια σημείωση σε λειτουργία επεξεργασίας για να εισαγάγετε ένα callout.",

	"vaultStats.title": "Στατιστικά callout",
	"vaultStats.totalCallouts": "Σύνολο callouts",
	"vaultStats.typesFound": "Τύποι που βρέθηκαν",
	"vaultStats.filesWithCallouts": "Αρχεία με callouts",
	"vaultStats.filesScanned": "Αρχεία Markdown που σαρώθηκαν",
	"vaultStats.empty": "Δεν βρέθηκαν callouts σε σημειώσεις Markdown.",
	"vaultStats.columnType": "Τύπος",
	"vaultStats.columnName": "Όνομα",
	"vaultStats.columnSource": "Πηγή",
	"vaultStats.columnCount": "Πλήθος",
	"vaultStats.columnFiles": "Αρχεία",
	"vaultStats.unknown": "Άγνωστο",
	"vaultStats.sourceBuiltIn": "Ενσωματωμένο",
	"vaultStats.sourceCustom": "Προσαρμοσμένο",
	"vaultStats.sourceAutoFallback": "Αυτόματο εφεδρικό",
	"vaultStats.sourceTheme": "Απόσπασμα CSS",
	"vaultStats.sourceAlias": "Ψευδώνυμο του {{id}}",
	"vaultStats.sourceUnknown": "Άγνωστο",
	"vaultStats.byRole": "Γράφτηκε ως",
	"vaultStats.roleBlock": "Μπλοκ",
	"vaultStats.roleHeading": "Επικεφαλίδα",
	"vaultStats.roleInline": "Ενσωματωμένο",
	"vaultStats.defineUndefined": "Ορισμός {{count}} που λείπουν",
	"vaultStats.defineRunning": "Σάρωση",
	"vaultStats.defineDone": "Προστέθηκαν {{count}} τύποι callout.",
	"vaultStats.close": "Κλείσιμο",
	"import.title": "Προβλήματα εισαγωγής",
	"import.reportLeadIn":
		"Φαίνεται ότι το εισαγόμενο αρχείο έχει τροποποιηθεί. Ακολουθεί η λίστα προβλημάτων:",
	"import.reportLeadInFatal":
		"Αυτό το αρχείο δεν μοιάζει με εξαγωγή Callout Studio. Δεν μπορεί να εισαχθεί:",
	"import.entryHeading": "Καταχώρηση {{index}} — {{label}}",
	"import.summary":
		"{{valid}} από {{total}} καταχωρήσεις είναι έγκυρες · βρέθηκαν {{issues}} πρόβλημα/τα.",
	"import.btnCancel": "Ακύρωση",
	"import.btnImportValid": "Εισαγωγή μόνο έγκυρων ({{count}})",
	"import.err.notRecognized":
		"Μη αναγνωρίσιμο αρχείο: αναμενόταν πίνακας ορισμών callout ή εξαγωγή από το Callout Studio.",
	"import.warn.settingsIgnored":
		"Το μπλοκ ρυθμίσεων δεν ήταν έγκυρο αντικείμενο και αγνοήθηκε.",
	"import.warn.invalidGradient":
		"Η διαβάθμιση φόντου δεν ήταν έγκυρη και αγνοήθηκε.",
	"import.err.parseFailed":
		"Το αρχείο δεν είναι έγκυρο JSON και δεν ήταν δυνατή η ανάλυσή του.",
	"import.err.entryNotObject": "Η καταχώρηση πρέπει να είναι αντικείμενο.",
	"import.err.requiredMissing":
		'Το υποχρεωτικό πεδίο "{{field}}" λείπει ή έχει λανθασμένο τύπο.',
	"import.err.idEmpty": "Το ID δεν πρέπει να είναι κενό.",
	"import.err.idTooLong":
		'Το ID "{{value}}" έχει {{length}} χαρακτήρες· το μέγιστο είναι {{max}}.',
	"import.err.idBadChar":
		'Το ID "{{value}}" περιέχει μη έγκυρους χαρακτήρες ("|", "[", "]", στηλοθέτες και αλλαγές γραμμής δεν επιτρέπονται).',
	"import.err.idMetadata":
		'Το ID "{{value}}" περιέχει "|".Στο Obsidian, όλα μετά το πρώτο "|" είναι μεταδεδομένα callout και όχι μέρος του τύπου· αυτή η καταχώρηση περιγράφει το callout "{{id}}". Παραλείφθηκε, ώστε το υπάρχον σας "{{id}}" να παραμείνει αναλλοίωτο.',
	"import.err.displayNameEmpty":
		"Το εμφανιζόμενο όνομα δεν πρέπει να είναι κενό.",
	"import.err.displayNameTooLong":
		"Το εμφανιζόμενο όνομα έχει {{length}} χαρακτήρες· το μέγιστο είναι {{max}}.",
	"import.err.boolField":
		'"{{field}}" πρέπει να είναι boolean (true ή false).',
	"import.err.iconNotObject": "Το εικονίδιο πρέπει να είναι αντικείμενο.",
	"import.err.iconTypeInvalid":
		'Ο τύπος εικονιδίου "{{value}}" δεν είναι ένα από: {{types}}.',
	"import.warn.iconFieldIgnored":
		'"{{field}}" ισχύει μόνο για εικονίδια Material και αγνοείται για τον τύπο εικονιδίου {{type}}.',
	"import.err.iconValueEmpty":
		"Η τιμή εικονιδίου πρέπει να είναι μη κενή συμβολοσειρά.",
	"import.err.iconValueTooLong":
		"Η τιμή εικονιδίου είναι ασυνήθιστα μεγάλη ({{length}} χαρακτήρες).",
	"import.err.materialStyle":
		'Το στυλ εικονιδίου Material "{{value}}" δεν είναι ένα από: outlined, filled, rounded, sharp.',
	"import.err.materialWeight":
		'Το βάρος εικονιδίου Material "{{value}}" πρέπει να είναι ακέραιος μεταξύ 100 και 700, με βήμα 100.',
	"import.warn.iconRecolorIgnored":
		'"recolor" ισχύει μόνο για δικές σας εικόνες και αγνοείται για τον τύπο εικονιδίου {{type}}.',
	"import.err.iconRecolorInvalid":
		'"recolor" πρέπει να είναι true ή false (ελήφθη "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" πρέπει να είναι χρώμα hex όπως "#448aff" (ελήφθη "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" πρέπει να είναι αριθμός μεταξύ {{min}} και {{max}} (ελήφθη "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" πρέπει να είναι αριθμός μεταξύ {{min}} και {{max}} (ελήφθη "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray":
		'"aliases" πρέπει να είναι πίνακας συμβολοσειρών.',
	"import.err.aliasNotString": "Το ψευδώνυμο πρέπει να είναι συμβολοσειρά.",
	"import.err.aliasDup":
		'Το ψευδώνυμο "{{value}}" είναι διπλότυπο σε αυτήν την καταχώρηση.',
	"import.err.tooManyIds":
		"Πάρα πολλά IDs ({{count}})· κάθε callout μπορεί να έχει το πολύ {{max}} IDs (κύριο + ψευδώνυμα).",
	"import.err.metadataShape":
		'"metadata" πρέπει να είναι αντικείμενο του οποίου όλες οι τιμές είναι συμβολοσειρές.',
	"import.warn.unknownFields": "Αγνώστα πεδία αγνοήθηκαν: {{fields}}.",
	"import.err.duplicateInFile":
		'Το ID/ψευδώνυμο "{{value}}" χρησιμοποιείται ήδη από την καταχώρηση #{{first}} σε αυτό το αρχείο.',
	"import.err.aliasConflict":
		'Το ψευδώνυμο "{{value}}" χρησιμοποιείται ήδη από άλλο callout ("{{other}}") στο vault σας.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" ήταν true ενώ "foldable" ήταν false· το defaultFolded επαναφέρθηκε στο false.',
	"import.warn.imageMissing":
		"Αυτό το Callout χρησιμοποιεί μια εικόνα που δεν βρίσκεται στο αρχείο ούτε σε αυτό το vault, γι' αυτό θα εμφανίσει ένα εικονίδιο κράτησης θέσης έως ότου δώσετε νέο.",
	"import.err.paletteIdInvalid":
		'Το "paletteId" πρέπει να είναι ένα μη κενό αναγνωριστικό κειμένου (ελήφθη "{{value}}").',
	"import.warn.iconNameUnknown":
		'Δεν υπάρχει εικονίδιο "{{value}}" στο {{type}}, οπότε χρησιμοποιήθηκε το προεπιλεγμένο εικονίδιο.',
	"import.warn.cmIconUnknownNew":
		'Το εικονίδιο "{{value}}" δεν είναι διαθέσιμο σε αυτό το vault, οπότε χρησιμοποιήθηκε το προεπιλεγμένο εικονίδιο.',
	"import.warn.cmIconUnknownExisting":
		'Το εικονίδιο "{{value}}" δεν είναι διαθέσιμο σε αυτό το vault, οπότε το "{{id}}" διατήρησε το εικονίδιο που είχε ήδη.',
	"import.chooseSource": "Εισαγωγή από",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Φόρτωση αρχείου .json εξαγόμενου από το Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Μεταφέρετε τα προσαρμοσμένα σας callout από το πρόσθετο Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Φέρτε τα προσαρμοσμένα admonition σας από το πρόσθετο " +
		"Admonition.",
	"import.cmTitle": "Εισαγωγή από Callout Manager",
	"import.cmInstructions":
		"Κάθε προσαρμοσμένο callout μεταφέρεται με το εικονίδιο και το χρώμα " +
		"του. Τα στυλ ανά θέμα και το προσαρμοσμένο CSS δεν έχουν αντίστοιχο " +
		"εδώ και δεν μεταφέρονται.",
	"import.cmFromVault": "Αυτό το vault",
	"import.cmVaultChecking": "Αναζήτηση του πρόσθετου Callout Manager…",
	"import.cmVaultFound": "Βρέθηκαν {{count}} προσαρμοσμένα callout.",
	"import.cmVaultNotFound":
		"Δεν βρέθηκαν προσαρμοσμένα callout σε αυτό το vault.",
	"import.cmPasteLabel":
		"Ή επικολλήστε εδώ τα αντιγραμμένα στυλ του Callout Manager:",
	"import.cmPlaceholder":
		"Επικολλήστε τα αντιγραμμένα στυλ, ή ένα data.json, εδώ…",
	"import.cmBtnCancel": "Ακύρωση",
	"import.cmBtnImport": "Εισαγωγή",
	"import.err.cmNoBlocksFound":
		"Δεν βρέθηκαν στυλ Callout Manager στο επικολλημένο κείμενο.",
	"import.err.cmNotRecognized":
		"Μη αναγνωρίσιμο αρχείο: αναμένονται τα στυλ που παράγει το κουμπί " +
		"Copy του Callout Manager, ή ένα data.json του Callout Manager.",
	"import.err.cmNoEntries":
		"Δεν βρέθηκαν προσαρμοσμένα callout προς εισαγωγή.",
	"import.err.cmNoColorForNew":
		'Δεν βρέθηκε χρησιμοποιήσιμο χρώμα για το νέο callout "{{value}}"· παραλείφθηκε.',
	"import.err.cmIdConflict":
		'Το ID "{{value}}" χρησιμοποιείται ήδη ως ψευδώνυμο από άλλο callout ("{{other}}") και παραλείφθηκε.',
	"import.warn.cmNoColorDefault":
		"Δεν είχε οριστεί χρώμα στο Callout Manager, οπότε χρησιμοποιήθηκε " +
		"το προεπιλεγμένο γκρι του.",
	"import.warn.cmThemeCondition":
		"Το χρώμα ή το εικονίδιο αυτού του callout είχε οριστεί μόνο για ένα " +
		"θέμα. Το Callout Studio δεν έχει στυλ ανά θέμα, οπότε μεταφέρθηκε " +
		"για όλα τα θέματα.",
	"import.warn.cmCustomStyles":
		"Αυτό το callout έχει επίσης προσαρμοσμένο CSS στο Callout Manager. " +
		"Αυτό το στυλ δεν αποτελεί μέρος της εισαγωγής, οπότε μεταφέρθηκαν " +
		"μόνο το εικονίδιο και το χρώμα του.",

	// Import — Admonition
	"import.admTitle": "Εισαγωγή από το Admonition",
	"import.admInstructions":
		"Κάθε admonition έρχεται ως callout με το όνομα, το εικονίδιο και " +
		"το χρώμα του. Ρυθμίσεις χωρίς αντίστοιχο στο Callout Studio " +
		"(εντολή, κουμπί αντιγραφής, κρυφός τίτλος) δεν μεταφέρονται.",
	"import.admFromVault": "Αυτό το θησαυροφυλάκιο",
	"import.admVaultChecking": "Αναζήτηση του πρόσθετου Admonition…",
	"import.admVaultFound": "Βρέθηκαν {{count}} προσαρμοσμένα admonition.",
	"import.admVaultNotFound":
		"Δεν βρέθηκαν προσαρμοσμένα admonition σε αυτό το θησαυροφυλάκιο.",
	"import.admFromFile": "Ένα αρχείο",
	"import.admFromFileDesc":
		"Ένα αρχείο admonitions.json ή ένα κοινόχρηστο πακέτο.",
	"import.admChooseFile": "Επιλογή αρχείου…",
	"import.admPasteLabel": "Ή επικολλήστε εδώ το JSON:",
	"import.admPlaceholder": "Επικολλήστε εδώ τα admonition σας…",
	"import.admBtnCancel": "Ακύρωση",
	"import.admBtnImport": "Εισαγωγή",
	"import.err.admNotRecognized":
		"Μη αναγνωρίσιμο αρχείο: αναμενόταν λίστα admonition ή ένα " +
		"data.json του Admonition.",
	"import.err.admNoEntries": "Δεν βρέθηκαν admonition για εισαγωγή.",
	"import.err.admTypeMissing":
		'Αυτό το admonition δεν έχει "type" και παραλείφθηκε.',
	"import.warn.admIconUnknown":
		'Δεν βρέθηκε εικονίδιο με όνομα "{{value}}" σε καμία βιβλιοθήκη, ' +
		"οπότε χρησιμοποιήθηκε το προεπιλεγμένο εικονίδιο.",
	"import.warn.admIconUnknownExisting":
		'Δεν βρέθηκε εικονίδιο με όνομα "{{value}}" σε καμία βιβλιοθήκη, ' +
		'οπότε το "{{id}}" κράτησε το εικονίδιο που είχε ήδη.',
	"import.warn.admImageFailed":
		"Δεν ήταν δυνατή η ανάγνωση της μεταφορτωμένης εικόνας, οπότε " +
		"χρησιμοποιήθηκε το προεπιλεγμένο εικονίδιο.",
	"import.warn.admIconWithCss":
		"Αυτό το admonition παίρνει την εμφάνισή του από ένα απόσπασμα " +
		"CSS στο Admonition. Η εμφάνιση αυτή δεν περιλαμβάνεται στην " +
		"εισαγωγή, οπότε ήρθαν μόνο το όνομα, το εικονίδιο και το χρώμα.",
	"import.warn.admNoColor":
		"Δεν είχε οριστεί χρώμα, οπότε χρησιμοποιήθηκε το προεπιλεγμένο " +
		"μπλε.",
	"import.warn.admTitleTruncated":
		"Ο τίτλος έχει {{length}} χαρακτήρες· συντομεύτηκε στους {{max}}.",

	"footer.tagline":
		"Έχετε σχόλια, απόψεις ή προτάσεις; Θα χαρώ να τα ακούσω!",
	"footer.madeBy": "Δημιουργήθηκε από τον Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Να διαγραφεί η παλέτα "{{name}}";\n1 callout τη χρησιμοποιεί. Κρατά τα χρώματά του και μπορείτε να το συνδέσετε ξανά αργότερα από τη γραμμή Χρώμα στον επεξεργαστή του.',
	"settings.deletePaletteConfirmLinked":
		'Να διαγραφεί η παλέτα "{{name}}";\n{{count}} callouts τη χρησιμοποιούν. Κρατούν τα χρώματά τους και μπορείτε να τα συνδέσετε ξανά αργότερα από τη γραμμή Χρώμα σε οποιονδήποτε από τους επεξεργαστές τους.',
	"settings.unlinkedColors": "Μη συνδεδεμένα χρώματα",
	"settings.unlinkedColorsDesc":
		"Callouts των οποίων το αποθηκευμένο χρώμα διαγράφηκε. Κρατούν τα χρώματα που είχαν· η επαναφορά αποθηκεύει ξανά το χρώμα και επανασυνδέει όλη την ομάδα.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callouts",
	"settings.restoreColor": "Επαναφορά",
	"settings.palettesMergedNotice":
		"Συγχωνεύτηκαν {{count}} εισαγόμενες παλέτες σε αποθηκευμένα χρώματα που είχαν ήδη τα ίδια χρώματα.",
	"notice.palettesMerged":
		"Συγχωνεύτηκαν {{count}} αποθηκευμένα χρώματα με πανομοιότυπα χρώματα: {{names}}. Τα callouts που τα χρησιμοποιούν κρατούν τα χρώματά τους και τώρα συνδέονται με το χρώμα που έμεινε.",
	"editor.colorsDescDeleted":
		"Το αποθηκευμένο χρώμα αυτού του callout διαγράφηκε. Μπορείτε να το αποθηκεύσετε ξανά {{link}}.",
	"editor.colorsDescDeletedOther":
		"Το αποθηκευμένο χρώμα αυτού του callout διαγράφηκε. Μπορείτε να το αποθηκεύσετε ξανά {{link}} — θα επανασυνδεθεί και 1 ακόμη callout που το χρησιμοποιεί.",
	"editor.colorsDescDeletedOthers":
		"Το αποθηκευμένο χρώμα αυτού του callout διαγράφηκε. Μπορείτε να το αποθηκεύσετε ξανά {{link}} — θα επανασυνδεθούν και {{count}} ακόμη callouts που το χρησιμοποιούν.",
	"editor.colorsDescDeletedLink": "κάνοντας κλικ εδώ",
	"palette.colorExists":
		'Αυτά τα χρώματα είναι ίδια με το "{{name}}". Δύο αποθηκευμένα χρώματα δεν μπορούν να είναι ίδια — αλλάξτε ένα χρώμα για να ξεχωρίζουν.',
	"palette.colorExistsUse":
		'Αυτά τα χρώματα είναι ίδια με το "{{name}}". Δύο αποθηκευμένα χρώματα δεν μπορούν να είναι ίδια — αλλάξτε ένα χρώμα ή {{link}}.',
	"palette.colorExistsUseLink": "χρησιμοποιήστε το υπάρχον",
	"locale.downloading": "Λήψη μετάφρασης…",
	"locale.notDownloaded": "Το {{name}} δεν έχει ληφθεί ακόμη",
	"locale.notDownloadedDesc":
		"Το Callout Studio εμφανίζει αγγλικά μέχρι να ληφθεί η μετάφραση. Θα ξαναπροσπαθήσει την επόμενη φορά που θα ξεκινήσει το Obsidian.",
	"locale.retry": "Επανάληψη",
	"locale.diskWriteFailed":
		"Το Callout Studio δεν μπόρεσε να αποθηκεύσει τη μετάφραση στον δίσκο, οπότε θα χρειαστεί νέα λήψη την επόμενη φορά.",
	"notice.exportedCssCreated": "Το απόσπασμα CSS αποθηκεύτηκε στο {{path}}",
	"notice.exportedCssUpdated": "Το απόσπασμα CSS ενημερώθηκε στο {{path}}",
	"notice.exportedCssUnchanged": "Το απόσπασμα CSS είναι ήδη ενημερωμένο.",
	"notice.exportCssEmpty": "Δεν υπάρχουν προσαρμοσμένα callout για εξαγωγή.",
	"notice.exportCssFailed":
		"Δεν ήταν δυνατή η αποθήκευση του αποσπάσματος CSS. Ελέγξτε την κονσόλα προγραμματιστή για λεπτομέρειες.",
	"notice.exportCssEnabled":
		"Αυτό το απόσπασμα είναι ενεργοποιημένο σε αυτό το vault. Το Callout Studio μορφοποιεί ήδη αυτά τα callout και το απόσπασμα διατηρεί τη μορφή κατά την εξαγωγή.",
	"confirm.titleOverwriteSnippet": "Αντικατάσταση αποσπάσματος CSS",
	"confirm.overwriteSnippet":
		"Το απόσπασμα CSS στον φάκελο snippets άλλαξε από τότε που το έγραψε το Callout Studio. Η νέα εξαγωγή αντικαθιστά ολόκληρο το αρχείο.",
	"confirm.overwriteSnippetOk": "Αντικατάσταση",
	"export.chooseFormat": "Εξαγωγή ως",
	"export.formatJson": "Αντίγραφο ασφαλείας Callout Studio",
	"export.formatJsonDesc":
		"Αρχείο .json με τα callout και τις ρυθμίσεις σας για εισαγωγή σε άλλο vault.",
	"export.formatCss": "Απόσπασμα CSS",
	"export.formatCssDesc":
		"Αρχείο .css στον φάκελο snippets αυτού του vault, για χρήση όπου δεν είναι εγκατεστημένο το Callout Studio. Καλύπτει μόνο τα κανονικά callout και είναι στιγμιότυπο· κάντε νέα εξαγωγή μετά από αλλαγή.",
};
