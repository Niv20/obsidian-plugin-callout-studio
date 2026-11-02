# The brush mascot - the plugin's icon with a face

The mascot is Lucide's **paintbrush**, the plugin's own icon (`PLUGIN_ICON_ID`),
able to show a face and move. It appears in empty lists, searches that found
nothing, confirmations, every notice and the welcome window.
Everything about it lives in [`src/ui/mascot/`](../../src/ui/mascot/); the
places that show it call one helper each.

Two promises hold everywhere:

- **At rest it is the icon, exactly.** Whenever the mascot is not moving it
  draws Lucide's three paintbrush paths character for character, with nothing
  else showing. Every animation starts there and ends there, however it was
  started, stopped, or interrupted.
- **It is decoration.** Where it cannot be drawn (most test suites have no
  `createSvg`), every helper leaves it out and the screen is exactly what it
  was before the mascot existed. Its `<svg>` is `aria-hidden`: the words next
  to it always say what is going on.

## The face is born from the stripe

The icon has a stripe across the bristles (`STRIPE_D`). That stripe is the
mouth, and it is where the eyes wait: an eye is a dot as wide as the line, so
an eye sitting on the stripe is invisible. Every expression starts by pulling
the eyes up out of the line and bending the line into a mouth, and ends by
putting both back. Nothing appears from nowhere.

The face is drawn in its own coordinates, laid along the stripe
([`mascotFace.ts`](../../src/ui/mascot/mascotFace.ts)): `s` runs along the
stripe, `t` at a right angle to it (negative is "up" on the face), and
`toIcon(s, t)` turns them into the icon's 24 × 24 units. So a level pair of
eyes stays level with the stripe at the angle the icon draws it. The eyes sit
2.9 units above the stripe, where the bristles are widest; under the stripe
there is no room for a face at Lucide's stroke width of 2 (tried and dropped).

**A frame is a `Pose`**: the two eyes, a gaze, the mouth, how much of the mouth
is filled, the whole brush's transform, and three extras (tremble, blush,
paint stroke). Every one of them is a number or a list of
numbers, and shapes that morph into one another have the same number of
points:

- an **eye** is three points drawn as a line of two segments - all three on
  the centre make a dot, spread out they make a dash, `^` or `>`;
- a **mouth** is one cubic curve - the straight stripe is `MOUTHS.line`, and a
  filled curve is an open mouth (SVG fills an open path as if a straight line
  closed it).

Going from any pose to any other is therefore "move each number a little
closer" (`lerpPose`). There is no special case for which face it came from.

## Animations are data

[`mascotAnimations.ts`](../../src/ui/mascot/mascotAnimations.ts) holds every
animation as a list of steps: *move to this pose over this many milliseconds,
with this ease*, optionally throwing drops of paint as it starts. A step names
only what it changes (`PoseSpec`); everything else carries over.

An animation has up to four parts:

| Part | When it plays |
| --- | --- |
| `intro` | Always first. From the icon, or from whatever face is showing. |
| `body` | Once. |
| `loop` | Over and over while the animation is held. Without one, `body` repeats. |
| `outro` | After letting go, if there is one. |

and then the engine adds the same last step, back to `REST`, `exitMs` long
(320 ms unless the animation says otherwise). No animation can forget to go
home.

The one exception is `then`: an animation played once, with nothing held, that
names another animation hands over to it at the end of its `body`, starting
from the face it has, instead of going home first. `lookTwice` is the only
one that does (`then: NO_RESULTS_MOOD`, which is `sad`). If something is held
when it ends, the hold wins, as for every one-shot. `then` is a plain `string`, because a type made of
the animations' names cannot be used inside the object it is made from
(TS2502); a test checks that each one names a real animation.

The twenty-one animations, by what they are for: `peek` (only the eyes, for
idling), `hello`, `wink`, `look`, `lookTwice` (one round of
looking and then a shake of the head, then sad: a search that found nothing), `nod`, `no`, `surprised`, `happy`,
`excited`, `celebrate`, `sad`, `cry`, `scared`, `relief`, `paint` (work in
progress), `hold` (still and calm, for "paused"), and three for the pointer
playing with it (see [Played with](#played-with)): `notice`, `ouch` and `angry`.

**Looking** (`look`, and `lookTwice`, which is one round of it) is three glances,
`searchGlances` in `mascotAnimations.ts`: down left, up left, down right. A glance
(`glance(gaze, flick, rest)`) is a quick flick with the eyes wide open that slows as
it arrives (`ease: "out"`), then a long stare in which the eyes creep a tenth
further and **narrow** (`EYES.narrow`, a slit with its middle point on the centre:
the same eye half closed, not a blink) as if straining to see, until the next flick
opens them again. The head tilts away from the side looked at and rises or dips a
little. Every glance has its own flick and stare (240/640, 200/820, 250/700 ms), so
it does not tick, and the eyes cross the face from one corner to the next at speed
instead of stopping in the middle (an earlier version went left, middle, right,
middle: the eases made the middle a pause). There is no glance up and to the
right: the right eye ends up on the handle's lower edge (about half a unit over it,
checked by rendering it large), while the other three stay inside the bristles. The
last corner is where the eyes stay, narrowed. `look` stops there (held, it goes
round again after a blink). `lookTwice` carries on with `answerNo`: the eyes open
and look straight ahead (160 ms), a beat (180 ms), then the head shakes "no" (the
same `headShake` as `no`, 0.7 s) with the flat mouth, and only then it hands over to
the held `sad`, which restores the frown. So one round is 0.39 s of face, 2.85 s of
looking and 1.2 s of answer: 4.44 s.
`tests/brushMascot.test.ts` reads the order of the corners off the eye's path (its
second point: a blink moves the first), counts the frames where it sits still in the
middle, and checks the stroke width: wide on arriving, under 1.3 at the end of the
stare, wide again for the next glance.

The face of a search that found nothing is `NO_RESULTS_MOOD` in
`mascotAnimations.ts`, the one name every such place uses (`SearchMascot`, Find
callouts, and what `lookTwice` carries on as), so they cannot disagree.

## Playing them

[`brushMascot.ts`](../../src/ui/mascot/brushMascot.ts) is the engine.

- **`play(name)`** plays once and settles back on the icon. Asking for the
  one-shot already playing returns the same promise instead of restarting it,
  so a twitchy pointer cannot make it stutter.
- **`hold(name)`** keeps it going until the returned hold is released; its
  `active` says whether it still is.
- **`hold(name, "still")`** plays the intro and the body once, then rests on the
  face the body ended on instead of repeating the loop: the run stays (`current`
  still names it) but asks for no frames until something moves it again - a
  one-shot over it (which hands back to the resting face), the eyes turning
  toward the pointer (frames only until they get there), or letting go (the way
  home, as from a loop). Every frame has a cost, and a face that keeps
  breathing in a place left open for hours keeps the window drawing all along.
- **Holds stack.** The newest hold is the one showing; letting it go shows the
  one under it, and letting go of one underneath changes nothing on screen.
  A confirmation holds `scared` while it is open and its Delete button holds
  `cry` while the pointer is on it.
- **A one-shot over a hold hands back.** It plays to the end of its outro, then
  starts the hold that is on top instead of going home. A hold that arrives
  while a one-shot plays waits for it.
- **Letting go early.** Let go during the intro and the intro finishes, then the
  mascot goes home without the body or the loop. A quick pass of the pointer
  still shows a complete little face. Let go in the body or the loop and it
  heads home at once, from exactly where it is.
- **`hover(target, name)`** (its listeners are `hoverMood` in
  [`mascotPlay.ts`](../../src/ui/mascot/mascotPlay.ts), beside the pointer's
  other play) holds while the pointer is over `target` or it has
  keyboard focus (`:focus-visible` only, so a click that focuses a button
  does not leave the mascot excited after the pointer has gone). Touch has no
  hover and is ignored. It checks its own hold's `active` rather than a flag,
  because `stop()` drops every hold.
- **`hover(target, name, "once")`** is the other way to bind a hover: it plays
  `name` one time each time a mouse or pen comes onto `target`, instead of
  holding it. Nothing repeats while the pointer stays, and keyboard focus is
  not involved. (`play()` ignores a request for the one already playing, so
  coming back during the animation does not restart it.) The welcome window
  uses it for `wink`.
- **`stop()`** goes back to the icon at once, dropping every hold and drop.

## Played with

Every mascot except those of the `"notice"` size (a notice's, and the import
offer's: `interactive: false`, which `addMascot` passes for that size) answers the
pointer, and **every one answers a press the same way, whatever mood it holds**.
[`mascotPlay.ts`](../../src/ui/mascot/mascotPlay.ts)
wires it to the box the mascot is drawn in (`is-playful`, which styles.css
stretches 6px past the icon, so being near counts), and the engine gives it the
pieces: `poke()`, `lookToward()` and `holdCount`.

| The pointer | A mascot that is only the icon | A mascot that holds a mood (sad, scared…) |
| --- | --- | --- |
| comes near (mouse and pen) | holds `notice`: eyes pop out, one blink, a blink every 2.6 s, and the eyes follow the pointer (`lookToward`; eased over 90 ms, at most 0.7 face units) | nothing: it keeps its face |
| presses (main button, finger or pen) | dents (below) and holds `ouch` while pressed: eyes screwed shut, mouth open | the same: dents and holds `ouch` **on top of** the mood |
| presses a fourth time within 2.2 s | plays `angry`: the squint first, then glare, red cheeks (they grow out of a point as they fade in over about 230 ms and shrink away over 420 ms, at an even speed), two stamps, steam (drops with an upward pull) | the same, over the mood |
| leaves, or lets go | hold released, the dent springs back | the same, and the mood shows again |

A finger has no hover, so a touch is only ever a poke. Only the coming-near
reaction looks at whether a mood is held (`holdCount` minus the two holds the
play layer keeps itself): the squint and the glare do not, because the engine's
hold stack already does the right thing, showing the newest hold and going back to
the one under it. The press asks for `ouch` and `angry` in the same
moment, so `angry`'s intro starts with the squint itself (`eyes: "squint"`, open
mouth, 90 ms): without it the face jumped from whatever it was showing straight to
the glare, and `ouch` was never seen on the fourth press. There is one reaction to
being poked too much, `angry`, in every place (the welcome window used to cry; `tooManyPokes` is gone). `cry` keeps
one meaning, "this can't be undone", on the red buttons.

**A mood has to put the mouth back.** `ouch` (like `cry` and `excited`) leaves the
mouth filled in, and a pose carries over from the face before it, so a mood that
comes back after a press would keep an open mouth. Every animation a place can
hold sets `fill: 0` in its intro (`sad`, `scared`, `hold`, `hello`, `look`,
`relief`, `paint`), and `angry`, which also leaves red cheeks and a
shake, clears them in its `outro` (an outro does play when a one-shot hands back
to a hold; a hold handing over to another hold skips it, which is why the others
cannot use one). `tests/mascotPlay.test.ts` presses each of those moods and checks
the mouth is closed again.

**The dent** ([`mascotDent.ts`](../../src/ui/mascot/mascotDent.ts)) is a spring,
not an animation: it is pulled toward 1 while the pointer is down (well damped,
so a press feels firm) and toward 0 after (loose, ζ ≈ 0.26, so it pops out past
flat before settling), integrated in 4 ms sub-steps so a slow frame cannot
blow it up. `depth` becomes one SVG `matrix()` put in front of the body's own
transform: the brush is squashed along the push (from the poke through the
middle) about its far edge, stretched a little across it, shoved 0.9 units away
and leaned up to 4° about its feet. A poke dead in the middle has no side to
go in from and squashes evenly toward the feet. A press while the last one is
still springing carries on from where it is (`Dent.press`), and a poke that
follows quickly on another is up to 1.5 times as hard. A ring of paint
(`.cs-mascot-paint`, an extra `<circle>` that is the svg's last child) spreads
from the spot over 420 ms. The svg is `overflow: visible`, so the ring reaches
up to about 14px past the box (a press in the 6px invisible reach above it is
the worst case), which makes every ancestor that clips a place where it is cut
flat. Obsidian's `.setting-item-name` is one (`overflow: hidden`, for its
ellipsis) and holds the mascot of a search that found nothing and of an empty
list, so those two names carry `cs-mascot-line` / `cs-paint-room`, which turn
the clipping off (styles.css; `awakenSlot` sets the second). Check a new place
for a clipping ancestor before trusting that the ring shows.

Because the dent is its own layer, it works over any animation and never
touches the face: poke the sad mascot in an empty search and it sinks in
where you pressed while `ouch` shows on top, and when you let go the dent springs
back and it is sad again.

**Reduced motion** keeps the faces (`notice`, `ouch` and `angry` still change
the face) and drops everything that moves: no dent, no ring, no eyes following
the pointer, no steam.

**Frames.** The engine draws by setting SVG attributes, never with CSS
animations: CSS cannot change a path's shape in Safari, which is what Obsidian
runs on on iPhone and iPad. It asks for frames from the window that shows the
mascot (`requestFrameFor`, [`utils/elementFrame.ts`](../../src/utils/elementFrame.ts)),
because the settings may be a window of their own (Obsidian 1.14), and it
asks only while something is moving. A long frame is capped at 100 ms, so a
window that was hidden does not jump ahead. When a mascot that was on the
page is no longer, its next frame stops it: a closed window or a list drawn
again ends the animation without anyone having to say so.

**Drops of paint** (tears, confetti, sweat) start at a point on the
brush, moved by the brush's transform at that moment, and then fly on their
own, so they fall straight down whatever the brush does next. The paint
stroke under `paint` reaches as far right as the bristle tip has been since it
started.

**Reduced motion.** A mascot reads `prefers-reduced-motion` when it is made.
With it set, the faces still change (the eyes come out, the mouth bends), but
the brush itself never moves, shakes or squashes, no drops are thrown and no
stroke is painted.

**Colours** are the stylesheet's. The `<svg>` is `.cs-mascot`, drawn in
`--text-muted`: a grey in every theme, quieter than the words beside it. Every
drop of paint, the blush and the stroke are `.cs-mascot-paint`, drawn in
`--interactive-accent`, the theme's accent and the mascot's only colour.

## Where it appears

[`mascotPlaces.ts`](../../src/ui/mascot/mascotPlaces.ts) holds one helper per
kind of place. In a window that closes soon (a confirmation) a mood is held,
moving, for as long as the state lasts. A mood kept across redraws
(`KeptMascot.setMood`, which every search that found nothing, Find callouts and
the saving banner use) is held still: the face comes and then rests, with no
frames, because these places can stay on screen for hours. Elsewhere in a
long-lived place (the settings lists) the mascot reacts once and goes back to
being the icon, with an occasional peek at most.

| Place | What it does | Code |
| --- | --- | --- |
| My callout types, empty | `peek` every 9 s; `excited` while the pointer is on the list's `+` | `emptyListState`, `watchEmptyListMascots`; `declarative/calloutPages.ts` |
| Saved color palettes and Custom commands, empty | the same, smaller | `declarative/palettesPage.ts`, `declarative/commandsPage.ts` |
| Icon picker: a search that found nothing | `lookTwice` (looks around, shakes its head "no") when the search turns empty, then `sad` while nothing matches; `look` while typing, then `no` and back to `sad` once the typing pauses and nothing was found | `SearchMascot`; `iconpicker/PackPanel.ts`, `iconpicker/ImagePanel.ts` |
| My callout types, Built-in callouts, Callouts from your theme: a search that found nothing | `lookTwice`, then `sad` while nothing matches; `look` while typing and `no` when the typing pauses, as in the icon picker | `SearchMascot` in `NoMatchesRow`; `declarative/noMatchesRow.ts`, `declarative/calloutPages.ts`, `declarative/calloutListPage.ts` |
| Icon picker: Your images, empty | `hello` while it waits (it was a still icon until 2026-10-27); `excited` while a file is dragged over; `celebrate` when the first one is added (the grid waits 650 ms for the jump) | `KeptMascot`; `iconpicker/ImagePanel.ts` |
| Icon picker: a library downloading | `paint`, in place of the spinner | `addMascot`; `iconpicker/PackPanel.ts` |
| Quick insert: a search that found nothing | `lookTwice`, then `sad` while nothing matches; `no` again when the list is drawn empty once more and the typing pauses (it never calls `typed`) | `SearchMascot`; `QuickInsertModal.ts` |
| Replace in vault: a search that found nothing | `lookTwice`, then `sad` while nothing matches; `look` while typing and `no` when the typing pauses, as in the icon picker. Only for a non-empty query, drawn over the empty state's words (`cs-mascot-line`), and put away in `onClose` | `SearchMascot`; `utils/ReplaceCalloutModal.ts` |
| Find callouts: nothing found | `lookTwice` once each time the list turns empty, which hands over to the held `sad` with no step through the icon in between; `sad` stays, resting still, while the list is empty (it used to play once and go back to the icon) | `KeptMascot`; `usage/occurrenceResults.ts` |
| Review conversion: nothing to convert | `nod`, once | `KeptMascot`; `portable/PortableConversionView.ts` |
| Version history: no versions | `look`, held still: the glances once, then the face rests with no frames | `addMascot`; `declarative/versionHistoryPage.ts` |
| Every red question: deleting a callout, a palette, a command, a picture, a version or a library; Reset everything; converting notes; restoring a version; replacing the settings file; overwriting the CSS snippet | `scared` while open; `cry` while the pointer is on the confirm button; `relief` while it is on Cancel or on the window's ✕. Beside a two-line heading (the title, and a subtitle under it) at the start of the row (the right in RTL), 48px, in the title's own colour, the same in every one; none on a phone (see the notes below) | `ConfirmModal.withMascot(subtitle)`; `addConfirmMascot` in `mascotPlaces.ts`; called from `sections/calloutVaultActions.ts`, `sections/paletteFlows.ts`, `command/commandFlows.ts`, `iconpicker/ImagePanel.ts`, `iconpicker/iconLibraryQuestions.ts`, `declarative/versionHistoryPage.ts`, `resetEverything.ts`, `saveStatusBanner.ts`, `ExportFormatModal.ts`, `PortableConversionView.ts` |
| Saving is paused / settings were not saved | `hold` / `sad`, in place of the warning triangle at the start of the banner's title, drawn in `--text-warning`, 28px | `KeptMascot`; `saveStatusBanner.ts` |
| The first-install import offer (Callout Manager / Admonition) | `hello` once, 28px, in `--interactive-accent`; stops itself when the banner is removed | `addMascot`; `competitorImportBanner.ts` |
| Every notice | still for 0.4 s, then the animation of its kind until the notice goes (see [Notices](#notices)) | `showNotice`, `showActionNotice`; `mascotNotices.ts` |
| An import that worked | `celebrate` in the notice | `showNotice("celebrate", …)`; `sections/backupImport.ts`, `pluginImport/PluginImportModal.ts` |
| The clipboard is empty on Paste | `look` in the notice | `showNotice("notFound", …)`; `PluginImportModal.ts` |
| A press on a dimmed (blocked) button | `no` in the notice | `showNotice("blocked", …)`; `ui/blockedButton.ts` |
| Saving paused (the notice and its guard) | `hold`, as in the banner | `showActionNotice("paused", …)`; `pausedIndicator.ts`, `manager/settingsNotices.ts`, `pausedGuard.ts` |
| Scan for callouts, converting notes | `paint` in a notice while it runs; then `celebrate` (or `nod` when the scan found nothing) | `workNotice`, `showNotice`; `sections/manualScan.ts`, `PortableConversionView.ts` |
| Picking a language that has to be downloaded | `paint` in a notice while it downloads; then `happy`, or `sad` with Retry if it failed | `workNotice`, `showNotice`, `showActionNotice`; `sections/languagePicker.ts` |
| The welcome window | `wink` as it opens, and once each time the pointer comes onto it (`hover(…, "once")`); pressed, it answers like every mascot | `addMascot`; `WelcomeModal.ts` |

Notes on a few of them:

- **Every confirmation with a mascot looks and reacts alike.** It used to be
  64px above the message for the callout delete and the risky questions and 48px
  for the other deletes (a `mood` argument picked the size, and is gone), and
  until 2026-10-27 only the callout delete breathed out on Cancel and only the
  callout delete and the two risky ones cried, so hovering the red button of a
  library reset did nothing and looked like a bug.
- **The heading is two lines, and the mascot stands beside both.**
  `ConfirmModal.withMascot(subtitle)` adds `cs-confirm-heading` to the title's
  parent (`.modal-header`) and a `div.cs-confirm-subtitle` under the title;
  `addConfirmMascot` puts the mascot's box *before* the title and adds
  `cs-mascot-header`, which turns the row into a grid of two columns: the brush
  in the first, spanning both rows and centred on them, the title over the
  subtitle in the second. So the 48px brush has two lines of words to match its
  height, with nothing empty under it and nothing empty under the title, and the
  message below takes the window's full width. Obsidian centres `.modal-title`
  with auto margins (on a phone with `text-align: center`, a 70vw cap and a
  one-line ellipsis), so the heading's rules clear them and the title starts
  where the message does; the rules are `.modal`-prefixed to beat Obsidian's
  `.is-phone .modal-header` (same weight). The mascot is first in the DOM, so
  the grid puts it on the right in RTL with no extra rule, and it takes
  `color: inherit` there: the title's own colour, not the muted grey of the
  other places (the paint stays the accent). On a computer the dialog's own X
  sits in the row's end corner, so the row keeps 24px clear of it (a phone hides
  the X). Checked 2026-11-02 against Obsidian 1.14.5's `app.css` in headless
  Chrome, with the real `ConfirmModal` and `styles.css`: all 15 questions (two
  of them also in RTL), a phone, a window short enough to scroll, and a
  74-character subtitle (a German sentence) that wraps to a second line, where
  the brush stays centred on three lines.
- **The subtitle** says which one it is or what it costs, and never repeats the
  title or the message. It is the name of the item in quotes
  (`confirm.subtitleName`, `“{{name}}”`; a version has `versions.subtitle`,
  `“{{name}}” · {{when}}`) or a short sentence of ours. The quotes belong to the
  string, not to the code, so each language can use its own, and a name in quotes
  beside a sentence without them tells the reader which is the user's and which
  is ours. Keep a sentence to about 45 characters in English: a longer
  translation wraps. A message loses whatever its subtitle already says: the
  name and date of a version, the "exact copy is saved first" of a replaced
  settings file, and so on. `withMascot` takes the subtitle as a required
  argument, so a question with the mascot cannot go without one.
- **One layout, whatever the message says.** Until 2026-11-02 where the mascot
  stood depended on how long the message was: beside the words for up to three
  lines, in the title row for more (counted when the window opened, by
  `confirmLayout.ts`), and over the title on a phone. The beside layout left a
  strip under the brush and shortened the lines (a message of four lines became
  six), and the title row left a one-line title beside a 48px brush. The
  two-line heading replaced both, and `tests/confirmHeading.test.ts` holds that
  no class on the window depends on the message.
- **There is no mascot on a phone.** `ConfirmModal` leaves it out when
  `Platform.isPhone`: a finger has no hover, so `cry` and `relief` never play
  and the brush could only stand there frightened, and it took a row of a
  narrow sheet. The two lines stay, at the start edge, the title wrapping where
  Obsidian would cut it to one line with an ellipsis, and the row taking the
  body's own 16px on both sides. (A tablet is not a phone: it keeps the mascot.)
- **A scrolling window's heading row has its own padding.** Reset everything is
  the one confirmation whose body scrolls (`mod-scrollable-content`), and
  Obsidian gives that window no padding on its title row and pads the title
  itself, so the brush would sit in the window's corner and the title 16px lower
  than it. `.modal.mod-scrollable-content .modal-header.cs-confirm-heading` has
  the body's own 16px and its title none. Only the body scrolls, so the heading,
  brush included, stays put.
- **`relief` clears the tremble.** A pose carries over from the face before it,
  and the pointer reaches Cancel while `scared` (which trembles) is still
  showing, so `relief`'s first step sets `tremble: 0`; it used to breathe out
  while still shaking. `cry` still inherits the shake on purpose.
- **Cancel closes a confirmation at once**, so `relief` plays while the pointer
  is on Cancel - the only moment there is to see it. The window's ✕
  (`.modal-header-button`, a direct child of `modalEl` made by Obsidian's `Modal`
  constructor; the older `.modal-close-button` is no longer created; the phone hides it) closes
  it just as fast, so it gets the same `relief`. Cost: one more
  `pointerenter`/`pointerleave` pair on one element, nothing per mouse move.
- **A library download's success has no reaction**: the grid replaces the
  message, mascot and all, the moment the download ends.
- **`workNotice` exists to give the painting mascot a place.** Where the
  mascot cannot be drawn it shows no notice at all, so the scan and the
  conversion behave exactly as they did.

### Notices

Every notice the plugin raises has the mascot, because every notice goes
through [`mascotNotices.ts`](../../src/ui/mascot/mascotNotices.ts):
`showNotice(kind, message, duration?)`, or `showActionNotice` for the three
with a button (`ui/noticeAction.ts`, which is built on it). Without a
`duration` the notice stays as long as its sentence takes to read
([chapter 16](16-settings-ui-and-modals.md#how-long-a-notice-stays)), so the
mascot's moment is as long as the words.
`tests/repoSourceRules.test.ts` fails on a bare `new Notice(` anywhere else in
`src/`, so a notice added later cannot forget it.

- **Still first, then moving.** The mascot arrives as the plain icon and keeps
  still for 400 ms (`STILL_MS`), so the eye reads the words first. Then it
  *holds* its animation, which loops until the notice is gone. Nothing ends it
  by hand: the engine stops itself on the first frame after its `<svg>` leaves
  the page (`BrushMascot.wake`). A notice clicked away within the 400 ms never
  starts it. `workNotice` is the one place that ends it by hand, because its
  `done()` hides the notice itself.
- **One kind, one animation, always.** `NOTICE_MOODS` maps each kind of news to
  exactly one animation, with no rotation and nothing random: the same news
  looks the same every time, and no two kinds share an animation, so the face
  tells the news apart before the words are read. Choose the kind by what the
  notice tells the user, not by how it ends:

  | Kind | For | Animation |
  | --- | --- | --- |
  | `success` | something worked, or good news arrived | `happy` |
  | `celebrate` | a bigger job is finished: an import, a scan that found something, a conversion, a full reset | `celebrate` |
  | `restored` | something is back: an undo, a restored version, saving on again | `relief` |
  | `upToDate` | nothing to do or to change; all is well | `nod` |
  | `notFound` | what was asked for is not there: nothing to wrap, a note that is gone, an empty clipboard | `look` |
  | `blocked` | the request cannot be done as asked: a missing name, a conflicting ID, a read-only preview | `no` |
  | `problem` | something failed and nothing was done | `sad` |
  | `warning` | done only in part, or worth a second look: some notes not updated, changes kept aside | `surprised` |
  | `paused` | saving is paused: nothing lost, nothing kept | `hold` |
  | `info` | something to know, nothing to do | `hello` |
  | (`workNotice`) | work is running | `paint` |

  A new animation for a kind is one line in `NOTICE_MOODS`; the test checks
  that each is a real animation and that no two kinds share one.
- **Colour.** The brush takes `--notice-color` in full (`.notice .cs-mascot`),
  never see-through: the drawing is overlapping strokes, and where two
  translucent ones cross the crossing shows brighter.
- **Layout.** `.notice.cs-mascot-notice` is a two-column grid, the mascot in
  the first and the words in the second, so a button sits under the words.
  On a phone Obsidian's own row (words, then button) just gains the mascot at
  its start.

### Empty lists in the settings

These are the one place the mascot cannot simply be built where it is shown.
The lists are Obsidian's declarative lists (26), and Obsidian draws a list's
empty row from a **copy** of the `emptyState` fragment (`cloneNode(true)`,
read from `app.js` 1.14.5), and a copy carries nothing alive. So:

1. `emptyListState(text, addLabel)` returns a fragment holding the text and an
   empty, already-sized slot (`.cs-mascot-slot`) that carries the list's add
   action's name.
2. While the settings are open, `watchEmptyListMascots` watches the settings'
   content area (a `MutationObserver`, started and ended with the visit in
   `declarative/declarativeSettings.ts`) and puts a live mascot into every slot
   that appears, on the main page or a sub-page sliding in.
3. The mascot finds the list's `+` from inside its row: on a computer the
   heading button whose tooltip (`aria-label`) is the add action's name, on a
   phone the list's `.mod-add-item` row. It holds `excited` on hover.
4. Its peeks are one timer at a time, each setting the next. The chain stops by
   itself once the row has gone (the list has items now), and the end of the
   visit stops it in any case (the plugin's unload ends the visit too).

Obsidian keeps the empty row while the list stays empty, through every
redraw, so the mascot in it lives as long as the row does.

### Kept across redraws

Several empty states are drawn again on every change: a search on every key,
a sidebar on every refresh, the saving banner on every status change.
`KeptMascot` keeps one mascot and moves the same element into each new draw,
so it carries on with what it was doing. Its `setMood(name)` holds the mood
still (`hold(name, "still")`): the face plays its way in and its body once and
rests there with no frames, however long the state lasts. It can be called
on every draw: asking again for the mood already held changes nothing, and a
mood whose hold ended (the mascot was stopped, or left the page while it was
moving and stopped itself; a face resting still has no frame to notice that
with, and simply stays) is held again. `SearchMascot` is a `KeptMascot` that is sad while shown
(`NO_RESULTS_MOOD`). When a search turns empty it plays `lookTwice` over the held
`sad` (glances, then the shake of the head): the one-shot hands over to the hold
when it ends, so there is no moment as the plain icon between the shake and the
sadness. On the next keys, while it stays empty, `typed()` holds `look` on top of the
sad face, and `typed()` and a redraw of the empty state (`showEmpty` again) both
start the same 700 ms wait (`settleLater`, one timer, every key starts it again).
When it runs out the typing has paused: `settle()` lets go of `look` and, if the
search is still empty, plays `no` over the held `sad`, which hands back to `sad`
when the shake ends (the let-go and the `play` happen in the same moment, so the
face goes from looking straight to shaking with no frame of sadness between). It
does not shake while the first round is still playing (`searching`: `lookTwice`
ends with its own shake), and `hide()` clears the timer, so nothing shakes once
something matched. Quick insert never calls `typed()` and still shakes, because it
draws the empty state again on every key. Find callouts' empty state holds the same
mood through its own `KeptMascot` and gets the first round's shake, but not the
repeat: its list is redrawn for reasons that are not a changed query.

## Adding to it

- **A new animation** is one entry in `ANIMATIONS`. Name the shapes it uses
  from `EYES` and `MOUTHS` (or add one, with the same number of points as its
  siblings), and let the engine add the way home. The test suite plays every
  entry and checks it ends on the exact icon. If a place can hold it, set
  `fill: 0` in its intro (see "A mood has to put the mouth back" above), and add
  it to the list in `tests/mascotPlay.test.ts`.
- **A new notice** uses `showNotice(kind, t("…"))`, with the kind of news it
  brings; never `new Notice`.
- **A new place** uses a helper from `mascotPlaces.ts` and nothing else. Prefer
  a one-shot or a still hold in anything long-lived, never a looping hold, and give the mascot room in the layout
  (`.cs-mascot-line` stacks it over a line of words).

## Tests

[`tests/brushMascot.test.ts`](../../tests/brushMascot.test.ts) installs a
stand-in `createSvg` and drives the engine by hand (`{ manual: true }` and
`advance(ms)`). It covers every animation ending on the exact icon with every
drop gone, the hold stack, the hand-over from a one-shot, letting go in the
intro, a still hold resting with no frame asked for (and asking again to go home,
for a one-shot over it and for the eyes), hover (mouse but not touch, and again after a `stop()`), the kept
mascot, the empty-list slot and its watcher, the confirmation, and every helper
leaving the screen untouched without `createSvg`, and a notice's mascot: every
kind has an animation of its own, it keeps still until its timer is flushed and
then asks for frames, and it stops with the notice. What it cannot see - how it
looks and moves - was checked by rendering every animation frame by frame in
Chrome and in WebKit.

