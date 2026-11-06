# Recreating the user's UI — lift it, don't redraw it

When the film shows the user's product, the stills must pass for
screenshots. That only happens when the UI in the film IS their UI: its
element tree, its compiled CSS, its tokens, its icons, its copy — pruned
to what the camera sees. Claude is far better at recreating an interface
from code than from memory or a screenshot, so when the source is
reachable (their repo, a pasted component, a design file, a running
build), read it and build from it; screenshots are for checking, not for
measuring. It has to be THEIR product or an original design.

## 1. Find the real thing

- Ask where it lives: a repo path, a dev server or deployed URL you can
  reach, a Storybook, a design file or exported HTML, screenshots as a
  last resort. Start from what is visible: grep the code for the exact
  strings on screen (placeholder text, menu labels, button titles), walk
  up to the component that renders them and down through everything it
  composes. Note the page/route component too — it sets widths, gutters
  and the split between panes.
- Collect, with file:line so you can re-check: the component tree for
  each surface; the design tokens actually referenced (CSS custom
  properties → hex, including alpha greys for hairlines and hover
  washes); font stacks and the type scale (and get the font FILES — they
  become assets); the icon set and the icon names used; radii, paddings,
  gaps, shadows, border colors; the real copy (i18n files included);
  state variants (hover, selected, loading, streaming, disabled) and
  what toggles them.
- Prefer the variant real users see today (feature flags default off
  unless the brief is about the flagged thing). If two shells exist,
  ask which in the intake message.
- **Keep `film/SOURCES.md`** as you go: per surface, the component
  files (file:line), the token file, the icon names, the copy source,
  and every value you could NOT lift (marked "approx", with what you
  did instead). The hand-off caveats and your background check both
  read from it.

## 2. Lift it — two routes

**A. A rendered copy is reachable** (a dev server, Storybook, a deployed
page, an exported design artboard, an HTML mock): drive it headless into
the state you need (stub the flag or the response that unlocks it), then
lift markup, CSS and numbers in one go. Keep class names verbatim.
Highest fidelity, cheapest:

```js
// playwright-core is installed in the skill dir; point it at the page and the subtree you need
await page.coverage?.startCSSCoverage?.();                    // Chromium: which rules actually apply
await page.goto(url); await page.waitForSelector(sel);
const html = await page.$eval(sel, (n) => n.outerHTML);
const css = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } }).join('\n'));
const used = await page.coverage?.stopCSSCoverage?.();         // ranges → keep only used rules when pruning
const probe = await page.$eval(sel + ' [data-testid], ' + sel + ' button', (ns) => ns.slice(0, 12).map((n) => { const c = getComputedStyle(n), r = n.getBoundingClientRect(); return [n.className, r.width, r.height, c.fontSize, c.fontWeight, c.borderRadius, c.padding, c.color, c.backgroundColor]; }));
```

Write `probe` into SOURCES.md: those are the numbers you check your
close-ups against later.

**B. Source only**: rebuild the markup by hand FROM the JSX/templates —
the same element nesting, the same class strings, the same inline
styles — and GENERATE its CSS rather than remembering it: for
utility-class repos run the project's own CSS build over your lifted
markup (e.g. its Tailwind config with `content` pointed at your module
files) and keep the output; for CSS modules / vanilla-extract / plain
stylesheets copy the compiled rules from the package's build output or
source; read custom properties from the token files and define them
verbatim at the top of your module. Copy exact numbers; never round to
a 4/8 px grid or substitute a framework default. Where the source
computes a size (a column clamp, a `calc()`), keep the formula.

Either way the product keeps its identity: its accent color, its
neutral buttons, its own spacing. The film's display type, accent and
lively motion belong to the cards and shapes around it, not inside
product chrome.

## 3. Make it film-ready

- **Strip behavior**: no `<script>`, handlers, iframes, external
  `src`/`href`/`url()`; a product video becomes a clip asset. Product imagery becomes film assets
  (`assets/…`, referenced through `kit.assets.url(name)`) or inline SVG.
- **Fonts**: ship the product's faces as font assets (a Google family, in a film of scenes: a slot of `fonts`, rough-cut.md's `fonts`) and map its
  families onto them with a few override rules at the end of your module
  (`--font-ui: "BrandSans-500"`); a look-alike face is the first thing
  that reads "mock". **Icons**: product chrome is half icons, and a wrong
  stroke weight is the second; inline the real SVG paths (or the icon
  font as an asset) — never emoji or a look-alike.
- **Prune** the CSS to rules that match something on screen (a coverage
  pass in a headless page, or by hand from the class list) — a lifted
  app stylesheet is 400 KB+, a pruned scene is 30–150 KB. Keep
  `@font-face` out (assets register themselves); keep keyframes out
  (they won't run). Split what remains into modules per surface.
- **Namespace each plate** (prefix or wrapper class) — two lifted
  surfaces will share a class name (`.session`, `.composer`) and one
  silently restyles the other.
- **States are attributes you toggle from t** (`data-hover`,
  `data-sel`, `data-on` + rules for them) — `:hover` and friends never
  fire in a film: menu open, row hover tint, selected ring, button
  pressed, "Saving…", toast shown. Menus, popovers, toasts and "after"
  states live in the same markup, positioned where they open; a change
  big enough to reflow the page is a second fragment you cross-fade to,
  or a transform/clip you animate (`translateY` for scroll, `clip-path`
  for a panel growing).
- **Product micro-animations** (a spinner, a progress shimmer, a
  thinking mark) come from the product's own sprite or keyframe data,
  stepped from t (`frame = floor(t*30) % n`) — never a look-alike. Large
  sprite JSON shrinks 30–45 % by rounding path coordinates to integers;
  keep it in a `.json` module.
- **Dynamic text is spans**: a typed field is a text node you set to the
  typist's prefix plus a caret element; streamed prose is one
  `<span class="w">` per word revealed by count; status rows are list
  items revealed by index with the product's own shimmer class while
  "running" (drive the shimmer's phase from t).
- **Hooks**: put `data-v="send"`-style attributes on everything the
  cursor clicks, the camera frames or a mark annotates, so your cut can
  find them (`kit.srect`/`kit.center`/`kit.camrect`) by a stable selector.
- **Size**: build the window at real CSS pixels (a ≈1440×900 laptop
  window on a 1920-wide stage, or a 390-wide phone) on a plain desk; the
  camera does the zooming, never font-size.

## 4. Check fidelity before anyone sees it

Render the recreated surface at z = 1 with `frames.ts` and put it beside
a real screenshot (or the running product) in one contact sheet; look
for the tells reviewers catch: squashed controls (a 28 px button drawn
24), wrong font weight or tracking, greys that are flat instead of the
product's alpha-on-ink, missing hairlines, radii off by 2 px, icon size
and stroke, truncation and ellipsis behavior, scrollbars that should
not be there, a selection ring hugging the row instead of the text, a
drag ghost under instead of over. Then check one close-up at z ≈ 2 — at
that scale a 1 px error is 2 px. Fix these as content bugs.

## 5. When the input is a design, not shipped code

A design file's exported HTML, an HTML prototype or a Figma export is
lifted the same way (route A on its HTML; its token sheet for values).
Say in the hand-off which parts are design rather than product, and put
"Concept mock · Month YYYY" small and grey on the closing card. Never
invent product features to fill a beat; film what exists or what the
design shows.

## When the film shows a product being used

- **The person touches the real thing, not its caption** — retype the
  placeholder inline, scrub the number field, recolor through the real
  popover; never edit a heading that merely labels the design. Best
  single beat in the walkthroughs: the cursor drifting down a menu with
  the row tint following before it settles — a person deciding.
- **Fidelity is the whole trick.** Called out as
  blockers: a 28 px toolbar button drawn 24, a selection ring spanning the
  row instead of hugging the text, a drag ghost painting under artboards,
  text snapping under a slow zoom. Names and data are fictional ("Acme");
  anything speculative gets a tiny grey "Concept mock · Month YYYY" on the
  closing card.

## Small things that are easy to get wrong

- Cursor: about 30 px on screen at any zoom (counter-scale by 1/z), a click ring and press dip, a 5–8% hover tint on targets.
- Marks that annotate UI ride with the camera; 8–10 px at 1080p, drawn on over 0.3–0.45 s, held 0.8 s or more.
- Zoom: body UI text is about 26 px on screen or more, so 14 px UI text wants 1.9× or more. Build a mock window smaller and denser (about 1440×900 on a 1920-wide stage) so that a 2–3× camera has somewhere to go, and never sit on a whole window longer than about 1.2 s.
- Causality: the field is clicked, text types with visible keystrokes (20–26 characters a second, with jitter), the button lights, the result builds.

## The kit for product films

**Marks** draw themselves on, as if by hand: `const marks = new kit.Marks(kit.svgLayer()); marks.add({id, kind, t0, dur, out,
color, width, …geometry}); marks.render(t)`. Set `color` from the film's palette: a mark with none draws red. Kinds and geometry: `circle {x,y,w,h}`, `underline {x,y,w}`, `arrow {from:[x,y], to:[x,y]}`,
`bracket {x,y,h,side}`, `scribble {x,y,w,h}`, `burst {x,y,r}`, `check {x,y,size}`, `cross`, `path {d:[[x,y],…]}`.

**Geometry** for camera keys and cursor targets (stage px; measure in
`init` after building, or per frame for moving things): `kit.srect(node)` → `{x,y,w,h}` as seen on the
stage (camera included); `kit.camrect(node, cam)` → the same in the
camera's un-zoomed scene space (author camera keys, marks and cursor
targets in this space); `kit.center(node, dx, dy)` → a `() => [x,y]`
for cursor keys; `kit.phraseRect(el, 'phrase')` /
`kit.phraseCamRect(el, phrase, cam)` → the box of a sub-string (null
until it has streamed in) for underlines and circles.

**Cursor** — `const cur = kit.cursor()` mounts the arrow at stage level
and returns it; move `cur.el` into your camera layer to author in scene
coordinates (it then scales with the zoom; counter-scale by 1/z if you
want it a constant ~30 px). `cur.keys = [{t, at: [x,y] | () => [x,y],
bow?: 0.12, lin?}]` (eased, arced travel between keys), `cur.clicks =
[t…]` (ring + press dip), `cur.holds = [[a,b]…]`, `cur.ewSpans`,
`cur.shapes = [{spans: [[a,b]], gfx: kit.cursors.text}]`,
`cur.visible = t => opacity`; `cur.render(t)`.

**Walkthrough devices** — `kit.chip(text, {x, y, anchor: [ax, ay]})`
→ a caption chip (white pill, 26 px system sans unless `style:
'font-family:…'` names a font asset; leader + dot to the anchor);
`kit.show(node, t, tIn, tOut?)` fades/raises it from t;
`kit.spotlight(rect, amount 0..1, {pad = 24, radius = 18})` dims
`kit.fx` outside the rect (call inside `render`, after your own fx
drawing).

**Plates (HTML sprites)** — `await kit.raster(htmlOrNode, {css, width,
height, scale = 1})` in `init` → a canvas of that fragment rendered with
the stage fonts by the export's own DOM rasterizer; `drawImage` it per
frame for heavy static screens you only pan or zoom. Whatever `init`
makes or decodes (plates, `kit.assets.image()`, measured rects) lives
for the whole film; frames never reload assets. `kit.plateStats()`.

## Content and design rules shared by every appifact family

<!-- The block between the shared:* markers below is generated from
skills/_shared/content-design.md by scripts/inline-shared.ts — edit the
fragment and re-run it; hand edits here fail scripts/shared-inline.test.ts. -->

In a film, motion.md and finalize.md decide how much to draw and when to ask.

<!-- shared:content-design -->
These rules are about the CONTENT authored into the appifact — the
deck, the artboards, the dashboard, the seeded cards and rows — as
opposed to its chrome (the kit, the toolbar, the document machinery).
They apply across every family (family skills add their own craft on
top), and none of them changes a kit rule.

- **Do not add filler content.** Never pad a design with placeholder
  text, dummy sections, or informational material just to fill space.
  Every element should earn its place. If a section feels empty, that's
  a design problem to solve with layout and composition — not by
  inventing content. One thousand no's for every yes. Avoid "data slop"
  — unnecessary numbers, icons, or stats that are not useful. Less is
  more; bias towards minimalism.
- **Ask before adding material.** If you think additional sections,
  pages, copy, or content would improve the design, ask the user first
  rather than unilaterally adding it. The user knows their audience and
  goals better than you do.
- **Targeted changes stay targeted.** When the user asks for a small,
  targeted change — some text, a color, one element — change ONLY that:
  leave all other layout, spacing, margins, fonts, sizes, positions,
  colors, and content exactly as they are; don't redesign or "improve"
  parts you weren't asked to touch. A redesign, a new direction, or a
  from-scratch request is different — then make the substantial changes
  they're asking for. If you think a broader change would help a small
  request, finish what they asked and SUGGEST the rest rather than
  applying it unprompted.
- **Follow an existing design's visual vocabulary.** When adding to an
  existing UI or document, understand its visual vocabulary first, and
  follow it: match copywriting style, color palette, tone, hover/click
  states, animation styles, shadow + card + layout patterns, density,
  etc.
- **Avoid AI slop tropes:** including but not limited to aggressive use
  of gradient backgrounds, emoji (unless explicitly part of the brand),
  and containers with rounded corners and left-border accent color.
  Emoji in content: only if the brand or design system uses them.
  (Appifact chrome is stricter still — never emoji as UI glyphs —
  that rule is unconditional.)
- **Recreate from source, not from memory or screenshots.** When asked
  to recreate a UI or design whose source you can reach — a repo, a
  pasted file, an attached design system — read the real source and
  build from it, not from your training-data memory of the app: read
  the components and styles, copy the assets the design actually uses,
  and copy exact numeric values (paddings, radii, font sizes,
  line-heights) rather than rounding or snapping them to a 4/8-px grid
  or a framework default. Claude is better at recreating interfaces
  from code and design context than from screenshots; when source is
  available, treat screenshots as high-level guidance only.
- **Do not recreate copyrighted designs.** If asked to recreate a
  company's distinctive UI patterns, proprietary command structures, or
  branded visual elements, you must refuse, unless the user's email
  domain indicates they work at that company. Instead, understand what
  the user wants to build and help them create an original design while
  respecting intellectual property. (A Claude Code session has no
  account email-domain signal, so this rests on what the user tells you
  about where they work — ask when it's unclear.)
<!-- /shared:content-design -->
