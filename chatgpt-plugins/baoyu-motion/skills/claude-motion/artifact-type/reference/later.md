# Later turns on a film

This page covers every turn after a film is first made: a change, the page's buttons, a film cut short, a reviewer's comment. First find which kind of film you have, then follow that part. `if_version` applies only if your tool's input lists it; the version is in your last `list`, `get` or write of that document.

Before anything else: `modules/{retyped,recolored,refaced,fetched-fonts,recut,retouched}.json` are the page's own records, so never write or delete them. If the film holds one besides `fetched-fonts.json`, first read `artifact-type/reference/by-hand.md`, which says what counts. On any film, if rough-cut.md isn't in this conversation, read it, because the rules of a scene hold here. A film that holds `look.json` follows `styles.md` in place of rough-cut.md and finalize.md.

Asked to bring in their logo, icons, product or colors, or a film for their organization where a design system is listed: read design-systems.md too.

A film that speaks (it holds `modules/narration.js`, or its `film/script` sets `narration`): read `artifact-type/reference/recording.md` too, and follow its "Later" for any change to the lines, times or scenes.

## Which kind of film?

Go by what `scenes.json` and the scene modules say.

- **An empty film (no `film/script`), or one you refused whole with no scene written:** SKILL.md's "A new film", in this same film, never passing `type_url` again; a list already written is rewritten with `if_version`. What you refused stays refused, whatever they press or type, "Continue" too: the same no and offer (kinds.md for a banned kind). The offer taken, or another ask you can make, goes ahead with no remark on the refusal.
- **Listed scenes are missing, or you're told "Continue the animation."** This is the page's button, on a final film too. It may go on "Scenes left: 2, 5.", which are positions in `scenes.json` counted from 1, never a count. `list` `modules` and mend any scene whose code is broken. If a scene is rough, go to "Scenes missing or broken", and close with: "Done. Tell me what else to change, or say Finalize." Otherwise, go to "Cut short" for a final film, or take the next bullet.
- **`"stage":"rough"`, no `look.json`, and no scene is rough** (a new film cut short), whatever they ask: read finalize.md, make any change they asked for, finished, then "Cut short", through to the score and `"final"`.
- **Any other `"stage":"rough"`, with a change:** "A change", and close as for Continue.
- **`"stage":"rough"`, with "Finalize the animation."** (the page's button) or their own words for it: read finalize.md and follow "A rough cut redrawn". A film with `look.json` follows "Finalize" in styles.md.
- **`"stage":"final"`, or no `scenes.json`:** "Revising a film". If asked to Finalize it, say it already is.

## Revising a film

Never republish: the store is the truth. `list` `modules` (and `assets`) first, with each document whole and its version. With no list of scenes, `get` `film/script` too, and read film-api.md first. Before revising a finished film, also read motion.md and film-api.md. finalize.md says how a scene is drawn and how much a frame can carry.

Change only what was asked: a scene's module, `scenes.json` for order, names, seconds and `desc`, or `base.css` and `shared.js` for something across the film. Then `set` just those, and keep names stable. A scene added, dropped or retimed goes by "A change", so that the score still fits. A thing on `W` that is to change everywhere changes where it's drawn, once: in `shared.js`, or at the head of the scene that first shows it. A small change stays small: the richness of a finished scene is no reason to redraw it.

A reviewer's comment carries its pin ("How reviewers review", below). Map the time to its beat and the point to the element there before answering. Confirm anything ambiguous, then apply the round in one pass. Tell the user what changed, in their words. Music they asked for goes as "The music: [mood], [two instruments]." After a first score, add "It starts muted: the speaker button turns the sound on."

## How reviewers review

A comment a reviewer sends you carries its pin as `Location: 0:12` with `Anchor detail: at 12.4 s, the point at x 42.29% y 40.74% of the frame` (42.29% of a 1920-wide frame is 812 px; a box gives its top-left corner, width and height), or for a stretch of the timeline `Location: 0:02 to 0:05` with `Anchor detail: from 2.1 s to 5.4 s of the film` (no position).

A comment with no `Location` and `Anchor detail` lines carries `Element path: animation-v1:nth-of-type(1) > at-12400ms:nth-of-type(1) > x4229-y4074:nth-of-type(1) [> w1146-h0833:nth-of-type(1)]` instead: milliseconds, then x/y (a box's top-left) and w/h as fractions of the frame ×10000. A stretch ends `> to-5400ms:nth-of-type(1)` in place of x/y. Ignore the `:nth-of-type(1)`.

If you're unsure, ask one clear question. Batch fixes per round, name your pick when offering options, and keep the same link across rounds.

## A change

`list` `modules` (every document whole, with its version), change the scenes it touches at the same roughness (`rough: true` stays), and `set` each with `if_version`. On a change to a rough cut, don't read motion.md or film-api.md.

A change of color goes in the variables in `base.css` (for a new ground, `scenes.json`'s `background` too). Where scenes are rough, your closing sentence says it will show at Finalize.

A scene added, dropped, renamed, retimed or moved is an edit to `scenes.json` (`if_version`; `"stage"` stays as it is). A new scene's module follows it, and a dropped scene's module is `delete`d (`if_version`). The files run in film order, so a scene can call only what `shared.js` or a scene before it adds to `W`. If a drop, a move or a new scene breaks that, move those drawings to `shared.js` in the same round; a rewrite of a scene keeps its head. Scenes that stay keep their ids. If no scene is rough on a rough film, "Cut short" follows.

On a final film do the same, finished: draw as finalize.md says, with no `rough: true`, and the stage stays `"final"`. Fit `score.js` to the new times, with no `T.` of a dropped id left, because that would sound at 0:00. (Read sound.md first if it's not in this conversation. A silent film has no score.)

Every kind of film but a new one has scenes on show, so `base.css` and `shared.js` are added to, with nothing renamed or removed and type sizes and weights as they are, unless that is the change asked for.

## Another typeface, on a final film

Put it in `fonts`, as rough-cut.md says, in the slot whose stack those words wear now, so that no stack changes, with 400 and `base.css`'s weights. A weight the face lacks takes its nearest in `base.css`. Only widen a line's box in a scene, never shrink its type. A font asset named ahead of that stack comes out of `base.css` and of any scene, and stays in `assets`, so that if they ask for it back you can name it again. What `modules/refaced.json`'s `about` says of a font asset holds for their own files alone. Say D first, if it fits (below), then what changed, without a fetched family's name, then A or B, if one fits.

## A rough cut redrawn

The user has seen the rough cut, so keep the same ids, names, order and seconds, and the same words, each line exactly as in the rough scene. `modules/retyped.json` lists lines they retyped, as `{"was":"…","v":"…"}`: the film shows `v` wherever the code says `was`. Leave `was` and the record as they are, and fit the layout to `v`. Then follow finalize.md, with these differences:

- After the pages, `list` `modules`, unless you just did, with every document whole and its version.
- If `scenes.json` has no `fonts` (an older rough cut) and there's no `modules/refaced.json`, first `set` `scenes.json` (`if_version`) with `fonts` added, picked as rough-cut.md says, with 400 and `base.css`'s weights. `base.css` then adds the stack of each slot named (`.line`: the display one).
- Drawing the world is two writes. `set` `modules/base.css` (`if_version`), adding to it, with nothing renamed or removed (the rough scenes on show use it) and type sizes and weights as they are. Then the batch with `shared.js` and anything else. A time inside a scene that the score needs too goes there as a constant (`window.TT = { tip: 0.4 }`), read by both.
- Each scene is a `set` over the same document, with `if_version`. Redraw it: what's there was a stand-in, not a base. What stands is where things sit and how large, what happens when, and the words. Type keeps its sizes and weights. A new face changes widths, so widen a line's box and never shrink its type. A listed scene with no module is new.

## Cut short

For any film: have finalize.md, motion.md, film-api.md and rough-cut.md in this conversation (recreate-ui.md too if it shows their product), and `list` `modules` unless you just did. Before you reread any scene, read `shared.js`: mend a fault there, and on an older film with no `window.W` start it with `window.W = window.W || {};` (`if_version`). A scene named in "Scenes left" that has a module either failed when the page ran it or is listed by mistake, because the sentence can be copied early and pasted late. Read the scene for a bug and fix it (`if_version`). If you find none, leave the scene as it is and say in one line that you found nothing to mend, and to tell you if it still fails. Only if they then say so, or "Scenes left" names it again, write it again, more simply, keeping its head.

- **The stage says final** (scenes missing or failing): work on those alone, meaning the named ones, any other whose code you see is broken, and any with no module in your `list`, which you write as in finalize.md. Past that mend of `shared.js`, don't touch the world, the score or the close. Say in one line what you mended. If nothing is missing and there's no bug, the first time, change nothing and say only that you found nothing to mend, and to tell you if it still fails.
- **The stage says rough:** draw the world only if `base.css` is still the first batch's few lines. Write each scene that has no module (new) or is rough (redrawn, as above), in film order. Then finalize.md's step 5, whole: read sound.md and write `score.js` (unless they asked for silence), then `"final"`, and the close.

## Scenes missing or broken

A turn cut short leaves listed scenes with no module. A scene whose code fails shows its name card in place of the scene, and nobody tells you. Read `shared.js` too: a fault there fails every scene that leans on it. An older film has no `window.W`: a new head starts `window.W = window.W || {};`. At "Continue the animation." or when you find it so, `list` `modules`, then read the named scenes that have a module, or all of them, for a bug and mend it (`if_version`). If no scene is rough, follow "Cut short". Otherwise write what is missing, rough, in film order, one `set` per message, and go no further.

## How rough

This is only for a film whose scenes are rough already: a change to it, or Continue. No new film is written this way.

A rough scene is a wireframe with the real words, places, sizes and timing. Write the picked ground, one ink that reads on it (`--second`), and type in the sizes and weights it will have, from `base.css`. `--main` and `--accent` wait for Finalize. The player shows a rough scene as if drawn by hand in black and white: that isn't yours to imitate, mend or undo. No picked color shows until Finalize redraws the scene, and you say so only if asked or after a change of color.

Every object is an outline (2 px, no fill). One that holds no words of its own gets a short label in small capitals saying what it will be (LADLE, LOGO, CHART), written `data-label="LADLE"`, so that the page never offers it for retyping and the drawing takes its place at Finalize. Words that belong to the film are real text, and stay. Use no fill, texture, shadow, secondary motion, camera, sound, font file or image asset. The scene sets `rough: true`. `base.css` holds these too:

```css
.box { position:absolute; margin:0; border:2px solid var(--second); box-sizing:border-box; font-size:30px; letter-spacing:.12em }
.box::after { content:attr(data-label); position:absolute; left:14px; bottom:10px }
```

```js
const { seg, eo, lerp } = kit;
kit.scene('pour', {
  rough: true,
  init(kit) {
    kit.stage.append(kit.h('<div class="ground">' +
      '<div class="box" data-label="MOULD" style="left:760px;top:560px;width:400px;height:360px"></div>' +
      '<div class="box pour-ladle" data-label="LADLE" style="left:960px;top:170px;width:300px;height:170px;transform-origin:0 100%"></div>' +
      '<div class="words" style="left:140px;top:150px;width:560px"><h2 class="line">Eleven hundred degrees, four minutes</h2></div></div>'));
    this.ladle = kit.stage.querySelector('.pour-ladle');
  },
  render(t) { this.ladle.style.transform = 'rotate(' + lerp(0, -24, eo(seg(t, 0.4, 1.2))) + 'deg)'; },
});
```

## What to say about fonts

The close's one sentence says only these, as quoted, where they fit (X is the family; Y is yours; Z is the shipped face underneath, or "a system font" for words the ten can't spell). As the one sentence more they rank: what you refused, or the file they asked for (Export); A, D or E; what else you could not do; a design system's colors that they didn't pick; B or C. After a font note, what you made up gets a short sentence of its own.

- A. They named X, which isn't Google's: "X isn't on Google Fonts, so I chose Y, the closest match there, and I'll use X if you send me its font files."
- B. They named X, fetched, or ask what a fetched face is called: "X loads from Google Fonts when the animation opens, and Z shows instead if X can't load."
- C. There's no `fonts`, no `modules/refaced.json`, and `base.css` names no font asset of theirs: "The text uses each device's default font, so send me the font files if you want a specific one."
- D. `modules/refaced.json` is there, you changed `sans`, and the ten spell the words: "The font picked on the page is still showing, so go to Style and set Font to Original to see the new one."
- E. `look` names font files, you have none, and `assets` holds none: "I no longer have your font files, so the animation shows Z until you send them again."
- F. With any still of a film that has a fetched family: "This still shows Z where the animation loads X from Google Fonts."

## A film with no list of scenes

A film of scenes never writes this: `kit.scenes()` builds it. A film with no `scenes.json` sets it in `film/script`:

```js
window.CUT = {
  width: 1920, height: 1080,    // integers ≤4096; vertical 1080×1920, 4:5 1080×1350, square 1080×1080
  fps: 60,                      // 24 | 30 | 60
  duration: 32.4,               // seconds, ≤300
  background: '#f4f2ee',
  chapters: [{ t: 0, label: 'Title' }, { t: 2.6, label: 'The app' }],
  async init(kit) { /* build the stage once */ },
  render(t, kit)  { /* SYNCHRONOUS: put the stage into its state at time t */ },
  score(S, kit)   { /* optional: sound.md */ },
};
```

A screen reader says a chapter's `label` for the playhead position, so word it for a listener.
