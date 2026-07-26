---
name: "watercolor-illustration"
description: "Watercolor illustration\nCode-painted watercolor images"
---
Watercolor illustration — code-painted images in the house watercolor style, made with the `paint_watercolor` tool.

WHAT THIS IS
You paint by writing a short JavaScript painting script that `paint_watercolor` runs in the project's script sandbox with a watercolor kit already loaded. Every picture is procedural: washes of pigment laid onto a simulated sheet of cream paper, dried with granulation and pooled drying rims, overlapping transparently (paint multiplies — it can only darken), reserved paper for whites, thin wobbly ink, a little splatter, and a tiny letter-spaced serif caption. There is no image model and no source photo. This is the sanctioned way to produce illustration in this project when this skill is active: the general guideline to avoid hand-drawing imagery in SVG is about vector markup inside a design, not about this tool. The painting is saved as an ordinary PNG file in the project (put it under `scraps/`) and then placed in the design like any other image (an `<img src="scraps/…">`, or an image slot if the layout uses slots).

THE HOUSE STYLE (what a finished piece looks like)
• Warm off-white paper with a fine, quiet grain.
• Each subject sits on ONE soft irregular wash blob (pale aqua, mint, butter, dusty rose, or deep indigo for night scenes) with visible mottling inside and a slightly darker, uneven drying rim at its edge; an occasional backrun "cauliflower" bloom.
• The subject itself is 2–5 overlapping translucent washes that darken where they cross (glazing), with darks built from layered browns/indigos — never flat black, never a gradient, never a drop shadow.
• Small reserved areas of bare paper for eyes, bellies, highlights (cut the paper back out with `reserve` BEFORE laying a light wash there — a wash can never be lighter than what is under it).
• Sparse, thin, wobbly ink contours that only partially outline the form (lost-and-found edges) plus single strokes for whiskers, grasses, branches, ripples, and a few splatter dots.
• A tiny, widely letter-spaced lowercase serif caption at the bottom.
• Generous negative space; muted, slightly desaturated pigments; the whole sheet reads light.

METHOD — PAINT IN PASSES, AND LOOK AT EVERY PASS
1. Say the picture in one sentence before any code: the subject, its pose (a 3/4 turn or tilted head beats dead-frontal symmetry), the one blob colour behind it, what stays bare paper, and what the darkest accent is.
2. Write the script as a linear painting sequence: paper → the one background wash blob → `reserve` the silhouette of the subject → the subject's washes from light to dark (2–4 overlapping shapes, NOT one geometric shape per body part — build heads and bodies from slightly wobbled blobs and loose bezier paths, never perfect ellipses, triangles or rectangles) → reserved whites put back (eyes, belly) with a thin wash over them → the contact dark / darkest accent → ink contours and single strokes → splatter → caption → `await saveFile(OUTPUT_PATH, p.render())`.
3. Render a PREVIEW first: pass a small size, e.g. `paper(600, 800, {seed, scale: 2 / 3})` keeps your logical coordinates at 900×1200 while rendering a quick 600×800. The tool returns the rendered image inline — actually LOOK at it before saying anything is done. Ask: does the subject read as that animal? Any edge that looks like a hard sticker outline? Any mud where washes piled up? Any shape that reads as a geometric primitive? Is the ink too even or dashed? Is there enough bare paper?
4. Edit the script and re-render. Two to four passes is normal; name each output with a version (`scraps/fox-v1.png`, `scraps/fox-v2.png`) so you and the user can compare.
5. When the preview is right, render the final at full size (`paper(1800, 2400, {seed, scale: 2})` — same logical coordinates, twice the resolution) to the final path, then place it in the design.

THE KIT (available globally in the script; `OUTPUT_PATH` is the PNG path you passed to the tool)
  const p = paper(W, H, {seed, scale, cream, grain});   // the sheet; all drawing coordinates are in LOGICAL units (pixels / scale)
  p.wash(shape, color, {load, deckle, feather, edgePool, edgeWidth, granulation, mottle, blooms, seed})
                                 // one wash of pigment: load = amount (0.3 pale … 1.4 deep), deckle = how much the edge wanders (px),
                                 // feather = edge softness (px), edgePool/edgeWidth = the darker drying rim, granulation = settling into paper grain,
                                 // mottle = cloudy unevenness, blooms = [[x, y, r], …] backruns
  p.gradedWash(shape, [[0, '#4c62ae'], [0.74, '#ebb18c'], [1, '#fde5c2']], {axis: 'y', profile: [[0, 0.95], [1, 0.05]]})
                                 // colour-stop graded wash (skies, grounds); or p.gradedWash(shape, colorA, colorB, {front, soft}) for two pigments meeting wet-in-wet
  p.glaze(shape, 'shadow_violet', {load: 0.35})       // a thin, soft transparent veil
  p.reserve(shape, {alpha, feather})                    // put clean paper back (eyes, bellies, clouds, cutting the subject out of a blob)
  p.ink(points | [points, …], {width, wobble, lost, color, seed})   // wobbly pencil/ink polylines; lost = 0…0.5 how much the line drops out
  p.hatch(shape, {angle, spacing, width})               // short parallel strokes clipped to a shape (feathers, fur)
  p.dryStroke(points, color, {width, load})             // dry-brush stroke that skips on the paper's grain (branches, trunks)
  p.splatter(x, y, radius, color, {n, size, seed})      // flicked droplets
  p.caption('a small watercolour fox', {size, spacing, color})    // lowercase, letter-spaced serif
  await saveFile(OUTPUT_PATH, p.render());              // always the last line
Shapes: ['blob', cx, cy, rx, ry, {wobble, seed, rot}] (the workhorse — an organic blob; wobble 0.05 for a body, 0.25 for a background wash),
        ['path', c => { c.moveTo(…); c.bezierCurveTo(…); c.closePath(); }] (any Canvas2D path), ['union', [shape, shape, …]] (several shapes as one — use this for a reserve over a whole figure), ['ellipse', cx, cy, rx, ry, rotDeg], ['rect', x, y, w, h], ['poly', [[x, y], …]].
Colours: named pigments — soft blob washes: aqua, mint, butter, rose, lavender, sky, sage, night; animal bodies: fawn, tan, rust, burnt_sienna, raw_umber, umber, yellow_ochre, cream; darks and accents: warm_dark, indigo, navy, sepia, ink, shadow_violet, olive, teal — or any '#hex' / [r, g, b] transmittance (values near 1 are a pale stain, values near 0 are deep pigment). Every call is seeded, so the same script always renders the same image.

GOOD DEFAULTS
  body washes:       {load: 0.95, deckle: 2.5, feather: 1.3, edgePool: 1.2, edgeWidth: 3.5, mottle: 0.5}
  background blobs:  {load: 0.5, deckle: 7, feather: 2.5, edgePool: 1.2, edgeWidth: 6, granulation: 0.12, mottle: 0.7}
  eyes / darkest:    {load: 2.2, deckle: 0.5, feather: 0.8, edgePool: 0.3}
  ink:               {width: 1.4, wobble: 1.3, lost: 0.35}

PITFALLS
• Paint only darkens: a cream belly over a tan body stays tan. Reserve the belly (`p.reserve(shape, {alpha: 0.7, feather: 6})`) and then lay a thin cream wash there.
• Several ellipses in one Canvas2D path join up with straight lines — use the `['union', […]]` shape instead of hand-rolling multi-ellipse paths.
• Perfect ellipses, triangles and rectangles read as vector clip-art; use `blob` with a little wobble and bezier paths, and break the symmetry.
• Do not reach for gradients, glows or drop shadows; light is bare paper and shadow is a cool wash.
• Do not write text or labels into the painting except the one caption.

WORKED EXAMPLE (a sitting fox on an aqua blob; 900×1200 logical units)
  const S = 2;
  const p = paper(900 * S, 1200 * S, {seed: 11, scale: S});
  const body = {load: 0.95, deckle: 2.5, feather: 1.3, edgePool: 1.2, edgeWidth: 3.5, mottle: 0.5};
  const soft = {load: 0.5, deckle: 7, feather: 2.5, edgePool: 1.2, edgeWidth: 6, granulation: 0.12, mottle: 0.7};
  const head = c => { c.moveTo(300, 520); c.bezierCurveTo(292, 452, 322, 430, 334, 414); c.bezierCurveTo(318, 340, 328, 296, 344, 276); c.bezierCurveTo(404, 338, 426, 390, 436, 398); c.quadraticCurveTo(462, 386, 486, 396); c.bezierCurveTo(508, 342, 548, 300, 574, 286); c.bezierCurveTo(584, 322, 580, 392, 570, 420); c.bezierCurveTo(598, 448, 610, 470, 600, 520); c.bezierCurveTo(578, 600, 520, 622, 450, 620); c.bezierCurveTo(372, 624, 320, 598, 300, 520); c.closePath(); };
  const face = c => { c.moveTo(306, 516); c.bezierCurveTo(400, 552, 506, 556, 597, 514); c.bezierCurveTo(572, 604, 510, 620, 450, 618); c.bezierCurveTo(380, 622, 324, 598, 306, 516); c.closePath(); };
  const tail = c => { c.moveTo(530, 736); c.bezierCurveTo(688, 814, 812, 640, 742, 442); c.bezierCurveTo(722, 378, 652, 372, 632, 428); c.bezierCurveTo(654, 512, 666, 604, 624, 658); c.bezierCurveTo(598, 692, 558, 702, 518, 694); c.closePath(); };
  p.wash(['blob', 452, 505, 242, 212, {wobble: 0.26, seed: 2}], 'aqua', {...soft, seed: 5});
  p.reserve(['union', [['path', head], ['blob', 452, 714, 122, 152, {wobble: 0.07, seed: 17}], ['path', tail]]], {feather: 4});
  p.wash(['path', tail], 'rust', {...body, load: 0.8, seed: 30});
  p.wash(['blob', 452, 714, 118, 148, {wobble: 0.07, seed: 17}], 'fawn', {...body, seed: 40});
  p.reserve(['blob', 452, 748, 54, 100, {wobble: 0.09, seed: 19}], {alpha: 0.62, feather: 7});
  p.wash(['blob', 452, 748, 52, 98, {wobble: 0.09, seed: 19}], 'cream', {...body, load: 0.32, granulation: 0.1, edgePool: 0.4, deckle: 4, seed: 41});
  p.wash(['path', head], 'fawn', {...body, seed: 60});
  p.wash(['path', face], 'cream', {...body, load: 0.32, edgePool: 0.6, seed: 61});
  p.wash(['blob', 400, 480, 8, 10, {wobble: 0.12, seed: 70}], 'warm_dark', {load: 2.3, deckle: 0.5, feather: 0.8, edgePool: 0.3, seed: 70});
  p.wash(['blob', 504, 478, 8, 10, {wobble: 0.12, seed: 71}], 'warm_dark', {load: 2.3, deckle: 0.5, feather: 0.8, edgePool: 0.3, seed: 71});
  p.ink([[[300, 500], [332, 424], [340, 290], [430, 396]], [[742, 446], [748, 556], [702, 676], [600, 714]]], {width: 1.4, wobble: 1.3, lost: 0.35, seed: 81});
  p.splatter(672, 400, 34, 'teal', {n: 7, size: [1.2, 2.6], seed: 12});
  p.caption('a small watercolour fox', {color: 'grey'});
  await saveFile(OUTPUT_PATH, p.render());
