export const ja: Record<string, string> = {
	"cmd.openSettings": "設定を開く",
	"cmd.createCallout": "新しいcalloutタイプを作成",
	"cmd.insertEmptyCallout": "空のcalloutを挿入",
	"cmd.calloutWrap": "calloutで囲む",
	"cmd.calloutUnwrap": "calloutを解除",

	"cmd.customWrapBlock": "{{name}}ブロックcalloutで囲む",
	"cmd.customInsertBlock": "{{name}}ブロックcalloutを挿入",
	"cmd.customInsertHeading": "H{{level}} {{name}}見出しcalloutを挿入",
	"cmd.customInsertInline": "{{name}}インラインcalloutを挿入",
	"cmd.openQuickInsert": "ブロックcalloutをクイック挿入",

	"autocomplete.createNew": '新しいcalloutを作成: "{{name}}"',

	"settings.fallbackTag": "デフォルト",
	"settings.fallbackTagAuto": "自動デフォルト",
	"settings.rescanVault": "vaultを再スキャン",
	"settings.rescanVaultDesc":
		"ノート内の未認識のcallout IDを検索し、フォールバック行として追加します。",
	"settings.rescanVaultHintAction": "今すぐスキャン",
	"settings.rescanComplete":
		"再スキャン完了: {{count}}件の新しいcalloutを追加しました。",
	"replaceModal.deleteWithoutReplaceSuffix": "（デフォルトにフォールバック）",
	"replaceModal.titleDelete": "calloutを削除",
	"replaceModal.titleReplace": "vaultで置き換え",

	"firstRun.title": "vault内の既存のcalloutを検索しますか？",
	"firstRun.body":
		"Callout Studioはvaultをスキャンして、すでに使用しているcalloutを検出できます。設定リストに表示され、フォールバックスタイルを適用します。",
	"firstRun.heavyVaultNote":
		"vaultに{{count}}個のMarkdownファイルがあります。スキャンに数秒かかる場合があります。",
	"firstRun.laterHint":
		"後から設定 → vaultの洞察とメンテナンス → vaultを再スキャン から実行できます。",
	"firstRun.scanNow": "今すぐスキャン",
	"firstRun.noThanks": "いいえ、結構です",
	"firstRun.autoScanComplete":
		"Callout Studioがvaultをスキャンし、{{count}}件のcalloutを追加しました。",
	"firstRun.scanning": "スキャン中",

	"welcome.tooltip": "Callout Studioについて",
	"welcome.title": "Callout Studioへようこそ",
	"welcome.tagline": "Obsidianのcalloutを管理するための総合ソリューション。",
	"welcome.previewTitle": "実際の動作を見る",
	"welcome.sample":
		"Callout Studioを使えば、アイコン・色・名前をカスタマイズしたcalloutを作成できます。\n\n" +
		"同じcalloutは**3つ**の異なる方法で使用できます。\n\n" +
		"## [!tip] 見出しとして\n" +
		"見出しをcallout風にするには、`#`の直後に`[!type]`を追加します。\n\n" +
		"この[!warning]のようなインラインcalloutにしたい場合は、文章の途中に`[!type]`を追加するだけです。流れを止める必要はありません。\n\n" +
		"> [!note] Block Callout\n" +
		"> もちろん、従来のcalloutもこれまでと同じ構文でそのまま使えます：`> [!type]`。\n\n" +
		"Callout Studioにはまだまだ多くの機能があります！[詳しく見る]({{repoUrl}})。\n",

	"deleteModal.title": 'callout "{{name}}" を削除しますか？',
	"deleteModal.bodyInUse":
		"このcalloutは{{files}}個のファイルに{{count}}回出現しています。",
	"deleteModal.bodyInUseExplain":
		"削除すると、これらのブロックはプレーンテキストに変換されます。スタイルとcalloutヘッダーが失われます。",
	"deleteModal.replaceHint":
		"別のcalloutに置き換えることで、vault内のコンテンツをスタイル付きcalloutとして保持できます。",
	"deleteModal.bodyUnused":
		'"{{name}}"はどのノートでも使用されていませんが、カスタムcalloutです。削除するとこのリストから削除されます。',
	"deleteModal.replaceInstead": "代わりに置き換える",
	"deleteModal.deleteInUse": "削除（プレーンテキストに変換）",
	"deleteModal.deleteUnused": "calloutを削除",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "マイcalloutタイプ",
	"settings.builtInCallouts": "組み込みcallout",
	"settings.contextMenu": "コンテキストメニュー",
	"settings.autocomplete": "オートコンプリート",
	"settings.keyboardShortcuts": "キーボードショートカット",
	"settings.language": "言語",
	"settings.languageDesc":
		"Callout Studio の表示言語。デフォルトでは Obsidian のインターフェース言語に従います。",
	"settings.languageAuto": "自動（Obsidian に合わせる）",
	"settings.importExport": "インポート / エクスポート",
	"settings.import": "インポート",
	"settings.export": "エクスポート",
	"settings.importDesc":
		"JSONファイルを使って別のvaultからCallout Studioのデータをインポートします。",
	"settings.exportDesc":
		"すべてのカスタムcalloutタイプをJSON形式で保存します。",
	"settings.importConflictNotice":
		"{{count}}件のcalloutタイプをインポートしました。{{overwritten}}件の既存エントリが上書きされました。",

	"settings.addNewCallout": "+ calloutを追加",

	"settings.noCalloutsNow": "現在カスタムcalloutはありません。",

	"settings.editAria": "{{name}}を編集",
	"settings.moreRowActionsAria": "{{name}}のその他の操作",
	"settings.usageInfo": "{{files}}個のファイルで{{count}}回使用",
	"settings.replaceAction": "vaultで置き換え",
	"settings.deleteAction": "削除",
	"settings.resetAction": "デフォルトにリセット",
	"settings.makeFallbackAction": "デフォルトフォールバックスタイルを使用",

	"settings.colorSwatchAria": "アクセント: {{accent}} · 背景: {{bg}}",
	"settings.externalStyleTag": "外部スタイル",
	"settings.externalStyleAction": "外部スタイルを使用（テーマまたはCSS）",
	"settings.externalStyleBlocked":
		"これはデフォルトのフォールバックcalloutです。先に別のものを選択してください",
	"settings.fallbackCallout": "デフォルトフォールバックcallout",
	"settings.fallbackCalloutDesc":
		"vaultで認識されないcalloutタイプはこのcalloutのスタイルを継承します。",

	"settings.globalStyle": "グローバルcalloutスタイル",
	"settings.border": "ボーダー",
	"settings.borderAll": "すべて",
	"settings.borderTop": "上",
	"settings.borderRight": "右",
	"settings.borderBottom": "下",
	"settings.borderLeft": "左",
	"settings.borderWidth": "ボーダーの太さ",
	"settings.fontScaleGroup": "フォントスケール",
	"settings.titleScale": "タイトル",
	"settings.contentScale": "コンテンツ",
	"settings.inlineTextScale": "テキスト",
	"settings.shapeGroup": "形状",
	"settings.borderRadius": "角の丸み",
	"settings.alignGroup": "整列",
	"settings.alignContent": "コンテンツをタイトルに合わせて整列",
	"settings.headingSpacingGroup": "タイトル間隔",
	"settings.headingPadVertical": "垂直方向の間隔",
	"settings.headingGap": "見出し間の間隔",
	"settings.headingFoldGroup": "折りたたみ",
	"settings.headingFoldArrow": "折りたたみ矢印を表示",
	"settings.styleDemoName": "サンプル",
	"settings.previewTitle": "プレビュー",

	// Settings — Saved color palettes
	"settings.customPalettes": "保存済みのカラーパレット",
	"settings.newPalette": "新規パレット",
	"settings.customPalettesEmpty": "現在保存済みのパレットはありません。",
	"settings.editPaletteAria": "パレット {{name}} を編集",
	"settings.deletePaletteAria": "パレット {{name}} を削除",
	"settings.deletePaletteConfirm":
		'パレット "{{name}}" を削除しますか？\nこの色を使用しているcalloutには影響しません。',
	"settings.enableAutocomplete": "[! オートコンプリートを有効にする",
	"settings.enableAutocompleteDesc":
		'エディターの引用ブロック内で"[!"と入力すると候補を表示します。リストからcalloutタイプを選択して完全なcalloutヘッダーを挿入します。',

	"settings.customCommands": "コマンドとショートカット",
	"settings.customCommandsDesc":
		"すべてのCallout Studioコマンドと割り当てられたショートカットを確認し、よく使うcalloutのために独自のコマンドを作成できます。デフォルトではショートカットは割り当てられていません。",
	"settings.customCommandsButton": "コマンドを管理",

	"commandBuilder.title": "コマンドとショートカット",
	"commandBuilder.desc":
		"+ボタンを使って、Obsidianのホットキー設定でショートカットを設定または変更します。",
	"commandBuilder.builtIn": "組み込みコマンド",
	"commandBuilder.toggleAria": "{{name}}のオン/オフを切り替え",
	"commandBuilder.hotkeyBlank": "未設定",
	"commandBuilder.hotkeyAria": "{{name}}のショートカットを設定",
	"commandBuilder.yourCommands": "あなたのコマンド",
	"commandBuilder.newCommand": "新規コマンド",
	"commandBuilder.empty": "まだカスタムコマンドはありません。",
	"commandBuilder.unknownCommand": "このコマンド",
	"commandBuilder.editAria": "{{name}}を編集",
	"commandBuilder.deleteAria": "{{name}}を削除",
	"commandBuilder.deleteConfirm":
		"コマンド{{name}}を削除しますか？割り当てられているショートカットは機能しなくなります。",
	"commandBuilder.newTitle": "新規コマンド",
	"commandBuilder.editTitle": "コマンドを編集",
	"commandBuilder.format": "calloutの形式",
	"commandBuilder.formatDesc": "コマンドが書き込むcalloutの種類。",
	"commandBuilder.formatHeading": "見出し",
	"commandBuilder.formatInline": "インライン",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"この形式はオフになっているため、再度オンにするまでコマンドはプレーンテキストを挿入します。",
	"commandBuilder.callout": "calloutタイプ",
	"commandBuilder.calloutDesc": "このコマンドが挿入するcallout。",
	"commandBuilder.headingLevel": "見出しレベル",
	"commandBuilder.headingLevelDesc": "どの見出しレベルを書き込むか。",
	"commandBuilder.action": "アクション",
	"commandBuilder.actionDesc":
		"「囲む」は選択範囲をcalloutに変換し、「挿入」は空のcalloutを追加します。",
	"commandBuilder.actionWrap": "選択範囲を囲む",
	"commandBuilder.actionInsert": "新規挿入",
	"commandBuilder.preview": "コマンド名",
	"commandBuilder.duplicate":
		"まったく同じことを行うコマンドが既に存在します。",
	"commandBuilder.noCallouts":
		"コマンドを作成するためのcalloutタイプがまだありません。",
	"commandBuilder.save": "保存",

	"settings.vaultMaintenance": "vaultの洞察とメンテナンス",
	"settings.vaultStats": "callout統計",
	"settings.vaultStatsDesc":
		"Markdownノート内のすべてのcallout（ブロック、見出し、インライン）をカウントし、タイプ別にグループ化します。",
	"settings.vaultStatsButton": "統計を表示",
	"settings.vaultStatsScanning": "スキャン中",
	"settings.resetAll": "リセット",
	"settings.resetAllDesc":
		"すべてのユーザーcalloutを削除し、組み込みcallout、グローバルスタイル（ボーダー、フォントスケール、形状）、保存済みのカラーパレット、右クリックメニューのカスタマイズ、ダウンロード済みMaterial SVGをリセットします。",
	"settings.resetAllButton": "すべてリセット",
	"settings.resetAllConfirm":
		"すべてのカスタムcalloutを削除し、組み込みcallout、グローバルスタイル、保存済みのカラーパレット、右クリックメニューのカスタマイズ、キャッシュ済みMaterial SVGをリセットします。この操作は元に戻せません。よろしいですか？",
	"notice.resetAllDone": "すべてデフォルトにリセットされました。",

	"notice.customCommandsRemoved":
		"calloutタイプが存在しなくなったカスタムコマンドを{{count}}件削除しました。",
	"notice.customCommandMissingCallout":
		"このコマンドのcalloutタイプはもう存在しません。",

	"notice.exported":
		"calloutをcallout-studio-export.jsonにエクスポートしました",
	"notice.importedJSON":
		"JSONから{{count}}件のcalloutタイプをインポートしました。",
	"notice.importedSettings": "プラグインの設定をインポートしました。",
	"notice.importedCalloutManager":
		"Callout Manager からインポートしました：{{created}} 件作成、{{updated}} 件更新。",
	"notice.importedAdmonition":
		"Admonition からインポートしました：{{created}} 件作成、{{updated}} 件更新。",
	"notice.noNewJSON":
		"新しいcalloutタイプはインポートされませんでした（IDがすでに存在する可能性があります）。",
	"notice.iconDownloadFailed":
		'Materialアイコン"{{name}}"をダウンロードできませんでした。このスタイル/ウェイトでは利用できないか、接続がオフラインの可能性があります。',
	"notice.externalStyleOn":
		'"{{name}}"は現在、テーマまたはCSSスニペットによってスタイルが適用されています。',
	"notice.externalStyleOff":
		'Callout Studioが再び"{{name}}"にスタイルを適用します。',
	"notice.nothingToWrap": "囲むものがありません。",
	"notice.cursorNotInsideCallout": "カーソルがcallout内にありません。",
	"notice.autocompleteTargetMoved":
		"何も挿入されませんでした — エディタを開いている間に行が変更されました。",
	"notice.openHotkeysFailed": "Obsidianのホットキー設定を開けませんでした。",
	"notice.filterHotkeysFailed":
		"Obsidianのホットキーを開きましたが、Callout Studioフィルターを適用できませんでした。",

	"editor.editCallout": "calloutを編集",
	"editor.newCallout": "新しいcallout",
	"editor.displayName": "表示名",
	"editor.displayNameDesc": "UIに表示される人が読めるラベル",
	"editor.displayNameBuiltIn": "組み込みcalloutの表示名は変更できません",
	"editor.displayNamePlaceholder": "マイcallout",
	"editor.calloutIds": "Callout ID",
	"editor.calloutIdsDesc":
		"このcalloutのすべての識別子。スペースを使用できます。\nEnterまたは + ボタンを押して追加します。",
	"editor.calloutIdsPlaceholder": "IDを追加",
	"editor.addId": "IDを追加",
	"editor.idLinkedToName": "表示名にリンクされています",
	"editor.idCannotDelete":
		"このIDは表示名にリンクされているため削除できません。名前を編集して変更してください",
	"editor.icon": "アイコン",
	"editor.pickIcon": "アイコンを変更",
	"editor.replaceIcon": "アイコンを置き換え",
	"editor.removeIcon": "アイコンを削除",
	"editor.noIcon": "アイコンなし",
	"editor.resetIcon": "アイコンをデフォルトにリセット",
	"editor.livePreview": "ライブプレビュー",
	"editor.iconAdjustment": "アイコン調整",
	"editor.picture": "画像",
	"editor.size": "サイズ",
	"editor.horizontalOffset": "水平オフセット",
	"editor.verticalOffset": "垂直オフセット",
	"editor.colors": "カラー",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "カラーをデフォルトにリセット",
	"editor.paletteDeleted": "削除された色",
	"editor.paletteGroupObsidian": "Obsidian callout",
	"editor.paletteGroupPresets": "カラープリセット",
	"editor.paletteGroupCustom": "カスタム",
	"editor.paletteNewColor": "新しい色…",
	"editor.contrastWarning":
		"背景とのコントラストが低く、読みにくい場合があります",
	"editor.foldable": "折りたたみ可能",
	"editor.foldableDesc":
		"calloutを折りたたみ可能にするかどうか、およびvault全体に適用するデフォルト状態を選択します。",
	"editor.foldOff": "オフ",
	"editor.foldOpen": "デフォルトで開く",
	"editor.foldClosed": "デフォルトで閉じる",
	"editor.cancel": "キャンセル",
	"editor.saveChanges": "変更を保存",
	"editor.createCallout": "calloutを作成",
	"editor.nameRequired": "calloutを作成する前に表示名が必要です。",
	"editor.noChangesToSave": "変更はありませんでした。",
	"editor.downloadingIcon": "アイコンをダウンロード中",
	"editor.idEmpty": "少なくとも1つのIDが必要です",
	"editor.idExists": "このIDのcalloutがすでに存在します",
	"editor.idConflict": "このIDは既存のcalloutと競合します",
	"editor.idDashConflict":
		"Obsidianはスペースをハイフンとして書き込むため、このIDは「{{other}}」と衝突します",
	"editor.untitledCallout": "タイトルなしCallout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText": "段落内にインラインの [!{id}] ピルがあります。",
	"editor.previewReadOnly": "ライブプレビューは編集できません",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleTitle": "Callout Studioの外でスタイルされています",
	"editor.externalStyleBody":
		"Callout Studioは{{id}}にスタイルを適用していません。見た目はテーマ、CSSスニペット、またはObsidianのデフォルトから来ています。",
	"editor.externalStyleWhat": "これが意味すること",
	"editor.externalStyleWhatHeading":
		"## [!{{id}}] タイトルのような見出しcalloutはレンダリングされません — テキストは書かれたままになります。",
	"editor.externalStyleWhatInline":
		"インラインのもの、例えば 単語 [!{{id}}] 単語 も同様です。",
	"editor.externalStyleWhatGlobal":
		"グローバルスタイル設定（枠線、角の丸み、文字サイズ）は適用されません。",
	"editor.externalStylePreviewTitle": "現在の表示方法",
	"editor.externalStyleSample":
		"## [!{{id}}] タイトル\n\n" +
		"[!{{id}}] を含む文はこのように表示されます。\n\n" +
		"> [!{{id}}] {{name}}\n" +
		"> calloutの内容はこのように表示されます。\n",
	"editor.externalStyleResume": "スタイルを取り戻す",
	"editor.externalStyleClose": "了解",

	// Palette editor modal
	"palette.newTitle": "新しいカラーパレット",
	"palette.groupPalette": "パレット",
	"palette.editTitle": "カラーパレットを編集",
	"palette.name": "名前",
	"palette.namePlaceholder": "マイパレット",
	"palette.nameExists": "この名前のパレットはすでに存在します",
	"palette.baseColor": "ベースカラー",
	"palette.baseColorHint":
		"背景色を自動的にこの色に合わせます。ご希望であれば、{{link}}で個別に設定することもできます。",
	"palette.baseColorHintLink": "ここをクリック",
	"palette.advancedColors": "色",
	"palette.advancedColorsHint":
		"{{mode}}モードの色を編集中 - もう一方のモードは自動的に更新されます。確認するにはObsidianのテーマを切り替えてください。",
	"palette.revertHint": "代わりに単一のベースカラーを使いますか? {{link}}。",
	"palette.revertHintLink": "元に戻す",
	"palette.lightMode": "ライト",
	"palette.darkMode": "ダーク",
	"palette.accentColor": "アクセントカラー",
	"palette.backgroundColorChannel": "背景色",
	"palette.textColorChannel": "テキストの色",
	"palette.bgIntensity": "強度",
	"palette.bgStyle": "スタイル",
	"palette.bgSolid": "単色",
	"palette.bgGradient": "グラデーション",
	"palette.bgTransparent": "透明",
	"palette.gradientTo": "2番目の色",
	"palette.gradientDirection": "方向",
	"palette.gradientText": "グラデーションタイトルテキスト",
	"palette.save": "保存",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "赤",
	"colorName.orange": "オレンジ",
	"colorName.amber": "アンバー",
	"colorName.yellow": "黄",
	"colorName.lime": "ライム",
	"colorName.green": "緑",
	"colorName.teal": "ティール",
	"colorName.cyan": "シアン",
	"colorName.sky": "スカイブルー",
	"colorName.blue": "青",
	"colorName.indigo": "インディゴ",
	"colorName.violet": "バイオレット",
	"colorName.purple": "紫",
	"colorName.pink": "ピンク",
	"colorName.rose": "ローズ",
	"colorName.brown": "茶色",
	"colorName.gray": "グレー",
	"colorName.black": "黒",
	"colorName.white": "白",
	"colorName.crimson": "深紅",
	"colorName.coral": "サンゴ色",
	"colorName.grape": "グレープ",
	"colorName.plum": "プラム",
	"colorName.bubblegum": "バブルガム",

	"iconPicker.pickIcon": "アイコンを選択",
	"iconPicker.confirm": "確認",
	"iconPicker.cancel": "キャンセル",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "Lucideアイコンを検索",
	"iconPicker.searchTabler": "Tablerアイコンを検索",
	"iconPicker.tablerStyle": "アイコンスタイル",
	"iconPicker.tablerStyleOutline": "アウトライン (Outline)",
	"iconPicker.tablerStyleFilled": "塗りつぶし (Filled)",
	"iconPicker.loadMore": "さらに読み込む",
	"iconPicker.materialStyle": "アイコンスタイル",
	"iconPicker.materialStyleOutlined": "アウトライン (Outlined)",
	"iconPicker.materialStyleFilled": "塗りつぶし (Filled)",
	"iconPicker.materialStyleRounded": "丸み (Rounded)",
	"iconPicker.materialStyleSharp": "シャープ (Sharp)",
	"iconPicker.materialWeight": "アイコンの太さ",
	"iconPicker.materialWeight100": "極細 (Thin)",
	"iconPicker.materialWeight200": "超細 (Extra Light)",
	"iconPicker.materialWeight300": "細 (Light)",
	"iconPicker.materialWeight400": "標準 (Regular)",
	"iconPicker.materialWeight500": "中 (Medium)",
	"iconPicker.materialWeight600": "やや太 (Semi Bold)",
	"iconPicker.materialWeight700": "太 (Bold)",
	"iconPicker.materialFontFailed":
		"Material アイコンのプレビューを読み込めませんでした。代わりにアイコン名が表示されます。検索と選択は引き続き使えます。",
	"iconPicker.materialFontRetry": "もう一度試す",
	"iconPicker.searchMaterial": "Materialアイコンを検索",
	"iconPicker.searchEmoji": "絵文字を検索",
	"iconPicker.skinTone": "肌の色調",
	"iconPicker.allCategories": "すべてのカテゴリ",
	"iconPicker.noIconSelected": "アイコンが選択されていません",
	"iconPicker.noResults": "検索に一致するアイコンはありません。",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Octiconsを検索",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Font Awesomeを検索",
	"iconPicker.faStyle": "アイコンスタイル",
	"iconPicker.faStyleSolid": "塗りつぶし (Solid)",
	"iconPicker.faStyleRegular": "標準 (Regular)",
	"iconPicker.faStyleBrands": "ブランド (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "RPG Awesomeを検索",
	"iconPicker.image": "あなたの画像",
	"iconPicker.searchImage": "画像を検索",
	"iconPicker.imageTooLarge":
		"{{name}}は大きすぎます。画像は5MB未満にしてください。",
	"iconPicker.imageUnsupported":
		"{{name}}はサポートされている画像形式ではありません。SVG、PNG、JPEG、またはWebPを使用してください。",
	"iconPicker.imageInvalidSvg":
		"{{name}}は安全なSVGとして読み取れなかったため、追加されませんでした。",
	"iconPicker.imageDecodeFailed":
		"{{name}}は画像として読み取れませんでした。",
	"iconPicker.imageDuplicate":
		"{{name}}はすでにあなたの画像にあります。ファイル名を変更するか、既存の画像を削除してください。",
	"iconPicker.imageAdd": "画像を追加",
	"iconPicker.imageEmpty":
		"画像がまだありません。コンピューターからSVG、PNG、JPEG、またはWebPファイルを追加するか、ここにドロップしてください。",
	"iconPicker.imageDelete": "削除",
	"iconPicker.imageDeleteConfirm": "「{{name}}」を削除しますか？",
	"iconPicker.imageDeleteInUse":
		"{{count}}個のcalloutがこの画像を使用しています。新しい画像を指定するまで、プレースホルダーアイコンが表示されます。",
	"iconPicker.imageRecolor": "Calloutのカラーに合わせる",
	"iconPicker.allSources": "すべてのソース",
	"iconPicker.searchAllSources": "すべてのアイコンソースを検索",
	"iconPicker.sourcesNotDownloaded":
		"未取得: {{names}}。上からソースを選んでダウンロードしてください。",
	"iconPicker.chooseSource": "ソースを選択",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "すべてのライブラリを一度に検索",
	"iconPicker.descLucide": "Obsidian固有のセット、常にオフライン",
	"iconPicker.descTabler":
		"シンプルで統一感のあるUIアイコン、アウトラインと塗りつぶし",
	"iconPicker.descMaterial": "Googleのセット、4スタイルと7ウェイト",
	"iconPicker.descEmoji": "カラフルなグリフ、すべての肌色",
	"iconPicker.descOcticons": "GitHubのインターフェイスアイコン",
	"iconPicker.descFa": "Solid、Regular、ブランド",
	"iconPicker.descRpgAwesome": "ファンタジーとテーブルトップのアイコン",
	"iconPicker.descImage": "コンピューターから追加した画像",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "アクセシビリティ",
	"iconPicker.cat.Actions": "アクション",
	"iconPicker.cat.Activities": "アクティビティ",
	"iconPicker.cat.Alert": "アラート",
	"iconPicker.cat.Alphabet": "アルファベット",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "動物",
	"iconPicker.cat.Arrows": "矢印",
	"iconPicker.cat.Astronomy": "天文学",
	"iconPicker.cat.Audio&Video": "音声・映像",
	"iconPicker.cat.Automotive": "自動車",
	"iconPicker.cat.Badges": "バッジ",
	"iconPicker.cat.Brand": "ブランド",
	"iconPicker.cat.Buildings": "建物",
	"iconPicker.cat.Business": "ビジネス",
	"iconPicker.cat.Camping": "キャンプ",
	"iconPicker.cat.Charity": "チャリティー",
	"iconPicker.cat.Charts": "グラフ",
	"iconPicker.cat.Charts + Diagrams": "グラフ・図表",
	"iconPicker.cat.Childhood": "子供時代",
	"iconPicker.cat.Clothing + Fashion": "衣類・ファッション",
	"iconPicker.cat.Coding": "プログラミング",
	"iconPicker.cat.Communicate": "コミュニケーション",
	"iconPicker.cat.Communication": "通信",
	"iconPicker.cat.Computers": "コンピューター",
	"iconPicker.cat.Connectivity": "接続",
	"iconPicker.cat.Construction": "建設",
	"iconPicker.cat.Currencies": "通貨",
	"iconPicker.cat.Database": "データベース",
	"iconPicker.cat.Design": "デザイン",
	"iconPicker.cat.Development": "開発",
	"iconPicker.cat.Devices": "デバイス",
	"iconPicker.cat.Devices + Hardware": "デバイス・ハードウェア",
	"iconPicker.cat.Disaster + Crisis": "災害・危機",
	"iconPicker.cat.Document": "ドキュメント",
	"iconPicker.cat.E-commerce": "Eコマース",
	"iconPicker.cat.Editing": "編集",
	"iconPicker.cat.Education": "教育",
	"iconPicker.cat.Electrical": "電気",
	"iconPicker.cat.Emoji": "絵文字",
	"iconPicker.cat.Energy": "エネルギー",
	"iconPicker.cat.Extensions": "拡張機能",
	"iconPicker.cat.Files": "ファイル",
	"iconPicker.cat.Film + Video": "映画・動画",
	"iconPicker.cat.Food": "食べ物",
	"iconPicker.cat.Food + Beverage": "食べ物・飲み物",
	"iconPicker.cat.Fruits + Vegetables": "果物・野菜",
	"iconPicker.cat.Games": "ゲーム",
	"iconPicker.cat.Gaming": "ゲーミング",
	"iconPicker.cat.Gender": "性別",
	"iconPicker.cat.Genders": "性別",
	"iconPicker.cat.Gestures": "ジェスチャー",
	"iconPicker.cat.Halloween": "ハロウィン",
	"iconPicker.cat.Hands": "手",
	"iconPicker.cat.Hardware": "ハードウェア",
	"iconPicker.cat.Health": "健康",
	"iconPicker.cat.Holidays": "休日",
	"iconPicker.cat.Home": "ホーム",
	"iconPicker.cat.Household": "家庭",
	"iconPicker.cat.Humanitarian": "人道的",
	"iconPicker.cat.Images": "画像",
	"iconPicker.cat.Laundry": "洗濯",
	"iconPicker.cat.Letters": "文字",
	"iconPicker.cat.Logic": "論理",
	"iconPicker.cat.Logistics": "物流",
	"iconPicker.cat.Map": "地図",
	"iconPicker.cat.Maps": "地図",
	"iconPicker.cat.Maritime": "海事",
	"iconPicker.cat.Marketing": "マーケティング",
	"iconPicker.cat.Math": "数学",
	"iconPicker.cat.Mathematics": "数学",
	"iconPicker.cat.Media": "メディア",
	"iconPicker.cat.Media Playback": "メディア再生",
	"iconPicker.cat.Medical + Health": "医療・健康",
	"iconPicker.cat.Money": "お金",
	"iconPicker.cat.Mood": "気分",
	"iconPicker.cat.Moving": "引越し",
	"iconPicker.cat.Music + Audio": "音楽・音声",
	"iconPicker.cat.Nature": "自然",
	"iconPicker.cat.Numbers": "数字",
	"iconPicker.cat.Photography": "写真撮影",
	"iconPicker.cat.Photos + Images": "写真・画像",
	"iconPicker.cat.Political": "政治",
	"iconPicker.cat.Privacy": "プライバシー",
	"iconPicker.cat.Punctuation + Symbols": "句読点・記号",
	"iconPicker.cat.Religion": "宗教",
	"iconPicker.cat.Science": "科学",
	"iconPicker.cat.Science Fiction": "SF",
	"iconPicker.cat.Security": "セキュリティ",
	"iconPicker.cat.Shapes": "図形",
	"iconPicker.cat.Shopping": "ショッピング",
	"iconPicker.cat.Social": "ソーシャル",
	"iconPicker.cat.Spinners": "スピナー",
	"iconPicker.cat.Sport": "スポーツ",
	"iconPicker.cat.Sports + Fitness": "スポーツ・フィットネス",
	"iconPicker.cat.Symbols": "記号",
	"iconPicker.cat.System": "システム",
	"iconPicker.cat.Text": "テキスト",
	"iconPicker.cat.Text Formatting": "テキスト書式",
	"iconPicker.cat.Time": "時間",
	"iconPicker.cat.Toggle": "トグル",
	"iconPicker.cat.Transit": "交通",
	"iconPicker.cat.Transportation": "輸送",
	"iconPicker.cat.Travel": "旅行",
	"iconPicker.cat.Travel + Hotel": "旅行・ホテル",
	"iconPicker.cat.UI actions": "UI操作",
	"iconPicker.cat.Users + People": "ユーザー・人物",
	"iconPicker.cat.Vehicles": "乗り物",
	"iconPicker.cat.Version control": "バージョン管理",
	"iconPicker.cat.Weather": "天気",
	"iconPicker.cat.Writing": "文章",
	"iconPicker.cat.Zodiac": "星座",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}}はまだダウンロードされていません",
	"iconPack.downloadDetail":
		"{{count}}個のアイコン · {{size}} · 一度限りのダウンロード",
	"iconPack.download": "ダウンロード",
	"iconPack.downloading": "{{name}}をダウンロード中…",
	"iconPack.downloadFailed":
		"{{name}}をダウンロードできませんでした。接続を確認して再試行してください。",
	"iconPack.retry": "再試行",
	"iconPack.faBrandsNotice":
		"ブランドアイコンはそれぞれの所有者の商標です。それらの掲載は推薦を意味しません。それらが指す会社、製品、またはサービスを表すためにのみ使用してください。",
	"iconPack.artworkRestored":
		"{{names}}のアイコンアートワークをダウンロードしました。",
	"iconPack.diskWriteFailed":
		"Callout Studioはアイコンパックをディスクに保存できませんでした。次回また再ダウンロードが必要です。選んだアイコンは設定に保存されています。",

	// Icon licences & credits
	"credits.title": "アイコンライセンスとクレジット",
	"credits.intro":
		"Callout Studioはいくつかのオープンなアイコンライブラリを使用しています。それらのライセンスと、ここでの使用のために変更された点を以下に掲載します。",
	"credits.fullNotices": "サードパーティの完全な通知",
	"credits.pluginLicense":
		"Callout Studio自体のコードは permissive ライセンスです。アイコン ライブラリはそれぞれのライセンスを保持します。",

	"contextMenu.editCallout": "callout設定を編集",
	"contextMenu.copyMarkdown": "callout Markdownをコピー",
	"contextMenu.openSettings": "Callout Studio設定を開く",
	"contextMenu.setFoldClosed": "calloutを閉じた状態に設定 (-)",
	"contextMenu.setFoldOpen": "calloutを開いた状態に設定 (+)",
	"contextMenu.setFoldNone": "calloutを折りたたみ不可にする",
	"contextMenu.cutSection": "見出しセクションを切り取り",
	"contextMenu.copySection": "見出しセクションをコピー",
	"contextMenu.deleteSection": "見出しセクションを削除",

	"heading.toggleFold": "折りたたみを切り替え",

	"settings.globalSettings": "グローバル設定",
	"settings.globalSettingsRegularDesc":
		"引用ブロックにcalloutトークンを追加すると（例: `> [!type]`）、Obsidianのネイティブなcalloutボックスとして表示されます。ボーダー、半径、フォントスケール、整列を調整できます。",
	"settings.globalSettingsHeadingDesc":
		"見出しの # の直後にcalloutトークンを追加すると（例: `## [!type]`）、スタイル付きの見出しcalloutとして表示されます。ボーダー、形状、垂直方向の間隔を調整できます。",
	"settings.globalSettingsInlineDesc":
		"テキスト行の中のどこかにcalloutトークンを追加すると（例: `[!type]`）、小さなインラインピルとして表示されます。ボーダーと形状を調整できます。",
	"settings.globalSettingsCustomize": "カスタマイズ",

	"settings.calloutTypeRegular": "Block Callout",
	"settings.calloutTypeHeading": "見出しcallout",
	"settings.calloutTypeInline": "インラインcallout",

	"settings.customizeMenu": "メニュー項目をカスタマイズ",
	"settings.customizeMenuDesc":
		"各calloutタイプに表示する右クリック操作を選択し、順序を並べ替えます。 ソースモード、ライブプレビューで機能します。",
	"settings.customizeMenuButton": "メニュー項目をカスタマイズ",
	"menuCustomize.title": "右クリックメニューをカスタマイズ",
	"menuCustomize.desc":
		"操作のオン/オフを切り替え、ハンドルをドラッグして並べ替えます。変更は自動的に保存されます。",
	"menuCustomize.regular": "Block Callout",
	"menuCustomize.heading": "見出しcallout",
	"menuCustomize.inline": "インラインcallout",
	"menuCustomize.dragHandle": "ドラッグして並べ替え",
	"menuItem.edit": "calloutを編集",
	"menuItem.openSettings": "設定を開く",
	"menuItem.copyMarkdown": "Markdownをコピー",
	"menuItem.foldDefaults": "折りたたみのデフォルト（開く / 閉じる / なし）",
	"menuItem.cutSection": "セクションを切り取り",
	"menuItem.copySection": "セクションをコピー",
	"menuItem.deleteSection": "セクションを削除",

	"confirm.ok": "削除",
	"confirm.cancel": "キャンセル",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "コマンドを削除",
	"confirm.titleResetAll": "すべてのcalloutをリセット",
	"confirm.titleResetCallout": "calloutをリセット",
	"confirm.titleDeletePalette": "パレットを削除",
	"confirm.titleDeleteImage": "画像を削除",

	"vault.filesUpdated":
		"vaultファイルの{{count}}件のcallout参照を更新しました。",
	"vault.idsUpdated":
		"vaultファイルの{{count}}件のcallout IDを更新しました: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"vaultファイルの{{count}}件のcalloutタイトルを更新しました: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "置き換え先:",
	"vault.deleteWithout": "置き換えずに削除",
	"vault.confirmDelete": "確認",
	"vault.confirmReplace": "置き換え",
	"vault.replacePromptInUse":
		'"{{name}}"は{{files}}個のファイルで{{count}}回使用されています。置き換えるcalloutを選択してください:',
	"vault.replacePromptUnused":
		'"{{name}}"を置き換えるcalloutを選択してください:',
	"vault.noReplacementAvailable": "置き換え可能な他のcalloutがありません。",
	"vault.convertedToPlainText":
		"{{files}}個のファイルの{{blocks}}個のcalloutブロックをプレーンテキストに変換しました。",
	"vault.resetAliasWarning":
		"{{files}}個のファイルの{{count}}件の参照がカスタムエイリアスを使用しています: {{aliases}}。リセット後これらは機能しなくなります。続行しますか？",
	"vault.resetConfirm": "リセット",
	"vault.resetAllInUse":
		"⚠ {{files}}個のファイルの{{count}}件のcallout参照が削除されるカスタムcalloutタイプを使用しています。",

	"quickInsert.title": "ブロックcalloutをクイック挿入",
	"quickInsert.desc": "カーソル位置に挿入するcalloutを選択します。ブロックcalloutのみです。",
	"quickInsert.searchPlaceholder": "calloutを検索",
	"quickInsert.sourceAria": "calloutのソースで絞り込み",
	"quickInsert.sourceAll": "すべて",
	"quickInsert.sourceBuiltIn": "組み込み",
	"quickInsert.sourceUser": "自分のcallout",
	"quickInsert.editAria": "{{name}}を編集",
	"quickInsert.insertAria": "{{name}}をブロックcalloutとして挿入",
	"quickInsert.noResults": "calloutが見つかりません",
	"quickInsert.noUserCallouts": "まだcalloutを作成していません。",
	"quickInsert.noEditorHint": "編集モードで開いているノートがないため、何も挿入できません。",
	"quickInsert.noEditor": "calloutを挿入するには、ノートを編集モードで開いてください。",

	"vaultStats.title": "callout統計",
	"vaultStats.totalCallouts": "callout総数",
	"vaultStats.typesFound": "見つかったタイプ",
	"vaultStats.filesWithCallouts": "calloutを含むファイル",
	"vaultStats.filesScanned": "スキャン済みMarkdownファイル",
	"vaultStats.empty": "Markdownノートにcalloutが見つかりませんでした。",
	"vaultStats.columnType": "タイプ",
	"vaultStats.columnName": "名前",
	"vaultStats.columnSource": "ソース",
	"vaultStats.columnCount": "数",
	"vaultStats.columnFiles": "ファイル",
	"vaultStats.unknown": "不明",
	"vaultStats.sourceBuiltIn": "組み込み",
	"vaultStats.sourceCustom": "カスタム",
	"vaultStats.sourceAutoFallback": "自動フォールバック",
	"vaultStats.sourceTheme": "CSSスニペット",
	"vaultStats.sourceAlias": "{{id}}のエイリアス",
	"vaultStats.sourceUnknown": "不明",
	"vaultStats.byRole": "記述形式",
	"vaultStats.roleBlock": "ブロック",
	"vaultStats.roleHeading": "見出し",
	"vaultStats.roleInline": "インライン",
	"vaultStats.defineUndefined": "未定義の{{count}}件を定義",
	"vaultStats.defineRunning": "スキャン中",
	"vaultStats.defineDone": "{{count}}件のcalloutタイプを追加しました。",
	"vaultStats.close": "閉じる",

	"import.title": "インポートの問題",
	"import.reportLeadIn":
		"インポートしたファイルが変更されているようです。問題のリストです:",
	"import.reportLeadInFatal":
		"このファイルはCallout Studioのエクスポートではないようです。インポートできません:",
	"import.entryHeading": "エントリ {{index}} — {{label}}",
	"import.summary":
		"{{total}}件中{{valid}}件のエントリが有効 · {{issues}}件の問題が見つかりました。",
	"import.btnCancel": "キャンセル",
	"import.btnImportValid": "有効なもののみインポート（{{count}}件）",
	"import.err.notRecognized":
		"認識できないファイル: callout定義の配列またはCallout Studioのエクスポートが必要です。",
	"import.warn.settingsIgnored":
		"設定ブロックが有効なオブジェクトではなかったため、無視されました。",
	"import.warn.invalidGradient":
		"背景のグラデーションが無効だったため、無視されました。",
	"import.err.parseFailed":
		"ファイルは有効なJSONではなく、解析できませんでした。",
	"import.err.entryNotObject": "エントリはオブジェクトでなければなりません。",
	"import.err.requiredMissing":
		'必須フィールド"{{field}}"が欠けているか、型が間違っています。',
	"import.err.idEmpty": "IDは空であってはなりません。",
	"import.err.idTooLong":
		'ID"{{value}}"は{{length}}文字です。最大は{{max}}文字です。',
	"import.err.idBadChar":
		'ID"{{value}}"に無効な文字が含まれています（"|"、"["、"]"、タブ、改行は使用できません）。',
	"import.err.idMetadata":
		'ID"{{value}}"に"|"が含まれています。Obsidianでは最初の"|"以降はすべてcalloutのメタデータであり、タイプの一部ではありません。このため、このエントリは"{{id}}"calloutを説明しています。スキップされました。既存の"{{id}}"はそのまま変更されていません。',
	"import.err.displayNameEmpty": "表示名は空であってはなりません。",
	"import.err.displayNameTooLong":
		"表示名は{{length}}文字です。最大は{{max}}文字です。",
	"import.err.boolField":
		'"{{field}}"はブール値（trueまたはfalse）でなければなりません。',
	"import.err.iconNotObject": "アイコンはオブジェクトでなければなりません。",
	"import.err.iconTypeInvalid":
		'アイコンタイプ"{{value}}"は{{types}}のいずれかでなければなりません。',
	"import.warn.iconFieldIgnored":
		'"{{field}}"はMaterialアイコンにのみ適用され、アイコンタイプ{{type}}では無視されます。',
	"import.err.iconValueEmpty":
		"アイコンの値は空でない文字列でなければなりません。",
	"import.err.iconValueTooLong":
		"アイコンの値が異常に長いです（{{length}}文字）。",
	"import.err.materialStyle":
		'Materialアイコンスタイル"{{value}}"はoutlined、filled、rounded、sharpのいずれかでなければなりません。',
	"import.err.materialWeight":
		'Materialアイコンの太さ"{{value}}"は100〜700の範囲で100刻みの整数でなければなりません。',
	"import.warn.iconRecolorIgnored":
		'"recolor"はあなた自身の画像にのみ適用され、アイコンタイプ{{type}}では無視されます。',
	"import.err.iconRecolorInvalid":
		'"recolor"はtrueまたはfalseでなければなりません（受け取った値: "{{value}}")。',
	"import.err.colorInvalid":
		'"{{field}}"は"#448aff"のような16進数カラーでなければなりません（"{{value}}"を受け取りました）。',
	"import.err.numberRange":
		'"{{field}}"は{{min}}〜{{max}}の数値でなければなりません（"{{value}}"を受け取りました）。',
	"import.err.iconSizeRange":
		'"{{field}}"は{{min}}〜{{max}}の数値でなければなりません（"{{value}}"を受け取りました）。',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray":
		'"aliases"は文字列の配列でなければなりません。',
	"import.err.aliasNotString": "エイリアスは文字列でなければなりません。",
	"import.err.aliasDup":
		'"{{value}}"エイリアスがこのエントリ内で重複しています。',
	"import.err.tooManyIds":
		"IDが多すぎます（{{count}}件）。各calloutには最大{{max}}件のID（プライマリ＋エイリアス）を持てます。",
	"import.err.metadataShape":
		'"metadata"はすべての値が文字列のオブジェクトでなければなりません。',
	"import.warn.unknownFields":
		"不明なフィールドは無視されました: {{fields}}。",
	"import.err.duplicateInFile":
		'ID/エイリアス"{{value}}"はこのファイルのエントリ#{{first}}ですでに使用されています。',
	"import.err.aliasConflict":
		'エイリアス"{{value}}"はvault内の別のcallout（"{{other}}"）ですでに使用されています。',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded"がtrueで"foldable"がfalseでした。defaultFoldedはfalseにリセットされました。',
	"import.warn.imageMissing":
		"このCalloutはファイルにもこのvaultにも存在しない画像を使用しています。新しい画像を指定するまでプレースホルダーアイコンが表示されます。",

	"import.err.paletteIdInvalid":
		'"paletteId" は空でないテキスト ID である必要があります（"{{value}}" を受け取りました）。',
	"import.warn.iconNameUnknown":
		'"{{value}}" アイコンは {{type}} に存在しないため、デフォルトのアイコンが使用されました。',
	"import.warn.cmIconUnknownNew":
		'"{{value}}" アイコンは Obsidian に存在しないため、デフォルトのアイコンが使用されました。',
	"import.warn.cmIconUnknownExisting":
		'"{{value}}" アイコンは Obsidian に存在しないため、"{{id}}" は既存のアイコンを保持しました。',
	"import.chooseSource": "インポート元",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Callout Studio からエクスポートされた .json ファイルを読み込みます。",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Callout Manager の Copy ボタンでコピーしたスタイルを貼り付けてください。",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Admonition プラグインからカスタム admonition を引き継ぎます。",
	"import.cmTitle": "Callout Manager からインポート",
	"import.cmFromVault": "この保管庫",
	"import.cmVaultChecking": "Callout Manager プラグインを探しています…",
	"import.cmVaultFound": "カスタム callout が {{count}} 件見つかりました。",
	"import.cmVaultNotFound":
		"この保管庫にカスタム callout は見つかりませんでした。",
	"import.cmPasteLabel":
		"または Callout Manager からコピーしたスタイルをここに貼り付け：",
	"import.cmInstructions":
		"Callout Manager で Copy ボタンを使用してカスタマイズされた callout スタイルをコピーし、以下に貼り付けてください。",
	"import.cmPlaceholder": "コピーしたスタイルをここに貼り付け…",
	"import.cmBtnCancel": "キャンセル",
	"import.cmBtnImport": "インポート",
	"import.err.cmNoBlocksFound":
		"貼り付けたテキストに Callout Manager のスタイルが見つかりませんでした。",
	"import.err.cmNotRecognized":
		"ファイルを認識できませんでした。Callout Manager の Copy ボタンで作成されたスタイル、または Callout Manager の data.json が必要です。",
	"import.err.cmNoEntries":
		"インポートするカスタム callout が見つかりませんでした。",
	"import.err.cmNoColorForNew":
		'新しい callout "{{value}}" に使用できる色が見つからなかったため、スキップされました。',
	"import.err.cmIdConflict":
		'ID "{{value}}" は別の callout ("{{other}}") によって既にエイリアスとして使用されているため、スキップされました。',
	"import.warn.cmNoColorDefault":
		"Callout Manager で色が設定されていなかったため、デフォルトのグレーが使用されました。",
	"import.warn.cmThemeCondition":
		"この callout の色またはアイコンは 1 つのテーマにのみ設定されていました。Callout Studio はテーマごとのスタイルに対応していないため、すべてのテーマに引き継がれました。",
	"import.warn.cmCustomStyles":
		"この callout には Callout Manager のカスタム CSS もあります。このスタイルはインポート対象外のため、アイコンと色だけが引き継がれました。",

	// Import — Admonition
	"import.admTitle": "Admonition からインポート",
	"import.admInstructions":
		"各 admonition は名前・アイコン・色を保ったまま callout としてインポートされます。Callout " +
		"Studio に対応する設定がないもの（コマンド、コピーボタン、タイトル非表示）は引き継がれません。",
	"import.admFromVault": "この保管庫",
	"import.admVaultChecking": "Admonition プラグインを探しています…",
	"import.admVaultFound":
		"カスタム admonition が {{count}} 件見つかりました。",
	"import.admVaultNotFound":
		"この保管庫にカスタム admonition は見つかりませんでした。",
	"import.admFromFile": "ファイル",
	"import.admFromFileDesc": "admonitions.json ファイル、または共有パック。",
	"import.admChooseFile": "ファイルを選択…",
	"import.admPasteLabel": "または JSON をここに貼り付け：",
	"import.admPlaceholder": "ここに admonition を貼り付け…",
	"import.admBtnCancel": "キャンセル",
	"import.admBtnImport": "インポート",
	"import.err.admNotRecognized":
		"認識できないファイルです：admonition のリスト、または Admonition の data.json が必要です。",
	"import.err.admNoEntries":
		"インポートできる admonition が見つかりませんでした。",
	"import.err.admTypeMissing":
		'この admonition には "type" がないため、スキップしました。',
	"import.warn.admIconUnknown":
		'"{{value}}" という名前のアイコンはどのアイコンライブラリにもないため、既定のアイコンを使用しました。',
	"import.warn.admIconUnknownExisting":
		'"{{value}}" という名前のアイコンはどのアイコンライブラリにもないため、"{{id}}" は元のアイコンのままです。',
	"import.warn.admImageFailed":
		"アップロードされた画像を読み取れなかったため、既定のアイコンを使用しました。",
	"import.warn.admIconWithCss":
		"この admonition は Admonition 側の CSS " +
		"スニペットでスタイル設定されています。そのスタイルはインポートに含まれないため、名前・アイコン・色のみを引き継ぎました。",
	"import.warn.admNoColor":
		"色が設定されていないため、既定の青を使用しました。",
	"import.warn.admTitleTruncated":
		"タイトルは {{length}} 文字です。{{max}} 文字に短縮しました。",

	"footer.tagline":
		"フィードバック、コメント、提案はありますか？ぜひお聞かせください！",
	"footer.madeBy": "Nivが作成  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		"パレット「{{name}}」を削除しますか？\n1 件の callout が使用しています。色は保持され、後でエディターの色の行から再接続できます。",
	"settings.deletePaletteConfirmLinked":
		"パレット「{{name}}」を削除しますか？\n{{count}} 件の callout が使用しています。色は保持され、後で各エディターの色の行から再接続できます。",
	"settings.unlinkedColors": "未リンクの色",
	"settings.unlinkedColorsDesc":
		"保存済みの色が削除された callout です。現在の色は保持されます。復元すると色が再保存され、グループ全体が再リンクされます。",
	"settings.unlinkedColorOne": "1 件の callout",
	"settings.unlinkedColorCount": "{{count}} 件の callout",
	"settings.restoreColor": "復元",
	"settings.palettesMergedNotice":
		"同じ色を持つ保存済み色に、インポートしたパレット {{count}} 件を統合しました。",
	"notice.palettesMerged":
		"同一の色を持つ保存済み色 {{count}} 件を統合しました: {{names}}。それらを使用している callout は色を保持し、残った色にリンクされました。",
	"editor.colorsDescDeleted":
		"この callout の保存済み色は削除されました。{{link}}ことで再保存できます。",
	"editor.colorsDescDeletedOther":
		"この callout の保存済み色は削除されました。{{link}}ことで再保存できます — 同じ色を使う他の 1 件の callout も再リンクされます。",
	"editor.colorsDescDeletedOthers":
		"この callout の保存済み色は削除されました。{{link}}ことで再保存できます — 同じ色を使う他の {{count}} 件の callout も再リンクされます。",
	"editor.colorsDescDeletedLink": "ここをクリックする",
	"palette.colorExists":
		"これらの色は「{{name}}」と同じです。保存済みの色を 2 つ同じにすることはできません — 区別するために色を変更してください。",
	"palette.colorExistsUse":
		"これらの色は「{{name}}」と同じです。保存済みの色を 2 つ同じにすることはできません — 色を変更するか、{{link}}。",
	"palette.colorExistsUseLink": "既存の色を使う",
	"locale.downloading": "翻訳をダウンロード中…",
	"locale.notDownloaded": "{{name}}はまだダウンロードされていません",
	"locale.notDownloadedDesc":
		"翻訳をダウンロードできるまで、Callout Studioは英語で表示されます。次回Obsidianの起動時に再試行します。",
	"locale.retry": "再試行",
	"locale.diskWriteFailed":
		"Callout Studioは翻訳をディスクに保存できませんでした。次回、再度ダウンロードする必要があります。",
	"notice.exportedCssCreated": "CSSスニペットを{{path}}に保存しました",
	"notice.exportedCssUpdated": "CSSスニペットを{{path}}で更新しました",
	"notice.exportedCssUnchanged": "CSSスニペットはすでに最新です。",
	"notice.exportCssEmpty": "エクスポートするカスタムcalloutがありません。",
	"notice.exportCssFailed":
		"CSSスニペットを保存できませんでした。詳細は開発者コンソールを確認してください。",
	"notice.exportCssEnabled":
		"このスニペットはこのvaultで有効です。Callout Studioはすでにこれらのcalloutをスタイル設定しており、スニペットにはエクスポート時の状態が保存されています。",
	"confirm.titleOverwriteSnippet": "CSSスニペットを上書き",
	"confirm.overwriteSnippet":
		"snippetsフォルダのCSSスニペットは、Callout Studioが書き込んだ後に変更されています。再度エクスポートするとファイル全体が置き換えられます。",
	"confirm.overwriteSnippetOk": "上書き",
	"export.chooseFormat": "エクスポート形式",
	"export.formatJson": "Callout Studioバックアップ",
	"export.formatJsonDesc":
		"calloutと設定を含む.jsonファイル。他のvaultにインポートできます。",
	"export.formatCss": "CSSスニペット",
	"export.formatCssDesc":
		"このvaultのsnippetsフォルダに保存する.cssファイル。Callout Studioがインストールされていない場所で使用できます。通常のcalloutのみを対象とするスナップショットです。変更後に再度エクスポートしてください。",
};
