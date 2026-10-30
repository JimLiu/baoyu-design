/* BEGIN USAGE */
/**
 * <file-window> — a live, cropped window into a project file (vanilla web
 * component, dependency-free; works in plain HTML and Design Components).
 *
 * Shows a real file from this project inside a framed, input-isolated
 * window: pointer input lands on the window, not the embedded page, and
 * the frame is inert so it cannot take focus at all. (The frame is same-origin so
 * __dcUpdate forwarding works; the isolation assumes the embedded file is
 * ordinary project work, not an adversarial document — both live in the
 * same sandboxed preview origin; pages and permissions are further locked
 * by inert + a sensor-denying allow list.) A file that stops probing OK
 * (two consecutive misses) flips to the not-found card and emits the
 * unavailable state, so a hosting page can drop its pick. The element probes that the file exists before
 * mounting (a missing file shows a "file not found" card, never a broken
 * frame — unless `expect` is set, in which case the window waits as a
 * pencil-plan underdrawing (the canvas stickers' sketch loop: twenty plan
 * variants cycling, each window joining at its own seed-derived phase),
 * giving up after two minutes of page-wide streaming silence), reloads in
 * place when the file is rewritten, and offers an expand-to-modal close look — the modal fits the
 * page's rendered size (viewport-capped) and scrolls within; a cropped
 * window's modal opens scrolled to its crop. It knows nothing about questions or
 * selection: clicking it emits 'file-window:pick'; the hosting page
 * decides what a pick means.
 *
 * Attributes:
 *   file            Project-relative path to the file shown (required).
 *   label           Name line in the window's caption row.
 *   width, height   The window box, px. Defaults 320×200. Min 120×48.
 *   window-x, window-y, window-width, document-width
 *                   Optional crop: show the region starting at
 *                   (window-x, window-y) that is window-width wide, from a
 *                   document laid out document-width wide. Omit to show
 *                   the top of the file at the box's width.
 *   action-label    Label for the modal's action button; clicking it emits
 *                   'file-window:action'. Omit for no button.
 *   lazy            Defer the iframe until near the viewport.
 *   no-expand       Hide the expand control.
 *   expect          The file may not be written yet: show the sketch
 *                   underdrawing for a file that is still missing (instead
 *                   of the not-found card), and let a streamed update or
 *                   the rewrite poll mount it the moment it lands. Patience
 *                   runs out after two minutes WITHOUT streaming activity
 *                   anywhere on the page — any routed push re-arms every
 *                   still-waiting window, so a board being drawn one
 *                   candidate at a time never times out mid-show.
 *
 * Events (bubbling, composed): 'file-window:pick' (activation — click or
 * Enter/Space), 'file-window:action' (modal button), 'file-window:state'
 * (detail: 'loading'|'ready'|'unavailable').
 *
 * Live updates: fw.fileUpdate(name, kind, content, streaming, viewportKey,
 * path?) forwards into the embedded document's own __dcUpdate when present
 * (the dc-runtime contract), else a settle push reloads from disk — and any
 * push for a window still waiting on its file triggers an immediate probe,
 * so a freshly written file mounts without waiting for the poll. The
 * optional path (full project-relative) disambiguates two same-named files
 * on one board; name-only callers keep today's routing.
 * FileWindow.routeUpdates() (idempotent, once per page) installs a
 * window.__dcUpdate routing to every mounted <file-window>. The host pushes
 * dc updates into .dc.html documents and into open question pages — on
 * question pages it installs the router itself, so pages need no
 * routeUpdates call of their own.
 */
/* END USAGE */
(function () {
  if (customElements.get('file-window')) return;
  const CAP = { dim: [24, 4000], off: 8000, doc: 12000, minW: 120, minH: 48 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
  const dcName = (file) => {
    const base = file.split('/').pop() || '';
    return base.replace(/\.dc\.html$|\.html$/i, '');
  };
  const CSS = `
file-window{display:block;position:relative;background:var(--fw-surf,#fff);border:1px solid var(--fw-line,rgba(15,12,8,.14));
 border-radius:12px;padding:8px;box-shadow:0 1px 2px rgba(15,12,8,.05);cursor:pointer;
 transition:box-shadow .12s ease,border-color .12s ease,transform .12s ease}
file-window:hover{border-color:var(--fw-line2,rgba(15,12,8,.22));box-shadow:0 6px 20px rgba(15,12,8,.11);transform:translateY(-2px)}
file-window:focus-visible{outline:2.5px solid var(--fw-sel,#2A78D6);outline-offset:3px}
file-window[data-state=unavailable]{cursor:not-allowed;background:transparent;border-style:dashed;box-shadow:none}
file-window[data-state=unavailable]:hover{transform:none;box-shadow:none}
.fw-crop{display:block;border-radius:6px;background:var(--fw-muted,#F0EEE6);overflow:hidden;position:relative}
.fw-crop iframe{display:block;border:0;background:#fff;transform-origin:top left;pointer-events:none;opacity:0;transition:opacity .25s ease}
.fw-crop iframe.fw-live{opacity:1}
.fw-fence{position:absolute;inset:0}
file-window .fw-cap{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 3px 0}
file-window .fw-name{font:550 12.5px/1.3 var(--fw-font,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);
 color:var(--fw-fg,rgba(15,12,8,.92));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fw-exp{flex:none;border:0;background:transparent;color:var(--fw-fg3,rgba(15,12,8,.48));cursor:pointer;padding:4px;border-radius:5px;line-height:1}
.fw-exp:hover{background:var(--fw-hov,rgba(15,12,8,.04));color:var(--fw-fg,rgba(15,12,8,.92))}
.fw-exp:focus-visible{outline:2px solid var(--fw-sel,#2A78D6);outline-offset:1px}
.fw-exp svg{width:14px;height:14px;display:block}
file-window .fw-skel{position:absolute;inset:0;display:flex;flex-direction:column;gap:7px;padding:11px}
file-window .fw-sk{background:var(--fw-skel,rgba(15,12,8,.09));border-radius:3px;animation:fw-pulse 1.6s ease-in-out infinite}
@keyframes fw-pulse{0%,100%{opacity:1}50%{opacity:.45}}
file-window .fw-gone{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;
 color:var(--fw-fg3,rgba(15,12,8,.48));text-align:center;padding:10px;font:500 11.5px/1.35 var(--fw-font,sans-serif)}
file-window .fw-gone svg{width:17px;height:17px}
.fw-scrim{position:fixed;inset:0;z-index:2147483000;background:rgba(15,12,8,.42);backdrop-filter:blur(3px);
 display:flex;align-items:center;justify-content:center;padding:56px}
[data-theme=dark] .fw-scrim{background:rgba(0,0,0,.58)}
.fw-big{max-width:calc(100vw - 64px);max-height:100%;background:var(--fw-surf,#fff);border:1px solid var(--fw-line2,rgba(15,12,8,.22));
 border-radius:14px;box-shadow:0 24px 60px rgba(15,12,8,.28);padding:9px;display:flex;flex-direction:column;gap:9px}
.fw-bigcap{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 4px 0}
.fw-bigname{font:550 14px/1.3 var(--fw-font,sans-serif);color:var(--fw-fg,rgba(15,12,8,.92))}
.fw-bigacts{display:flex;align-items:center;gap:7px}
.fw-act{border-radius:9px;border:1px solid var(--fw-line2,rgba(15,12,8,.22));background:transparent;
 color:var(--fw-fg2,rgba(15,12,8,.64));padding:8px 13px;font:550 12.5px/1.2 var(--fw-font,sans-serif);cursor:pointer}
.fw-act:hover{background:var(--fw-hov,rgba(15,12,8,.04));color:var(--fw-fg,rgba(15,12,8,.92))}
.fw-big .fw-crop{overflow:auto;overscroll-behavior:contain}
.fw-big .fw-crop::-webkit-scrollbar{width:8px;height:8px}
.fw-big .fw-crop::-webkit-scrollbar-track{background:transparent;margin:2px}
.fw-big .fw-crop::-webkit-scrollbar-corner{background:transparent}
.fw-big .fw-crop::-webkit-scrollbar-thumb{background:transparent;border-radius:4px;border:2px solid transparent;background-clip:content-box}
.fw-big .fw-crop:hover::-webkit-scrollbar-thumb{background:var(--fw-scroll,rgba(15,12,8,.28));border:2px solid transparent;background-clip:content-box}
.fw-big .fw-crop::-webkit-scrollbar-thumb:hover{background:var(--fw-scroll2,rgba(15,12,8,.45));border:2px solid transparent;background-clip:content-box}
.fw-big .fw-crop:focus-visible{outline:2.5px solid var(--fw-sel,#2A78D6);outline-offset:-2.5px}
.fw-bigpage{display:block;position:relative;overflow:clip}
.fw-bigview{display:block;position:sticky;top:0;overflow:hidden}
.fw-ud{--fw-ud-T:100s;--fw-ud-P:0;position:absolute;inset:0;display:block;width:100%;height:100%}
.fw-ud-base,.fw-ud-hair{fill:none;stroke:var(--fw-ud,#6A9BCC);stroke-width:.8}
.fw-ud-base{opacity:.15}
.fw-ud-hair{stroke-dasharray:1;stroke-dashoffset:1;opacity:0;animation:fw-ud-draw var(--fw-ud-T) linear infinite;
 animation-delay:calc(var(--fw-ud-T)*(var(--fw-ud-gs,0) + var(--fw-ud-ds,0) + var(--fw-ud-P,0)))}
.fw-ud-faint{animation-name:fw-ud-draw-faint}
@keyframes fw-ud-draw{0%{stroke-dashoffset:1;opacity:0}.3%{opacity:.85}1.7%{stroke-dashoffset:0;opacity:.85}2.2%{opacity:.55}2.8%{opacity:.85}3.3%{opacity:.6}3.8%{stroke-dashoffset:0;opacity:.8}4%{stroke-dashoffset:0;opacity:0}4.2%{stroke-dashoffset:1;opacity:0}100%{stroke-dashoffset:1;opacity:0}}
@keyframes fw-ud-draw-faint{0%{stroke-dashoffset:1;opacity:0}.3%{opacity:.4}1.7%{stroke-dashoffset:0;opacity:.4}2.8%{opacity:.42}3.3%{opacity:.3}3.8%{stroke-dashoffset:0;opacity:.38}4%{stroke-dashoffset:0;opacity:0}4.2%{stroke-dashoffset:1;opacity:0}100%{stroke-dashoffset:1;opacity:0}}
.fw-ud-plan{transform-box:fill-box;transform-origin:50% 50%;
 animation:fw-ud-breathe var(--fw-ud-T) ease-in-out infinite,fw-ud-slot var(--fw-ud-T) step-end infinite;
 animation-delay:calc(var(--fw-ud-T)*(var(--fw-ud-gs,0) + var(--fw-ud-P,0)))}
@keyframes fw-ud-slot{0%{display:inline}5.2%{display:none}}
@keyframes fw-ud-breathe{0%{transform:translateY(0) scale(1)}2%{transform:translateY(-.9px) scale(1.006)}3.9%{transform:translateY(.5px) scale(.997)}5%,100%{transform:translateY(0) scale(1)}}
.fw-ud-d1{--fw-ud-ds:.0012}.fw-ud-d2{--fw-ud-ds:.0024}.fw-ud-d3{--fw-ud-ds:.0036}.fw-ud-d4{--fw-ud-ds:.0048}.fw-ud-d5{--fw-ud-ds:.006}
@media (prefers-reduced-motion:reduce){.fw-ud .fw-ud-plan,.fw-ud .fw-ud-hair{animation:none}.fw-ud .fw-ud-hair{stroke-dashoffset:0;opacity:.72}.fw-ud .fw-ud-faint{opacity:.36}.fw-ud .fw-ud-plan:not(:first-of-type){display:none}}`;
  const svg = (d) =>
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="' +
    d +
    '" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const I = {
    expand: svg('M9.5 2.5H13.5V6.5M6.5 13.5H2.5V9.5M13.5 2.5 9 7M2.5 13.5 7 9'),
    warn: svg('M8 5.5V9M8 11.2V11.4M8 1.5 15 13.5H1L8 1.5Z'),
    x: svg('M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5'),
  };
  const UD_BASE = [
    'M16.5 12.5H247.5A2 2 0 0 1 249.5 14.5V95.5A2 2 0 0 1 247.5 97.5H16.5A2 2 0 0 1 14.5 95.5V14.5A2 2 0 0 1 16.5 12.5Z',
    'M14.5 112.5L249.5 112.5',
  ];
  const UD_PLANS = [
    [
      [1, 14.5, 12.5, 249.5, 97.5, 0, 0],
      [0, 14.5, 12.5, 249.5, 97.5, 1, 1],
      [0, 249.5, 12.5, 14.5, 97.5, 1, 1],
      [0, 14.5, 112.5, 249.5, 112.5, 0, 2],
      [0, 14.5, 124.5, 196.5, 124.5, 0, 3],
      [0, 14.5, 136.5, 142.5, 136.5, 0, 4],
    ],
    [
      [1, 14.5, 12.5, 160.5, 97.5, 0, 0],
      [1, 168.5, 12.5, 249.5, 97.5, 0, 1],
      [0, 14.5, 55.5, 160.5, 55.5, 1, 2],
      [0, 14.5, 112.5, 223.5, 112.5, 0, 3],
      [0, 14.5, 124.5, 160.5, 124.5, 0, 4],
      [0, 14.5, 136.5, 103.5, 136.5, 0, 5],
    ],
    [
      [1, 14.5, 12.5, 72.5, 97.5, 0, 0],
      [1, 80.5, 12.5, 249.5, 97.5, 0, 1],
      [0, 80.5, 12.5, 249.5, 97.5, 1, 2],
      [0, 14.5, 112.5, 180.5, 112.5, 0, 3],
      [0, 14.5, 124.5, 249.5, 124.5, 0, 4],
    ],
    [
      [2, 132, 52, 40, 0, 0, 0],
      [1, 14.5, 12.5, 249.5, 97.5, 1, 1],
      [0, 60.5, 112.5, 203.5, 112.5, 0, 2],
      [0, 90.5, 124.5, 173.5, 124.5, 0, 3],
    ],
    [
      [0, 14.5, 22.5, 160.5, 22.5, 0, 0],
      [0, 14.5, 32.5, 110.5, 32.5, 1, 1],
      [2, 70, 70, 22, 0, 0, 2],
      [2, 140, 70, 22, 0, 1, 3],
      [1, 180.5, 48.5, 249.5, 92.5, 0, 4],
      [0, 14.5, 124.5, 249.5, 124.5, 0, 5],
    ],
    [
      [0, 132.5, 12.5, 132.5, 97.5, 1, 0],
      [0, 14.5, 24.5, 120.5, 24.5, 0, 1],
      [0, 14.5, 40.5, 120.5, 40.5, 0, 1],
      [0, 14.5, 56.5, 120.5, 56.5, 0, 2],
      [0, 14.5, 72.5, 96.5, 72.5, 0, 2],
      [1, 144.5, 12.5, 249.5, 72.5, 0, 3],
      [0, 144.5, 84.5, 249.5, 84.5, 1, 4],
      [0, 14.5, 124.5, 249.5, 124.5, 0, 5],
    ],
    [
      [1, 14.5, 20.5, 84.5, 74.5, 0, 0],
      [1, 97.5, 20.5, 167.5, 74.5, 0, 1],
      [1, 180.5, 20.5, 249.5, 74.5, 0, 2],
      [3, 'M20 94 C 80 72, 180 116, 244 88', 0, 0, 0, 1, 3],
      [0, 14.5, 124.5, 190.5, 124.5, 0, 4],
    ],
    [
      [2, 66, 62, 27, 0, 0, 0],
      [2, 118, 42, 17, 0, 0, 1],
      [2, 150, 72, 23, 0, 1, 2],
      [2, 196, 44, 12, 0, 0, 3],
      [2, 220, 72, 20, 0, 1, 4],
      [0, 40.5, 124.5, 224.5, 124.5, 0, 5],
    ],
    [
      [1, 14.5, 12.5, 249.5, 97.5, 1, 0],
      [3, 'M20 90 L 80 66 L 140 74 L 200 34 L 244 24', 0, 0, 0, 0, 1],
      [0, 20.5, 92.5, 244.5, 92.5, 1, 2],
      [0, 14.5, 112.5, 160.5, 112.5, 0, 3],
      [0, 14.5, 124.5, 100.5, 124.5, 0, 4],
    ],
    [
      [3, 'M132 13 L 236 55 L 132 97 L 28 55 Z', 0, 0, 0, 0, 0],
      [2, 132, 55, 17, 0, 1, 1],
      [0, 40.5, 112.5, 224.5, 112.5, 0, 2],
      [0, 78.5, 124.5, 186.5, 124.5, 0, 3],
    ],
    [
      [1, 14.5, 12.5, 86.5, 50.5, 0, 0],
      [1, 96.5, 12.5, 168.5, 50.5, 0, 1],
      [1, 178.5, 12.5, 249.5, 50.5, 0, 1],
      [1, 14.5, 60.5, 86.5, 98.5, 0, 2],
      [1, 96.5, 60.5, 168.5, 98.5, 1, 2],
      [1, 178.5, 60.5, 249.5, 98.5, 0, 3],
      [0, 14.5, 124.5, 168.5, 124.5, 0, 4],
    ],
    [
      [1, 88.5, 8.5, 176.5, 114.5, 0, 0],
      [0, 100.5, 30.5, 164.5, 30.5, 1, 1],
      [0, 100.5, 40.5, 146.5, 40.5, 1, 1],
      [2, 132, 78, 20, 0, 0, 2],
      [0, 90.5, 132.5, 174.5, 132.5, 0, 3],
    ],
    [
      [1, 14.5, 12.5, 249.5, 97.5, 0, 0],
      [0, 73.5, 12.5, 73.5, 97.5, 1, 1],
      [0, 132.5, 12.5, 132.5, 97.5, 1, 1],
      [0, 191.5, 12.5, 191.5, 97.5, 1, 2],
      [0, 14.5, 40.5, 249.5, 40.5, 0, 3],
      [0, 14.5, 68.5, 249.5, 68.5, 1, 4],
      [0, 14.5, 124.5, 140.5, 124.5, 0, 5],
    ],
    [
      [0, 56.5, 36.5, 136.5, 72.5, 1, 0],
      [0, 136.5, 72.5, 212.5, 30.5, 1, 0],
      [0, 56.5, 36.5, 212.5, 30.5, 1, 1],
      [2, 56, 36, 13, 0, 0, 2],
      [2, 136, 72, 19, 0, 0, 3],
      [2, 212, 30, 10, 0, 0, 4],
      [0, 14.5, 124.5, 200.5, 124.5, 0, 5],
    ],
    [
      [1, 14.5, 26.5, 249.5, 82.5, 0, 0],
      [0, 73.5, 26.5, 73.5, 82.5, 1, 1],
      [0, 132.5, 26.5, 132.5, 82.5, 1, 1],
      [0, 191.5, 26.5, 191.5, 82.5, 1, 2],
      [0, 14.5, 16.5, 249.5, 16.5, 0, 3],
      [0, 14.5, 92.5, 249.5, 92.5, 0, 4],
      [0, 14.5, 124.5, 118.5, 124.5, 0, 5],
    ],
    [
      [2, 76, 55, 36, 0, 0, 0],
      [3, 'M76 19 A 36 36 0 0 1 108 73 L 76 55 Z', 0, 0, 0, 1, 1],
      [0, 140.5, 34.5, 220.5, 34.5, 0, 2],
      [0, 140.5, 54.5, 196.5, 54.5, 0, 3],
      [0, 140.5, 74.5, 234.5, 74.5, 0, 4],
      [0, 14.5, 124.5, 180.5, 124.5, 1, 5],
    ],
    [
      [0, 14.5, 20.5, 228.5, 20.5, 0, 0],
      [0, 14.5, 38.5, 196.5, 38.5, 0, 1],
      [0, 14.5, 56.5, 148.5, 56.5, 0, 2],
      [0, 14.5, 74.5, 106.5, 74.5, 1, 3],
      [1, 14.5, 88.5, 38.5, 112.5, 0, 4],
      [0, 50.5, 100.5, 160.5, 100.5, 1, 5],
    ],
    [
      [3, 'M18 84 C 70 40, 130 96, 246 40', 0, 0, 0, 0, 0],
      [3, 'M18 96 C 78 56, 138 108, 246 56', 0, 0, 0, 1, 1],
      [3, 'M18 68 C 66 28, 126 82, 246 26', 0, 0, 0, 1, 2],
      [2, 150, 66, 9, 0, 0, 3],
      [0, 14.5, 124.5, 212.5, 124.5, 0, 4],
    ],
    [
      [2, 104, 55, 35, 0, 0, 0],
      [2, 160, 55, 35, 0, 0, 1],
      [0, 132.5, 12.5, 132.5, 97.5, 1, 2],
      [0, 50.5, 124.5, 214.5, 124.5, 0, 3],
    ],
    [
      [1, 14.5, 12.5, 110.5, 50.5, 0, 0],
      [1, 130.5, 50.5, 249.5, 97.5, 0, 1],
      [0, 14.5, 12.5, 249.5, 97.5, 1, 2],
      [0, 110.5, 50.5, 130.5, 50.5, 1, 3],
      [0, 14.5, 112.5, 190.5, 112.5, 0, 4],
      [0, 14.5, 124.5, 130.5, 124.5, 0, 5],
    ],
  ];
  const udD = (s) =>
    s[0] === 0
      ? `M${s[1]} ${s[2]}L${s[3]} ${s[4]}`
      : s[0] === 1
        ? `M${s[1] + 2} ${s[2]}H${s[3] - 2}A2 2 0 0 1 ${s[3]} ${s[2] + 2}V${s[4] - 2}A2 2 0 0 1 ${s[3] - 2} ${s[4]}H${s[1] + 2}A2 2 0 0 1 ${s[1]} ${s[4] - 2}V${s[2] + 2}A2 2 0 0 1 ${s[1] + 2} ${s[2]}Z`
        : s[0] === 2
          ? `M${s[1] - s[3]} ${s[2]}A${s[3]} ${s[3]} 0 1 0 ${s[1] + s[3]} ${s[2]}A${s[3]} ${s[3]} 0 1 0 ${s[1] - s[3]} ${s[2]}Z`
          : s[1];
  const udSvg = (seed, boxW, boxH) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const sheet = 264 / 152;
    const aspect = boxH > 0 ? boxW / boxH : sheet;
    const off = Math.max(aspect / sheet, sheet / aspect);
    let svg = `<svg class="fw-ud" viewBox="0 0 264 152" preserveAspectRatio="xMidYMid ${off <= 1.8 ? 'slice' : 'meet'}" aria-hidden="true" style="--fw-ud-P:${-(Math.abs(h) % 1000) / 1000}">`;
    for (const d of UD_BASE) svg += `<path class="fw-ud-base" d="${d}"/>`;
    for (const [i, plan] of UD_PLANS.entries()) {
      svg += `<g class="fw-ud-plan" style="--fw-ud-gs:${(i * 5 - (i ? 100 : 0)) / 100}">`;
      for (const s of plan)
        svg += `<path class="fw-ud-hair${s[5] ? ' fw-ud-faint' : ''}${s[6] ? ' fw-ud-d' + s[6] : ''}" pathLength="1" d="${udD(s)}"/>`;
      svg += '</g>';
    }
    return svg + '</svg>';
  };
  const registry = new Set();

  class FileWindow extends HTMLElement {
    static get observedAttributes() {
      return ['action-label'];
    }
    attributeChangedCallback(name, _old, next) {
      if (name === 'action-label' && this._bigAct && next != null)
        this._bigAct.textContent = next;
    }
    static routeUpdates() {
      if (window.__dcUpdate && window.__dcUpdate.__fwRouter) return;
      const prev = window.__dcUpdate;
      window.__dcUpdate = (
        name,
        kind,
        content,
        streaming,
        viewportKey,
        path
      ) => {
        if (typeof prev === 'function')
          prev(name, kind, content, streaming, viewportKey);
        for (const fw of registry)
          fw.fileUpdate(name, kind, content, streaming, viewportKey, path);
      };
      window.__dcUpdate.__fwRouter = true;
    }
    connectedCallback() {
      if (!document.getElementById('file-window-css')) {
        const st = document.createElement('style');
        st.id = 'file-window-css';
        st.setAttribute('data-omelette-injected', '');
        st.textContent = CSS;
        document.head.appendChild(st);
      }
      if (this._wired) {
        registry.add(this);
        clearInterval(this._watch);
        this._watch = setInterval(() => this._checkRewrite(), 5000);
        if (this._pending) this._setPending();
        document.addEventListener('visibilitychange', this._onVis);
        return;
      }
      this._wired = true;
      this._nonce = 1;
      this._key = null;
      this._state = 'loading';
      const file = this.getAttribute('file') || '';
      this._file = file;
      this._name = dcName(file);
      const boxW = clamp(
        this.getAttribute('width') || 320,
        CAP.minW,
        CAP.dim[1]
      );
      const boxH = clamp(
        this.getAttribute('height') || 200,
        CAP.minH,
        CAP.dim[1]
      );
      const winW = clamp(
        this.getAttribute('window-width') || boxW,
        CAP.dim[0],
        CAP.dim[1]
      );
      const docW = clamp(
        this.getAttribute('document-width') || winW,
        winW,
        CAP.doc
      );
      const winX = clamp(this.getAttribute('window-x'), 0, CAP.off);
      const winY = clamp(this.getAttribute('window-y'), 0, CAP.off);
      const s = boxW / winW;
      this._geom = {
        boxW,
        boxH,
        docW,
        winX,
        winY,
        winW,
        ifw: docW,
        ifh: winY + boxH / s,
        tf:
          winX || winY
            ? `scale(${s}) translate(${-winX}px, ${-winY}px)`
            : `scale(${s})`,
      };
      this.style.width = boxW + 'px';
      this.setAttribute('role', 'button');
      this.tabIndex = 0;
      this.dataset.state = 'loading';
      this._crop = document.createElement('span');
      this._crop.className = 'fw-crop';
      this._crop.style.height = boxH + 'px';
      // Expect-windows wait as a pencil-plan underdrawing (the canvas
      // stickers' waiting loop), never a plain shell.
      // nosemgrep: direct-inner-html-assignment -- component-built markup: constant paths, numeric phase/geometry only
      this._crop.innerHTML = this.hasAttribute('expect')
        ? udSvg(file + '|' + (this.getAttribute('label') || ''), boxW, boxH)
        : '<span class="fw-skel"><span class="fw-sk" style="height:9px;width:44%"></span>' +
          '<span class="fw-sk" style="height:22px;width:72%"></span><span class="fw-sk" style="flex:1"></span></span>';
      const cap = document.createElement('span');
      cap.className = 'fw-cap';
      const nm = document.createElement('span');
      nm.className = 'fw-name';
      nm.textContent = this.getAttribute('label') || this._name;
      cap.append(nm);
      if (!this.hasAttribute('no-expand')) {
        const ex = document.createElement('button');
        ex.type = 'button';
        ex.className = 'fw-exp';
        ex.innerHTML = I.expand; // nosemgrep: direct-inner-html-assignment -- static icon markup, zero interpolation
        ex.setAttribute('aria-label', 'Expand');
        ex.addEventListener('click', (e) => {
          e.stopPropagation();
          this._openModal();
        });
        cap.append(ex);
        this._exp = ex;
      }
      this.append(this._crop, cap);
      this.addEventListener('click', () => this._pick());
      this.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === this) {
          e.preventDefault();
          this._pick();
        }
      });
      registry.add(this);
      this._mount();
      this._watch = setInterval(() => this._checkRewrite(), 5000);
      document.addEventListener(
        'visibilitychange',
        (this._onVis = () => {
          if (!document.hidden) this._checkRewrite();
        })
      );
    }
    disconnectedCallback() {
      registry.delete(this);
      clearInterval(this._watch);
      clearTimeout(this._patience);
      document.removeEventListener('visibilitychange', this._onVis);
      this._closeModal();
    }
    get state() {
      return this._state;
    }
    _emit(type, detail) {
      this.dispatchEvent(
        new CustomEvent('file-window:' + type, {
          bubbles: true,
          composed: true,
          detail,
        })
      );
    }
    _setState(st) {
      this._state = st;
      this.dataset.state = st;
      this._emit('state', st);
    }
    _pick() {
      if (this._state === 'unavailable') return;
      this._emit('pick', { file: this._file });
    }
    _src() {
      return (
        this._url() +
        (this._file.includes('?') ? '&' : '?') +
        'fwv=' +
        this._nonce
      );
    }
    _url() {
      return encodeURI(this._file).replace(/#/g, '%23');
    }
    // Change key: etag/last-modified when the server sends them, else body
    // size — a same-length rewrite without validators is invisible to the poll.
    async _probe() {
      try {
        const key = (r) =>
          r.headers.get('etag') ||
          r.headers.get('last-modified') ||
          r.headers.get('content-length');
        const head = await fetch(this._url(), {
          method: 'HEAD',
          cache: 'no-store',
        });
        head.body?.cancel();
        if (head.ok && key(head)) return key(head);
        if (!head.ok && head.status !== 405 && head.status !== 501) return null;
        const r = await fetch(this._url(), {
          method: 'GET',
          cache: 'no-store',
        });
        if (!r.ok) {
          r.body?.cancel();
          return null;
        }
        const k = key(r);
        if (k) {
          r.body?.cancel();
          return k;
        }
        return String((await r.blob()).size);
      } catch {
        return null;
      }
    }
    async _mount() {
      const key = await this._probe();
      if (key === null) {
        if (this.hasAttribute('expect')) return this._setPending();
        return this._setGone();
      }
      this._key = key;
      this._mountFrame();
    }
    _setPending() {
      if (this._iframe) return;
      this._pending = true;
      clearTimeout(this._patience);
      this._patience = setTimeout(() => {
        this._pending = false;
        if (!this._iframe && this._state === 'loading') this._setGone();
      }, 120000);
    }
    _setGone() {
      this._pending = false;
      clearTimeout(this._patience);
      this._crop.innerHTML = '';
      this._iframe = null;
      const card = document.createElement('span');
      card.className = 'fw-gone';
      card.innerHTML = I.warn; // nosemgrep: direct-inner-html-assignment -- static icon markup, zero interpolation
      const text = document.createElement('span');
      text.append('File not found', document.createElement('br'), this._file);
      card.append(text);
      this._crop.append(card);
      this.tabIndex = -1;
      this.setAttribute('aria-disabled', 'true');
      if (this._exp) this._exp.hidden = true;
      this._missedProbes = 0;
      this._closeModal();
      this._setState('unavailable');
    }
    // allow-same-origin is load-bearing (prod preview auth, dc-import CORS,
    // __dcUpdate reach); candidates are same-trust project files — tradeoff
    // recorded in the PR.
    _newFrame(style) {
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      f.setAttribute(
        'allow',
        "camera 'none'; microphone 'none'; geolocation 'none'; fullscreen 'none'"
      );
      f.referrerPolicy = 'no-referrer';
      f.setAttribute('scrolling', 'no');
      f.inert = true;
      f.tabIndex = -1;
      Object.assign(f.style, style);
      return f;
    }
    _mountFrame() {
      const f = this._newFrame({
        width: this._geom.ifw + 'px',
        height: this._geom.ifh + 'px',
        transform: this._geom.tf,
      });
      if (this.hasAttribute('lazy')) f.loading = 'lazy';
      const reveal = setTimeout(() => f.classList.add('fw-live'), 4000);
      f.addEventListener('load', () => {
        clearTimeout(reveal);
        f.classList.add('fw-live');
        if (this._state === 'loading') this._setState('ready');
      });
      f.src = this._src();
      const fence = document.createElement('span');
      fence.className = 'fw-fence';
      this._crop.innerHTML = '';
      this._crop.append(f, fence);
      this._iframe = f;
    }
    async _checkRewrite() {
      if (this._checking) return;
      this._checking = true;
      try {
        await this._checkRewriteInner();
      } finally {
        this._checking = false;
      }
    }
    async _checkRewriteInner() {
      if (this._state === 'unavailable') {
        const key = await this._probe();
        if (key === null || this._state !== 'unavailable') return;
        this._key = key;
        this._nonce++;
        this._crop.innerHTML = '';
        this._setState('loading');
        this.tabIndex = 0;
        this.removeAttribute('aria-disabled');
        if (this._exp) this._exp.hidden = false;
        return this._mountFrame();
      }
      if (!this._iframe) {
        if (!this._pending) return;
        const key = await this._probe();
        if (key === null || this._iframe || !this._pending) return;
        this._pending = false;
        clearTimeout(this._patience);
        this._key = key;
        this._mountFrame();
        return;
      }
      const key = await this._probe();
      if (key === null) {
        this._missedProbes = (this._missedProbes || 0) + 1;
        if (this._missedProbes >= 2) this._setGone();
        return;
      }
      this._missedProbes = 0;
      if (this._key !== null && key !== this._key) {
        this._key = key;
        this.reload();
      }
    }
    reload() {
      this._nonce++;
      if (this._iframe) this._iframe.src = this._src();
      if (this._bigFrame) this._bigFrame.src = this._src();
    }
    fileUpdate(name, kind, content, streaming, viewportKey, path) {
      if (this._pending && streaming && content) this._setPending();
      if (name !== this._name || !this._matchesPath(path)) return;
      const w = this._iframe && this._iframe.contentWindow;
      let delivered = false;
      try {
        if (w && typeof w.__dcUpdate === 'function') {
          w.__dcUpdate(name, kind, content, streaming, viewportKey);
          delivered = true;
        }
      } catch {
        /* cross-origin frame: fall through to reload */
      }
      if (delivered) return;
      if (!this._iframe) {
        // Streaming ticks arrive per-token; probe at most twice a second.
        const now = Date.now();
        if (!streaming || !this._pushProbeAt || now - this._pushProbeAt > 500) {
          this._pushProbeAt = now;
          this._checkRewrite();
        }
        return;
      }
      if (!streaming) this._checkRewrite();
    }
    // Uncertainty (no serve base in the page URL, resolution surprises)
    // fails open to name routing; a clean mismatch filters.
    _matchesPath(path) {
      if (!path) return true;
      const m = location.pathname.match(
        /\/v1\/design\/projects\/[^/]+\/serve\//
      );
      if (!m) return true;
      const base = location.pathname.slice(0, m.index + m[0].length);
      try {
        const resolved = new URL(this._file, location.href).pathname;
        if (!resolved.startsWith(base)) return true;
        const want = String(path)
          .split('/')
          .filter((s) => s && s !== '.')
          .join('/');
        return decodeURIComponent(resolved.slice(base.length)) === want;
      } catch {
        return true;
      }
    }
    _openModal() {
      if (this._scrim || this._state === 'unavailable') return;
      const scrim = document.createElement('div');
      scrim.className = 'fw-scrim';
      // The host's canvas pan yields wheels crossing a [data-dc-wheel-passthru]
      // path; without it, a gesture from the crop's scroll edge pans the board.
      scrim.setAttribute('data-dc-wheel-passthru', '');
      const big = document.createElement('div');
      big.className = 'fw-big';
      big.addEventListener('click', (e) => e.stopPropagation());
      const cap = document.createElement('span');
      cap.className = 'fw-bigcap';
      const nm = document.createElement('span');
      nm.className = 'fw-bigname';
      nm.textContent = this.getAttribute('label') || this._name;
      const acts = document.createElement('span');
      acts.className = 'fw-bigacts';
      const actLabel = this.getAttribute('action-label');
      if (actLabel) {
        const act = document.createElement('button');
        act.type = 'button';
        act.className = 'fw-act';
        act.textContent = actLabel;
        act.addEventListener('click', () => {
          if (this._state === 'unavailable') return;
          this._emit('action', { file: this._file });
        });
        acts.append(act);
        this._bigAct = act;
      }
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'fw-exp';
      close.innerHTML = I.x; // nosemgrep: direct-inner-html-assignment -- static icon markup, zero interpolation
      close.setAttribute('aria-label', 'Close');
      close.addEventListener('click', () => this._closeModal());
      acts.append(close);
      cap.append(nm, acts);
      const crop = document.createElement('span');
      crop.className = 'fw-crop';
      // Mark-up mode's forwarded wheel scrolls the nearest marked element
      // directly, so the real scroller carries the marker too.
      crop.setAttribute('data-dc-wheel-passthru', '');
      crop.tabIndex = 0;
      const page = document.createElement('span');
      page.className = 'fw-bigpage';
      const view = document.createElement('span');
      view.className = 'fw-bigview';
      const f = this._newFrame({});
      f.addEventListener('load', () => {
        f.classList.add('fw-live');
        try {
          if (this._bigRO) this._bigRO.disconnect();
          this._bigRO = null;
          const w = f.contentWindow,
            d = f.contentDocument;
          if (w && d && typeof w.ResizeObserver === 'function') {
            this._bigRO = new w.ResizeObserver(() => this._measureBig());
            if (d.documentElement) this._bigRO.observe(d.documentElement);
            if (d.body) this._bigRO.observe(d.body);
          }
        } catch {
          /* cross-origin frame: keep the pre-measure size */
        }
        this._measureBig();
        this._syncBig();
      });
      f.src = this._src();
      const fence = document.createElement('span');
      fence.className = 'fw-fence';
      view.append(f);
      page.append(view, fence);
      crop.append(page);
      crop.addEventListener('scroll', () => this._syncBig(), {
        passive: true,
      });
      big.append(cap, crop);
      scrim.append(big);
      scrim.addEventListener('click', () => this._closeModal());
      // On <html>, not <body>: a pannable canvas transforms <body>,
      // which would drag a fixed scrim along with the board.
      document.documentElement.append(scrim);
      this._scrim = scrim;
      this._bigFrame = f;
      this._bigCrop = crop;
      this._bigPage = page;
      this._bigView = view;
      this._bigDocH = 0;
      this._bigSet = false;
      window.addEventListener(
        'resize',
        (this._onBigResize = () => this._fitBig())
      );
      this._fitBig();
      this._onEsc = (e) => {
        if (e.key === 'Escape') this._closeModal();
      };
      document.addEventListener('keydown', this._onEsc);
      close.focus();
    }
    // scrollHeight never reads below the frame's own height, so a short page
    // is read from bounding boxes; genuine overflow is read from scrollHeight.
    _measureBig() {
      let h = 0;
      try {
        const d = this._bigFrame && this._bigFrame.contentDocument;
        const de = d && d.documentElement;
        if (de) {
          h = Math.max(
            de.getBoundingClientRect().height,
            d.body ? d.body.getBoundingClientRect().height : 0,
            de.scrollHeight > de.clientHeight ? de.scrollHeight : 0
          );
        }
      } catch {
        /* cross-origin frame: keep the pre-measure size */
      }
      if (h > 0 && Math.abs(h - this._bigDocH) > 1) {
        this._bigDocH = h;
        this._fitBig();
      }
    }
    // The frame keeps a viewport-sized height — content-sized would let the
    // page's vh units chase the modal — and the page scrolls inside it instead.
    _fitBig() {
      if (!this._scrim) return;
      const g = this._geom;
      const maxW = Math.min(window.innerWidth - 128, 960);
      const maxH = window.innerHeight - 160;
      // Readability floor: a very wide document stops shrinking at 0.66 and
      // scrolls horizontally instead.
      const zs = (this._bigZs = Math.min(2, Math.max(maxW / g.docW, 0.66)));
      const docH = this._bigDocH || g.winY + (g.boxH * g.winW) / g.boxW;
      const bw = Math.min(Math.round(g.docW * zs), maxW);
      const bh = Math.min(Math.max(Math.round(docH * zs), 120), maxH);
      Object.assign(this._bigFrame.style, {
        width: g.docW + 'px',
        transform: `scale(${zs})`,
      });
      Object.assign(this._bigPage.style, {
        width: Math.round(g.docW * zs) + 'px',
        height: Math.round(docH * zs) + 'px',
      });
      Object.assign(this._bigCrop.style, {
        width: bw + 'px',
        height: bh + 'px',
      });
      const sb = this._bigCrop.offsetWidth - this._bigCrop.clientWidth;
      if (sb > 0)
        this._bigCrop.style.width =
          Math.min(bw + sb, window.innerWidth - 128) + 'px';
      // Scrollbars or flex squeeze can shrink the crop below bh; the holder
      // and the frame's scroll range must match the real scrollport, or the
      // frame un-pins and the page's last strip becomes unreachable.
      const ch = this._bigCrop.clientHeight || bh;
      this._bigView.style.height = ch + 'px';
      this._bigFrame.style.height = Math.ceil(ch / zs) + 'px';
      if (this._bigDocH && !this._bigSet) {
        this._bigSet = true;
        this._bigCrop.scrollLeft = g.winX * zs;
        this._bigCrop.scrollTop = g.winY * zs;
      }
      this._syncBig();
    }
    _syncBig() {
      try {
        this._bigFrame.contentWindow.scrollTo(
          0,
          this._bigCrop.scrollTop / this._bigZs
        );
      } catch {
        /* frame not ready: the next scroll resyncs */
      }
    }
    _closeModal() {
      if (!this._scrim) return;
      if (this._bigRO) this._bigRO.disconnect();
      this._scrim.remove();
      window.removeEventListener('resize', this._onBigResize);
      this._scrim =
        this._bigFrame =
        this._bigAct =
        this._bigCrop =
        this._bigPage =
        this._bigView =
        this._bigRO =
          null;
      document.removeEventListener('keydown', this._onEsc);
      this.focus();
    }
  }
  customElements.define('file-window', FileWindow);
  window.FileWindow = FileWindow;
})();
