export const fr: Record<string, string> = {
	"cmd.openSettings": "Ouvrir les paramètres",
	"cmd.createCallout": "Créer un nouveau type de callout",
	"cmd.insertEmptyCallout": "Insérer un callout vide",
	"cmd.calloutWrap": "Envelopper dans un callout",
	"cmd.calloutUnwrap": "Retirer le callout",

	"cmd.customWrapBlock": "Envelopper dans un callout de bloc {{name}}",
	"cmd.customInsertBlock": "Insérer un callout de bloc {{name}}",
	"cmd.customInsertHeading": "Insérer un titre H{{level}} callout {{name}}",
	"cmd.customInsertInline": "Insérer un callout en ligne {{name}}",
	"cmd.openQuickInsert": "Insertion rapide d'un callout de bloc",

	"autocomplete.createNew": 'Créer un nouveau callout : "{{name}}"',

	"settings.fallbackTag": "Par défaut",
	"settings.fallbackTagAuto": "Par défaut automatique",
	"settings.autoDiscover": "Détecter automatiquement les callouts dans votre coffre",
	"settings.autoDiscoverDesc":
		"Repère les types de callout écrits dans vos notes et les ajoute automatiquement à la liste. Désactiver cette option laisse les callouts déjà présents inchangés — vous pouvez toujours les ajouter vous-même ou utiliser Réanalyser le coffre ci-dessous.",
	"settings.rescanVault": "Rescanner le vault",
	"settings.rescanVaultDesc":
		"Recherche les IDs de callout non reconnus dans les notes et les ajoute comme lignes de secours.",
	"settings.rescanVaultHintAction": "Scanner maintenant",
	"settings.rescanComplete":
		"Rescan terminé : {{count}} nouveau(x) callout(s) ajouté(s).",
	"replaceModal.deleteWithoutReplaceSuffix": "(revient au défaut)",
	"replaceModal.titleDelete": "Supprimer le callout",
	"replaceModal.titleReplace": "Remplacer dans le vault",

	"firstRun.title": "Trouver les callouts existants dans votre vault ?",
	"firstRun.body":
		"Callout Studio peut scanner votre vault pour découvrir les callouts que vous utilisez déjà, afin qu'ils apparaissent dans votre liste de paramètres et adoptent votre style de secours.",
	"firstRun.heavyVaultNote":
		"Votre vault contient {{count}} fichiers Markdown — le scan peut prendre quelques secondes.",
	"firstRun.laterHint":
		"Vous pouvez toujours effectuer cette opération plus tard depuis Paramètres → Informations et maintenance du vault → Rescanner le vault.",
	"firstRun.scanNow": "Scanner maintenant",
	"firstRun.noThanks": "Non merci",
	"firstRun.autoScanComplete":
		"Callout Studio a scanné votre vault et ajouté {{count}} callout(s).",
	"firstRun.scanning": "Scan en cours",
	"firstRun.autoScanFailed":
		"Callout Studio n'a pas pu scanner votre vault. Vous pouvez réessayer depuis Paramètres → Informations et maintenance du vault → Rescanner le vault.",
	"firstRun.scanFailed":
		"Le scan ne s'est pas terminé. Vous pouvez réessayer depuis Paramètres → Informations et maintenance du vault → Rescanner le vault.",

	"welcome.tooltip": "À propos de Callout Studio",
	"welcome.title": "Bienvenue dans Callout Studio !",
	"welcome.tagline":
		"Votre solution complète pour créer, styliser et gérer les callouts d'Obsidian.",
	"welcome.previewTitle": "Voir en action",
	"welcome.demoName": "Callout Studio",
	"welcome.sample":
		"Callout Studio vous permet de créer des callouts avec une icône, des couleurs et un nom personnalisés.\n\n" +
		"Vous pouvez utiliser ce callout de **trois** façons différentes :\n\n" +
		"## [!{{id}}] Callout en titre\n" +
		"Pour transformer n'importe quel titre en titre au style callout, ajoutez `[!type]` juste après les `#`.\n\n" +
		"Vous voulez un [!{{id}}]{callout en ligne} comme celui-ci ? Ajoutez simplement `[!type]{text}` au milieu d'une phrase, sans interrompre votre rédaction.\n\n" +
		"> [!{{id}}] Callout en bloc\n" +
		"> Le callout classique fonctionne exactement avec la même syntaxe que vous connaissez déjà : `> [!type]`.\n\n" +
		"Callout Studio a bien plus à offrir ! [En savoir plus]({{repoUrl}}).\n",

	"deleteModal.title": 'Supprimer le callout "{{name}}" ?',
	"deleteModal.bodyInUse":
		"Ce callout apparaît {{count}} fois dans {{files}} fichier(s).",
	"deleteModal.bodyInUseExplain":
		"La suppression convertira ces blocs en texte brut — ils perdront leur style et l'en-tête du callout.",
	"deleteModal.replaceHint":
		"Vous pouvez le remplacer par un autre callout, ce qui conserve le contenu du vault sous forme de callout stylisé.",
	"deleteModal.bodyUnused":
		"\"{{name}}\" n'est utilisé dans aucune note, mais c'est un callout personnalisé que vous avez créé. La suppression le retirera de cette liste.",
	"deleteModal.replaceInstead": "Remplacer plutôt",
	"deleteModal.deleteInUse": "Supprimer (convertir en texte brut)",
	"deleteModal.deleteUnused": "Supprimer le callout",

	// The variant for a callout whose definition Callout Studio cannot remove:
	// one of Obsidian's built-ins, or a type the active theme declares.
	"deleteModal.titleKeep": 'Supprimer tous les usages de "{{name}}" ?',
	"deleteModal.keepsRowBuiltIn":
		"Il s'agit de l'un des callouts intégrés d'Obsidian : le type lui-même reste disponible — seules ses utilisations dans vos notes changent.",
	"deleteModal.keepsRowTheme":
		"{{theme}} définit ce type de callout, qui reste donc disponible et conserve son apparence. Callout Studio ne modifie que les notes de votre vault — rien de ce qui appartient à votre thème n'est touché.",
	"deleteModal.clearUsages": "Supprimer les usages (convertir en texte brut)",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "Mes types de callout",
	"settings.builtInCallouts": "Callouts intégrés",
	"settings.contextMenu": "Menu contextuel",
	"settings.autocomplete": "Saisie automatique",
	"settings.keyboardShortcuts": "Raccourcis clavier",
	"settings.language": "Langue",
	"settings.languageDesc":
		"Langue d'affichage de Callout Studio. Suit par défaut la langue de l'interface d'Obsidian.",
	"settings.languageAuto": "Automatique (comme Obsidian)",
	"settings.importExport": "Importer / exporter",
	"settings.import": "Importer",
	"settings.export": "Exporter",
	"settings.importDesc":
		"Importez votre progression Callout Studio depuis un autre vault via un fichier JSON.",
	"settings.exportDesc":
		"Enregistrez tous vos types de callout personnalisés au format JSON.",
	"settings.importConflictNotice":
		"{{count}} type(s) de callout importé(s) ; {{overwritten}} entrée(s) existante(s) écrasée(s).",

	"settings.addNewCallout": "+ ajouter un callout",

	"settings.noCalloutsNow": "Aucun callout personnalisé pour le moment.",

	"settings.editAria": "Modifier {{name}}",
	"settings.moreRowActionsAria": "Plus d'actions pour {{name}}",
	"settings.usageInfo": "{{count}} utilisation(s) dans {{files}} fichier(s)",
	"settings.replaceAction": "Remplacer dans le vault",
	"settings.deleteAction": "Supprimer",
	"settings.resetAction": "Réinitialiser par défaut",
	"settings.makeFallbackAction": "Utiliser le style de secours par défaut",
	"settings.colorSwatchAria": "Accent : {{accent}} · Arrière-plan : {{bg}}",

	// Handing a callout to the user's own CSS. Not a statement about the theme —
	// that is derived and has no action — so the wording names the snippet.
	"settings.externalCssAction": "Styliser avec mon propre CSS",
	"settings.externalCssStopAction": "Laisser Callout Studio styliser ceci à nouveau",
	// The one label on any row: a callout sitting among the user's own that
	// Callout Studio has nonetheless stopped painting.
	"settings.externalCssTag": "CSS externe",
	// Settings — callouts the active theme styles
	"settings.themeCalloutsHeading": "Callouts de votre thème",
	"settings.themeCalloutsDesc":
		"{{theme}} fournit ou restylise ceux-ci, donc Callout Studio les laisse exactement tels que votre thème les dessine et ne les propose qu'en callouts de bloc. Les deux types apparaissent ici : les types de callout que votre thème ajoute, et les callouts intégrés dont il remplace l'apparence. Les types de callout ajoutés par votre thème ne sont listés que lorsqu'il est actif.",
	"settings.themeCalloutsDefaultTheme": "Votre thème",
	"settings.themePreviewAria":
		'Aperçu de "{{name}}" — voir comment votre thème le dessine',
	"settings.clearUsesAction": "Supprimer les usages dans vos notes",
	"settings.builtInAllThemeStyled":
		"{{theme}} restylise chaque callout intégré, ils sont donc tous listés ci-dessus et Callout Studio les laisse tels quels. Pour concevoir le vôtre, ajoutez un callout avec un ID différent.",

	"settings.fallbackCallout": "Callout de secours par défaut",
	"settings.fallbackCalloutDesc":
		"Les types de callout non reconnus dans votre vault hériteront du style de ce callout.",

	"settings.globalStyle": "Style global des callouts",
	"settings.border": "Bordures",
	"settings.borderAll": "Tous",
	"settings.borderTop": "Haut",
	"settings.borderRight": "Droit",
	"settings.borderBottom": "Bas",
	"settings.borderLeft": "Gauche",
	"settings.borderWidth": "Épaisseur de bordure",
	"settings.fontScaleGroup": "Échelle de police",
	"settings.titleScale": "Titre",
	"settings.contentScale": "Contenu",
	"settings.inlineTextScale": "Texte",
	"settings.shapeGroup": "Forme",
	"settings.borderRadius": "Arrondi des coins",
	"settings.alignGroup": "Alignement",
	"settings.alignContent": "Aligner le contenu avec le titre",
	"settings.headingSpacingGroup": "Espacement du titre",
	"settings.headingPadVertical": "Espacement vertical",
	"settings.headingGap": "Espacement entre les titres",
	"settings.headingFoldGroup": "Réduire",
	"settings.headingFoldArrow": "Afficher la flèche de réduction",
	"settings.styleDemoName": "Exemple",
	"settings.previewTitle": "Aperçu",

	// Settings — Saved color palettes
	"settings.customPalettes": "Palettes de couleurs enregistrées",
	"settings.newPalette": "Nouvelle palette",
	"settings.customPalettesEmpty":
		"Aucune palette enregistrée pour le moment.",
	"settings.editPaletteAria": "Modifier la palette {{name}}",
	"settings.deletePaletteAria": "Supprimer la palette {{name}}",
	"settings.deletePaletteConfirm":
		'Supprimer la palette "{{name}}" ?\nLes callouts qui utilisent ses couleurs ne sont pas affectés.',
	"settings.enableAutocomplete": "Activer la saisie automatique [!",
	"settings.enableAutocompleteDesc":
		'Affiche des suggestions lorsque vous tapez "[!" dans une citation de l\'éditeur. Choisissez un type de callout dans la liste pour insérer un en-tête de callout complet.',

	"settings.customCommands": "Commandes et raccourcis",
	"settings.customCommandsDesc":
		"Consultez chaque commande de Callout Studio et le raccourci auquel elle est associée, et créez vos propres commandes pour les callouts que vous utilisez le plus. Aucun raccourci n'est attribué par défaut.",
	"settings.customCommandsButton": "Gérer les commandes",

	// Générateur de commandes
	"commandBuilder.title": "Commandes et raccourcis",
	"commandBuilder.desc":
		"Utilisez le bouton + pour définir ou modifier un raccourci dans les paramètres de raccourcis d'Obsidian.",
	"commandBuilder.builtIn": "Commandes intégrées",
	"commandBuilder.toggleAria": "Activer ou désactiver {{name}}",
	"commandBuilder.hotkeyBlank": "Vide",
	"commandBuilder.hotkeyAria": "Définir un raccourci pour {{name}}",
	"commandBuilder.yourCommands": "Vos commandes",
	"commandBuilder.newCommand": "Nouvelle commande",
	"commandBuilder.empty": "Aucune commande personnalisée pour l'instant.",
	"commandBuilder.unknownCommand": "cette commande",
	"commandBuilder.editAria": "Modifier {{name}}",
	"commandBuilder.deleteAria": "Supprimer {{name}}",
	"commandBuilder.deleteConfirm":
		"Supprimer la commande {{name}} ? Tout raccourci qui lui est assigné cessera de fonctionner.",
	"commandBuilder.newTitle": "Nouvelle commande",
	"commandBuilder.editTitle": "Modifier la commande",
	"commandBuilder.format": "Format de callout",
	"commandBuilder.formatDesc": "Le type de callout écrit par la commande.",
	"commandBuilder.formatHeading": "Titre",
	"commandBuilder.formatInline": "En ligne",
	"commandBuilder.formatBlock": "Bloc",
	"commandBuilder.roleDisabled":
		"Ce format est désactivé, la commande insérera donc du texte brut jusqu'à ce que vous le réactiviez.",
	"commandBuilder.callout": "Type de callout",
	"commandBuilder.calloutDesc": "Le callout que cette commande insère.",
	"commandBuilder.headingLevel": "Niveau de titre",
	"commandBuilder.headingLevelDesc": "Quel niveau de titre écrire.",
	"commandBuilder.action": "Action",
	"commandBuilder.actionDesc":
		"Envelopper transforme la sélection en callout ; insérer en ajoute un vide.",
	"commandBuilder.actionWrap": "Envelopper la sélection",
	"commandBuilder.actionInsert": "Insérer un nouveau",
	"commandBuilder.preview": "Nom de la commande",
	"commandBuilder.duplicate":
		"Vous avez déjà une commande qui fait exactement cela.",
	"commandBuilder.noCallouts":
		"Il n'y a pas encore de type de callout à partir duquel créer une commande.",
	"commandBuilder.save": "Enregistrer",

	"commandBuilder.roleThemeOwned":
		"Votre thème fournit ce callout, il n'a donc qu'un format Bloc.",
	"commandBuilder.commandSuspended":
		"En pause : votre thème fournit ce callout, il n'a donc qu'un format Bloc. Cette commande fonctionnera à nouveau lorsque le thème cessera de le fournir.",

	"settings.vaultMaintenance": "Informations et maintenance du vault",
	"settings.vaultStats": "Statistiques des callouts",
	"settings.vaultStatsDesc":
		"Compte chaque callout dans vos notes Markdown — bloc, titre et en ligne — et les regroupe par type.",
	"settings.vaultStatsButton": "Voir les statistiques",
	"settings.vaultStatsScanning": "Scan en cours",
	"settings.resetAll": "Réinitialiser",
	"settings.resetAllDesc":
		"Supprime tous les callouts utilisateur, réinitialise les callouts intégrés, les styles globaux (bordures, échelle de police, forme), les palettes de couleurs enregistrées, la personnalisation du menu du clic droit et les SVG Material téléchargés.",
	"settings.resetAllButton": "Tout réinitialiser",
	"settings.resetAllConfirm":
		"Cela supprimera tous les callouts personnalisés, réinitialisera les callouts intégrés, les styles globaux, les palettes de couleurs enregistrées, la personnalisation du menu du clic droit et tous les SVG Material en cache. Cette action est irréversible. Êtes-vous sûr ?",
	"notice.resetAllDone": "Tout a été réinitialisé aux valeurs par défaut.",

	"notice.customCommandsRemoved":
		"{{count}} commande(s) personnalisée(s) supprimée(s) car leur type de callout n'existe plus.",
	"notice.customCommandMissingCallout":
		"Le type de callout de cette commande n'existe plus.",

	"notice.exported": "Callouts exportés vers callout-studio-export.json",
	"notice.importedJSON":
		"{{count}} type(s) de callout importé(s) depuis JSON.",
	"notice.importedSettings": "Paramètres de l'extension importés.",
	"notice.importedCalloutManager":
		"Importé depuis Callout Manager : {{created}} créés, {{updated}} mis à jour.",
	"notice.importedAdmonition":
		"Importé depuis Admonition : {{created}} créés, {{updated}} mis à " +
		"jour.",
	"notice.noNewJSON":
		"Aucun nouveau type de callout importé (les IDs peuvent déjà exister).",
	"notice.iconDownloadFailed":
		"Impossible de télécharger l'icône Material \"{{name}}\". Elle n'est peut-être pas disponible pour ce style/grammage, ou votre connexion est hors ligne.",

	"notice.externalCssOn":
		"Callout Studio ne stylise plus \"{{name}}\" — votre propre CSS décide de son apparence. Ses formats Callout de titre et Callout en ligne ne s'afficheront pas.",
	"notice.externalCssOff": 'Callout Studio stylise de nouveau "{{name}}".',
	"notice.vaultRewritePartial":
		"{{count}} note(s) n'ont pas pu être mises à jour et sont restées inchangées. Voir la console développeur pour plus de détails.",
	"notice.settingsUnreadable":
		"Callout Studio n'a pas pu lire son fichier de paramètres, donc vos types de callout sont absents de cette session. Rien n'a été écrit et le fichier sur le disque est inchangé — rechargez Obsidian pour réessayer.",
	"notice.settingsMissing":
		"Le fichier de paramètres de Callout Studio est manquant, donc vos types de callout sont absents de cette session. Rien n'a été écrit — si vous synchronisez ce coffre, laissez la synchronisation se terminer et rechargez Obsidian avant d'apporter des modifications.",
	"notice.settingsMissingAction": "Recommencer sur cet appareil",

	"notice.nothingToWrap": "Rien à envelopper.",
	"notice.cursorNotInsideCallout": "Le curseur n'est pas dans un callout.",
	"notice.autocompleteTargetMoved":
		"Rien n'a été inséré : la ligne a changé pendant que l'éditeur était ouvert.",
	"notice.openHotkeysFailed":
		"Impossible d'ouvrir les paramètres de raccourcis d'Obsidian.",
	"notice.filterHotkeysFailed":
		"Les raccourcis Obsidian ont été ouverts, mais le filtre Callout Studio n'a pas pu être appliqué.",

	"editor.editCallout": "Modifier le callout",
	"editor.newCallout": "Nouveau callout",
	"editor.displayName": "Nom d'affichage",
	"editor.displayNameDesc": "L'étiquette lisible affichée dans l'interface",
	"editor.displayNameBuiltIn":
		"Le nom d'affichage ne peut pas être modifié pour les callouts intégrés",
	"editor.displayNamePlaceholder": "Mon callout",
	"editor.calloutIds": "IDs de callout",
	"editor.calloutIdsDesc":
		"Tous les identifiants de ce callout. Les espaces sont autorisés.\nAppuyez sur Entrée ou le bouton + pour en ajouter.",
	"editor.calloutIdsPlaceholder": "Ajouter un ID",
	"editor.addId": "Ajouter un ID",
	"editor.idLinkedToName": "Lié au nom d'affichage",
	"editor.idCannotDelete":
		"Cet ID est lié au nom d'affichage et ne peut pas être supprimé — modifiez le nom pour le changer",
	"editor.icon": "Icône",
	"editor.pickIcon": "Changer d'icône",
	"editor.replaceIcon": "Remplacer l'icône",
	"editor.removeIcon": "Supprimer l'icône",
	"editor.noIcon": "Aucune icône",
	"editor.resetIcon": "Réinitialiser l'icône par défaut",
	"editor.livePreview": "Aperçu en direct",
	"editor.iconAdjustment": "Ajustement de l'icône",
	"editor.picture": "Image",
	"editor.size": "Taille",
	"editor.horizontalOffset": "Décalage horizontal",
	"editor.verticalOffset": "Décalage vertical",
	"editor.colors": "Couleurs",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "Réinitialiser les couleurs par défaut",
	"editor.paletteDeleted": "Couleur supprimée",
	"editor.paletteGroupObsidian": "Callouts Obsidian",
	"editor.paletteGroupPresets": "Préréglages de couleur",
	"editor.paletteGroupCustom": "Personnalisé",
	"editor.paletteNewColor": "Nouvelle couleur…",
	"editor.contrastWarning":
		"Contraste faible avec l'arrière-plan — peut être difficile à lire",
	"editor.foldable": "Repliable",
	"editor.foldableDesc":
		"Choisissez si le callout peut être replié et l'état par défaut à appliquer dans tout le vault.",
	"editor.foldOff": "Désactivé",
	"editor.foldOpen": "Ouvert par défaut",
	"editor.foldClosed": "Fermé par défaut",
	"editor.cancel": "Annuler",
	"editor.saveChanges": "Enregistrer les modifications",
	"editor.createCallout": "Créer le callout",
	"editor.nameRequired":
		"Un nom d'affichage est requis avant de créer un callout.",
	"editor.noChangesToSave": "Aucune modification n'a été effectuée.",
	"editor.downloadingIcon": "Téléchargement de l'icône",
	"editor.idEmpty": "Au moins un ID est requis",
	"editor.idExists": "Un callout avec cet ID existe déjà",
	"editor.idConflict": "Cet ID entre en conflit avec un callout existant",
	"editor.idDashConflict":
		"Obsidian écrit les espaces sous forme de tirets, donc cet ID entre en conflit avec « {{other}} »",

	"editor.idFromTheme":
		"{{theme}} fournit déjà un callout avec cet ID, donc Callout Studio ne peut pas le styliser. Choisissez un ID différent.",
	"editor.idThemePattern":
		"Attention : votre thème stylise tous les callouts correspondant à {{pattern}}, il pourrait donc modifier l'apparence de celui-ci.",

	"editor.untitledCallout": "Callout sans titre",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText":
		"Voici une pastille [!{id}] intégrée dans un paragraphe.",
	"editor.previewReadOnly": "L'aperçu en direct ne peut pas être modifié",

	// Theme callout preview window — opens instead of the editor for a callout
	// the active theme supplies or restyles.
	"themePreview.title": '{{name}} — fourni par votre thème',
	"themePreview.owned":
		"{{theme}} fournit et stylise \"{{name}}\". Callout Studio ne le remplacera pas, donc son callout de bloc a exactement l'apparence que lui donne votre thème.",
	"themePreview.readOnly":
		"Cela signifie que sa couleur, son icône, son nom et son ID ne peuvent pas être modifiés ici. Si vous voulez un design personnel, créez un nouveau callout avec un ID différent.",
	"themePreview.blockOnly":
		"Les formats Titre et En ligne ne sont pas disponibles pour les callouts fournis par votre thème. Les callouts de bloc utilisent le style natif du thème.",
	"themePreview.previewTitle": "Comment il s'affiche actuellement",
	"themePreview.blockSample":
		"> [!{{id}}] {{name}}\n" +
		"> Voici à quoi ressemble le contenu du callout.\n",

	"editor.externalStyleClose": "Compris",

	// Palette editor modal
	"palette.newTitle": "Nouvelle palette de couleurs",
	"palette.groupPalette": "Palette",
	"palette.editTitle": "Modifier la palette de couleurs",
	"palette.name": "Nom",
	"palette.namePlaceholder": "Ma palette",
	"palette.nameExists": "Une palette portant ce nom existe déjà",
	"palette.baseColor": "Couleur de base",
	"palette.baseColorHint":
		"Nous adapterons automatiquement la couleur d'arrière-plan à celle-ci. Si vous le souhaitez, vous pouvez la contrôler séparément en {{link}}.",
	"palette.baseColorHintLink": "cliquant ici",
	"palette.advancedColors": "Couleurs",
	"palette.advancedColorsHint":
		"Modification des couleurs pour le mode {{mode}} - l'autre mode se met à jour automatiquement. Changez le thème d'Obsidian pour vérifier.",
	"palette.revertHint": "Vous préférez une seule couleur de base ? {{link}}.",
	"palette.revertHintLink": "Rétablir",
	"palette.lightMode": "Clair",
	"palette.darkMode": "Sombre",
	"palette.accentColor": "Couleur d'accent",
	"palette.backgroundColorChannel": "Couleur d'arrière-plan",
	"palette.textColorChannel": "Couleur du texte",
	"palette.bgIntensity": "Intensité",
	"palette.bgStyle": "Style",
	"palette.bgSolid": "Uni",
	"palette.bgGradient": "Dégradé",
	"palette.bgTransparent": "Transparent",
	"palette.gradientTo": "Deuxième couleur",
	"palette.gradientDirection": "Direction",
	"palette.gradientText": "Texte du titre en dégradé",
	"palette.save": "Enregistrer",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "Rouge",
	"colorName.orange": "Orange",
	"colorName.amber": "Ambre",
	"colorName.yellow": "Jaune",
	"colorName.lime": "Citron vert",
	"colorName.green": "Vert",
	"colorName.teal": "Sarcelle",
	"colorName.cyan": "Cyan",
	"colorName.sky": "Bleu ciel",
	"colorName.blue": "Bleu",
	"colorName.indigo": "Indigo",
	"colorName.violet": "Violet",
	"colorName.purple": "Pourpre",
	"colorName.pink": "Rose",
	"colorName.rose": "Fuchsia",
	"colorName.brown": "Marron",
	"colorName.gray": "Gris",
	"colorName.black": "Noir",
	"colorName.white": "Blanc",
	"colorName.crimson": "Cramoisi",
	"colorName.coral": "Corail",
	"colorName.grape": "Raisin",
	"colorName.plum": "Prune",
	"colorName.bubblegum": "Chewing-gum",

	"iconPicker.pickIcon": "Choisir une icône",
	"iconPicker.confirm": "Confirmer",
	"iconPicker.cancel": "Annuler",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "rechercher des icônes Lucide",
	"iconPicker.searchTabler": "rechercher des icônes Tabler",
	"iconPicker.tablerStyle": "Style d'icône",
	"iconPicker.tablerStyleOutline": "Contour (Outline)",
	"iconPicker.tablerStyleFilled": "Rempli (Filled)",
	"iconPicker.loadMore": "Charger plus",
	"iconPicker.materialStyle": "Style d'icône",
	"iconPicker.materialStyleOutlined": "Contour (Outlined)",
	"iconPicker.materialStyleFilled": "Rempli (Filled)",
	"iconPicker.materialStyleRounded": "Arrondi (Rounded)",
	"iconPicker.materialStyleSharp": "Anguleux (Sharp)",
	"iconPicker.materialWeight": "Épaisseur de l'icône",
	"iconPicker.materialWeight100": "Fin (Thin)",
	"iconPicker.materialWeight200": "Extra léger (Extra Light)",
	"iconPicker.materialWeight300": "Léger (Light)",
	"iconPicker.materialWeight400": "Normal (Regular)",
	"iconPicker.materialWeight500": "Moyen (Medium)",
	"iconPicker.materialWeight600": "Semi-gras (Semi Bold)",
	"iconPicker.materialWeight700": "Gras (Bold)",
	"iconPicker.materialFontFailed":
		"Impossible de charger les aperçus des icônes Material. Les noms des icônes s'affichent à la place — la recherche et la sélection fonctionnent toujours.",
	"iconPicker.materialFontRetry": "Réessayer",
	"iconPicker.searchMaterial": "rechercher des icônes Material",
	"iconPicker.searchEmoji": "Rechercher des emojis",
	"iconPicker.skinTone": "Teinte de peau",
	"iconPicker.allCategories": "Toutes les catégories",
	"iconPicker.noIconSelected": "Aucune icône sélectionnée",
	"iconPicker.noResults": "Aucune icône ne correspond à votre recherche.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Rechercher dans Octicons",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Rechercher dans Font Awesome",
	"iconPicker.faStyle": "Style d'icône",
	"iconPicker.faStyleSolid": "Plein (Solid)",
	"iconPicker.faStyleRegular": "Régulier (Regular)",
	"iconPicker.faStyleBrands": "Marques (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "Rechercher dans RPG Awesome",
	"iconPicker.image": "Vos images",
	"iconPicker.searchImage": "Rechercher dans vos images",
	"iconPicker.imageTooLarge":
		"{{name}} est trop volumineux. Les images doivent faire moins de 5 Mo.",
	"iconPicker.imageUnsupported":
		"{{name}} n'est pas un format d'image pris en charge. Utilisez SVG, PNG, JPEG ou WebP.",
	"iconPicker.imageInvalidSvg":
		"{{name}} ne peut pas être lu comme un SVG sécurisé et n'a pas été ajouté.",
	"iconPicker.imageDecodeFailed":
		"{{name}} ne peut pas être lu comme une image.",
	"iconPicker.imageDuplicate":
		"{{name}} est déjà dans vos images. Renommez le fichier ou supprimez l'image existante.",
	"iconPicker.imageAdd": "Ajouter des images",
	"iconPicker.imageEmpty":
		"Pas encore d'images. Ajoutez un fichier SVG, PNG, JPEG ou WebP depuis votre ordinateur, ou déposez-en un ici.",
	"iconPicker.imageDelete": "Supprimer",
	"iconPicker.imageDeleteConfirm": "Supprimer « {{name}} » ?",
	"iconPicker.imageDeleteInUse":
		"{{count}} callout(s) utilisent cette image. Ils afficheront une icône de remplacement jusqu'à ce que vous en fournissiez une nouvelle.",
	"iconPicker.imageRecolor": "Suivre la couleur du Callout",
	"iconPicker.allSources": "Toutes les sources",
	"iconPicker.searchAllSources":
		"Rechercher dans toutes les sources d'icônes",
	"iconPicker.sourcesNotDownloaded":
		"Pas encore inclus : {{names}}. Choisissez une source ci-dessus pour la télécharger.",
	"iconPicker.chooseSource": "Choisir une source",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources":
		"rechercher dans toutes les bibliothèques à la fois",
	"iconPicker.descLucide": "le kit d'Obsidian, toujours hors ligne",
	"iconPicker.descTabler":
		"icônes d'interface épurées et cohérentes, contour et rempli",
	"iconPicker.descMaterial":
		"le kit de Google, quatre styles et sept épaisseurs",
	"iconPicker.descEmoji": "glyphes colorés, chaque teinte de peau",
	"iconPicker.descOcticons": "icônes d'interface de GitHub",
	"iconPicker.descFa": "plein, régulier et marques",
	"iconPicker.descRpgAwesome": "icônes de fantaisie et jeux de plateau",
	"iconPicker.descImage": "images que vous ajoutez depuis votre ordinateur",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "Accessibilité",
	"iconPicker.cat.Actions": "Actions",
	"iconPicker.cat.Activities": "Activités",
	"iconPicker.cat.Alert": "Alerte",
	"iconPicker.cat.Alphabet": "Alphabet",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "Animaux",
	"iconPicker.cat.Arrows": "Flèches",
	"iconPicker.cat.Astronomy": "Astronomie",
	"iconPicker.cat.Audio&Video": "Audio et vidéo",
	"iconPicker.cat.Automotive": "Automobile",
	"iconPicker.cat.Badges": "Badges",
	"iconPicker.cat.Brand": "Marques",
	"iconPicker.cat.Buildings": "Bâtiments",
	"iconPicker.cat.Business": "Affaires",
	"iconPicker.cat.Camping": "Camping",
	"iconPicker.cat.Charity": "Charité",
	"iconPicker.cat.Charts": "Graphiques",
	"iconPicker.cat.Charts + Diagrams": "Graphiques et diagrammes",
	"iconPicker.cat.Childhood": "Enfance",
	"iconPicker.cat.Clothing + Fashion": "Vêtements et mode",
	"iconPicker.cat.Coding": "Programmation",
	"iconPicker.cat.Communicate": "Communiquer",
	"iconPicker.cat.Communication": "Communication",
	"iconPicker.cat.Computers": "Ordinateurs",
	"iconPicker.cat.Connectivity": "Connectivité",
	"iconPicker.cat.Construction": "Construction",
	"iconPicker.cat.Currencies": "Devises",
	"iconPicker.cat.Database": "Base de données",
	"iconPicker.cat.Design": "Design",
	"iconPicker.cat.Development": "Développement",
	"iconPicker.cat.Devices": "Appareils",
	"iconPicker.cat.Devices + Hardware": "Appareils et matériel",
	"iconPicker.cat.Disaster + Crisis": "Catastrophes et crises",
	"iconPicker.cat.Document": "Document",
	"iconPicker.cat.E-commerce": "Commerce électronique",
	"iconPicker.cat.Editing": "Édition",
	"iconPicker.cat.Education": "Éducation",
	"iconPicker.cat.Electrical": "Électrique",
	"iconPicker.cat.Emoji": "Emoji",
	"iconPicker.cat.Energy": "Énergie",
	"iconPicker.cat.Extensions": "Extensions",
	"iconPicker.cat.Files": "Fichiers",
	"iconPicker.cat.Film + Video": "Films et vidéo",
	"iconPicker.cat.Food": "Nourriture",
	"iconPicker.cat.Food + Beverage": "Nourriture et boissons",
	"iconPicker.cat.Fruits + Vegetables": "Fruits et légumes",
	"iconPicker.cat.Games": "Jeux",
	"iconPicker.cat.Gaming": "Gaming",
	"iconPicker.cat.Gender": "Genre",
	"iconPicker.cat.Genders": "Genres",
	"iconPicker.cat.Gestures": "Gestes",
	"iconPicker.cat.Halloween": "Halloween",
	"iconPicker.cat.Hands": "Mains",
	"iconPicker.cat.Hardware": "Matériel",
	"iconPicker.cat.Health": "Santé",
	"iconPicker.cat.Holidays": "Jours fériés",
	"iconPicker.cat.Home": "Maison",
	"iconPicker.cat.Household": "Ménage",
	"iconPicker.cat.Humanitarian": "Humanitaire",
	"iconPicker.cat.Images": "Images",
	"iconPicker.cat.Laundry": "Lessive",
	"iconPicker.cat.Letters": "Lettres",
	"iconPicker.cat.Logic": "Logique",
	"iconPicker.cat.Logistics": "Logistique",
	"iconPicker.cat.Map": "Carte",
	"iconPicker.cat.Maps": "Cartes",
	"iconPicker.cat.Maritime": "Maritime",
	"iconPicker.cat.Marketing": "Marketing",
	"iconPicker.cat.Math": "Mathématiques",
	"iconPicker.cat.Mathematics": "Mathématiques",
	"iconPicker.cat.Media": "Médias",
	"iconPicker.cat.Media Playback": "Lecture de médias",
	"iconPicker.cat.Medical + Health": "Médecine et santé",
	"iconPicker.cat.Money": "Argent",
	"iconPicker.cat.Mood": "Humeur",
	"iconPicker.cat.Moving": "Déménagement",
	"iconPicker.cat.Music + Audio": "Musique et audio",
	"iconPicker.cat.Nature": "Nature",
	"iconPicker.cat.Numbers": "Chiffres",
	"iconPicker.cat.Photography": "Photographie",
	"iconPicker.cat.Photos + Images": "Photos et images",
	"iconPicker.cat.Political": "Politique",
	"iconPicker.cat.Privacy": "Confidentialité",
	"iconPicker.cat.Punctuation + Symbols": "Ponctuation et symboles",
	"iconPicker.cat.Religion": "Religion",
	"iconPicker.cat.Science": "Science",
	"iconPicker.cat.Science Fiction": "Science-fiction",
	"iconPicker.cat.Security": "Sécurité",
	"iconPicker.cat.Shapes": "Formes",
	"iconPicker.cat.Shopping": "Shopping",
	"iconPicker.cat.Social": "Réseaux sociaux",
	"iconPicker.cat.Spinners": "Spinners",
	"iconPicker.cat.Sport": "Sport",
	"iconPicker.cat.Sports + Fitness": "Sports et fitness",
	"iconPicker.cat.Symbols": "Symboles",
	"iconPicker.cat.System": "Système",
	"iconPicker.cat.Text": "Texte",
	"iconPicker.cat.Text Formatting": "Mise en forme du texte",
	"iconPicker.cat.Time": "Temps",
	"iconPicker.cat.Toggle": "Interrupteur",
	"iconPicker.cat.Transit": "Transit",
	"iconPicker.cat.Transportation": "Transport",
	"iconPicker.cat.Travel": "Voyage",
	"iconPicker.cat.Travel + Hotel": "Voyage et hôtel",
	"iconPicker.cat.UI actions": "Actions d'interface",
	"iconPicker.cat.Users + People": "Utilisateurs et personnes",
	"iconPicker.cat.Vehicles": "Véhicules",
	"iconPicker.cat.Version control": "Contrôle de version",
	"iconPicker.cat.Weather": "Météo",
	"iconPicker.cat.Writing": "Écriture",
	"iconPicker.cat.Zodiac": "Zodiaque",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} n'est pas encore téléchargé",
	"iconPack.downloadDetail":
		"{{count}} icônes · {{size}} · téléchargement unique",
	"iconPack.download": "Télécharger",
	"iconPack.downloading": "Téléchargement de {{name}}…",
	"iconPack.downloadFailed":
		"Impossible de télécharger {{name}}. Vérifiez votre connexion et réessayez.",
	"iconPack.retry": "Réessayer",
	"iconPack.faBrandsNotice":
		"Les icônes de marques sont des marques déposées de leurs propriétaires respectifs. Leur inclusion n'indique pas une approbation. Veuillez les utiliser uniquement pour représenter l'entreprise, le produit ou le service auquel elles font référence.",
	"iconPack.artworkRestored":
		"Les graphismes d'icônes pour {{names}} ont été téléchargés.",
	"iconPack.diskWriteFailed":
		"Callout Studio n'a pas pu enregistrer le pack d'icônes sur le disque, il devra donc être retéléchargé la prochaine fois. Les icônes que vous choisissez sont toujours enregistrées dans vos paramètres.",

	// Icon licences & credits
	"credits.title": "Licences d'icônes et crédits",
	"credits.intro":
		"Callout Studio s'appuie sur plusieurs bibliothèques d'icônes ouvertes. Leurs licences sont reproduites ci-dessous, ainsi que ce qui a été modifié pour les utiliser ici.",
	"credits.fullNotices": "Mentions tierces complètes",
	"credits.pluginLicense":
		"Le code propre de Callout Studio est sous licence permissive ; les bibliothèques d’icônes conservent leurs propres licences.",

	"contextMenu.editCallout": "Modifier les paramètres du callout",
	"contextMenu.copyMarkdown": "Copier le Markdown du callout",
	"contextMenu.openSettings": "Ouvrir les paramètres de Callout Studio",
	"contextMenu.setFoldClosed": "Définir le callout comme fermé (-)",
	"contextMenu.setFoldOpen": "Définir le callout comme ouvert (+)",
	"contextMenu.setFoldNone": "Rendre le callout non repliable",
	"contextMenu.cutSection": "Couper la section de titre",
	"contextMenu.copySection": "Copier la section de titre",
	"contextMenu.deleteSection": "Supprimer la section de titre",
	"heading.toggleFold": "Basculer le repli",
	"settings.globalSettings": "Options de style globales de Callout Studio",
	"settings.globalSettingsScope":
		"Ce sont des réglages globaux : chacun modifie d'un coup la forme, l'espacement et la taille de chaque callout que Callout Studio stylise. Les callouts stylisés par votre thème conservent le design propre du thème.",
	"settings.globalSettingsRegularDesc":
		"Ajustez la bordure, le rayon, l'échelle de police et l'alignement de chaque callout de bloc de votre coffre.",
	"settings.globalSettingsHeadingDesc":
		"Ajustez la bordure, la forme et l'espacement vertical de chaque callout de titre de votre coffre.",
	"settings.globalSettingsInlineDesc":
		"Ajustez la bordure et la forme de chaque callout en ligne de votre coffre.",
	"settings.globalSettingsCustomize": "Personnaliser",
	"settings.calloutTypeRegular": "Block callout",
	"settings.calloutTypeHeading": "Callout de titre",
	"settings.calloutTypeInline": "Callout en ligne",
	"settings.customizeMenu": "Personnaliser les éléments du menu",
	"settings.customizeMenuDesc":
		"Choisissez quelles actions du clic droit apparaissent pour chaque type de callout et réorganisez-les. Fonctionne en mode source et aperçu en direct.",
	"settings.customizeMenuButton": "Personnaliser les éléments du menu",
	"menuCustomize.title": "Personnaliser le menu du clic droit",
	"menuCustomize.desc":
		"Activez ou désactivez les actions et faites glisser la poignée pour les réorganiser. Les modifications sont enregistrées automatiquement.",
	"menuCustomize.regular": "Block callout",
	"menuCustomize.heading": "Callout de titre",
	"menuCustomize.inline": "Callout en ligne",
	"menuCustomize.dragHandle": "Faire glisser pour réorganiser",
	"menuItem.edit": "Modifier le callout",
	"menuItem.openSettings": "Ouvrir les paramètres",
	"menuItem.copyMarkdown": "Copier le Markdown",
	"menuItem.foldDefaults": "Repli par défaut (ouvert / fermé / aucun)",
	"menuItem.cutSection": "Couper la section",
	"menuItem.copySection": "Copier la section",
	"menuItem.deleteSection": "Supprimer la section",

	"confirm.ok": "Supprimer",
	"confirm.cancel": "Annuler",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "Supprimer la commande",
	"confirm.titleResetAll": "Réinitialiser tous les callouts",
	"confirm.titleResetCallout": "Réinitialiser le callout",
	"confirm.titleDeletePalette": "Supprimer la palette",
	"confirm.titleDeleteImage": "Supprimer l'image",

	"vault.filesUpdated":
		"{{count}} référence(s) de callout mises à jour dans les fichiers du vault.",
	"vault.idsUpdated":
		"{{count}} ID(s) de callout mis à jour dans les fichiers du vault : {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"{{count}} titre(s) de callout mis à jour dans les fichiers du vault : {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "Remplacer par :",
	"vault.deleteWithout": "Supprimer sans remplacer",
	"vault.confirmDelete": "Confirmer",
	"vault.confirmReplace": "Remplacer",
	"vault.replacePromptInUse":
		'"{{name}}" est utilisé {{count}} fois dans {{files}} fichier(s). Choisissez un callout pour le remplacer :',
	"vault.replacePromptUnused":
		'Choisissez un callout pour remplacer "{{name}}" :',
	"vault.noReplacementAvailable":
		"Aucun autre callout disponible pour remplacer celui-ci.",
	"vault.convertedToPlainText":
		"{{blocks}} bloc(s) de callout dans {{files}} fichier(s) convertis en texte brut.",
	"vault.resetAliasWarning":
		"{{count}} référence(s) dans {{files}} fichier(s) utilisent des alias personnalisés : {{aliases}}. Ceux-ci ne fonctionneront plus après la réinitialisation. Continuer ?",
	"vault.resetConfirm": "Réinitialiser",
	"vault.resetAllInUse":
		"⚠ {{count}} référence(s) de callout dans {{files}} fichier(s) utilisent des types de callout personnalisés qui seront supprimés.",

	"quickInsert.title": "Insertion rapide d'un callout de bloc",
	"quickInsert.desc": "Choisissez un callout à insérer à l'emplacement du curseur. Callouts de bloc uniquement.",
	"quickInsert.searchPlaceholder": "Rechercher des callouts",
	"quickInsert.sourceAria": "Filtrer par source de callout",
	"quickInsert.sourceAll": "Tous",
	"quickInsert.sourceBuiltIn": "Intégré",
	"quickInsert.sourceUser": "Mes callouts",
	"quickInsert.editAria": "Modifier {{name}}",
	"quickInsert.insertAria": "Insérer {{name}} comme callout de bloc",
	"quickInsert.noResults": "Aucun callout trouvé",
	"quickInsert.noUserCallouts": "Vous n'avez encore créé aucun callout.",
	"quickInsert.noEditorHint": "Aucune note n'est ouverte en mode édition, donc rien ne peut être inséré.",
	"quickInsert.noEditor": "Ouvrez une note en mode édition pour insérer un callout.",

	"vaultStats.title": "Statistiques des callouts",
	"vaultStats.totalCallouts": "Total des callouts",
	"vaultStats.typesFound": "Types trouvés",
	"vaultStats.filesWithCallouts": "Fichiers avec callouts",
	"vaultStats.filesScanned": "Fichiers Markdown scannés",
	"vaultStats.empty": "Aucun callout trouvé dans les notes Markdown.",
	"vaultStats.columnType": "Type",
	"vaultStats.columnName": "Nom",
	"vaultStats.columnSource": "Source",
	"vaultStats.columnCount": "Nombre",
	"vaultStats.columnFiles": "Fichiers",
	"vaultStats.unknown": "Inconnu",
	"vaultStats.sourceBuiltIn": "Intégré",
	"vaultStats.sourceCustom": "Personnalisé",
	"vaultStats.sourceAutoFallback": "Secours automatique",
	"vaultStats.sourceTheme": "Snippet CSS",
	"vaultStats.sourceAlias": "Alias de {{id}}",
	"vaultStats.sourceUnknown": "Inconnu",
	"vaultStats.byRole": "Écrit comme",
	"vaultStats.roleBlock": "Bloc",
	"vaultStats.roleHeading": "Titre",
	"vaultStats.roleInline": "En ligne",
	"vaultStats.defineUndefined": "Définir {{count}} manquants",
	"vaultStats.defineRunning": "Analyse en cours",
	"vaultStats.defineDone": "{{count}} types de callout ajoutés.",
	"vaultStats.close": "Fermer",

	"import.title": "Problèmes d'importation",
	"import.reportLeadIn":
		"Il semble que le fichier que vous avez importé ait été modifié. Voici la liste des problèmes :",
	"import.reportLeadInFatal":
		"Ce fichier ne ressemble pas à un export Callout Studio. Il ne peut pas être importé :",
	"import.entryHeading": "Entrée {{index}} — {{label}}",
	"import.summary":
		"{{valid}} sur {{total}} entrées sont valides · {{issues}} problème(s) trouvé(s).",
	"import.btnCancel": "Annuler",
	"import.btnImportValid": "Importer seulement les valides ({{count}})",
	"import.err.notRecognized":
		"Fichier non reconnu : un tableau de définitions de callout ou une exportation de Callout Studio était attendu.",
	"import.warn.settingsIgnored":
		"Le bloc de paramètres n'était pas un objet valide et a été ignoré.",
	"import.warn.invalidGradient":
		"Le dégradé d'arrière-plan n'était pas valide et a été ignoré.",
	"import.err.parseFailed":
		"Le fichier n'est pas du JSON valide et n'a pas pu être analysé.",
	"import.err.entryNotObject": "L'entrée doit être un objet.",
	"import.err.requiredMissing":
		'Le champ requis "{{field}}" est manquant ou a un type incorrect.',
	"import.err.idEmpty": "L'ID ne doit pas être vide.",
	"import.err.idTooLong":
		'L\'ID "{{value}}" fait {{length}} caractères ; le maximum est {{max}}.',
	"import.err.idBadChar":
		'L\'ID "{{value}}" contient des caractères invalides ("|", "[", "]", les tabulations et les sauts de ligne ne sont pas autorisés).',
	"import.err.idMetadata":
		'L\'ID "{{value}}" contient un "|". Dans Obsidian, tout ce qui suit le premier "|" est une métadonnée du callout, pas une partie du type ; cet entrée décrit donc le callout "{{id}}". Ignoré, afin que votre "{{id}}" existant reste inchangé.',
	"import.err.idReserved":
		'L\'ID "{{value}}" est réservé par Callout Studio pour ses propres aperçus et ne peut pas être importé.',
	"import.err.displayNameEmpty": "Le nom d'affichage ne doit pas être vide.",
	"import.err.displayNameTooLong":
		"Le nom d'affichage fait {{length}} caractères ; le maximum est {{max}}.",
	"import.err.boolField": '"{{field}}" doit être un booléen (true ou false).',
	"import.err.iconNotObject": "L'icône doit être un objet.",
	"import.err.iconTypeInvalid":
		"Le type d'ic\u00f4ne \"{{value}}\" n'est pas l'un de\u00a0: {{types}}.",
	"import.warn.iconFieldIgnored":
		"\"{{field}}\" s'applique uniquement aux icônes Material et est ignoré pour le type d'icône {{type}}.",
	"import.err.iconValueEmpty":
		"La valeur de l'icône doit être une chaîne non vide.",
	"import.err.iconValueTooLong":
		"La valeur de l'icône est inhabituellement longue ({{length}} caractères).",
	"import.err.materialStyle":
		"Le style d'icône Material \"{{value}}\" n'est pas l'un de : outlined, filled, rounded, sharp.",
	"import.err.materialWeight":
		'Le poids de l\'icône Material "{{value}}" doit être un entier entre 100 et 700, par pas de 100.',
	"import.warn.iconRecolorIgnored":
		"\"recolor\" s'applique uniquement à vos propres images et est ignoré pour le type d'icône {{type}}.",
	"import.err.iconRecolorInvalid":
		'"recolor" doit être true ou false (reçu : "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}" doit être une couleur hexadécimale comme "#448aff" (reçu "{{value}}").',
	"import.err.numberRange":
		'"{{field}}" doit être un nombre entre {{min}} et {{max}} (reçu "{{value}}").',
	"import.err.iconSizeRange":
		'"{{field}}" doit être un nombre entre {{min}} et {{max}} (reçu "{{value}}").',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases" doit être un tableau de chaînes.',
	"import.err.aliasNotString": "L'alias doit être une chaîne.",
	"import.err.aliasDup":
		'L\'alias "{{value}}" est dupliqué dans cette entrée.',
	"import.err.tooManyIds":
		"Trop d'IDs ({{count}}) ; chaque callout peut avoir au maximum {{max}} IDs (principal + alias).",
	"import.err.metadataShape":
		'"metadata" doit être un objet dont toutes les valeurs sont des chaînes.',
	"import.warn.unknownFields": "Champ(s) inconnu(s) ignoré(s) : {{fields}}.",
	"import.err.duplicateInFile":
		"L'ID/alias \"{{value}}\" est déjà utilisé par l'entrée #{{first}} dans ce fichier.",
	"import.err.aliasConflict":
		'L\'alias "{{value}}" est déjà utilisé par un autre callout ("{{other}}") dans votre vault.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded" était true alors que "foldable" était false ; defaultFolded a été réinitialisé à false.',
	"import.warn.imageMissing":
		"Ce Callout utilise une image qui n'est pas dans le fichier ni dans ce vault, il affichera donc une icône de remplacement jusqu'à ce que vous lui en donniez une nouvelle.",

	"import.err.paletteIdInvalid":
		'"paletteId" doit être un identifiant texte non vide (reçu "{{value}}").',
	"import.warn.iconNameUnknown":
		"Il n'y a aucune icône \"{{value}}\" dans {{type}}, donc l'icône par défaut a été utilisée.",
	"import.warn.cmIconUnknownNew":
		"L'icône \"{{value}}\" n'est pas disponible dans ce vault, donc l'icône par défaut a été utilisée.",
	"import.warn.cmIconUnknownExisting":
		"L'icône \"{{value}}\" n'est pas disponible dans ce vault, donc \"{{id}}\" a conservé l'icône qu'il avait déjà.",
	"import.chooseSource": "Importer depuis",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Charger un fichier .json exporté depuis Callout Studio.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Récupérez vos callouts personnalisés depuis le plugin Callout Manager.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Récupérez vos admonitions personnalisées depuis le plugin " +
		"Admonition.",
	"import.cmTitle": "Importer depuis Callout Manager",
	"import.cmInstructions":
		"Chaque callout personnalisé est récupéré avec son icône et sa couleur. Le style " +
		"par thème et le CSS personnalisé n'ont pas d'équivalent ici et ne sont pas repris.",
	"import.cmFromVault": "Ce vault",
	"import.cmVaultChecking": "Recherche du plugin Callout Manager…",
	"import.cmVaultFound": "{{count}} callout(s) personnalisé(s) trouvé(s).",
	"import.cmVaultNotFound":
		"Aucun callout personnalisé n'a été trouvé dans ce vault.",
	"import.cmPasteLabel":
		"Ou collez ici les styles copiés depuis Callout Manager :",
	"import.cmPlaceholder": "Collez ici les styles copiés, ou un data.json…",
	"import.cmBtnCancel": "Annuler",
	"import.cmBtnImport": "Importer",
	"import.err.cmNoBlocksFound":
		"Aucun style Callout Manager n'a été trouvé dans le texte collé.",
	"import.err.cmNotRecognized":
		"Fichier non reconnu : styles produits par le bouton Copy de Callout Manager, " +
		"ou fichier data.json de Callout Manager attendus.",
	"import.err.cmNoEntries":
		"Aucun callout personnalisé n'a été trouvé à importer.",
	"import.err.cmNoColorForNew":
		'Aucune couleur utilisable n\'a été trouvée pour le nouveau callout "{{value}}" ; il a été ignoré.',
	"import.err.cmIdConflict":
		'L\'ID "{{value}}" est déjà utilisé comme alias par un autre callout ("{{other}}") et a été ignoré.',
	"import.warn.cmNoColorDefault":
		"Aucune couleur n'était définie dans Callout Manager, donc son gris par défaut a été utilisé.",
	"import.warn.cmThemeCondition":
		"La couleur ou l'icône de ce callout n'était définie que pour un seul thème. Callout " +
		"Studio n'a pas de style par thème, il a donc été récupéré pour tous les thèmes.",
	"import.warn.cmCustomStyles":
		"Ce callout possède aussi du CSS personnalisé dans Callout Manager. Ce style ne fait " +
		"pas partie de l'import, seuls son icône et sa couleur ont été récupérés.",

	// Import — Admonition
	"import.admTitle": "Importer depuis Admonition",
	"import.admInstructions":
		"Chaque admonition devient un callout avec son nom, son icône et " +
		"sa couleur. Les réglages sans équivalent dans Callout Studio " +
		"(commande, bouton de copie, titre masqué) sont laissés de côté.",
	"import.admFromVault": "Ce coffre",
	"import.admVaultChecking": "Recherche du plugin Admonition…",
	"import.admVaultFound":
		"{{count}} admonition(s) personnalisée(s) trouvée(s).",
	"import.admVaultNotFound":
		"Aucune admonition personnalisée trouvée dans ce coffre.",
	"import.admFromFile": "Un fichier",
	"import.admFromFileDesc":
		"Un fichier admonitions.json, ou un pack partagé.",
	"import.admChooseFile": "Choisir un fichier…",
	"import.admPasteLabel": "Ou collez le JSON ici :",
	"import.admPlaceholder": "Collez vos admonitions ici…",
	"import.admBtnCancel": "Annuler",
	"import.admBtnImport": "Importer",
	"import.err.admNotRecognized":
		"Fichier non reconnu : une liste d'admonitions ou un data.json " +
		"d'Admonition était attendu.",
	"import.err.admNoEntries": "Aucune admonition à importer n'a été trouvée.",
	"import.err.admTypeMissing":
		'Cette admonition n\'a pas de "type" et a été ignorée.',
	"import.warn.admIconUnknown":
		'Aucune icône nommée "{{value}}" n\'a été trouvée dans les ' +
		"bibliothèques d'icônes ; l'icône par défaut a été utilisée.",
	"import.warn.admIconUnknownExisting":
		'Aucune icône nommée "{{value}}" n\'a été trouvée dans les ' +
		'bibliothèques d\'icônes ; "{{id}}" a conservé son icône actuelle.',
	"import.warn.admImageFailed":
		"L'image téléversée n'a pas pu être lue ; l'icône par défaut a " +
		"été utilisée.",
	"import.warn.admIconWithCss":
		"Cette admonition est stylisée par un extrait CSS dans " +
		"Admonition. Ce style ne fait pas partie de l'import : seuls son " +
		"nom, son icône et sa couleur ont été repris.",
	"import.warn.admNoColor":
		"Aucune couleur n'était définie ; le bleu par défaut a été " +
		"utilisé.",
	"import.warn.admTitleTruncated":
		"Le titre fait {{length}} caractères ; il a été raccourci à " +
		"{{max}}.",

	"footer.tagline":
		"Des retours, commentaires ou suggestions ? J'adorerais vous entendre !",
	"footer.madeBy": "Créé par Niv  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'Supprimer la palette "{{name}}" ?\n1 callout l’utilise. Il conserve ses couleurs, et vous pourrez la reconnecter plus tard depuis la ligne Couleur dans son éditeur.',
	"settings.deletePaletteConfirmLinked":
		'Supprimer la palette "{{name}}" ?\n{{count}} callouts l’utilisent. Ils conservent leurs couleurs, et vous pourrez les reconnecter plus tard depuis la ligne Couleur dans n’importe lequel de leurs éditeurs.',
	"settings.unlinkedColors": "Couleurs dissociées",
	"settings.unlinkedColorsDesc":
		"Callouts dont la couleur enregistrée a été supprimée. Ils conservent leurs couleurs actuelles ; restaurer enregistre à nouveau la couleur et reconnecte tout le groupe.",
	"settings.unlinkedColorOne": "1 callout",
	"settings.unlinkedColorCount": "{{count}} callouts",
	"settings.restoreColor": "Restaurer",
	"settings.palettesMergedNotice":
		"{{count}} palette(s) importée(s) ont été fusionnées avec des couleurs enregistrées qui avaient déjà les mêmes couleurs.",
	"notice.palettesMerged":
		"{{count}} couleur(s) enregistrée(s) avec des couleurs identiques ont été fusionnées : {{names}}. Les callouts qui les utilisent conservent leurs couleurs et sont maintenant liés à la couleur restante.",
	"editor.colorsDescDeleted":
		"La couleur enregistrée de ce callout a été supprimée. Vous pouvez l’enregistrer à nouveau en {{link}}.",
	"editor.colorsDescDeletedOther":
		"La couleur enregistrée de ce callout a été supprimée. Vous pouvez l’enregistrer à nouveau en {{link}} — 1 autre callout qui l’utilise sera aussi reconnecté.",
	"editor.colorsDescDeletedOthers":
		"La couleur enregistrée de ce callout a été supprimée. Vous pouvez l’enregistrer à nouveau en {{link}} — {{count}} autres callouts qui l’utilisent seront aussi reconnectés.",
	"editor.colorsDescDeletedLink": "cliquant ici",
	"palette.colorExists":
		'Ces couleurs sont identiques à "{{name}}". Deux couleurs enregistrées ne peuvent pas être identiques — modifiez une couleur pour les différencier.',
	"palette.colorExistsUse":
		'Ces couleurs sont identiques à "{{name}}". Deux couleurs enregistrées ne peuvent pas être identiques — modifiez une couleur, ou {{link}}.',
	"palette.colorExistsUseLink": "utiliser celle existante",
	"locale.downloading": "Téléchargement de la traduction…",
	"locale.notDownloaded": "{{name}} n’est pas encore téléchargé",
	"locale.notDownloadedDesc":
		"Callout Studio affiche l’anglais jusqu’au téléchargement de la traduction. Il réessaiera au prochain démarrage d’Obsidian.",
	"locale.retry": "Réessayer",
	"locale.diskWriteFailed":
		"Callout Studio n’a pas pu enregistrer la traduction sur le disque. Elle devra être téléchargée à nouveau la prochaine fois.",
	"notice.exportedCssCreated": "Extrait CSS enregistré dans {{path}}",
	"notice.exportedCssUpdated": "Extrait CSS mis à jour dans {{path}}",
	"notice.exportedCssUnchanged": "L’extrait CSS est déjà à jour.",
	"notice.exportCssEmpty": "Aucun callout personnalisé à exporter.",
	"notice.exportCssFailed":
		"Impossible d’enregistrer l’extrait CSS. Consultez la console de développement pour plus de détails.",
	"notice.exportCssEnabled":
		"Cet extrait est activé dans ce vault. Callout Studio applique déjà un style à ces callouts et l’extrait conserve le style présent lors de l’exportation.",
	"confirm.titleOverwriteSnippet": "Écraser l’extrait CSS",
	"confirm.overwriteSnippet":
		"L’extrait CSS de votre dossier snippets a changé depuis que Callout Studio l’a écrit. Une nouvelle exportation remplacera tout le fichier.",
	"confirm.overwriteSnippetOk": "Écraser",
	"export.chooseFormat": "Exporter comme",
	"export.formatJson": "Sauvegarde Callout Studio",
	"export.formatJsonDesc":
		"Un fichier .json contenant vos callouts et paramètres, à importer dans un autre vault.",
	"export.formatCss": "Extrait CSS",
	"export.formatCssDesc":
		"Un fichier .css enregistré dans le dossier snippets de ce vault, à utiliser là où Callout Studio n’est pas installé. Il couvre uniquement les callouts classiques et constitue un instantané : exportez-le à nouveau après toute modification.",
	"quickInsert.readingViewHint": "Cette note est ouverte en mode lecture, donc rien ne peut être inséré.",
	"quickInsert.readingView": "Passez en mode source ou en aperçu en direct pour insérer un callout.",
	"quickInsert.noCursorHint": "Il n'y a pas de curseur dans cette note, donc il n'y a nulle part où insérer.",
	"quickInsert.noCursor": "Placez le curseur dans la note à l'endroit où vous souhaitez insérer le callout, puis réessayez.",
};
