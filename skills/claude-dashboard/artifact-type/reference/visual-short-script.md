# A Visual short's skeleton: the script

Goes with the HTML and CSS in `artifact-type/reference/visual-short-skeleton.md`.
Yours to write: the calcs, `fmt`, a `dash.draw` per chart and `scenes`. The rest
is the engine, which already does what has to hold: copy it as it stands, unless
the person asks for something it doesn't do.

```js
// Figures as the captions say them: rounded for the ear, still numbers from the data, so the mark check compares them.
dash.calc('said', {inputs: ['orders'], title: 'Figures as the captions say them', description: 'Rounded to two significant figures.',
  fn: (orders) => orders.map((r) => ({channel: r.channel, cost: r.cost == null || !Number.isFinite(+r.cost) ? null : +(+r.cost).toPrecision(2)}))});

const root = document.querySelector('#dash-root'), vs = root.querySelector('.vs'), stage = vs.querySelector('.vs-stage');
const [chs, caps, mks] = ['.vs-ch', '.vs-cap', '.vs-mk'].map((q) => [...vs.querySelectorAll(q)]); // one of each, and one scene, per chapter
const still = matchMedia('(prefers-reduced-motion: reduce)');
const words = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const write = (el, s) => { if (el && el.textContent !== s) el.textContent = s; }; // text only when it changes
const says = (i) => [...(caps[i]?.querySelectorAll('.vs-s:not([hidden])') ?? [])]; // a chapter's sentences, less any the data ruled out
// How a figure is written, by source and field; any other as it comes.
const fmt = {'orders.cost': d3.format('$,.2f'), 'said.cost': d3.format('$,~f')};
let said = [], durs = [], cur = 0, t = Infinity, playing = false, begun = false, raf = 0, last = 0, heard = null, was = null, pace = 1;
const phase = () => root.getAttribute('data-dash-read-phase'); // there while Listen's player is open

// While a reading is open every time is scaled by `pace`: how long the voice took over the last caption it read through, against 15 characters a second.
const paced = (at) => (phase() ? at * pace : at);
// The second at which the mark named by `word` arrives in chapter i: where the word starts in the caption; 0 if it isn't there.
const cue = (i, word) => paced(Math.max(0, said[i].indexOf(word)) / 15);
// How far a move that starts at second `from` has got at time t, 0 to 1.
const moved = (t, from, len = 0.6) => d3.easeCubicOut(Math.max(0, Math.min(1, (t - from) / len)));
// A figure that counts up: `real` is marked and keeps its value; `copy` (data-draw="copy", unmarked, aria-hidden) lies over it and counts.
const places = (v) => { const [m, e = 0] = String(v).split('e'); return Math.min(100, Math.max(0, (m.split('.')[1] ?? '').length - e)) || 0; };
const shown = (s) => (String(s).match(/\.(\d+)/)?.[1] ?? '').length; // the decimals in a figure as written
const count = (real, copy, p, value, f) => {
  real.style.opacity = p < 1 ? 0 : 1; copy.style.opacity = p > 0 && p < 1 ? 1 : 0;
  if (p >= 1) return;
  let s = f(value * p); // on the way it is never written with more decimals than the finished figure
  if (shown(s) > shown(f(value))) s = f(+(value * p).toFixed(places(value)));
  write(copy, s);
};

// One per chart: make its elements from its rows, whole, and leave a — when there are none or the status isn't "ok"; fill each mark it makes with fig(mark), but no header cell, which is a label. Runs on new data and on a new width.
dash.draw('d1', (el) => { /* el.replaceChildren(...) */ });
// One function per chapter. It finds what the drawings made at each call, skips what is missing, sets styles from t and makes nothing; t = Infinity is the chapter whole. Take every time from cue(), so that a voice's pace reaches it.
const scenes = [(t) => { /* for (const bar of chs[0].querySelectorAll('.bar')) bar.style.width = bar.dataset.share * moved(t, cue(0, 'email')) * 100 + '%' */ }];

function fig(el) { // the one place marked text is written: fills one mark, its row found as the dashboard finds it
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  const {source, field, where, row: n} = el.dataset, d = dash.data(source), rows = d.status === 'ok' && Array.isArray(d.data) ? d.data : [];
  const row = where == null ? rows[+(n ?? 0)] : rows.find((r) => where.split('&').every((p) => {
    const i = p.indexOf('='); return i > 0 && String(r[dec(p.slice(0, i)).trim()] ?? '') === dec(p.slice(i + 1)); }));
  const v = row?.[field];
  write(el, v == null || v === '' ? '—' : (fmt[source + '.' + field] ?? String)(v));
}
dash.draw('fig', fig); // every marked figure in the HTML is data-draw="fig"
for (const name of ['runs', 'now', 'copy']) dash.draw(name, () => {}); // drawings the engine writes in at its own times
function timing() { // after the figures: filling moves where the words fall
  said = chs.map((_, i) => says(i).map(words).join(' ')); durs = said.map((s) => s.length / 15 + 1);
  chs.forEach((_, i) => { let at = 0; for (const s of says(i)) { const w = words(s), j = said[i].indexOf(w, at); s.cue = (j < 0 ? at : j) / 15; if (j >= 0) at = j + w.length; } });
  write(vs.querySelector('.vs-runs'), String(Math.round(d3.sum(durs) / 5) * 5));
}
function draw(i, t) {
  scenes[i]?.(still.matches || t >= paced(durs[i]) ? Infinity : t); // under reduced motion the drawing is whole, and the sentences still take their turns
  const ss = says(i), k = begun ? ss.findLastIndex((s) => t >= paced(s.cue)) : 0; // the sentence being said; before the first Play, the first
  ss.forEach((s, j) => s.classList.toggle('vs-on', j === Math.max(0, k)));
}
function frame() {
  draw(cur, t);
  mks.forEach((m, j) => { for (const bar of m.children) bar.style.width = (j < cur ? 1 : j > cur || t === Infinity ? 0 : Math.min(1, t / durs[cur])) * 100 + '%'; });
}
function show(i, from) {
  if (i !== cur) { draw(cur, Infinity); if (!phase()) write(vs.querySelector('.vs-now'), mks[i]?.getAttribute('aria-label') ?? ''); } // what leaves is left whole: its marks are still checked
  [cur, t] = [i, from];
  for (const set of [chs, caps]) set.forEach((el, j) => el.classList.toggle('vs-on', j === i));
  chs.forEach((ch, j) => ch.setAttribute('aria-hidden', String(j !== i))); // not the captions: Listen skips what is aria-hidden
  for (const set of [mks, caps]) set.forEach((el, j) => (j === i ? el.setAttribute('aria-current', 'true') : el.removeAttribute('aria-current')));
  frame();
}
function tick(now) {
  raf = 0;
  if (!vs.isConnected || (phase() ? phase() !== 'playing' : !playing)) return;
  t += last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
  if (phase() || t < durs[cur]) frame(); // in a reading the chapter waits, whole, for the voice, and the clock runs on to time it
  else if (cur < chs.length - 1) show(cur + 1, 0);
  else return play(false);
  raf = requestAnimationFrame(tick);
}
const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
function play(on) { playing = on; begun ||= on; vs.classList.toggle('vs-playing', on); vs.querySelector('.vs-toggle')?.setAttribute('aria-label', on ? 'Pause' : 'Play'); frame(); if (on) kick(); }
const from = (i) => (show(Math.max(0, Math.min(chs.length - 1, i)), 0), play(true));
const on = (q, f) => { const b = vs.querySelector(q); if (b) b.onclick = f; }; // a piece may leave a control out
on('.vs-toggle', () => (playing ? play(false) : t < durs[cur] ? play(true) : from(cur === chs.length - 1 ? 0 : cur)));
on('.vs-back', () => from(cur - 1));
on('.vs-next', () => from(cur + 1));
mks.forEach((m, j) => (m.onclick = () => from(j)));
on('.vs-cc', (e) => e.currentTarget.setAttribute('aria-pressed', String(!vs.classList.toggle('vs-hush')))); // captions on or off, until the page is loaded again
// vs-idle: a mouse still for 3 s counts as gone, unless its last move was onto the pill (vs-held); vs-touch: a finger or pen, which may leave no hover, counts as on the stage
stage.onpointermove = stage.onpointerdown = (e) => {
  const m = e.pointerType === 'mouse', move = e.type === 'pointermove', l = stage.classList;
  if (move && Math.abs(e.clientX - stage.x) + Math.abs(e.clientY - stage.y) < 4) return; // no move: a click can drift a pixel, and a still mouse gets a move when the page changes under it
  [stage.x, stage.y] = [e.clientX, e.clientY];
  l.toggle('vs-idle', false); l.toggle('vs-touch', !m); l.toggle('vs-held', move && !!e.target.closest('.vs-controls'));
  clearTimeout(stage.idle); if (m) stage.idle = setTimeout(() => l.add('vs-idle'), 3000);
};
still.onchange = () => (vs.isConnected ? frame() : (still.onchange = null)); // switched while paused in mid-chapter

const mo = new MutationObserver(() => {
  if (!vs.isConnected) return mo.disconnect();
  const now = vs.querySelector('[data-dash-read-now]'), p = phase(), again = p === 'starting' && was !== 'starting'; // each start reads its caption from the top
  const through = heard && p === 'playing' && was === 'playing'; // the voice went on by itself, so t is how long the caption took
  was = p;
  if (!p) { if (heard) show(cur, Infinity); heard = null; return; }
  if (playing) play(false); // the voice keeps time now
  begun = true;
  write(vs.querySelector('.vs-now'), ''); // else a later move to the chapter it names would not be announced, since write() skips unchanged text
  if (now && (now !== heard || again)) {
    if (through) pace = Math.max(0.5, Math.min(1.5, t / (durs[cur] - 1)));
    const i = caps.indexOf((heard = now));
    if (i >= 0) show(i, 0); // a stamp on anything but a caption moves nothing
  }
  if (p === 'ended') show(cur, Infinity); // read to its end, or cut short: whole
  kick();
});
mo.observe(root, {subtree: true, attributes: true, attributeFilter: ['data-dash-read-phase', 'data-dash-read-now']});

// What is drawn in a chapter: the box of each run of words, each element with a background or a border, each image, canvas and SVG shape, at any opacity.
// A shadow or a pseudo-element is not seen. A background or border on a wrapper counts over its whole box, and so does an SVG path, a slanting line too.
// Left out: words under aria-hidden inside the chapter, and the source line, which a caption may cover.
function ink(ch) {
  const out = [], walk = document.createTreeWalker(ch, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT), range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.nodeType === 1) { const s = getComputedStyle(n);
      if (n.matches('img, canvas, image, use, text') || n instanceof SVGGeometryElement || s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none'
        || ['Top', 'Right', 'Bottom', 'Left'].some((e) => parseFloat(s['border' + e + 'Width']) && s['border' + e + 'Color'] !== 'rgba(0, 0, 0, 0)')) out.push(n.getBoundingClientRect()); }
    else if (n.nodeValue.trim() && [null, ch].includes(n.parentElement.closest('[aria-hidden="true"], .vs-src'))) { range.selectNodeContents(n); out.push(...range.getClientRects()); }
  }
  return out.filter((b) => b.width > 1 && b.height > 1);
}
// Seats each caption at the foot, where it covers nothing of its chapter drawn whole: center, else right, else left; if all three cover something, center.
// The place is sized for all the chapter's sentences, so it holds while they change. Only the caption moves; the holder stays.
function seat() {
  if (!durs.length) return;
  chs.forEach((_, i) => draw(i, Infinity));
  const st = stage.getBoundingClientRect(), pad = st.width * 0.036;
  const over = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  chs.forEach((ch, i) => {
    if (!caps[i]) return; // a person may have deleted it
    caps[i].style.transform = '';
    const drawn = ink(ch), rs = [...caps[i].querySelectorAll('.vs-s > span')].flatMap((b) => [...b.getClientRects()]);
    if (!rs.length) return;
    const left = d3.min(rs, (r) => r.left) - 10, w = d3.max(rs, (r) => r.right) + 10 - left, top = d3.min(rs, (r) => r.top) - 8, bottom = d3.max(rs, (r) => r.bottom) + 8; // with some air
    const x = [left, st.right - pad + 10 - w, st.left + pad - 10].find((x) => !drawn.some((o) => over({left: x, right: x + w, top, bottom}, o))) ?? left;
    caps[i].style.transform = 'translateX(' + (x - left) + 'px)';
  });
  frame();
}

let box = vs.parentElement; // the box the page scrolls in
while (box.parentElement && !/auto|scroll/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
const fit = () => vs.style.setProperty('--room', Math.max(240, box.getBoundingClientRect().bottom - box.scrollTop - vs.getBoundingClientRect().top
  - parseFloat(getComputedStyle(root).paddingBottom) - parseFloat(getComputedStyle(box).paddingBottom)) + 'px'); // the box may be padded for a bar that floats over its foot
const ro = new ResizeObserver(() => (vs.isConnected ? (fit(), seat()) : ro.disconnect())); ro.observe(box); ro.observe(stage); // the stage too: when only its width changes, the dashboard draws each chart again, whole, without settle, and this puts the chapter showing back at t
document.fonts.ready.then(() => vs.isConnected && seat()); // a web font that comes late moves what is drawn

dash.onData(fit);
dash.draw('settle', () => { timing(); show(cur, t); seat(); }); // the last drawing in the HTML, so it runs once the others have
```
