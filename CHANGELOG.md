# Changelog

English | [中文](./CHANGELOG.zh.md)

All notable changes to `baoyu-design` are tracked in this file.

## 2.4.1 - 2026-10-31

### Features
- `claude-dashboard`: comment on a chart, a number, a table or any part of the page, and tick **Send to agent**. New `comments`, `comment-reply` and `comment-resolve` commands; `comments --wait` prints the page's address and title. The `dsh-claude-dashboard` plugin waits for comments and shows a sent comment as a card in the chat.
- `claude-slides`, `claude-design` and `claude-design-system`: on a page opened on its own, the comments button sits in the top-right toolbar.
- The editors use claude.ai's current icon set.
- DeepSeek Harness: a plugin market index for the **Discover** tab, at `https://jimliu.github.io/baoyu-design/dsh-plugins/index.json`, rebuilt after each release.

### Fixes
- `claude-dashboard`: the editor ships the licenses of its open-source packages in `scripts/editor/third-party-licenses.txt`, like the other editors.

### Documentation
- New `NOTICE.md` sets out the license of each part. The MIT License covers only the maintainer's own work. The material from Anthropic (skill text and references adapted from the Artifact types, `dataviz`, the editors reconstructed from claude.ai, the Anthropicons icon fonts, and the Claude Design prompt, built-in skills and starter components in `archive/`) stays Anthropic's and is not under MIT; the archived `frontend-design` skill is Apache 2.0, with its license beside it. Open-source code keeps its own licenses. `LICENSE`, the READMEs and every `SKILL.md` point to it, and the DeepSeek Harness plugins now ship it (`"license": "SEE LICENSE IN LICENSE"`).
- The READMEs cover installing the DeepSeek Harness plugins from npm and from **Discover**.

## 2.4.0 - 2026-10-30

### Features
- DeepSeek Harness plugins for the four editors, published to npm: `dsh-claude-slides`, `dsh-claude-design`, `dsh-claude-design-system` and `dsh-claude-dashboard`. In the app, open **Plugins** → **Add plugin** and enter a plugin's name. Each plugin carries its skill as this repo publishes it, prebuilt editor included; the folders are also in `dsh-plugins/`.
- In the DeepSeek Harness plugins, the plugin waits for comments whenever the agent opens an editor, so **Send to agent** wakes the agent even when the chat is idle. A comment sent to the agent shows in the chat as a card, and **View thread** on the card opens the editor at that thread.
- Comments: after a comment is sent to the agent, its thread opens and shows "Working…" until the agent replies. `?comment=<id>` in an editor's address opens that thread, and `comments --wait` also prints the editor's address and the artifact's title.
- Comments: in the All comments panel, resolve and a more menu (Edit, Reopen, Delete thread) show when you hover a row and stay on the selected one; editing and the delete confirmation open in the row. Escape in a panel menu closes only the menu.

### Documentation
- `dsh-plugins/README.md`: installing by name, using, updating, uninstalling, and what to do when something doesn't work.

### Maintenance
- A version tag publishes the DeepSeek Harness plugins to npm from GitHub Actions.

## 2.3.0 - 2026-10-30

### Changed
- Archive the `baoyu-design` skill: it moves from `skills/` to `archive/baoyu-design/`, so the `skills` CLI no longer installs it. The READMEs now cover the four artifact skills and `dataviz`.

### Fixes
- `claude-slides`: port the rest of the 2026-10-29 editor, including video embeds beyond YouTube, the Present menu, the phone landscape hint and the bottom toolbar; buttons and menus keep their spacing.
- `claude-design-system`: add the new controls (2D color picker, segmented control, property rows, number input); the delete confirmation opens again.
- `claude-dashboard`: port the 2026-10-29 page UI and messages, and editing the page by hand (Edit the page, Beta) on one-writer pages.
- Comments: fix toast placement on right-to-left pages and the danger menu item highlight.

### Documentation
- Refresh the editor screenshots in the READMEs.

## 2.1.0 - 2026-10-30

### Features
- `claude-slides`, `claude-design` and `claude-design-system`: leave comments on elements or areas in the editor. Comments are saved locally with their file and location; the agent can read, reply to, resolve and reopen threads. While an agent listens, a **Send to agent** checkbox lets you send a comment for it to act on.
- Add `dataviz`, a chart-design skill for any output medium, with guidance on chart forms, color, marks, legends, accessibility and interaction, plus JavaScript and Python palette validators.
- Refresh all four artifact editors to the 2026-10-29 upstream release, including the design canvas's Theme tab, read-only code-synced design systems, and updated font and icon assets.
- `claude-slides`: decks opened on their own page gain additional export formats; PowerPoint export embeds linked Google Fonts, with WOFF2 decoding in the page.

### Fixes
- Editor servers exit with an error when their port is already in use instead of hanging.

### Changed
- Ship the artifact tools and editors prebuilt and remove the separate `tools/artifact-skills/` build tooling.
- `claude-dashboard`: share server state and HTTP helpers with the other artifact servers.

### Documentation
- Sync the four artifact skills and their reference pages with the 2026-10-29 upstream instructions, covering design-system setup, slide links, canvas notes and dashboard data workflows.
- Reorganize the English and Chinese READMEs around the skills, with editor screenshots, updated examples, dataviz and comments guidance, and a demo video in the Chinese README.

## 2.0.3 - 2026-10-29

### Fixes
- `claude-design`: a page's phone version, the artboard beside the page at phone width, is now a 390×844 phone screen whose content scrolls inside the frame, so full-screen Fit shows it at its own size like a phone. Before, it took the page's full height, and Fit shrank it to a sliver.

## 2.0.2 - 2026-10-28

### Fixes
- `claude-dashboard`: a dashboard's numbers, dates and state lines follow the person's language (in Chinese: 万/亿, `10月1日`, `加载失败`), and a title not in Latin letters gets a short English folder name.
- `claude-dashboard`: dates not in ISO form, such as `Thu, Oct 29, 2026` in an X analytics export, are parsed as UTC with `d3.utcParse`, not `new Date()`, which shows them as the day before east of UTC.
- `claude-dashboard`: a batch sent through a shell heredoc quotes its end marker (`<<'EOF'`); unquoted, the shell expands the `$file` in `{"$file": …}`.

## 2.0.1 - 2026-10-28

### Fixes
- `claude-design-system`: a design system imported from a component library now gets live, interactive component previews instead of README-only or hand-drawn static cards. The agent takes every exported component, installs the package published on npm (`--ignore-scripts`, so none of the repository's code runs) and bundles it; the repository's own build is only for unpublished packages, and static previews are a labelled fallback.
- `claude-design-system`: document libraries that need React 19 (ship `components/lib/react.js` and `react-dom.js`, listed in `libraries`), and that fonts from hosts other than Google Fonts, such as Typekit, fall back in previews.
- `baoyu-design`: importing a design system keeps every path it reads or copies inside the design-system folder and the project; an `@import` or manifest entry that points outside, or a symlink leading out, is skipped and reported (#16).

## 2.0.0 - 2026-10-28

### Features
- Add four skills that bring claude.ai's Artifact types to local agents: `claude-slides` (slide decks), `claude-design` (a canvas of artboards), `claude-design-system` (design systems) and `claude-dashboard` (data-backed dashboards). Each `SKILL.md` keeps the type's original instructions, with the Artifact tool calls swapped for a local `scripts/artifact.mjs` (Node 20+, the dashboard Node 22+; nothing to install).
- Each skill ships its editor prebuilt in `scripts/editor/` and runs its own local server, so you and the agent can take turns: the agent's file writes show up in the editor at once, and edits made in the editor are saved back into the same files.
- Decks and canvases can install a design system made with `claude-design-system`; the editor's Theme and color menus then offer its colors and text styles.
- `claude-design` gets an Export button in the editor toolbar: export the whole design as a standalone HTML page, a PDF or PNG images. PDF and PNG first ask which artboards to include; PNG exports at 1× or 2×, and several artboards download as a .zip.
- Add `tools/artifact-skills/` to rebuild the prebuilt editors.

### Changed
- `baoyu-design` now triggers only when a task creates or edits a visual deliverable. Architecture or protocol analysis, rendering-engine or backend work and technical Markdown no longer trigger it on their own.

### Documentation
- Document the four artifact skills, their `artifact.mjs` commands and the `claude-design` export in the English and Chinese READMEs.

## 1.3.0 - 2026-09-23

### Features
- Synchronize the September 14 Claude Design snapshot: a new `watercolor-kit` starter paints deterministic, code-driven watercolors and replays them stroke by stroke, with matching watercolor components in `animations-v3` for painterly animation beats (plus a portable fallback when hosted painting tools are unavailable).
- Absorb upstream guidance on GitHub sync receipts, minimum text contrast, and fluid layouts; PDF exports now rebuild the print copy from a fresh read of the design with optional source-version provenance.

### Fixes
- Soften mouse-wheel zoom on the design canvas: each wheel click now zooms 10% instead of ~20%, and zoom-vs-pan is decided once per scroll, so trackpad or Magic Mouse momentum can no longer blow the canvas up mid-pan.
- Keep fit-mode `doc-page` content on a single printed sheet instead of spilling onto a second page.
- Reject absolute asset paths when importing a design system, closing a path-traversal gap (by @anupamme)

### Changed
- Tweak-panel chat submissions are tagged as suggestion, free text, or ideas requests, and the suggestion bar reports a single impression per session.
- Record the local design-canvas patch alongside the existing deck-stage patches so upstream syncs reapply it, with a test guarding it.

### Documentation
- Mention the watercolor painting runtime in the English and Chinese starter-component overviews.

## 1.2.0 - 2026-07-25

### Features
- Synchronize 13 project-type routes and the July 25 Claude Design system-prompt snapshot, covering slides, mobile apps, wireframes, documents, animation, UI mockups, résumés, 3D objects, research, HTML email, color/type systems, diagrams, and fliers.
- Add specialized workflows for 3D objects, data science and visualization, design feedback, experiments, HTML email, maps, social media campaigns, trifold brochures, watercolor illustration, web research, landing pages, and additional export formats.
- Add starter components for timeline animation, charts and data overlays, document and file views, 3D scenes, browser/device shells, and major social platforms.

### Changed
- Merge upstream improvements into `deck-stage`, `image-slot`, design guidance, and project routing while preserving local native PowerPoint animations, tweak suggestions, design-system tooling, import flows, and video export.
- Record reproducible upstream-sync provenance and manifests, with tests that verify every project type and protect local feature overlays.

### Documentation
- Expand the English and Chinese capability overview for the new workflows and starter components.

## 1.1.1 - 2026-06-22

### Changed
- `make-a-deck`: clarify that text-capable image generation is not a reason to prefer it — HTML/CSS stays the default for structured and precise slide content, and generated imagery remains a supplement reserved for conceptual scenes, mascots, hero/section art, and genuine infographics (Chinese labels are welcome when an infographic is genuinely the right call).

## 1.1.0 - 2026-06-22

### Changed
- `generate-images`: update raster image guidance for modern image backends that can render text reliably, including Chinese / CJK, and route text-heavy infographics to HTML/CSS only when editability, exactness, or data binding matters.
- `make-a-deck`: align deck imagery guidance with text-capable image generation so generated slide infographics can include headings, labels, callouts, and Chinese copy when they do not need live editability or exact numeric binding.

## 1.0.0 - 2026-06-22

### Features
- Ship the portable `baoyu-design` Agent Skill with the core design methodology, harness references for Claude Code, Cursor, and Codex, built-in design workflows, starter components, design-system tooling, and local import/export agents.
- Add `release-skills`, a reusable release workflow for version selection, multi-language changelogs, annotated tags, and GitHub Releases.
- Add local deck, document, PPTX, video, image-generation, Figma `.fig`, GitHub repo, HTML/CSS import, and design-system preview flows.

### Fixes
- `gen-pptx`: improve editable PowerPoint fidelity by rendering children in z-index order, propagating ancestor opacity through exported subtrees, rasterizing gradient overlays, preserving Unicode filenames, preserving line breaks, and guarding stuck captures with per-call timeouts.
- `make-a-deck`: document full-height slide wrappers so full-bleed slide content exports reliably.

### Documentation
- Document installation, local usage, design systems, import sources, deck/PPTX export, and the supported agent harnesses in the English and Chinese READMEs.

## 2026-06-19

### Features
- `generate-images`: add a harness-agnostic image-generation dispatcher and wire it into the design flows that need raster output. The dispatcher records prompt files before generation, chooses runtime-native providers before the installed `baoyu-image-gen` CLI, standardizes `imgs/` + `prompts/` outputs, and removes the obsolete `gemini-image` built-in skill.

### Changed
- PPTX export now defaults to editable mode; screenshot export remains available when explicitly requested.

### Fixes
- `make-a-deck`: document that each slide's content wrapper must fill its `<section>`. deck-stage sizes only the section (via `::slotted`), not the wrapper inside it, so a wrapper whose children are all absolutely positioned collapses to zero height — dropping full-bleed images entirely on export, or rendering hero backgrounds at half height. Adds a base CSS rule (`section[data-label] > *`), the mechanism behind it, and a verification check.
- `gen-pptx` / `gen-video`: preserve Unicode characters (CJK, Cyrillic, accented Latin) in export filenames via a shared `safeBasename` sanitizer, instead of replacing every non-ASCII word character with `_` (which turned names like `小米SU7-外观与价格` into all underscores).
- `gen-pptx`: rasterize CSS gradient backgrounds (cover/hero scrims, fade overlays) to transparent PNGs in editable PPTX export. PowerPoint has no gradient fill, so the converter previously flattened a gradient to its first color stop — turning an alpha-fading scrim like `linear-gradient(105deg, rgba(8,10,13,.92) → .05)` into a near-opaque dark rectangle that uniformly dimmed the whole image and hid the bright subject under the fade. The exporter now paints the gradient onto a canvas honoring each stop's alpha (linear + radial, angle / `to`-direction / corner, %/px stops, border-radius clipping), so overlays fade exactly as in the browser; unsupported forms (conic / repeating) fall back to the prior flat fill.

## 2026-06-16

### Features
- `animated-video`: add a local `gen-video` CLI for MP4/WebM/GIF export. It drives Chromium with Playwright, seeks timeline animations frame by frame through `window.__animStage`, supersamples captures, and streams frames to ffmpeg.
- `starter-components/animations.jsx`: add the `window.__animStage` timeline bridge and `?capture` behavior so exported animations start paused, render full-bleed, and omit editing chrome.

### Fixes
- `gen-pptx`: guard setup and capture calls with per-call timeouts so a stuck slide cannot hang export forever.
- `gen-pptx`: preserve code-block line breaks and `<br>` elements in editable PPTX text export.

### Documentation
- README: document the deck/PPTX export workflow and add English/Chinese pipeline diagrams.

## 2026-06-15

### Features
- `gen-pptx`: add a local PPTX exporter for Claude Code. The TypeScript CLI uses Playwright and PptxGenJS to export baoyu-design decks in editable or screenshot mode and prints structured validation output.
- `deck-stage`: add native fullscreen support, auto-hide the thumbnail rail in Fullscreen API mode, add a fullscreen toolbar button plus `F` shortcut, and add a Duplicate slide action.
- `deck-stage`: move rail mutations to a host-driven `dc-op` model while preserving standalone HTML fallback behavior.
- `make-a-doc`: add a built-in skill for page-style, print-first documents.
- `something-cool`: add the opt-in "show me something cool" flow with an upfront direction picker.
- `tweaks-panel`: add `TweakSuggestionBar` so edit-mode tweak ideas can be dropped into the host chat composer.

### Changed
- Built-in skill prompts were refreshed across deck authoring, speaker notes, mobile prototypes, print/PDF export, handoff, PDF reading, visual design, animation, sound, Canva, and PPTX export flows.
- `design-canvas`: persist and restore viewport pan/zoom, with a visibility backstop and wheel passthrough for nested deck rails.
- `SKILL.md`: add PPT/PPTX/PowerPoint routing terms, scope PPTX export to baoyu-design decks only, and trim the skill description under the runtime description limit.

### Fixes
- `deck-stage`: force slide animations and transitions to their end state during print/PDF export so entrance states are not captured mid-animation.

## 2026-06-11

### Features
- Add `import-from-github` and `import-from-html` built-in skills for treating repositories and existing HTML/CSS pages as design sources with provenance and content-is-data guardrails.
- Design-system tooling now parses component prop contracts from `.d.ts` files, emits complete enum/default prop guidance into `_ds_prompt.md`, and detects risky top-level Babel globals such as `status`, `open`, and `location`.
- Add a GitHub Actions test workflow and Node test coverage for the design-system, Figma import, preview, asset, and prompt tooling.

### Fixes
- `build-preview.mjs`: inline assets referenced from card scripts and JSX string literals so generated `preview.html` files no longer show broken images for script-side asset refs.
- `fig-materialize.mjs`: map font weights with the ordered decoder table so Semi Bold, Extra Bold, Thin, and related weights materialize correctly.
- `ds-prompt.mjs`: keep fenced JSX examples complete when extracting component prompt excerpts.

### Documentation
- README: add an "Import design sources" section covering offline Figma `.fig` files, GitHub repositories, and existing HTML/CSS references.

## 2026-06-10

### Features
- Add a local offline Figma `.fig` importer with `outline`, `mount`, `materialize`, `render`, and `design-system` subcommands.
- Add the `design-system-preview` built-in skill and `agents/build-preview.mjs`, generating a self-contained interactive `preview.html` for compiled design systems.

### Changed
- `.fig` importer output now prints copy-pasteable next-step commands, warns about case-insensitive filename collisions, and records mount/render guidance in generated README files.
- Design-system preview summaries are capped for very large systems so validation output stays readable.

### Fixes
- Design-system bundles now emit sources in dependency-safe order so local component dependencies are defined before consumers load.
- Token extraction no longer misreads BEM pseudo-class selectors as custom-property declarations.
- Preview fallback messages now distinguish a missing manifest from a manifest with no usable preview entries.

## 2026-06-09

### Features
- Add end-to-end design-system support: discovery, project binding, `_ds/<slug>/` sync, generated per-load `_ds_prompt.md`, and project metadata recorded in `_d_meta.json`.
- Add the read-only fork-verifier subagent for post-build checks across Claude Code, Codex, and Cursor harnesses.
- Design-system prompts now use bundle-first wiring, include component prompt excerpts, and expose PascalCase `.jsx`/`.tsx` exports without `.d.ts` contracts when safe.

### Changed
- Expand design-system authoring guidance for GitHub source import, component imports, accepted global CSS entry names, and runtime wiring.
- Shorten the `baoyu-design` skill description while preserving trigger terms (by @easonshen90, [#8](https://github.com/JimLiu/baoyu-design/pull/8)).

### Credits
- `baoyu-design` skill description shortening contributed by @easonshen90 ([#8](https://github.com/JimLiu/baoyu-design/pull/8)).

## 2026-06-08

### Features
- Add the portable design-system authoring toolchain: compiler, checker, core parser, vendored Babel runtime, and a read-only checker subagent.
- Add design-system consumer import/sync tooling, including `_ds/<slug>/` bindings, generated per-load prompts, and `_d_meta.json` project metadata.
- Add asset recording tooling for tracking generated deliverables, versions, status, viewport, subtitles, and sections.

### Changed
- Harness references now point to the shared design-system authoring guide and clarify when to run checks inline versus through an isolated read-only subagent.

### Fixes
- Remove the tracked `skills/baoyu-design/.DS_Store` file (by @HCS9527, [#2](https://github.com/JimLiu/baoyu-design/pull/2)).

### Credits
- Tracked `.DS_Store` removal contributed by @HCS9527 ([#2](https://github.com/JimLiu/baoyu-design/pull/2)).

## 2026-06-07

### Fixes
- `SKILL.md`: fix frontmatter metadata so the skill loads correctly (by @y122972, [#1](https://github.com/JimLiu/baoyu-design/pull/1)).
- Remove the root `.DS_Store` file and add `.DS_Store` to `.gitignore`.
- Correct README screenshot file mappings.

### Documentation
- Add screenshots to the English and Chinese READMEs, document Reader Mac App prompts and Claude Design comparison examples, and optimize screenshot assets to WebP.

### Credits
- `SKILL.md` frontmatter fix contributed by @y122972 ([#1](https://github.com/JimLiu/baoyu-design/pull/1)).

## 2026-06-06

### Features
- Add the portable `baoyu-design` Agent Skill with core design methodology, built-in skill prompts, starter components, export/handoff flows, and Claude Code/Cursor harness references.
- Add Codex Agent support with `skills/baoyu-design/references/codex.md`, covering question asking, browser preview, screenshots, debugging, deliverable surfacing, and subagent verification defaults.

### Documentation
- Add English and Simplified Chinese README files.
- Add this changelog and clarify that final design/prototype delivery should surface the running preview, not only generated files.

### Chore
- Add initial repository files and MIT license.
