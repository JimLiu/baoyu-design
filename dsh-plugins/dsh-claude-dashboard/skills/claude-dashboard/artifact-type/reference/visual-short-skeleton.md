# A Visual short's skeleton: HTML and CSS

Working HTML and CSS that, with the script in
`artifact-type/reference/visual-short-script.md`, already do what
`visual-short.md` says has to hold: one writer for each part, the fit, the
containers, filling each marked figure, cues worked out after filling, one
clock, keeping step with Listen, captions that keep off the drawing where they
can, and the controls. Start from them and change whatever the piece needs,
keeping the class names the script looks for. What is left to write is the piece
itself: the chapters and captions, the calcs, a `dash.draw` per chart, one
function in `scenes` per chapter, `fmt`, and the look of the drawings.

```html
<meta name="dash-one-writer">
<div class="vs">
  <section class="vs-stage" data-read-stage><div class="vs-in">
    <div class="vs-chapters">
      <article class="vs-ch">
        <p class="vs-label">Part of the story</p>
        <h2>A sentence that states the finding</h2>
        <div class="vs-draw"><div data-draw="d1" data-source="orders"></div></div><!-- a chart is a drawing, stored empty; words and single figures beside it are HTML, each figure data-draw="fig" -->
        <p class="vs-src">Measure, who, dates. Runs about <span class="vs-runs" data-draw="runs">—</span> seconds.</p>
      </article>
      <!-- one .vs-ch per chapter; only the first, the title, has "Runs about … seconds." -->
    </div>
    <div class="vs-caps" data-read>
      <p class="vs-cap" data-read-step><span class="vs-s"><span>An email order cost about <span data-draw="fig" data-source="said" data-field="cost" data-where="channel=Email">—</span>.</span></span> <span class="vs-s"><span>The next sentence.</span></span></p>
      <!-- one .vs-cap per chapter, in the same order; one .vs-s per sentence, its words in an inner span, which is the box; nothing else in here: whatever is, is read aloud too -->
    </div>
    <div class="vs-controls">
      <button class="vs-toggle" aria-label="Play"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.44 3.682L11.59 6.765C12.022 7.024 12.286 7.497 12.286 8C12.286 8.503 12.022 8.976 11.59 9.235L6.44 12.318C6.241 12.437 6.014 12.5 5.782 12.5C5.074 12.5 4.5 11.926 4.5 11.218L4.5 4.782C4.5 4.074 5.074 3.5 5.782 3.5C6.014 3.5 6.241 3.563 6.44 3.682Z"/></svg><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="3" height="9" rx=".75"/><rect x="9.5" y="3.5" width="3" height="9" rx=".75"/></svg></button>
      <button class="vs-back" aria-label="Back"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8L10 12.5"/></svg></button><button class="vs-next" aria-label="Next"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8L6 12.5"/></svg></button>
      <button data-read-play>Listen</button><!-- the dashboard wires it, and hides it where there is no voice; here, clear of the open player's Close -->
      <div class="vs-line">
        <button class="vs-mk" aria-label="Part of the story"><i></i></button>
        <!-- one .vs-mk per chapter, named for its label -->
      </div>
      <button class="vs-cc" aria-label="CC, captions" aria-pressed="true">CC</button>
    </div>
    <p class="vs-now" aria-live="polite" data-draw="now"></p>
  </div></section>
  <i data-draw="settle"></i><!-- keep it last: drawings run in order, and this one needs the others filled -->
</div>
```

```css
.vs, .vs-stage { container-type: inline-size; }
.vs-stage { box-sizing: border-box; aspect-ratio: 16 / 9; width: min(100%, calc(var(--room, 70dvh) * 16 / 9)); margin-inline: auto; overflow: clip;
  background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: var(--cds-radius); }
@container (max-width: 800px) { .vs-stage { aspect-ratio: 1; width: min(100%, var(--room, 70dvh)); } }
@container (max-width: 560px) { .vs-stage { aspect-ratio: 4 / 5; width: min(100%, calc(var(--room, 70dvh) * 4 / 5)); } }
.vs-in { box-sizing: border-box; height: 100%; padding: 3cqi 3.6cqi; display: grid; grid-template-rows: minmax(0, 1fr); position: relative; }
.vs-chapters { display: grid; box-sizing: border-box; isolation: isolate; } /* isolated, or a z-index in a drawing lifts it over the caption and the controls */
.vs-in, .vs-chapters, .vs-ch { grid-template-columns: minmax(0, 1fr); } /* Without this, one wide child widens every column. */
.vs-ch, .vs-cap { margin: 0; opacity: 0; transition: opacity 400ms var(--cds-ease-out); }
.vs-ch.vs-on, .vs-cap.vs-on { opacity: 1; } .vs-ch:not(.vs-on) { pointer-events: none; }
.vs-ch { grid-area: 1 / 1; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; }
.vs-label { text-transform: uppercase; }
.vs-draw { container-type: size; display: flex; flex-direction: column; justify-content: safe center; font-size: max(12px, 1.8cqi); } /* a container of its own: inside it, cqh is 1% of the drawing's height, which comes from .vs-ch's 1fr row, not from what it holds */
/* The chapter has the whole stage. A caption takes no room: it lies over the stage's foot, and the script slides it along the foot to where it covers nothing drawn.
   It is placed against .vs-in, so .vs-caps must stay unpositioned and .vs-cap must have no grid-area, which would place it inside .vs-in's padding.
   Presses pass through it to the stage; the price is that its words can't be selected, and a figure in it shows no tip on hover. */
.vs-chapters, .vs-caps { grid-area: 1 / 1; }
/* Listen's player opens 16px under the holder's own box, as wide as it. So the holder, a box of no height, stands 16px above the pill, as wide as the pill less CC:
   the player opens where the pill was, and CC stays at its right end (on a narrow touch stage CC hides instead: see below). */
.vs-caps { display: block; height: 0; font-size: max(14px, 2cqi); pointer-events: none;
  justify-self: end; width: calc(min(100%, 400px) - 42px); margin: -22px 42px calc(var(--row) + 16px) 0; }
.vs-cap { position: absolute; inset: auto 0 14px; margin-inline: auto; display: grid; justify-items: center; align-items: end; inline-size: min(84cqi, 560px); text-align: center; text-wrap: balance; }
/* One sentence shows at a time, in a box of the opposing color that hugs each line. The rest, and all of them with captions off, are hidden from the eye alone. */
.vs-s { grid-area: 1 / 1; opacity: 0; } .vs-s.vs-on { opacity: 1; }
.vs-s > span { padding: 0.16em 0.5em; border: 1px solid transparent; /* a frame in forced colors */ border-radius: 6px; box-decoration-break: clone; -webkit-box-decoration-break: clone;
  line-height: 1.8; font-weight: var(--cds-font-weight-medium); background: var(--color-fg); color: var(--color-panel); }
.vs-hush .vs-caps { opacity: 0; }
/* The controls: one small pill, made like the dashboard's own read-aloud player, at the top right on the label's line, away from claude.ai's own bars under the page.
   On a narrow stage it has a row of its own above the label. */
.vs-in { --row: 32px; }
@media (pointer: coarse) { .vs-in { --row: 52px; } }
.vs-label { min-block-size: calc(var(--row) - 2px); padding-inline-end: 416px; } /* room for the pill */
.vs-controls { position: absolute; inset: calc(3cqi - 6px) 3.6cqi auto auto; box-sizing: border-box; width: min(100% - 7.2cqi, 400px); height: var(--row);
  display: flex; align-items: center; gap: 6px; padding: 4px; border-radius: 10px;
  background: var(--color-panel); box-shadow: 0 0 0 1px var(--cds-border), 0 1px 2px rgb(0 0 0 / 6%), 0 2px 8px rgb(0 0 0 / 8%); }
/* vs-idle, vs-held and vs-touch come from the script. The pill fades by opacity, not display, so a keyboard and a screen reader still reach it.
   :focus-visible, not :focus-within: in most browsers a button pressed with the mouse keeps focus, which would hold the pill up. */
.vs-controls { transition: opacity 200ms var(--cds-ease-out); }
@media (hover: hover) { .vs-playing .vs-stage:is(.vs-idle:not(.vs-held), :not(:hover, .vs-touch)):not(:has(:focus-visible)) .vs-controls { opacity: 0; transition: opacity var(--cds-dur-slow) var(--cds-ease-out) 300ms; } }
@media (prefers-reduced-motion: reduce) { .vs-controls { transition: none !important; } }
.vs-controls > button { flex: none; height: 100%; min-inline-size: 24px; padding-inline: 6px; font: inherit; font-size: 13px; color: var(--color-fg); background: none; border: 0; border-radius: 6px; cursor: pointer; }
@media (hover: hover) { .vs-controls > button:hover { background: var(--cds-border); } .vs-mk:hover { background-size: 100% 5px; } } /* on touch, hover sticks after a tap */
.vs-controls > button:has(svg) { display: grid; place-items: center; padding-inline: 4px; }
.vs-controls svg { grid-area: 1 / 1; inline-size: 16px; block-size: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; } /* CDS's Play, Pause, CaretLeft and CaretRight, 16px, as its Icon draws them: a page has no icon font */
@media (pointer: coarse) { .vs-controls > button:has(svg) { min-inline-size: 40px; } .vs-controls svg { inline-size: 20px; block-size: 20px; } } /* as in the dashboard's own player */
.vs-cc[aria-pressed="false"] { color: var(--color-fg-muted); text-decoration: line-through; }
.vs.vs-playing .vs-toggle > :first-child, .vs:not(.vs-playing) .vs-toggle > :last-child { visibility: hidden; }
/* The chapter marks: each a button as tall as the pill's inside that draws a 3px bar. */
.vs-line { flex: 1; align-self: stretch; display: flex; gap: 4px; padding-inline: 8px; min-inline-size: 0; }
.vs-mk { flex: 1; min-inline-size: 0; display: flex; align-items: center; padding: 0; border: 0; cursor: pointer; forced-color-adjust: none;
  background: linear-gradient(var(--cds-border) 0 0) center / 100% 3px no-repeat; }
.vs-mk i { display: block; width: 0; height: 3px; background: var(--color-fg); }
@media (forced-colors: active) { .vs-mk { background-image: linear-gradient(GrayText 0 0); } .vs-mk i { background: CanvasText; } .vs-controls { outline: 1px solid; } }
.vs-controls > .vs-cc { inline-size: 32px; } /* whatever the font: the holder leaves it just that room */
#dash-root[data-dash-read-phase] .vs-controls { display: contents; }
#dash-root[data-dash-read-phase] .vs-controls > :not(.vs-cc) { display: none; }
#dash-root[data-dash-read-phase] .vs-cc { position: absolute; inset: calc(3cqi - 2px) calc(3.6cqi + 4px) auto auto; height: calc(var(--row) - 8px); }
@media (forced-colors: active) { #dash-root[data-dash-read-phase] .vs-cc { outline: 1px solid; } }
@container (max-width: 400px) { .vs-line { padding-inline: 0; gap: 2px; } } /* room for the marks */
/* On a narrow touch stage the player's larger buttons need the pill's whole width, so CC hides while it is open; under about 317px even that is too narrow for them. */
@media (pointer: coarse) { @container (max-width: 400px) { .vs-caps { width: 100%; margin-right: 0; } #dash-root[data-dash-read-phase] .vs-cc { display: none; } } }
@container (max-width: 800px) { .vs-caps { margin-top: -16px; } #dash-root[data-dash-read-phase] .vs-cc { top: calc(3cqi + 4px); } .vs-controls { top: 3cqi; } .vs-chapters { padding-top: calc(var(--row) + 8px); } .vs-label { min-block-size: 0; padding-inline-end: 0; } }
.vs-now { position: absolute; width: 1px; height: 1px; margin: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
```
