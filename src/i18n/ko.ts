export const ko: Record<string, string> = {
	"cmd.openSettings": "설정 열기",
	"cmd.createCallout": "새 callout 유형 만들기",
	"cmd.insertEmptyCallout": "빈 callout 삽입",
	"cmd.calloutWrap": "callout으로 감싸기",
	"cmd.calloutUnwrap": "callout 제거",

	"cmd.customWrapBlock": "{{name}} 블록 callout으로 감싸기",
	"cmd.customInsertBlock": "{{name}} 블록 callout 삽입",
	"cmd.customInsertHeading": "H{{level}} {{name}} 제목 callout 삽입",
	"cmd.customInsertInline": "{{name}} 인라인 callout 삽입",
	"cmd.openQuickInsert": "블록 callout 빠른 삽입",

	"autocomplete.createNew": '새 callout 만들기: "{{name}}"',

	"settings.fallbackTag": "기본값",
	"settings.fallbackTagAuto": "자동 기본값",
	"settings.rescanVault": "볼트 재스캔",
	"settings.rescanVaultDesc":
		"노트에서 인식되지 않는 callout ID를 찾아 폴백 행으로 추가합니다.",
	"settings.rescanVaultHintAction": "지금 스캔",
	"settings.rescanComplete":
		"재스캔 완료: {{count}}개의 새 callout이 추가되었습니다.",
	"replaceModal.deleteWithoutReplaceSuffix": "(기본값으로 폴백)",
	"replaceModal.titleDelete": "callout 삭제",
	"replaceModal.titleReplace": "볼트에서 교체",

	"firstRun.title": "볼트에서 기존 callout을 찾으시겠습니까?",
	"firstRun.body":
		"Callout Studio가 볼트를 스캔하여 이미 사용 중인 callout을 검색할 수 있습니다. 설정 목록에 표시되고 폴백 스타일을 적용합니다.",
	"firstRun.heavyVaultNote":
		"볼트에 {{count}}개의 Markdown 파일이 있습니다. 스캔에 몇 초가 걸릴 수 있습니다.",
	"firstRun.laterHint":
		"나중에 설정 → 볼트 인사이트 및 유지보수 → 볼트 재스캔에서 실행할 수 있습니다.",
	"firstRun.scanNow": "지금 스캔",
	"firstRun.noThanks": "아니오, 괜찮습니다",
	"firstRun.autoScanComplete":
		"Callout Studio가 볼트를 스캔하고 {{count}}개의 callout을 추가했습니다.",
	"firstRun.scanning": "스캔 중",

	"welcome.tooltip": "Callout Studio 소개",
	"welcome.title": "Callout Studio에 오신 것을 환영합니다",
	"welcome.tagline": "Obsidian callout 관리를 위한 완벽한 솔루션입니다.",
	"welcome.previewTitle": "실제 동작 보기",
	"welcome.sample":
		"Callout Studio를 사용하면 아이콘, 색상, 이름을 원하는 대로 지정한 callout을 만들 수 있습니다.\n\n" +
		"같은 callout을 **세 가지** 다른 방식으로 사용할 수 있습니다:\n\n" +
		"## [!tip] 제목으로 사용\n" +
		"제목을 callout 스타일로 바꾸려면 `#` 바로 뒤에 `[!type]`을 추가하세요.\n\n" +
		"이 [!warning]처럼 인라인 callout을 원하시나요? 문장 중간에 `[!type]`을 추가하기만 하면 흐름을 끊지 않고 삽입할 수 있습니다.\n\n" +
		"> [!note] Block Callout\n" +
		"> 물론 기존에 사용하던 것과 동일한 문법으로 클래식 callout도 그대로 사용할 수 있습니다: `> [!type]`.\n\n" +
		"Callout Studio에는 훨씬 더 많은 기능이 있습니다! [자세히 보기]({{repoUrl}}).\n",

	"deleteModal.title": 'callout "{{name}}"을(를) 삭제하시겠습니까?',
	"deleteModal.bodyInUse":
		"이 callout은 {{files}}개의 파일에서 {{count}}번 나타납니다.",
	"deleteModal.bodyInUseExplain":
		"삭제하면 해당 블록이 일반 텍스트로 변환됩니다. 스타일과 callout 헤더가 손실됩니다.",
	"deleteModal.replaceHint":
		"다른 callout으로 대체하면 볼트 내용을 스타일 있는 callout으로 유지할 수 있습니다.",
	"deleteModal.bodyUnused":
		'"{{name}}"은(는) 어떤 노트에서도 사용되지 않지만 사용자 정의 callout입니다. 삭제하면 이 목록에서 제거됩니다.',
	"deleteModal.replaceInstead": "대신 교체",
	"deleteModal.deleteInUse": "삭제 (일반 텍스트로 변환)",
	"deleteModal.deleteUnused": "callout 삭제",

	"settings.title": "Callout Studio",
	"settings.myCalloutTypes": "내 callout 유형",
	"settings.builtInCallouts": "기본 제공 callout",
	"settings.contextMenu": "컨텍스트 메뉴",
	"settings.autocomplete": "자동 완성",
	"settings.keyboardShortcuts": "키보드 단축키",
	"settings.language": "언어",
	"settings.languageDesc":
		"Callout Studio의 표시 언어입니다. 기본값은 Obsidian의 인터페이스 언어를 따릅니다.",
	"settings.languageAuto": "자동 (Obsidian과 동일)",
	"settings.importExport": "가져오기 / 내보내기",
	"settings.import": "가져오기",
	"settings.export": "내보내기",
	"settings.importDesc":
		"JSON 파일을 사용하여 다른 볼트에서 Callout Studio 데이터를 가져옵니다.",
	"settings.exportDesc":
		"모든 사용자 정의 callout 유형을 JSON 형식으로 저장합니다.",
	"settings.importConflictNotice":
		"{{count}}개의 callout 유형을 가져왔습니다. {{overwritten}}개의 기존 항목을 덮어썼습니다.",

	"settings.addNewCallout": "+ callout 추가",

	"settings.noCalloutsNow": "현재 사용자 정의 callout이 없습니다.",

	"settings.editAria": "{{name}} 편집",
	"settings.moreRowActionsAria": "{{name}}에 대한 추가 작업",
	"settings.usageInfo": "{{files}}개의 파일에서 {{count}}번 사용",
	"settings.replaceAction": "볼트에서 교체",
	"settings.deleteAction": "삭제",
	"settings.resetAction": "기본값으로 재설정",
	"settings.makeFallbackAction": "기본 폴백 스타일 사용",

	"settings.colorSwatchAria": "강조색: {{accent}} · 배경: {{bg}}",
	"settings.externalStyleTag": "외부 스타일",
	"settings.externalStyleAction": "외부 스타일 사용 (테마 또는 CSS)",
	"settings.externalStyleBlocked":
		"이것은 기본 대체 callout입니다. 먼저 다른 것을 선택하세요",
	"settings.fallbackCallout": "기본 폴백 callout",
	"settings.fallbackCalloutDesc":
		"볼트에서 인식되지 않는 callout 유형은 이 callout의 스타일을 상속합니다.",

	"settings.globalStyle": "전역 callout 스타일",
	"settings.border": "테두리",
	"settings.borderAll": "모두",
	"settings.borderTop": "위",
	"settings.borderRight": "오른쪽",
	"settings.borderBottom": "아래",
	"settings.borderLeft": "왼쪽",
	"settings.borderWidth": "테두리 두께",
	"settings.fontScaleGroup": "폰트 크기",
	"settings.titleScale": "제목",
	"settings.contentScale": "내용",
	"settings.inlineTextScale": "텍스트",
	"settings.shapeGroup": "모양",
	"settings.borderRadius": "모서리 둥글기",
	"settings.alignGroup": "정렬",
	"settings.alignContent": "제목에 맞게 내용 정렬",
	"settings.headingSpacingGroup": "제목 간격",
	"settings.headingPadVertical": "수직 간격",
	"settings.headingGap": "제목 사이 간격",
	"settings.headingFoldGroup": "접기",
	"settings.headingFoldArrow": "접기 화살표 표시",
	"settings.styleDemoName": "예시",
	"settings.previewTitle": "미리 보기",

	// Settings — Saved color palettes
	"settings.customPalettes": "저장된 색상 팔레트",
	"settings.newPalette": "새 팔레트",
	"settings.customPalettesEmpty": "현재 저장된 팔레트가 없습니다.",
	"settings.editPaletteAria": "팔레트 {{name}} 편집",
	"settings.deletePaletteAria": "팔레트 {{name}} 삭제",
	"settings.deletePaletteConfirm":
		'팔레트 "{{name}}"을(를) 삭제하시겠습니까?\n이 색상을 사용하는 callout은 영향을 받지 않습니다.',
	"settings.enableAutocomplete": "[! 자동 완성 활성화",
	"settings.enableAutocompleteDesc":
		'편집기의 인용 블록에서 "[!"를 입력하면 제안을 표시합니다. 목록에서 callout 유형을 선택하여 완전한 callout 헤더를 삽입합니다.',

	"settings.customCommands": "명령 및 단축키",
	"settings.customCommandsDesc":
		"모든 Callout Studio 명령어와 여기에 지정된 단축키를 확인하고, 자주 사용하는 callout을 위해 직접 명령어를 만들어 보세요. 기본적으로 지정된 단축키는 없습니다.",
	"settings.customCommandsButton": "명령어 관리",

	"commandBuilder.title": "명령 및 단축키",
	"commandBuilder.desc":
		"+ 버튼을 사용하여 Obsidian 단축키 설정에서 단축키를 지정하거나 변경하세요.",
	"commandBuilder.builtIn": "기본 제공 명령어",
	"commandBuilder.toggleAria": "{{name}} 켜기/끄기",
	"commandBuilder.hotkeyBlank": "비어 있음",
	"commandBuilder.hotkeyAria": "{{name}}의 단축키 설정",
	"commandBuilder.yourCommands": "내 명령어",
	"commandBuilder.newCommand": "새 명령어",
	"commandBuilder.empty": "아직 사용자 정의 명령어가 없습니다.",
	"commandBuilder.unknownCommand": "이 명령어",
	"commandBuilder.editAria": "{{name}} 편집",
	"commandBuilder.deleteAria": "{{name}} 삭제",
	"commandBuilder.deleteConfirm":
		"명령어 {{name}}을(를) 삭제하시겠습니까? 여기에 지정된 단축키는 더 이상 작동하지 않습니다.",
	"commandBuilder.newTitle": "새 명령어",
	"commandBuilder.editTitle": "명령어 편집",
	"commandBuilder.format": "callout 형식",
	"commandBuilder.formatDesc": "명령어가 작성하는 callout의 종류입니다.",
	"commandBuilder.formatHeading": "제목",
	"commandBuilder.formatInline": "인라인",
	"commandBuilder.formatBlock": "Block",
	"commandBuilder.roleDisabled":
		"이 형식은 꺼져 있어서, 다시 켜기 전까지 명령어는 일반 텍스트를 삽입합니다.",
	"commandBuilder.callout": "callout 유형",
	"commandBuilder.calloutDesc": "이 명령어가 삽입하는 callout입니다.",
	"commandBuilder.headingLevel": "제목 수준",
	"commandBuilder.headingLevelDesc": "작성할 제목 수준입니다.",
	"commandBuilder.action": "작업",
	"commandBuilder.actionDesc":
		"감싸기는 선택 영역을 callout으로 바꾸고, 삽입은 빈 callout을 추가합니다.",
	"commandBuilder.actionWrap": "선택 영역 감싸기",
	"commandBuilder.actionInsert": "새로 삽입",
	"commandBuilder.preview": "명령어 이름",
	"commandBuilder.duplicate": "이미 똑같은 작업을 하는 명령어가 있습니다.",
	"commandBuilder.noCallouts":
		"아직 명령어를 만들 수 있는 callout 유형이 없습니다.",
	"commandBuilder.save": "저장",

	"settings.vaultMaintenance": "볼트 인사이트 및 유지보수",
	"settings.vaultStats": "Callout 통계",
	"settings.vaultStatsDesc":
		"Markdown 노트의 모든 callout(블록, 헤딩, 인라인)을 계산하고 유형별로 그룹화합니다.",
	"settings.vaultStatsButton": "통계 보기",
	"settings.vaultStatsScanning": "스캔 중",
	"settings.resetAll": "재설정",
	"settings.resetAllDesc":
		"모든 사용자 callout을 삭제하고, 기본 제공 callout, 전역 스타일 (테두리, 폰트 크기, 모양), 저장된 색상 팔레트, 마우스 오른쪽 버튼 메뉴 사용자 지정 및 다운로드된 Material SVG를 재설정합니다.",
	"settings.resetAllButton": "모두 재설정",
	"settings.resetAllConfirm":
		"모든 사용자 정의 callout이 삭제되고 기본 제공 callout, 전역 스타일, 저장된 색상 팔레트, 마우스 오른쪽 버튼 메뉴 사용자 지정, 캐시된 Material SVG가 재설정됩니다. 이 작업은 취소할 수 없습니다. 계속하시겠습니까?",
	"notice.resetAllDone": "모든 항목이 기본값으로 재설정되었습니다.",

	"notice.customCommandsRemoved":
		"callout 유형이 더 이상 존재하지 않는 사용자 정의 명령어 {{count}}개를 제거했습니다.",
	"notice.customCommandMissingCallout":
		"해당 명령어의 callout 유형이 더 이상 존재하지 않습니다.",

	"notice.exported": "callout을 callout-studio-export.json으로 내보냈습니다",
	"notice.importedJSON":
		"JSON에서 {{count}}개의 callout 유형을 가져왔습니다.",
	"notice.importedSettings": "플러그인 설정을 가져왔습니다.",
	"notice.importedCalloutManager":
		"Callout Manager에서 가져왔습니다: {{created}}개 생성됨, {{updated}}개 업데이트됨.",
	"notice.importedAdmonition":
		"Admonition에서 가져왔습니다: {{created}}개 생성, {{updated}}개 업데이트.",
	"notice.noNewJSON":
		"새로운 callout 유형을 가져오지 못했습니다 (ID가 이미 존재할 수 있습니다).",
	"notice.iconDownloadFailed":
		'Material 아이콘 "{{name}}"을(를) 다운로드할 수 없습니다. 이 스타일/굵기에서 사용할 수 없거나 연결이 오프라인 상태일 수 있습니다.',
	"notice.externalStyleOn":
		'"{{name}}"은(는) 이제 테마 또는 CSS 스니펫에 의해 스타일이 지정됩니다.',
	"notice.externalStyleOff":
		'Callout Studio가 다시 "{{name}}"의 스타일을 지정합니다.',
	"notice.nothingToWrap": "감쌀 내용이 없습니다.",
	"notice.cursorNotInsideCallout": "커서가 callout 안에 있지 않습니다.",
	"notice.autocompleteTargetMoved":
		"아무것도 삽입되지 않았습니다 — 편집기가 열려 있는 동안 줄이 변경되었습니다.",
	"notice.openHotkeysFailed": "Obsidian 단축키 설정을 열 수 없습니다.",
	"notice.filterHotkeysFailed":
		"Obsidian 단축키를 열었지만 Callout Studio 필터를 적용할 수 없습니다.",

	"editor.editCallout": "callout 편집",
	"editor.newCallout": "새 callout",
	"editor.displayName": "표시 이름",
	"editor.displayNameDesc": "UI에 표시되는 읽기 가능한 레이블",
	"editor.displayNameBuiltIn":
		"기본 제공 callout의 표시 이름은 변경할 수 없습니다",
	"editor.displayNamePlaceholder": "내 callout",
	"editor.calloutIds": "Callout ID",
	"editor.calloutIdsDesc":
		"이 callout의 모든 식별자. 공백을 사용할 수 있습니다.\nEnter 또는 + 버튼을 눌러 추가합니다.",
	"editor.calloutIdsPlaceholder": "ID 추가",
	"editor.addId": "ID 추가",
	"editor.idLinkedToName": "표시 이름에 연결됨",
	"editor.idCannotDelete":
		"이 ID는 표시 이름에 연결되어 있어 삭제할 수 없습니다 — 이름을 편집하여 변경하세요",
	"editor.icon": "아이콘",
	"editor.pickIcon": "아이콘 변경",
	"editor.replaceIcon": "아이콘 교체",
	"editor.removeIcon": "아이콘 제거",
	"editor.noIcon": "아이콘 없음",
	"editor.resetIcon": "아이콘을 기본값으로 재설정",
	"editor.livePreview": "라이브 미리 보기",
	"editor.iconAdjustment": "아이콘 조정",
	"editor.picture": "이미지",
	"editor.size": "크기",
	"editor.horizontalOffset": "수평 오프셋",
	"editor.verticalOffset": "수직 오프셋",
	"editor.colors": "색상",
	"editor.colorsDesc":
		"Sets this callout's border, background, and text colors.",
	"editor.resetColors": "색상을 기본값으로 재설정",
	"editor.paletteDeleted": "삭제된 색상",
	"editor.paletteGroupObsidian": "Obsidian callout",
	"editor.paletteGroupPresets": "색상 사전 설정",
	"editor.paletteGroupCustom": "사용자 지정",
	"editor.paletteNewColor": "새 색상…",
	"editor.contrastWarning":
		"배경과의 대비가 낮습니다 — 읽기 어려울 수 있습니다",
	"editor.foldable": "접을 수 있음",
	"editor.foldableDesc":
		"callout을 접을 수 있는지와 볼트 전체에 적용할 기본 상태를 선택합니다.",
	"editor.foldOff": "끄기",
	"editor.foldOpen": "기본적으로 열기",
	"editor.foldClosed": "기본적으로 닫기",
	"editor.cancel": "취소",
	"editor.saveChanges": "변경 사항 저장",
	"editor.createCallout": "callout 만들기",
	"editor.nameRequired": "callout을 만들기 전에 표시 이름이 필요합니다.",
	"editor.noChangesToSave": "변경 사항이 없습니다.",
	"editor.downloadingIcon": "아이콘 다운로드 중",
	"editor.idEmpty": "최소 하나의 ID가 필요합니다",
	"editor.idExists": "이 ID를 가진 callout이 이미 존재합니다",
	"editor.idConflict": "이 ID는 기존 callout과 충돌합니다",
	"editor.idDashConflict":
		'Obsidian은 공백을 대시로 저장하므로 이 ID는 "{{other}}"와(과) 충돌합니다',
	"editor.untitledCallout": "제목 없는 Callout",
	"editor.loremIpsum":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"editor.loremIpsumShort":
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"editor.sampleInlineText": "다음은 단락 안에 있는 인라인 [!{id}] 필입니다.",
	"editor.previewReadOnly": "실시간 미리보기는 편집할 수 없습니다",

	// External style window (opens instead of the editor for a callout the
	// user handed to their theme / a CSS snippet)
	"editor.externalStyleTitle": "Callout Studio 외부에서 스타일 지정됨",
	"editor.externalStyleBody":
		"Callout Studio는 {{id}}에 스타일을 적용하지 않습니다. 모양은 테마, CSS 스니펫 또는 Obsidian의 기본값에서 나옵니다.",
	"editor.externalStyleWhat": "이것이 의미하는 것",
	"editor.externalStyleWhatHeading":
		"## [!{{id}}] 제목과 같은 헤딩 callout은 렌더링되지 않습니다 — 텍스트는 작성된 그대로 유지됩니다.",
	"editor.externalStyleWhatInline":
		"인라인 callout도 마찬가지입니다, 예: 단어 [!{{id}}] 단어.",
	"editor.externalStyleWhatGlobal":
		"전역 스타일 설정(테두리, 반경, 텍스트 크기)이 적용되지 않습니다.",
	"editor.externalStylePreviewTitle": "현재 렌더링 방식",
	"editor.externalStyleSample":
		"## [!{{id}}] 제목\n\n" +
		"[!{{id}}]이(가) 포함된 문장은 이렇게 보입니다.\n\n" +
		"> [!{{id}}] {{name}}\n" +
		"> callout 내용은 이렇게 보입니다.\n",
	"editor.externalStyleResume": "스타일 되찾기",
	"editor.externalStyleClose": "확인",

	// Palette editor modal
	"palette.newTitle": "새 색상 팔레트",
	"palette.groupPalette": "팔레트",
	"palette.editTitle": "색상 팔레트 편집",
	"palette.name": "이름",
	"palette.namePlaceholder": "내 팔레트",
	"palette.nameExists": "이 이름의 팔레트가 이미 있습니다",
	"palette.baseColor": "기본 색상",
	"palette.baseColorHint":
		"배경색을 자동으로 이 색상에 맞춥니다. 원하시면 {{link}}하여 별도로 설정할 수 있습니다.",
	"palette.baseColorHintLink": "여기를 클릭",
	"palette.advancedColors": "색상",
	"palette.advancedColorsHint":
		"{{mode}} 모드의 색상을 편집 중입니다 - 다른 모드는 자동으로 업데이트됩니다. 확인하려면 Obsidian 테마를 전환하세요.",
	"palette.revertHint": "대신 단일 기본 색상을 사용하시겠습니까? {{link}}.",
	"palette.revertHintLink": "되돌리기",
	"palette.lightMode": "라이트",
	"palette.darkMode": "다크",
	"palette.accentColor": "강조 색상",
	"palette.backgroundColorChannel": "배경 색상",
	"palette.textColorChannel": "텍스트 색상",
	"palette.bgIntensity": "강도",
	"palette.bgStyle": "스타일",
	"palette.bgSolid": "단색",
	"palette.bgGradient": "그라데이션",
	"palette.bgTransparent": "투명",
	"palette.gradientTo": "두 번째 색상",
	"palette.gradientDirection": "방향",
	"palette.gradientText": "그라데이션 제목 텍스트",
	"palette.save": "저장",

	// Color name suggestions (used to prefill palette names)
	"colorName.red": "빨강",
	"colorName.orange": "주황",
	"colorName.amber": "호박색",
	"colorName.yellow": "노랑",
	"colorName.lime": "라임",
	"colorName.green": "초록",
	"colorName.teal": "틸",
	"colorName.cyan": "시안",
	"colorName.sky": "하늘색",
	"colorName.blue": "파랑",
	"colorName.indigo": "인디고",
	"colorName.violet": "바이올렛",
	"colorName.purple": "보라",
	"colorName.pink": "분홍",
	"colorName.rose": "로즈",
	"colorName.brown": "갈색",
	"colorName.gray": "회색",
	"colorName.black": "검정",
	"colorName.white": "흰색",
	"colorName.crimson": "진홍색",
	"colorName.coral": "산호색",
	"colorName.grape": "포도색",
	"colorName.plum": "자두색",
	"colorName.bubblegum": "풍선껌",

	"iconPicker.pickIcon": "아이콘 선택",
	"iconPicker.confirm": "확인",
	"iconPicker.cancel": "취소",
	"iconPicker.lucide": "Lucide",
	"iconPicker.tabler": "Tabler Icons",
	"iconPicker.material": "Material",
	"iconPicker.emoji": "Emoji",
	"iconPicker.searchLucide": "Lucide 아이콘 검색",
	"iconPicker.searchTabler": "Tabler 아이콘 검색",
	"iconPicker.tablerStyle": "아이콘 스타일",
	"iconPicker.tablerStyleOutline": "아웃라인 (Outline)",
	"iconPicker.tablerStyleFilled": "채워진 (Filled)",
	"iconPicker.loadMore": "더 불러오기",
	"iconPicker.materialStyle": "아이콘 스타일",
	"iconPicker.materialStyleOutlined": "아웃라인 (Outlined)",
	"iconPicker.materialStyleFilled": "채워진 (Filled)",
	"iconPicker.materialStyleRounded": "둥근 (Rounded)",
	"iconPicker.materialStyleSharp": "날카로운 (Sharp)",
	"iconPicker.materialWeight": "아이콘 두께",
	"iconPicker.materialWeight100": "얇게 (Thin)",
	"iconPicker.materialWeight200": "매우 가볍게 (Extra Light)",
	"iconPicker.materialWeight300": "가볍게 (Light)",
	"iconPicker.materialWeight400": "보통 (Regular)",
	"iconPicker.materialWeight500": "중간 (Medium)",
	"iconPicker.materialWeight600": "세미 볼드 (Semi Bold)",
	"iconPicker.materialWeight700": "볼드 (Bold)",
	"iconPicker.materialFontFailed":
		"Material 아이콘 미리보기를 불러올 수 없습니다. 대신 아이콘 이름이 표시됩니다. 검색과 선택은 계속 작동합니다.",
	"iconPicker.materialFontRetry": "다시 시도",
	"iconPicker.searchMaterial": "Material 아이콘 검색",
	"iconPicker.searchEmoji": "이모지 검색",
	"iconPicker.skinTone": "피부 톤",
	"iconPicker.allCategories": "모든 카테고리",
	"iconPicker.noIconSelected": "선택된 아이콘 없음",
	"iconPicker.noResults": "검색과 일치하는 아이콘이 없습니다.",
	"iconPicker.octicons": "Octicons",
	"iconPicker.searchOcticons": "Octicons 검색",
	"iconPicker.fa": "Font Awesome",
	"iconPicker.searchFa": "Font Awesome 검색",
	"iconPicker.faStyle": "아이콘 스타일",
	"iconPicker.faStyleSolid": "솔리드 (Solid)",
	"iconPicker.faStyleRegular": "레귤러 (Regular)",
	"iconPicker.faStyleBrands": "브랜드 (Brands)",
	"iconPicker.rpgAwesome": "RPG Awesome",
	"iconPicker.searchRpgAwesome": "RPG Awesome 검색",
	"iconPicker.image": "내 이미지",
	"iconPicker.searchImage": "이미지 검색",
	"iconPicker.imageTooLarge":
		"{{name}}이(가) 너무 큽니다. 이미지는 5MB 미만이어야 합니다.",
	"iconPicker.imageUnsupported":
		"{{name}}은(는) 지원되지 않는 이미지 형식입니다. SVG, PNG, JPEG 또는 WebP를 사용하세요.",
	"iconPicker.imageInvalidSvg":
		"{{name}}을(를) 안전한 SVG로 읽을 수 없어 추가되지 않았습니다.",
	"iconPicker.imageDecodeFailed": "{{name}}을(를) 이미지로 읽을 수 없습니다.",
	"iconPicker.imageDuplicate":
		"{{name}}이(가) 이미 이미지에 있습니다. 파일 이름을 변경하거나 기존 이미지를 삭제하세요.",
	"iconPicker.imageAdd": "이미지 추가",
	"iconPicker.imageEmpty":
		"아직 이미지가 없습니다. 컴퓨터에서 SVG, PNG, JPEG 또는 WebP 파일을 추가하거나 여기에 끌어다 놓으세요.",
	"iconPicker.imageDelete": "삭제",
	"iconPicker.imageDeleteConfirm": "“{{name}}” 삭제하시겠습니까?",
	"iconPicker.imageDeleteInUse":
		"{{count}}개의 callout이 이 이미지를 사용합니다. 새 이미지를 지정할 때까지 자리 표시자 아이콘이 표시됩니다.",
	"iconPicker.imageRecolor": "Callout 색상 따르기",
	"iconPicker.allSources": "모든 소스",
	"iconPicker.searchAllSources": "모든 아이콘 소스 검색",
	"iconPicker.sourcesNotDownloaded":
		"아직 포함되지 않음: {{names}}. 위에서 소스를 선택하여 다운로드하세요.",
	"iconPicker.chooseSource": "소스 선택",
	"iconPicker.sourceGroup": "{{name}} · {{count}}",

	// Source menu — what each library holds, in a few words
	"iconPicker.descAllSources": "모든 라이브러리를 한 번에 검색",
	"iconPicker.descLucide": "Obsidian 자체 세트, 항상 오프라인",
	"iconPicker.descTabler":
		"깔끔하고 일관된 UI 아이콘, 아웃라인과 채워진 스타일",
	"iconPicker.descMaterial": "Google 세트, 네 가지 스타일과 일곱 가지 두께",
	"iconPicker.descEmoji": "컬러 글리프, 모든 피부 톤",
	"iconPicker.descOcticons": "GitHub 인터페이스 아이콘",
	"iconPicker.descFa": "솔리드, 레귤러 및 브랜드",
	"iconPicker.descRpgAwesome": "판타지 및 테이블탑 아이콘",
	"iconPicker.descImage": "컴퓨터에서 추가한 이미지",

	// Icon picker — category filter dropdown labels
	"iconPicker.cat.Accessibility": "접근성",
	"iconPicker.cat.Actions": "동작",
	"iconPicker.cat.Activities": "활동",
	"iconPicker.cat.Alert": "알림",
	"iconPicker.cat.Alphabet": "알파벳",
	"iconPicker.cat.Android": "Android",
	"iconPicker.cat.Animals": "동물",
	"iconPicker.cat.Arrows": "화살표",
	"iconPicker.cat.Astronomy": "천문학",
	"iconPicker.cat.Audio&Video": "오디오 및 비디오",
	"iconPicker.cat.Automotive": "자동차",
	"iconPicker.cat.Badges": "배지",
	"iconPicker.cat.Brand": "브랜드",
	"iconPicker.cat.Buildings": "건물",
	"iconPicker.cat.Business": "비즈니스",
	"iconPicker.cat.Camping": "캠핑",
	"iconPicker.cat.Charity": "자선",
	"iconPicker.cat.Charts": "차트",
	"iconPicker.cat.Charts + Diagrams": "차트 및 다이어그램",
	"iconPicker.cat.Childhood": "어린 시절",
	"iconPicker.cat.Clothing + Fashion": "의류 및 패션",
	"iconPicker.cat.Coding": "프로그래밍",
	"iconPicker.cat.Communicate": "소통",
	"iconPicker.cat.Communication": "통신",
	"iconPicker.cat.Computers": "컴퓨터",
	"iconPicker.cat.Connectivity": "연결",
	"iconPicker.cat.Construction": "건설",
	"iconPicker.cat.Currencies": "통화",
	"iconPicker.cat.Database": "데이터베이스",
	"iconPicker.cat.Design": "디자인",
	"iconPicker.cat.Development": "개발",
	"iconPicker.cat.Devices": "기기",
	"iconPicker.cat.Devices + Hardware": "기기 및 하드웨어",
	"iconPicker.cat.Disaster + Crisis": "재난 및 위기",
	"iconPicker.cat.Document": "문서",
	"iconPicker.cat.E-commerce": "전자상거래",
	"iconPicker.cat.Editing": "편집",
	"iconPicker.cat.Education": "교육",
	"iconPicker.cat.Electrical": "전기",
	"iconPicker.cat.Emoji": "이모지",
	"iconPicker.cat.Energy": "에너지",
	"iconPicker.cat.Extensions": "확장",
	"iconPicker.cat.Files": "파일",
	"iconPicker.cat.Film + Video": "영화 및 비디오",
	"iconPicker.cat.Food": "음식",
	"iconPicker.cat.Food + Beverage": "음식 및 음료",
	"iconPicker.cat.Fruits + Vegetables": "과일 및 채소",
	"iconPicker.cat.Games": "게임",
	"iconPicker.cat.Gaming": "게이밍",
	"iconPicker.cat.Gender": "성별",
	"iconPicker.cat.Genders": "성별",
	"iconPicker.cat.Gestures": "제스처",
	"iconPicker.cat.Halloween": "할로윈",
	"iconPicker.cat.Hands": "손",
	"iconPicker.cat.Hardware": "하드웨어",
	"iconPicker.cat.Health": "건강",
	"iconPicker.cat.Holidays": "휴일",
	"iconPicker.cat.Home": "홈",
	"iconPicker.cat.Household": "가정",
	"iconPicker.cat.Humanitarian": "인도주의",
	"iconPicker.cat.Images": "이미지",
	"iconPicker.cat.Laundry": "세탁",
	"iconPicker.cat.Letters": "문자",
	"iconPicker.cat.Logic": "논리",
	"iconPicker.cat.Logistics": "물류",
	"iconPicker.cat.Map": "지도",
	"iconPicker.cat.Maps": "지도",
	"iconPicker.cat.Maritime": "해양",
	"iconPicker.cat.Marketing": "마케팅",
	"iconPicker.cat.Math": "수학",
	"iconPicker.cat.Mathematics": "수학",
	"iconPicker.cat.Media": "미디어",
	"iconPicker.cat.Media Playback": "미디어 재생",
	"iconPicker.cat.Medical + Health": "의료 및 건강",
	"iconPicker.cat.Money": "돈",
	"iconPicker.cat.Mood": "기분",
	"iconPicker.cat.Moving": "이사",
	"iconPicker.cat.Music + Audio": "음악 및 오디오",
	"iconPicker.cat.Nature": "자연",
	"iconPicker.cat.Numbers": "숫자",
	"iconPicker.cat.Photography": "사진",
	"iconPicker.cat.Photos + Images": "사진 및 이미지",
	"iconPicker.cat.Political": "정치",
	"iconPicker.cat.Privacy": "개인정보",
	"iconPicker.cat.Punctuation + Symbols": "구두점 및 기호",
	"iconPicker.cat.Religion": "종교",
	"iconPicker.cat.Science": "과학",
	"iconPicker.cat.Science Fiction": "SF",
	"iconPicker.cat.Security": "보안",
	"iconPicker.cat.Shapes": "도형",
	"iconPicker.cat.Shopping": "쇼핑",
	"iconPicker.cat.Social": "소셜",
	"iconPicker.cat.Spinners": "스피너",
	"iconPicker.cat.Sport": "스포츠",
	"iconPicker.cat.Sports + Fitness": "스포츠 및 피트니스",
	"iconPicker.cat.Symbols": "기호",
	"iconPicker.cat.System": "시스템",
	"iconPicker.cat.Text": "텍스트",
	"iconPicker.cat.Text Formatting": "텍스트 서식",
	"iconPicker.cat.Time": "시간",
	"iconPicker.cat.Toggle": "토글",
	"iconPicker.cat.Transit": "교통",
	"iconPicker.cat.Transportation": "운송",
	"iconPicker.cat.Travel": "여행",
	"iconPicker.cat.Travel + Hotel": "여행 및 호텔",
	"iconPicker.cat.UI actions": "UI 동작",
	"iconPicker.cat.Users + People": "사용자 및 사람",
	"iconPicker.cat.Vehicles": "차량",
	"iconPicker.cat.Version control": "버전 관리",
	"iconPicker.cat.Weather": "날씨",
	"iconPicker.cat.Writing": "글쓰기",
	"iconPicker.cat.Zodiac": "별자리",

	// Downloadable icon packs
	"iconPack.downloadTitle": "{{name}} 아직 다운로드되지 않음",
	"iconPack.downloadDetail": "{{count}}개 아이콘 · {{size}} · 1회 다운로드",
	"iconPack.download": "다운로드",
	"iconPack.downloading": "{{name}} 다운로드 중…",
	"iconPack.downloadFailed":
		"{{name}}을(를) 다운로드할 수 없습니다. 연결을 확인하고 다시 시도하세요.",
	"iconPack.retry": "재시도",
	"iconPack.faBrandsNotice":
		"브랜드 아이콘은 각 소유자의 상표입니다. 포함되었다고 해서 지지를 의미하지 않습니다. 해당 회사, 제품 또는 서비스를 나타내기 위해서만 사용하세요.",
	"iconPack.artworkRestored":
		"{{names}}의 아이콘 아트워크를 다운로드했습니다.",
	"iconPack.diskWriteFailed":
		"Callout Studio가 아이콘 팩을 디스크에 저장할 수 없어 다음에 다시 다운로드해야 합니다. 선택한 아이콘은 설정에 저장되어 있습니다.",

	// Icon licences & credits
	"credits.title": "아이콘 라이선스 및 크레딧",
	"credits.intro":
		"Callout Studio는 여러 오픈 아이콘 라이브러리를 사용합니다. 라이선스는 아래에 재현되어 있으며, 여기서 사용하기 위해 변경된 내용도 포함되어 있습니다.",
	"credits.fullNotices": "전체 서드파티 고지사항",
	"credits.pluginLicense":
		"Callout Studio 자체 코드는 permissive 라이선스입니다. 아이콘 라이브러리는 각자의 라이선스를 유지합니다.",

	"contextMenu.editCallout": "callout 설정 편집",
	"contextMenu.copyMarkdown": "callout Markdown 복사",
	"contextMenu.openSettings": "Callout Studio 설정 열기",
	"contextMenu.setFoldClosed": "callout 닫힘(-)으로 설정",
	"contextMenu.setFoldOpen": "callout 열림(+)으로 설정",
	"contextMenu.setFoldNone": "callout을 접을 수 없게 설정",
	"contextMenu.cutSection": "제목 섹션 잘라내기",
	"contextMenu.copySection": "제목 섹션 복사",
	"contextMenu.deleteSection": "제목 섹션 삭제",

	"heading.toggleFold": "접기 전환",

	"settings.globalSettings": "전역 설정",
	"settings.globalSettingsRegularDesc":
		"인용 블록에 callout 토큰을 추가하면(예: `> [!type]`) Obsidian 기본 callout 상자로 표시됩니다. 테두리, 반지름, 폰트 크기, 정렬을 조정할 수 있습니다.",
	"settings.globalSettingsHeadingDesc":
		"제목의 # 기호 바로 뒤에 callout 토큰을 추가하면(예: `## [!type]`) 스타일이 적용된 제목 callout으로 표시됩니다. 테두리, 모양, 수직 간격을 조정할 수 있습니다.",
	"settings.globalSettingsInlineDesc":
		"텍스트 줄 안 어디든 callout 토큰을 추가하면(예: `[!type]`) 작은 인라인 필로 표시됩니다. 테두리와 모양을 조정할 수 있습니다.",
	"settings.globalSettingsCustomize": "사용자 지정",

	"settings.calloutTypeRegular": "Block Callout",
	"settings.calloutTypeHeading": "제목 callout",
	"settings.calloutTypeInline": "인라인 callout",

	"settings.customizeMenu": "메뉴 항목 사용자 지정",
	"settings.customizeMenuDesc":
		"각 callout 유형에 표시할 마우스 오른쪽 버튼 작업을 선택하고 순서를 변경합니다. 소스 모드, 라이브 미리 보기에서 작동합니다.",
	"settings.customizeMenuButton": "메뉴 항목 사용자 지정",
	"menuCustomize.title": "마우스 오른쪽 버튼 메뉴 사용자 지정",
	"menuCustomize.desc":
		"작업을 켜거나 끄고 핸들을 드래그하여 순서를 변경합니다. 변경 사항은 자동으로 저장됩니다.",
	"menuCustomize.regular": "Block Callout",
	"menuCustomize.heading": "제목 callout",
	"menuCustomize.inline": "인라인 callout",
	"menuCustomize.dragHandle": "드래그하여 순서 변경",
	"menuItem.edit": "callout 편집",
	"menuItem.openSettings": "설정 열기",
	"menuItem.copyMarkdown": "Markdown 복사",
	"menuItem.foldDefaults": "접기 기본값 (열기 / 닫기 / 없음)",
	"menuItem.cutSection": "섹션 잘라내기",
	"menuItem.copySection": "섹션 복사",
	"menuItem.deleteSection": "섹션 삭제",

	"confirm.ok": "삭제",
	"confirm.cancel": "취소",
	// Headings for each confirmation — every window carries one, so each
	// caller of ConfirmModal names what it is about to do.
	"confirm.titleDeleteCommand": "명령 삭제",
	"confirm.titleResetAll": "모든 callout 재설정",
	"confirm.titleResetCallout": "callout 재설정",
	"confirm.titleDeletePalette": "팔레트 삭제",
	"confirm.titleDeleteImage": "이미지 삭제",

	"vault.filesUpdated":
		"볼트 파일에서 {{count}}개의 callout 참조를 업데이트했습니다.",
	"vault.idsUpdated":
		"볼트 파일에서 {{count}}개의 callout ID를 업데이트했습니다: {{oldIds}} → {{newId}}",
	"vault.titlesUpdated":
		"볼트 파일에서 {{count}}개의 callout 제목을 업데이트했습니다: {{oldTitle}} → {{newTitle}}",
	"vault.replaceWith": "다음으로 교체:",
	"vault.deleteWithout": "교체 없이 삭제",
	"vault.confirmDelete": "확인",
	"vault.confirmReplace": "교체",
	"vault.replacePromptInUse":
		'"{{name}}"은(는) {{files}}개의 파일에서 {{count}}번 사용됩니다. 교체할 callout을 선택하세요:',
	"vault.replacePromptUnused":
		'"{{name}}"을(를) 교체할 callout을 선택하세요:',
	"vault.noReplacementAvailable": "이것을 교체할 다른 callout이 없습니다.",
	"vault.convertedToPlainText":
		"{{files}}개의 파일에서 {{blocks}}개의 callout 블록을 일반 텍스트로 변환했습니다.",
	"vault.resetAliasWarning":
		"{{files}}개의 파일에서 {{count}}개의 참조가 사용자 정의 별칭을 사용합니다: {{aliases}}. 재설정 후 작동하지 않습니다. 계속하시겠습니까?",
	"vault.resetConfirm": "재설정",
	"vault.resetAllInUse":
		"⚠ {{files}}개의 파일에서 {{count}}개의 callout 참조가 삭제될 사용자 정의 callout 유형을 사용합니다.",

	"quickInsert.title": "블록 callout 빠른 삽입",
	"quickInsert.desc": "커서 위치에 삽입할 callout을 선택하세요. 블록 callout만 해당됩니다.",
	"quickInsert.searchPlaceholder": "callout 검색",
	"quickInsert.sourceAria": "callout 출처로 필터링",
	"quickInsert.sourceAll": "전체",
	"quickInsert.sourceBuiltIn": "기본 제공",
	"quickInsert.sourceUser": "내 callout",
	"quickInsert.editAria": "{{name}} 편집",
	"quickInsert.insertAria": "{{name}}을(를) 블록 callout으로 삽입",
	"quickInsert.noResults": "callout을 찾을 수 없습니다",
	"quickInsert.noUserCallouts": "아직 만든 callout이 없습니다.",
	"quickInsert.noEditorHint": "편집 모드로 열린 노트가 없어 아무것도 삽입할 수 없습니다.",
	"quickInsert.noEditor": "callout을 삽입하려면 노트를 편집 모드로 여세요.",

	"vaultStats.title": "Callout 통계",
	"vaultStats.totalCallouts": "총 callout",
	"vaultStats.typesFound": "발견된 유형",
	"vaultStats.filesWithCallouts": "callout이 있는 파일",
	"vaultStats.filesScanned": "스캔된 Markdown 파일",
	"vaultStats.empty": "Markdown 노트에서 callout을 찾지 못했습니다.",
	"vaultStats.columnType": "유형",
	"vaultStats.columnName": "이름",
	"vaultStats.columnSource": "소스",
	"vaultStats.columnCount": "수",
	"vaultStats.columnFiles": "파일",
	"vaultStats.unknown": "알 수 없음",
	"vaultStats.sourceBuiltIn": "기본 제공",
	"vaultStats.sourceCustom": "사용자 정의",
	"vaultStats.sourceAutoFallback": "자동 폴백",
	"vaultStats.sourceTheme": "CSS 스니펫",
	"vaultStats.sourceAlias": "{{id}}의 별칭",
	"vaultStats.sourceUnknown": "알 수 없음",
	"vaultStats.byRole": "작성 형식",
	"vaultStats.roleBlock": "블록",
	"vaultStats.roleHeading": "제목",
	"vaultStats.roleInline": "인라인",
	"vaultStats.defineUndefined": "누락된 {{count}}개 정의",
	"vaultStats.defineRunning": "스캔 중",
	"vaultStats.defineDone": "callout 유형 {{count}}개를 추가했습니다.",
	"vaultStats.close": "닫기",

	"import.title": "가져오기 문제",
	"import.reportLeadIn": "가져온 파일이 수정된 것 같습니다. 문제 목록입니다:",
	"import.reportLeadInFatal":
		"이 파일은 Callout Studio 내보내기 파일이 아닌 것 같습니다. 가져올 수 없습니다:",
	"import.entryHeading": "항목 {{index}} — {{label}}",
	"import.summary":
		"{{total}}개 중 {{valid}}개 항목이 유효합니다 · {{issues}}개의 문제가 발견되었습니다.",
	"import.btnCancel": "취소",
	"import.btnImportValid": "유효한 항목만 가져오기 ({{count}}개)",
	"import.err.notRecognized":
		"인식할 수 없는 파일: callout 정의 배열 또는 Callout Studio 내보내기가 필요합니다.",
	"import.warn.settingsIgnored":
		"설정 블록이 유효한 객체가 아니어서 무시되었습니다.",
	"import.warn.invalidGradient":
		"배경 그라데이션이 유효하지 않아 무시되었습니다.",
	"import.err.parseFailed":
		"파일이 유효한 JSON이 아니므로 파싱할 수 없습니다.",
	"import.err.entryNotObject": "항목은 객체여야 합니다.",
	"import.err.requiredMissing":
		'필수 필드 "{{field}}"이(가) 없거나 잘못된 유형입니다.',
	"import.err.idEmpty": "ID는 비어 있으면 안 됩니다.",
	"import.err.idTooLong":
		'ID "{{value}}"는 {{length}}자입니다. 최대 {{max}}자입니다.',
	"import.err.idBadChar":
		'ID "{{value}}"에 유효하지 않은 문자가 포함되어 있습니다 ("|", "[", "]", 탭, 줄 바꿈은 허용되지 않습니다).',
	"import.err.idMetadata":
		'ID "{{value}}"에 "|"가 포함되어 있습니다. Obsidian에서 첫 번째 "|" 이후의 모든 것은 callout 메타데이터이며 유형의 일부가 아니므로 이 항목은 "{{id}}" callout을 설명합니다. 건너뜀, 기존 "{{id}}"는 변경되지 않습니다.',
	"import.err.displayNameEmpty": "표시 이름은 비어 있으면 안 됩니다.",
	"import.err.displayNameTooLong":
		"표시 이름은 {{length}}자입니다. 최대 {{max}}자입니다.",
	"import.err.boolField":
		'"{{field}}"은(는) 불리언 값(true 또는 false)이어야 합니다.',
	"import.err.iconNotObject": "아이콘은 객체여야 합니다.",
	"import.err.iconTypeInvalid":
		'아이콘 유형 "{{value}}"은(는) {{types}} 중 하나여야 합니다.',
	"import.warn.iconFieldIgnored":
		'"{{field}}"은(는) Material 아이콘에만 적용되며 아이콘 유형 {{type}}에 대해서는 무시됩니다.',
	"import.err.iconValueEmpty":
		"아이콘 값은 비어 있지 않은 문자열이어야 합니다.",
	"import.err.iconValueTooLong":
		"아이콘 값이 비정상적으로 깁니다 ({{length}}자).",
	"import.err.materialStyle":
		'Material 아이콘 스타일 "{{value}}"은(는) outlined, filled, rounded, sharp 중 하나여야 합니다.',
	"import.err.materialWeight":
		'Material 아이콘 두께 "{{value}}"은(는) 100에서 700 사이의 100 단위 정수여야 합니다.',
	"import.warn.iconRecolorIgnored":
		'"recolor"은(는) 직접 추가한 이미지에만 적용되며 아이콘 유형 {{type}}에 대해서는 무시됩니다.',
	"import.err.iconRecolorInvalid":
		'"recolor"은(는) true 또는 false여야 합니다 (받음: "{{value}}").',
	"import.err.colorInvalid":
		'"{{field}}"은(는) "#448aff"와 같은 16진수 색상이어야 합니다 ("{{value}}"을(를) 받았습니다).',
	"import.err.numberRange":
		'"{{field}}"은(는) {{min}}에서 {{max}} 사이의 숫자여야 합니다 ("{{value}}"을(를) 받았습니다).',
	"import.err.iconSizeRange":
		'"{{field}}"은(는) {{min}}에서 {{max}} 사이의 숫자여야 합니다 ("{{value}}"을(를) 받았습니다).',
	"import.err.iconAdjustShape":
		'"iconAdjust" must be an object mapping a callout type ("regular", "heading", "inline") to its icon size and offsets.',
	"import.err.aliasesNotArray": '"aliases"는 문자열 배열이어야 합니다.',
	"import.err.aliasNotString": "별칭은 문자열이어야 합니다.",
	"import.err.aliasDup": '"{{value}}" 별칭이 이 항목 내에서 중복됩니다.',
	"import.err.tooManyIds":
		"ID가 너무 많습니다 ({{count}}개). 각 callout은 최대 {{max}}개의 ID(기본 + 별칭)를 가질 수 있습니다.",
	"import.err.metadataShape":
		'"metadata"는 모든 값이 문자열인 객체여야 합니다.',
	"import.warn.unknownFields":
		"알 수 없는 필드가 무시되었습니다: {{fields}}.",
	"import.err.duplicateInFile":
		'ID/별칭 "{{value}}"은(는) 이 파일의 항목 #{{first}}에서 이미 사용 중입니다.',
	"import.err.aliasConflict":
		'별칭 "{{value}}"은(는) 볼트의 다른 callout ("{{other}}")에서 이미 사용 중입니다.',
	"import.warn.defaultFoldedAutofix":
		'"defaultFolded"가 true이고 "foldable"이 false였습니다. defaultFolded가 false로 재설정되었습니다.',
	"import.warn.imageMissing":
		"이 Callout은 파일에도, 이 vault에도 없는 이미지를 사용하므로 새 이미지를 지정할 때까지 자리 표시자 아이콘이 표시됩니다.",

	"import.err.paletteIdInvalid":
		'"paletteId"는 비어 있지 않은 텍스트 ID여야 합니다("{{value}}" 수신).',
	"import.warn.iconNameUnknown":
		'"{{value}}" 아이콘이 {{type}}에 없어 기본 아이콘이 대신 사용되었습니다.',
	"import.warn.cmIconUnknownNew":
		'"{{value}}" 아이콘을 이 vault에서 사용할 수 없어 기본 아이콘이 대신 사용되었습니다.',
	"import.warn.cmIconUnknownExisting":
		'"{{value}}" 아이콘을 이 vault에서 사용할 수 없어 "{{id}}"는 기존 아이콘을 유지했습니다.',
	"import.chooseSource": "가져오기 위치",
	"import.sourceStudio": "Callout Studio",
	"import.sourceStudioDesc":
		"Callout Studio에서 내보낸 .json 파일을 불러옵니다.",
	"import.sourceCalloutManager": "Callout Manager",
	"import.sourceCalloutManagerDesc":
		"Callout Manager 플러그인에서 사용자 지정 callout을 가져옵니다.",
	"import.sourceAdmonition": "Admonition",
	"import.sourceAdmonitionDesc":
		"Admonition 플러그인에서 사용자 지정 admonition을 가져옵니다.",
	"import.cmTitle": "Callout Manager에서 가져오기",
	"import.cmInstructions":
		"사용자 지정된 각 callout은 아이콘과 색상만 그대로 가져옵니다. 테마별 스타일과 사용자 지정 CSS는 여기에 대응되는 기능이 없어 제외됩니다.",
	"import.cmFromVault": "이 vault",
	"import.cmVaultChecking": "Callout Manager 플러그인을 찾는 중…",
	"import.cmVaultFound": "사용자 지정 callout {{count}}개를 찾았습니다.",
	"import.cmVaultNotFound":
		"이 vault에서 사용자 지정 callout을 찾지 못했습니다.",
	"import.cmPasteLabel":
		"또는 Callout Manager에서 복사한 스타일을 여기에 붙여넣으세요:",
	"import.cmPlaceholder":
		"복사한 스타일 또는 data.json을 여기에 붙여넣으세요…",
	"import.cmBtnCancel": "취소",
	"import.cmBtnImport": "가져오기",
	"import.err.cmNoBlocksFound":
		"붙여넣은 텍스트에서 Callout Manager 스타일을 찾을 수 없습니다.",
	"import.err.cmNotRecognized":
		"인식할 수 없는 파일입니다. Callout Manager의 Copy 버튼으로 생성한 스타일 또는 Callout Manager의 data.json 파일이 필요합니다.",
	"import.err.cmNoEntries":
		"가져올 수 있는 사용자 지정 callout을 찾지 못했습니다.",
	"import.err.cmNoColorForNew":
		'새 callout "{{value}}"에 사용 가능한 색상을 찾을 수 없어 건너뛰었습니다.',
	"import.err.cmIdConflict":
		'ID "{{value}}"는 이미 다른 callout("{{other}}")의 alias로 사용 중이어서 건너뛰었습니다.',
	"import.warn.cmNoColorDefault":
		"Callout Manager에 색상이 설정되어 있지 않아 기본 회색이 사용되었습니다.",
	"import.warn.cmThemeCondition":
		"이 callout의 색상 또는 아이콘은 하나의 테마에만 설정되어 있었습니다. Callout Studio는 테마별 스타일을 지원하지 않으므로 모든 테마에 동일하게 적용되었습니다.",
	"import.warn.cmCustomStyles":
		"이 callout에는 Callout Manager에 사용자 지정 CSS도 있습니다. 해당 스타일은 가져오기 대상이 아니므로 아이콘과 색상만 반영되었습니다.",

	// Import — Admonition
	"import.admTitle": "Admonition에서 가져오기",
	"import.admInstructions":
		"각 admonition은 이름, 아이콘, 색상을 그대로 유지한 채 콜아웃으로 들어옵니다. Callout " +
		"Studio에 대응하는 기능이 없는 설정(명령, 복사 버튼, 제목 숨김)은 가져오지 않습니다.",
	"import.admFromVault": "이 보관함",
	"import.admVaultChecking": "Admonition 플러그인을 찾는 중…",
	"import.admVaultFound": "사용자 지정 admonition {{count}}개를 찾았습니다.",
	"import.admVaultNotFound":
		"이 보관함에서 사용자 지정 admonition을 찾지 못했습니다.",
	"import.admFromFile": "파일",
	"import.admFromFileDesc": "admonitions.json 파일 또는 공유된 팩.",
	"import.admChooseFile": "파일 선택…",
	"import.admPasteLabel": "또는 여기에 JSON을 붙여넣으세요:",
	"import.admPlaceholder": "여기에 admonition을 붙여넣으세요…",
	"import.admBtnCancel": "취소",
	"import.admBtnImport": "가져오기",
	"import.err.admNotRecognized":
		"인식할 수 없는 파일입니다: admonition 목록 또는 Admonition의 data.json이 필요합니다.",
	"import.err.admNoEntries": "가져올 admonition을 찾지 못했습니다.",
	"import.err.admTypeMissing":
		'이 admonition에는 "type"이 없어 건너뛰었습니다.',
	"import.warn.admIconUnknown":
		'"{{value}}" 이름의 아이콘을 어떤 아이콘 라이브러리에서도 찾지 못해 기본 아이콘을 사용했습니다.',
	"import.warn.admIconUnknownExisting":
		'"{{value}}" 이름의 아이콘을 어떤 아이콘 라이브러리에서도 찾지 못해 "{{id}}"은(는) 기존 아이콘을 ' +
		"그대로 유지했습니다.",
	"import.warn.admImageFailed":
		"업로드된 이미지를 읽을 수 없어 기본 아이콘을 사용했습니다.",
	"import.warn.admIconWithCss":
		"이 admonition은 Admonition의 CSS 스니펫으로 스타일이 지정되어 있습니다. 해당 스타일은 " +
		"가져오기에 포함되지 않으므로 이름, 아이콘, 색상만 가져왔습니다.",
	"import.warn.admNoColor":
		"색상이 설정되어 있지 않아 기본 파란색을 사용했습니다.",
	"import.warn.admTitleTruncated":
		"제목이 {{length}}자입니다. {{max}}자로 줄였습니다.",

	"footer.tagline": "피드백, 의견 또는 제안이 있으신가요? 꼭 들려주세요!",
	"footer.madeBy": "Niv 제작  •  ",
	"settings.deletePaletteConfirmLinkedOne":
		'팔레트 "{{name}}"을 삭제할까요?\n1개의 callout이 이 팔레트를 사용합니다. 색상은 유지되며, 나중에 편집기의 색상 행에서 다시 연결할 수 있습니다.',
	"settings.deletePaletteConfirmLinked":
		'팔레트 "{{name}}"을 삭제할까요?\n{{count}}개의 callout이 이 팔레트를 사용합니다. 색상은 유지되며, 나중에 각 편집기의 색상 행에서 다시 연결할 수 있습니다.',
	"settings.unlinkedColors": "연결 해제된 색상",
	"settings.unlinkedColorsDesc":
		"저장된 색상이 삭제된 callout입니다. 기존 색상은 유지되며, 복원하면 색상을 다시 저장하고 전체 그룹을 다시 연결합니다.",
	"settings.unlinkedColorOne": "1개 callout",
	"settings.unlinkedColorCount": "{{count}}개 callout",
	"settings.restoreColor": "복원",
	"settings.palettesMergedNotice":
		"이미 같은 색상을 가진 저장된 색상에 가져온 팔레트 {{count}}개를 병합했습니다.",
	"notice.palettesMerged":
		"동일한 색상을 가진 저장된 색상 {{count}}개를 병합했습니다: {{names}}. 이를 사용하는 callout은 색상을 유지하며, 이제 남은 색상에 연결됩니다.",
	"editor.colorsDescDeleted":
		"이 callout의 저장된 색상이 삭제되었습니다. {{link}} 다시 저장할 수 있습니다.",
	"editor.colorsDescDeletedOther":
		"이 callout의 저장된 색상이 삭제되었습니다. {{link}} 다시 저장할 수 있으며, 이를 사용하는 다른 callout 1개도 다시 연결됩니다.",
	"editor.colorsDescDeletedOthers":
		"이 callout의 저장된 색상이 삭제되었습니다. {{link}} 다시 저장할 수 있으며, 이를 사용하는 다른 callout {{count}}개도 다시 연결됩니다.",
	"editor.colorsDescDeletedLink": "여기를 클릭해",
	"palette.colorExists":
		'이 색상은 "{{name}}"과 동일합니다. 저장된 색상 두 개는 같을 수 없습니다. 구분하려면 색상 하나를 변경하세요.',
	"palette.colorExistsUse":
		'이 색상은 "{{name}}"과 동일합니다. 저장된 색상 두 개는 같을 수 없습니다. 색상을 변경하거나 {{link}}.',
	"palette.colorExistsUseLink": "기존 색상 사용",
	"locale.downloading": "번역 다운로드 중…",
	"locale.notDownloaded": "{{name}}이(가) 아직 다운로드되지 않았습니다",
	"locale.notDownloadedDesc":
		"번역을 다운로드할 수 있을 때까지 Callout Studio는 영어로 표시됩니다. 다음 Obsidian 시작 시 다시 시도합니다.",
	"locale.retry": "다시 시도",
	"locale.diskWriteFailed":
		"Callout Studio가 번역을 디스크에 저장하지 못했습니다. 다음에 다시 다운로드해야 합니다.",
	"notice.exportedCssCreated": "CSS 스니펫을 {{path}}에 저장했습니다",
	"notice.exportedCssUpdated": "CSS 스니펫을 {{path}}에서 업데이트했습니다",
	"notice.exportedCssUnchanged": "CSS 스니펫이 이미 최신 상태입니다.",
	"notice.exportCssEmpty": "내보낼 사용자 지정 callout이 없습니다.",
	"notice.exportCssFailed":
		"CSS 스니펫을 저장하지 못했습니다. 자세한 내용은 개발자 콘솔을 확인하세요.",
	"notice.exportCssEnabled":
		"이 스니펫은 이 vault에서 켜져 있습니다. Callout Studio가 이미 이 callout을 스타일링하며, 스니펫은 내보낼 당시의 스타일을 유지합니다.",
	"confirm.titleOverwriteSnippet": "CSS 스니펫 덮어쓰기",
	"confirm.overwriteSnippet":
		"Callout Studio가 작성한 후 snippets 폴더의 CSS 스니펫이 변경되었습니다. 다시 내보내면 파일 전체를 교체합니다.",
	"confirm.overwriteSnippetOk": "덮어쓰기",
	"export.chooseFormat": "내보내기 형식",
	"export.formatJson": "Callout Studio 백업",
	"export.formatJsonDesc":
		"다른 vault로 가져올 수 있도록 callout과 설정을 담은 .json 파일입니다.",
	"export.formatCss": "CSS 스니펫",
	"export.formatCssDesc":
		"Callout Studio가 설치되지 않은 곳에서 사용할 수 있도록 이 vault의 snippets 폴더에 저장되는 .css 파일입니다. 일반 callout만 포함하며 스냅샷이므로 변경 후 다시 내보내야 합니다.",
};
