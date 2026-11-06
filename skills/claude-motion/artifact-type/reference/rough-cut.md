# The film's records

This page holds the first batch and how a scene module is built. SKILL.md says when each step happens; finalize.md says
how the film gets drawn. The example is another film's (a bell foundry's open day): copy how it's built, never its
scenes, words, colors, typeface, shapes or times. `if_version` applies only if your tool's input lists it.

## The first batch

Send it at once, before you design any scene, in this order. The film then plays, with a plain card for each scene
still to come.

**`film/meta`**, then **`modules/scenes.json`** (`kind` json):

```json
{"v":1,"stage":"rough","look":"First bell: A drawn brick yard in morning light, with smoke and long shadows",
 "palettes":[["#17455C","#FFC24B","#FFF1DE","#2A1410"],["#10201D","#3E8F84","#C9E4DC","#D98A3D"],["#F3EFE6","#7A4B2A","#2B211A","#C8962E"]],"theirs":0,
 "width":1920,"height":1080,"fps":60,"background":"#F3EFE6",
 "fonts":{"display":{"family":"…","or":"…"},"sans":{"family":"…","or":"…"}},"scenes":[
  {"id":"yard","name":"The yard","dur":3,"desc":"Gates open on the foundry yard; the date sets in."},
  {"id":"pour","name":"The pour","dur":4.5,"desc":"The ladle tips; bronze runs into the mould."},
  {"id":"ring","name":"First ring","dur":4,"desc":"The bell swings once; the birds go up."},
  {"id":"come","name":"Come and see","dur":3.5,"desc":"End card: day, place, free entry."}]}
```

**Scenes.** Plan two or three for 10 seconds, three or four for 20 and five or six for 30; the player takes 24 at most, and the seconds add
up to the Length answer, 300 at most. Judge how rich the film should be (motion.md), and say "rich" or "plain" in `look`. Each scene makes one clear point, not one symbol, that the viewer can take in at once: cut what doesn't serve it, and keep the detail that does. Many films go from an establishing
open, through the subject arriving and the thing happening, to an end card held 3 s or more, but that's a habit, not a
rule: a poem may want one long drifting shot. Nothing blinks or cuts more than three times a second, rough or finished.

- `id`: lower-case letters, digits and `-`, a letter first, 32 at most. It never changes and no two are alike, because
  comments and the user's own edits hang on it. A bad `id`, `dur` or count stops the whole film.
- `name`: one to three words (48 characters at most), for a listener: "The pour", not "Scene 2".
- `dur`: seconds, above 0. `desc`: one plain sentence on what happens. A person is in it only if the ask needs one (motion.md).

One continuous action (one window, one camera move, one cursor's errand) is ONE scene, however long: nothing carries
over a cut. The one exception: a character or object that moves about or travels (a window, screen, cursor, card or logo
is not one). Where two scenes in a row show it, the second must **open in the same framing, with it as the first's code
left it**: place, size, pose, speed; plan none of its moves ahead, in thought or in `shared.js`.

**Other fields.**

- `stage`: `"rough"` until the film's last write: to the page, "not done yet".
- `width`, `height`: vertical (Reels, TikTok, Shorts) is 1080 by 1920.
- `background`: the picked ground (an overlay: `"transparent"`, and `.ground` paints nothing).
- `look`: the look in words, for whoever draws the scenes, perhaps in another conversation: the picked option's name and
  line, and whatever they typed, word for word. If you decided, a name and line of your own. Either way, add rich or plain. Before you write the look line, hold it against motion.md's never-draw list: no red rising sun with rays; no spread eagle or heroic figure against a red or pale disc, rays or a field of red. A sunset, a moon or a sunrise that the person asks for stays.
- `palettes`: every palette the Colors question offered, picked or not, in the order shown (the picked one is not moved
  up), each its four colors as `#rrggbb` in role order (ground, main, second, accent); for a palette offered in words alone, settle its
  four now. `theirs`: how many of them, from the first, are the user's. If they answered Other or in words of their
  own, the palette you made of that stands first and counts as theirs.
  With no Colors question: the film's own four alone, `theirs` 1 if they are the user's, else 0. Keep both keys at every
  later write: the page offers them again.

**`fonts`** names the film's faces, in four optional slots: `sans`, `serif` and `mono` for text, `display` for headlines. A
slot takes one of the ten faces that ship with the player, by id, or nearly any Google Fonts family with the nearest of
the ten to stand in: `{"family":"…","or":"…"}`. Name it from memory and look nothing up; the player fetches it, and `or`
shows where it can't. A family brings weights 400 and 700, or its nearest, never thickened; for others list them, four at most:
`"weights":[400,800]`. With `display` unnamed, headlines take `sans`. A line must still fit where `or` shows, so leave it room.
With a design system in play, its faces come first: from `type.families` in its `tokens.json`, a family Google hosts goes in its slot by name. Keep `fonts` at every later write. Never download a font or search the machine for one.

The ten. Text: `plus-jakarta-sans` (wide), `manrope` (round), `space-grotesk` (angular), `instrument-sans` (narrow),
`fraunces` (serif), `dm-mono`, `departure-mono` (pixel), these two of one weight. Headlines: `fraunces-display` (hairline,
one weight, the only italic), `inter-display` (loud, to 900), `shantell-sans` (hand-drawn, slants from 600 up). `manrope` goes to 800.

**Type is Inter and Space Grotesk unless the brief calls for other lettering.** With Western European words, no design
system, and no family or lettering asked for in the request or in `Style (other)`, `display` is `space-grotesk` and `sans` is
`{"family":"Inter","or":"instrument-sans"}`. A Style option alone leaves this default in place. Inter sets wider than
`instrument-sans`, so leave each line room for it. If only `display` is named, `sans` still takes that default; if a text face
is named, leave `display` unnamed. For other lettering, think what kind of face is at home there (a hymn book, a shop
sign), then a family of that kind fit for work. Two faces are enough; a third only as `mono`, for code or figures in
columns; figures that count up need `tabular-nums` in a mono, `instrument-sans`, `space-grotesk`, `plus-jakarta-sans` or
`inter-display`.

If the user names a family, use it, spelt right, in the slot they mean (titles: `display`; the text: `sans`; the whole film:
`sans` and no `display`; one of the ten: its id), or the nearest Google family if it isn't Google's, and say so:
"X isn't on Google Fonts, so I chose Y, the closest match there, and I'll use X if you send me its font files." Of a fetched family
they named (Z is the shipped face underneath, or "a system font" for words the ten can't spell), say "X loads from Google Fonts when the animation opens, and Z shows instead if X can't load." With no `fonts` and no font file of theirs, say "The text uses each device's default font, so send me the font files if you want a specific one." In the one closing sentence, what you refused or
the Export note comes first, then these font notes; after a font note, what you made up gets a short sentence of its own. Font files they gave go in as assets over the nearest of the ten, with no
`display` of yours, each named by its stem in `base.css` ahead of the stack (`#stage { font-synthesis:style; font-family:"Face-400", var(--sans, system-ui, sans-serif) }`); a bold is a face of its own. The ten have Western European letters only: for other scripts use one or two well-known Google families that hold
them, and for Chinese, Japanese or Korean leave `fonts` out.

**`modules/base.css`** (`kind` css), six lines at most for now: the picked colors as variables, each once, a plain
`#rrggbb`, no two alike (the page reads them to offer palettes); `.ground`, the element every scene paints first, at the bottom; the type stacks,
written as below or as `var(--serif, Georgia, serif)` or `var(--mono, ui-monospace, monospace)`, never a family's name
(`#stage` wears the one most words wear); the few classes every scene uses. Pin a group of words by the edge it grows
away from, so that a line that wraps has room on any shape of film.

```css
#stage { --ground:#F3EFE6; --main:#7A4B2A; --second:#2B211A; --accent:#C8962E; color:var(--second); font-family:var(--sans, system-ui, sans-serif) }
.ground { position:absolute; inset:0; background:var(--ground) }
.words { position:absolute; margin:0; display:flex; flex-direction:column; gap:24px } .words > * { margin:0 }
.line { font-family:var(--display, var(--sans, system-ui, sans-serif)); font-size:84px; line-height:1.05; font-weight:700 } .sub { font-size:36px }
```

**`film/script`**, last: `{"code":"window.CUT = kit.scenes();"}`, that line and nothing else, for the film's whole life.

## A scene

One document per scene: `modules/scene-pour.js` (`kind` js) for the scene `pour`. The player looks for that name and no
other. finalize.md has a whole one; this is the bare shape.

```js
const { seg, eio, lerp } = kit;
kit.scene('pour', {
  init(kit) {
    kit.stage.append(kit.h('<div class="ground"><div class="pour-ladle"></div></div>'));
    this.ladle = kit.stage.querySelector('.pour-ladle');
  },
  render(t) {
    this.ladle.style.transform = 'rotate(' + lerp(4, -24, eio(seg(t, 0.3, 1.2))) + 'deg)';
  },
});
```

- One `kit.scene` call per module, for its own id. At the top level: constants, the drawings it adds to `W` for
  later scenes (finalize.md) and that call, no DOM.
- `init(kit)` builds the scene once inside `kit.stage`. It's optional and may be async. The whole film loads again at
  every write, so keep it light, and await whatever `render` needs: the player tries `render(0)` as soon as `init` settles,
  and a throw there fails the scene.
- `render(t, kit)` is required, synchronous and pure: it sets every varying property from `t` alone, in seconds since the
  scene began. No CSS transitions or animations, no timers, nothing remembered from the frame before. What `init` built
  goes on `this`, under any names but `init`, `render` and `rough`.
- A scene's `kit` is its own: `kit.stage` fills the stage and has no ground of its own, and what `kit.css` and `kit.svgLayer`
  make stays in the scene. `kit.dur` is the scene's seconds, `kit.start` where it begins; `kit.video`'s `start` and `kit.typist`'s
  `t0` count from the scene's beginning. `kit.fx` is one canvas shared by all scenes: set its state in `render`, never in `init`.
- Scenes cut from one to the next. Open what moves about as it was left; else build each to stand alone, holding its
  first and last picture for a `t` below 0 or past `kit.dur` (`seg` does). The first scene at `t` 0 is the poster and
  thumbnail: never blank.
- A scene's class names and ids begin with its id (`pour-ladle`). `scenes.json`, `base.css`, `shared.js`, `score.js` and any
  name that begins `scene-` or `layer-` are the player's: name no other module so.
- Helpers: `kit.el`, `kit.h` (returns ONE element: wrap siblings in one root), `seg(t,a,b)` (0 to 1 across a to b), `lerp`,
  `clamp01`, `eo` `ei` `eio` (eases). The rest is in film-api.md.

Three things the page's own tools depend on:

- **A line of words, a drawing's labels and signs too, is ONE whole string literal in an HTML element, never svg `<text>`
  or `fillText` (svg the user gave aside).** The page lets the user retype it and finds it by those words, so no id, class or key is spelt like
  them. Word by word: `kit.TextFx` or `line.split(' ')`, never written in pieces.
- **Lines that belong together** sit in ONE flow container (`.words`), placed as a group, so that a line that wraps pushes
  the next one along. A lone line sits in a `.words` too.
- **Markup goes in single-quoted strings, `style="…"` in double quotes, no quotes inside a style:** a nested quote silently
  ends the style, and the rest is lost.

`modules/{retyped,recolored,refaced,fetched-fonts,recut,retouched}.json` are the page's own records: never write or
delete them. If the film holds one besides fetched-fonts.json, first read `artifact-type/reference/by-hand.md`.

A change, Scenes missing or broken, How rough, Finalize ("A rough cut redrawn"), Cut short: now in `artifact-type/reference/later.md`.
