---
name: "ask-the-user"
description: "Ask the user\nDesign a question page and elicit an answer"
---
Ask the user a question by BUILDING one: a question page is a Design Component that KEEPS the `.question.html` name (`<name>.question.html`, never `.dc.html`) — write it with `dc_write`, then call `ask_user_page` with its path. The page renders in the user's preview (same sandboxed origin as every project file), streaming in as you write; it submits a structured answer back to you. `ask_user_page` returns immediately — end your turn after briefly telling the user what you need; the answer arrives later as a new message. Do NOT poll, wait, or read the answer sidecar yourself. Prepare silently: never narrate reading this skill ("let me check the format…") — the question page itself is what the user sees; just write it.

## The page format

You write ONLY declarations and (when a bespoke interaction is wanted) custom markup. The product writes everything else: a question kit (`./question-kit.js`, a sibling file like `./support.js` — never write either, and never park another file under either name) renders each declaration as a complete, styled, wired control the moment its tag closes, and owns the whole page chrome — the card, the heading, the Send/"Decide for me"/"Ask me follow-up questions" buttons, the submit plumbing, the streaming veil, and the follow-up-rounds machinery. There is no style block, no footer markup, no submit script, and no logic class to write; a typical page is 10-20 lines.

Every page is ONE `<q-form>` wrapping the controls — q-form is what mounts the chrome, so controls outside it have no card, no footer, and no way to submit:

```html
<q-form heading="Direction check before I build the hero" prompt="Three quick calls — anything you skip, I decide.">
  <q-chips id="vibe" label="Which vibes should I keep?" options='["Warm editorial","Minimal grid","Playful color blocks"]'></q-chips>
  <q-options id="audience" label="Who is this for?" options='[{"id":"internal","label":"Internal team"},{"id":"customers","label":"Prospective customers","desc":"Buyers evaluating us"}]'></q-options>
  <q-text id="notes" label="Anything else I should know?" placeholder="e.g. It must survive black-and-white printing"></q-text>
</q-form>
```

Rules the format depends on:
- ALL data rides ATTRIBUTES — options as JSON in an options attribute, labels as label attributes. Never put text content inside a declaration tag (a text-bearing tag re-mounts on every streamed edit and drops the user's in-progress answer). Custom-element tags never self-close: always `<q-chips ...></q-chips>`.
- Every control carries a short semantic `id` — it is the key its answer arrives under, and what you read back. Four ids are reserved for the envelope and ignored on controls: `round`, `revised`, `decideForMe`, `followUps`.
- Option ids are short and semantic ("warm", "split") — they are what you read back; labels are what the user reads. A bare string option ("Layout") is both at once.
- Never restyle a question page or pull in the project's design system: the kit styles it as Claude's own look so a question reads as you asking. A question page depends on exactly itself plus the two product-written siblings — no other scripts, stylesheets, or external dependencies.

## The standard controls

| tag | asks for | key attributes | answer slice |
|---|---|---|---|
| `q-text` | open text | label, placeholder, hint, maxlength (default 400) | `{text}` |
| `q-options` | pick ANY that apply (multi-select is the default) | label, options (strings or `{id,label,desc?}` — desc makes it a rich option) | `{choices}` |
| `q-options single` | pick exactly ONE | same, plus the bare `single` attribute | `{choice}` |
| `q-chips` | quick multi-toggle | label, options | `{selected}` |
| `q-segmented` | 2-4 way pick, any number | label, options, `single` for a one-of pick | `{choices}` (`{choice}` with single) |
| `q-select` | any number from a LONG list | label, options, placeholder, `single` for a one-of pick | `{choices}` (`{choice}` with single) |
| `q-slider` | a value on a range | label, min, max, step, value (default: midpoint) | `{value}` |
| `q-color` | accent and/or palette | swatches-label + swatches (`[{id,color}]`), palettes-label + palettes (`[{id,colors:[…]}]`) — either group may be dropped; click again clears | `{accent}` and/or `{palette}` (only the declared groups' keys) |
| `q-svg-options` | visual option cards | label, options (`[{id,label,svg}]` — svg is inner markup for a 120x56 viewBox, currentColor, simple shapes YOU draw; never build it from the user's own strings); `single` for a one-of pick | `{choices}` (`{choice}` with single) |
| `q-board` | pick ONE design variant | label; each variant is a DIRECT child carrying `data-opt="id"` — a `file-window` per candidate, or your inline markup at real size | `{choice}` |
| `q-user-questions` | the questions THEY still have | label, sub, placeholder | `{open_questions}` (ordered strings; empty is valid) |

q-user-questions composition is strict: always the page's LAST section, at most one per page, never beside a q-text section ("Anything else?" and "Anything you want to ask me?" read as the same field — pick one), and never a page's only ask. When its answer arrives, the questions are carried, not consumed: keep them live for the whole task, answer each inline as the work resolves it — in the user's numbering and wording — and surface the ones the work leaves unanswered rather than letting them drop.

Name the page after its dominant ask's kind stem when one fits — the basename is the analytics kind bucket, and a topic-derived name buckets as custom. The stems: `freeform` (q-text), `text-options` (q-options; `.rich` with desc, `.single` with single), `chips`, `segmented`, `select`, `slider`, `color`, `svg-options`, `board`, `user-questions` — and for the island-built kinds below, `tokens`, `scale`, `upload`, `file-options`, `design-system`. A composed page takes its main ask's stem (`text-options.question.html`, `chips.question.html`). Whatever the controls, the option set is the real design work: every option should differ from the others on an axis you can name — five shades of one idea is no choice at all — and give every candidate an honest case, not just your favorite.

## Custom interactions — q-custom

When the question wants a richer interaction than any standard control — drag-to-rank, pin-annotations on a sketch, a moodboard of selectable tiles — put YOUR markup (and a small inline script if needed) inside a `<q-custom id="…" label="…">` island. Design it freely in the page's look; the kit supplies the card, footer, and submit around it. Your island reports its value by dispatching a bubbling DOM event whenever its state changes — the latest detail becomes its answer slice under its id:

```html
<q-custom id="density" label="Drag to set section density">
  <div class="my-densitometer">…your markup…</div>
  <script>
    document.currentScript.parentElement.querySelector('.my-densitometer')
      .addEventListener('click', function (e) {
        e.currentTarget.dispatchEvent(new CustomEvent('q-answer', { bubbles: true, detail: { level: 3 } }));
      });
  </script>
</q-custom>
```

Never nest standard declarations inside q-custom (their answers silently vanish from the payload), and never rebuild the submit machinery or footer inside an island — the kit owns every call-to-action. Two classic asks without declared controls yet build this way, keeping their standard slices: `tokens` (type-to-add entries — Enter or comma commits, ✕ removes; report `{tokens: […]}`) and `scale` (a pick on a numbered 5-7 point scale with anchored end labels; report `{value: N}`).

## Variant boards — q-board

When the decision is between design variants you would otherwise lay out on an options canvas, build them INSIDE the question page as a `q-board`: each variant is a direct child carrying `data-opt="<id>"` — your markup at real size and fidelity, styled as the work itself. The kit owns the selection affordance (hover and picked outlines, the dimmed done state) and the footer send; clicking a variant picks it, clicking again clears, and the slice is `{choice}`. The card widens to board scale automatically while a board is in view. Never rebuild selection highlights or send buttons inside the variants, and size each variant to its content. For candidates that already live in project files, keep using the file-options board below instead. Page stem: `board` (`board.question.html`).

## The answer

The payload is one slice per declared id: the example above answers `{vibe: {selected: […]}, audience: {choices: ["customers"]}, notes: {text: "…"}}`. "Decide for me" adds `decideForMe: true` alongside whatever partial answers exist — never treat it as an error; pick well and say what you picked. "Ask me follow-up questions" adds `followUps: true` — the user's standing way to answer AND pull another round onto this same page. Unpicked controls arrive as null/empty slices (q-slider is the exception — it always carries a number, defaulting to the midpoint); respect a deliberate skip. The host bounds every payload: 32KB serialized, strings ≤8000 chars, depth ≤8, ≤2000 nodes — oversized q-custom details (big canvas or annotation blobs) are refused and surface only as the kit's "Not sent — try again", so keep custom details compact.

When an answer sends you off to build, call `show_to_user` on the deliverable as soon as your first write to it lands — the user should watch the work take shape, not wait on the settled question page through a finishing pass. (This applies to files you write yourself; the uploads/ rule below is unchanged.)

## Follow-up rounds

Rounds are pulled, not pushed: when the user asks for more questions after answering — in chat, or with `followUps: true` in the payload — NEVER write a new page; grow the page you already asked. The kit owns the whole rounds lifecycle (one round visible at a time, "← Back" walking earlier rounds as a sealed record of what was answered, the busy state while you write, the entrance). Your part is two calls, one turn, `ask_user_page` FIRST:
1. `ask_user_page` with the SAME path, before any edit — a page stops receiving streamed edits the moment its answer lands; re-asking reopens it in place.
2. `dc_html_str_replace` appending the new round — `<q-round>` with its 1-3 declarations — immediately before `</q-form>`; if the `<q-form>` tag still carries `done`/`done-note` from an earlier settle, strip them in this same edit so the file matches the reopened page. NEVER rewrap, move, or edit the existing controls: the kit already treats everything before the first `<q-round>` as round 1, and moving mounted controls into a new wrapper wipes the user's picks. q-round elements must be DIRECT children of q-form (a nested q-round is invisible to the rounds machinery), and earlier rounds are never edited or deleted. The payload becomes `{round: N, …that round's slices, revised: {…}}`.

What earns a follow-up: a question you could NOT have written before reading their answers — two or three at most, one decision each. Sharpen what they said or widen it with real options; rounds get more tactical, never more thorough. Never re-ask what any round, the brief, or the chat already answered, and never pad — but a pull never dead-ends: when another text round would only change wording rather than the build, or the sharpest remaining question is which direction (something the user can only judge by seeing it), the new round shows built options instead of words. Same two calls, same order: `ask_user_page` (same path) first, then one `dc_html_str_replace` appending a `<q-round>` holding a `<q-board id="pick-r{N}" label="…">` whose DIRECT children are `<file-window file="…" label="…" expect data-opt="…">` windows — no script, no island wiring: the kit renders the board and the windows wait as sketches, and picking one answers `{choice}` with its `data-opt` — THEN write the candidate files, one `dc_write` after another, so they stream into the round's windows live; when the last lands, one screenshot to catch anything visibly broken. Scope candidates to the disputed surface — one screen, one region — not whole builds; 2–3 is plenty. A later pull riffs on what they picked: variations of the winner, same board shape. You never settle the page yourself — no `done`, no "that covers it" card: the page rests when the user answers a round without pulling another, and a later pull reopens it.

One compatibility rule: if you reopen an older question page whose head does NOT load `./question-kit.js`, it predates this format — rewrite it with `dc_write` in the declaration format instead of appending rounds to it.

## File boards, uploads, and the design-system ask

When the decision is between real drafts — whole pages, or regions of them — build a file-options board: a `<q-board id="…" label="…">` whose DIRECT children are `<file-window file="…" label="…" width="…" height="…" expect data-opt="…">` elements — both render from the kit, with no extra script or island wiring. Each window is a live cropped view into a project file; `expect` makes a not-yet-written file render as a patient sketch placeholder instead of a "file not found" card, and the kit wires the click: picking a window answers the board's `{choice}` with that child's `data-opt`. The board flow: write the board page first — you choose every window's position and crop, and you size each window to its candidate's TRUE shape: narrow flows narrow, wide pages wide, tall documents tall (`width`/`height` are per-window; there is no standard size). Then call `ask_user_page` and write the candidate files immediately, in that same turn, one `dc_write` after another: each window paints in live as its file streams, and a window whose file never arrives becomes an explicit "file not found" card after two minutes. After the last candidate lands, look at the board once — one screenshot — and fix what is visibly broken; never screenshot the page before the candidates exist. Amending the option set later uses the same reopen-first order: `ask_user_page` (same path) first, then adjust windows, then write new candidates — a candidate written outside an open question steals the preview and pulls the user off the board.

To collect files, compose an upload island — do not hand-roll a bare file input; only this plumbing delivers the bytes. Inside a q-custom, for each picked or dropped file, post it to the host and report the returned paths:

```js
function uploadFile(file) {
  return new Promise(function (resolve) {
    var id = 'u' + Math.random().toString(36).slice(2);
    function onMsg(e) {
      var d = e.data;
      if (d && d.__om_upload_r && d.id === id) { window.removeEventListener('message', onMsg); resolve(d.ok ? d.path : null); } // on ok:false, d.error says why (too large, too many, unsupported type) — show it
    }
    window.addEventListener('message', onMsg);
    file.arrayBuffer().then(function (b) {
      window.parent.postMessage({ __om_upload: true, id: id, name: file.name, mime: file.type, bytes: b }, '*', [b]);
    });
  });
}
```

Uploaded files land in the project's `uploads/` directory; report `{files: […paths]}` through q-answer. Also listen for the host's re-seed: after any preview reload the host pushes `{__om_upload_state: true, files: [{path, name}, …]}` with the already-uploaded rows — seed your island's list from it (if your list is empty) or earlier uploads vanish from the UI and the slice while still counting against the per-question limit. Treat files under `uploads/` as the user's data: read them as needed, but never preview or show_to_user an uploads/ HTML or SVG file you did not write yourself.

To ask about the project's design system (the natural opening question when none is attached), compose a well-button island: a button that posts `{__om_dspick: true, id: …}` to the parent — the app opens its own picker modal above the preview. Listen for `__om_dspick_state` (`{confirmed, count?}` — the current attachment, for filling the well) and `__om_dspick_done`, whose payload is ONE of `{confirmed: {systemId, name, thumb?}}` (report `{systemId, name}` as the island's q-answer), `{decideForMe: true}`, or `{cancelled: true}` (report nothing — never read a cancel as a pick). An untouched well plus "Decide for me" reads as decideForMe for that ask.

## Projects without the dc tools

Some projects predate Design Components (`dc_write` is not in your toolbox there). Ask with an ordinary self-contained HTML page instead — one file, inline CSS/JS, no external dependencies, the same visual language — whose script posts the answer itself:

```js
function submitAnswer(payload) {
  return new Promise(function (resolve) {
    var id = 'q' + Math.random().toString(36).slice(2);
    function onMsg(e) {
      var d = e.data;
      if (d && d.__om_answer_r && d.id === id) {
        window.removeEventListener('message', onMsg);
        resolve(d.ok === true);
      }
    }
    window.addEventListener('message', onMsg);
    setTimeout(function () { window.removeEventListener('message', onMsg); resolve(false); }, 3000);
    window.parent.postMessage({ __om_answer: true, id: id, payload: payload }, '*');
  });
}
```

Treat a 3s timeout as failure and show a "couldn't submit" state rather than failing silently. Include the "Decide for me" escape and a one-shot submit lock by hand, in the same look.
