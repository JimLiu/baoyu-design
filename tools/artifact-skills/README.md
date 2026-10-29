# artifact-skills

Maintainer tooling for the Artifact-type skills: `claude-slides`, `claude-design`, `claude-design-system` and
`claude-dashboard`. Agents never run anything here; they use what it writes into `skills/<skill>/`.

Each skill holds

- `SKILL.md`: the type's original instructions, hand-ported: the Artifact tool parts changed, plus local notes the
  original lacks (keep them when porting a change). Never generated.
- `artifact-type/reference/`: the type's reference pages, copied verbatim.
- `scripts/artifact.mjs`: the local Artifact tool (`open`, `stop`, `check`, `upload`, and per type `list` or
  `write-db`/`read-db`), one self-contained Node script with no dependencies.
- `scripts/server.mjs` (slides, canvas, design system): the editor server, hand-written plain JavaScript (Node
  built-ins only), one per skill. Never generated.
- `scripts/editor/`: the type's editor page, prebuilt.

## Slides, canvas, design system

```bash
node tools/artifact-skills/build.mjs                 # all three
node tools/artifact-skills/build.mjs --only design   # one of slides | design | design-system
node tools/artifact-skills/build.mjs --editors       # rebuild the editor dists first
```

`build.mjs` bundles [`cli.ts`](cli.ts) once per skill with esbuild (the skill's kind baked in) and copies the editor
dist and the references. Sources: a BaoCut checkout (`BAOCUT_DIR`, default `../baocut`) for the checks and editors,
and the original types (`ORIGINALS_DIR`, default `../claude-skills/originals`) for the references. It never touches
`scripts/server.mjs`; it stops when one is missing and warns when the three servers' shared core differs.

How an artifact sits on disk: a folder `<root>` with the type's files under `<root>/project/` at the paths the type's
SKILL.md names; uploads are content-addressed (`/_blob/<id>`, id = first 32 hex of the sha256) and stored in
`project/assets/` (slides, canvas) or `project/_blobs/` (design system). `open` starts `scripts/server.mjs` on
127.0.0.1 as a detached process, which records itself in `<root>/.artifact-server.json` (log: `.artifact-server.log`);
a second `open` reuses it, `stop` ends it. `serve` runs the same server in the foreground.

The server speaks the wire protocol the prebuilt editors expect (BaoCut's `@baocut/slides` file protocol, re-implemented):
`_files.json`, `project/<path>`, `__deck/publish` (all-or-nothing, `ifMatch` → 409 conflict, atomic writes),
`__deck/assets`, `__deck/events` (SSE `external-change`) and `__deck/session`. Edits flow both ways:

- page → disk: a save is a publish; the server writes the files and remembers each one's sha256, so the save never
  comes back to the page as a change;
- disk → page: one `fs.watch` per directory plus a 2 s stat poll, debounced 300 ms, compared by content with what the
  page has; a real change sends `external-change`, and the page saves its own pending edits, then reloads. A stream
  that reconnects (it sends `Last-Event-ID`) is told about the changes it missed.

The three `server.mjs` differ only in their first section (`KIND`, the index file, `LAYOUT`: which paths are files,
where watching starts, limits, the upload folder; the page CSP's `script-src`; extra session fields). The layouts
match BaoCut's `DECK_LAYOUT`, `CANVAS_LAYOUT` and `DESIGN_SYSTEM_LAYOUT`; everything below the `shared core` marker is
the same code in all three, so change it in all three.

After changing `cli.ts` or a `server.mjs`, or pulling new editors, rebuild and smoke-test each kind: `check` on a
sample, `open`, an edit in the page lands on disk, a write on disk shows in the page, and the server log
(`.artifact-server.log`) shows the page's saves without a `changed on disk` echo. A server started before the change
keeps the old code: `stop`, then `open`.

## Dashboard

```bash
node tools/artifact-skills/sync-dashboard.mjs           # copy the built page and the references
node tools/artifact-skills/sync-dashboard.mjs --build   # vite-build the page first
```

The dashboard is not BaoCut-based. Its page comes from the TypeScript reconstruction of the Dashboard type in
`CLAUDE_SKILLS_DIR` (default `../claude-skills`, `src/dashboard-type`), its references from
`originals/dashboard-type`. `sync-dashboard.mjs` patches the built `index.html` to boot standalone and records the
hash of every source in [`dashboard/upstream.json`](dashboard/upstream.json); it warns when the original SKILL.md
changed, so the port can be redone by hand. Hand-written, never generated: `skills/claude-dashboard/SKILL.md`,
`scripts/artifact.mjs` (Node 22+, built-ins only) and `scripts/editor/local-host.js` (the local stand-in for the
page's `claude` runtime: store, uploads, user, downloads). A dashboard keeps its documents in
`<root>/db/<collection>/<doc_id>.json` and its attached files in `<root>/_blobs/`.
