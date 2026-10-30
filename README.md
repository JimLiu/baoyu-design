# baoyu-design


https://github.com/user-attachments/assets/d5b4f39b-a701-49de-87b8-64f3c6ef9c61



**Run Claude Design on your own local agent — Cursor, Claude Code, Claude Desktop, or any file‑capable coding agent.**

[English](README.md) · [简体中文](README.zh-CN.md) · [Changelog](CHANGELOG.md)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Best with Opus 5.5](https://img.shields.io/badge/Best%20with-Opus%205.5-d97757) ![Harness](https://img.shields.io/badge/Cursor%20%C2%B7%20Claude%20Code%20%C2%B7%20Codex-supported-1f6feb)

This repo brings claude.ai's **Artifact types** to local agents: editable slide decks, design canvases, design systems and data dashboards, each opened in its own editor that runs on your machine. A fifth skill, `dataviz`, is the chart guide the agent reads before it draws any chart, in these skills or anywhere else.

The original `baoyu-design` skill (self‑contained HTML mockups and prototypes) has been archived to [`archive/baoyu-design/`](archive/baoyu-design/).

No website, no separate subscription, no upload step. The agent already on your machine does the work, and every artifact stays in your repo.

---

## Skills in this repo

| Skill | Makes | You edit it in |
|---|---|---|
| [`claude-slides`](skills/claude-slides/) | Slide decks: `project/deck.json` plus one HTML file per slide | The slides editor: present, retype, drag; export PDF, HTML or PowerPoint |
| [`claude-design`](skills/claude-design/) | A canvas of artboards: `project/canvas.json` plus `.dc.html` Design Components | The canvas editor: artboards side by side, play prototypes, retype copy, adjust tweaks; export HTML, PDF or PNG |
| [`claude-design-system`](skills/claude-design-system/) | Design systems: tokens, a README brand book, component previews, fonts, asset groups | The design system editor: browse and edit colors, type, components and assets |
| [`claude-dashboard`](skills/claude-dashboard/) | Data‑backed dashboards: datasets (CSV, TSV, JSON) and a page of charts, numbers and tables over them | The dashboard page: live charts, filters, and a Sources panel that traces every number to its rows |
| [`dataviz`](skills/dataviz/) | Better charts in any medium (HTML, SVG, d3, matplotlib, plotly…): picking the form, colors that stay readable in light and dark and for color‑blind readers, marks, legends and tooltips, with a palette validator script | Nothing to open: the agent reads it before writing chart code; swap [`palette.md`](skills/dataviz/references/palette.md) for your brand's colors |

---

## Artifact skills: editable decks, canvases, design systems and dashboards

These four skills write the Artifact type's own file format into a folder and open it in that type's editor page, served from your machine. The agent writes the files and the editor shows each write at once; your edits in the editor are saved back into the same files, so you and the agent can take turns.

In the slides, canvas and design-system editors, choose **Comment** (or press **C**) to comment on an element or area. Comments stay in the project's local `comments.json`; the agent reads and replies through `artifact.mjs`. While it listens with `comments <root> --wait`, the editor offers **Send to agent** to send your comment for it to act on.

### `claude-slides`: slide decks

<img src="assets/screenshots/claude-slides-editor.webp" alt="A five-slide health class deck about sleep open in the claude-slides editor" width="880">

A deck is `project/deck.json` plus one HTML file per slide. In the editor you can present full screen, retype any text, drag elements, add text, images, tables and shapes, and export to PDF, HTML or PowerPoint. *Above: a five‑slide health class deck about sleep, built on a sample design system.*

### `claude-design`: a canvas of artboards

<img src="assets/screenshots/claude-design-canvas.webp" alt="A coffee subscription landing page and its mobile signup form side by side on the claude-design canvas" width="880">

A canvas holds artboards side by side: `project/canvas.json` plus one `.dc.html` Design Component per artboard. Play an artboard as a working prototype, on the canvas or full screen; retype copy, adjust tweaks and leave notes; export the whole design as a standalone HTML page, a PDF or PNG images (1× or 2×, several artboards in a .zip). *Above: the landing hero of a coffee subscription, with its mobile signup form beside it.*

### `claude-design-system`: design systems

<img src="assets/screenshots/claude-design-system-editor.webp" alt="The overview page of the Nimbus design system in the claude-design-system editor" width="880">

A design system is tokens, a README brand book, component previews, fonts and asset groups. In the editor you browse and edit colors, type, spacing, radii, shadows, components and assets. Import one from a component library and its previews are the real components, live and interactive. Decks and canvases can install it: their editors' Theme and color menus then offer its colors and text styles. *Above: Nimbus, a small design system for a weather app.*

### `claude-dashboard`: data‑backed dashboards

<img src="assets/screenshots/claude-dashboard.webp" alt="An X account analytics dashboard with sample data in the claude-dashboard page" width="880">

A dashboard is datasets (CSV, TSV or JSON) and a page of charts, numbers and tables computed from them. The charts are live, and the Sources panel traces every number back to its rows. Give the agent a newer export and it swaps the file in; the page recomputes every number. Numbers, dates and labels follow your language. *Above: a year of daily X account analytics, with sample data.*

### Run the editors

Each `SKILL.md` keeps the type's original instructions nearly word for word; only the Artifact tool calls are swapped for local ones. That tool lives inside each skill as `scripts/artifact.mjs` (Node 20+, the dashboard's Node 22+; nothing to install). The agent runs it for you; by hand:

```bash
node skills/claude-slides/scripts/artifact.mjs open designs/q3-review             # start the editor, print its URL
node skills/claude-slides/scripts/artifact.mjs check designs/q3-review            # validate the files
node skills/claude-slides/scripts/artifact.mjs upload designs/q3-review hero.jpg  # store an image, print its /_blob/ URL
node skills/claude-slides/scripts/artifact.mjs list                                 # find design systems on disk
```

A dashboard is written through the same script (`write-db`, `read-db`, `upload`, `check`, `open`) into its own store under `<root>/db/`. Each skill runs its own local server, and everything in `scripts/` ships prebuilt: plain JavaScript that runs on Node alone, with nothing to install or build.

---

## Why run it locally

- **Free yourself from the website.** You get the vast majority of `claude.ai/design`'s capabilities without ever leaving your editor — same methodology, same craft standards, same output format.
- **Best with Opus 5.5.** The skill is a long, demanding design brief; the stronger the model, the better the result. Pair it with **Claude Opus 5.5** for the best output, and it still works well on other capable models.
- **Edit side by side with the agent.** Each editor runs on `localhost`; your edits save back into the same files the agent writes, so you can take turns.
- **Everything is yours.** Output lands in `designs/<slug>/` as plain files you can version, fork, export, or ship.

---

## Quick start

### Prerequisites

- A local agent — **[Cursor](https://cursor.com)**, **[Claude Code](https://claude.com/claude-code)**, **[Codex](https://developers.openai.com/codex/)**, or any of the 70+ agents the installer supports (Cline, Roo Code, GitHub Copilot…). Cursor, Claude Code, and Codex have first‑class tool references inside the skill.
- **Claude Opus 5.5** selected as the model, for best results.
- **Node.js**, for the `npx` installer below and for the artifact skills' editors (Node 20+, the dashboard Node 22+).

### Install

**Recommended — the `skills` CLI.** [`npx skills`](https://github.com/vercel-labs/skills) (from Vercel Labs) reads this repo, finds the skills under `skills/`, and drops them into the right folder for whatever agent it detects:

```bash
# Install into the current project (auto‑detects your agent)
npx skills add JimLiu/baoyu-design

# …or install globally, for every project
npx skills add JimLiu/baoyu-design -g

# Target a specific agent explicitly
npx skills add JimLiu/baoyu-design --agent claude-code
npx skills add JimLiu/baoyu-design --agent cursor
npx skills add JimLiu/baoyu-design --agent codex

# Just list what's in the repo first
npx skills add JimLiu/baoyu-design --list

# Install only some of the skills
npx skills add JimLiu/baoyu-design --skill claude-slides --skill claude-dashboard
```

It installs to `.claude/skills/` for Claude Code and `.agents/skills/` for Cursor/Codex-style agents (add `-g` for the `~/`‑level user install).

### Update

If you installed with the `skills` CLI, update from the terminal:

```bash
# Update one skill (the CLI prompts for the install scope)
npx skills update claude-slides

# Update the project-level or global install
npx skills update claude-slides -p -y
npx skills update claude-slides -g -y
```

`upgrade` is also supported as an alias.

You can also run `npx skills update` to update all installed skills. After updating, restart Claude Code (or start a new agent session) so the refreshed skill files are loaded.

**Alternative — hand the repo URL to your agent.** Don't want to install anything? Paste the URL into chat and let the agent fetch the skill itself:

> Read https://github.com/JimLiu/baoyu-design and follow its `skills/claude-slides/SKILL.md` to make a 10‑slide deck from this PRD.

The agent clones or fetches the repo, loads `SKILL.md`, and proceeds — perfect for a one‑off.

### Use it

Once a skill is installed (or fetched), ask for what you want (*"Make a 12‑slide deck from this PRD"*, *"Turn this CSV into a dashboard"*) or call one by name: `/claude-slides`, `/claude-design`, `/claude-design-system` or `/claude-dashboard` in Claude Code, `$claude-slides` and so on in Codex. The agent writes the files under `designs/<slug>/`, starts the editor, and gives you its `http://127.0.0.1` URL.

---

## Example prompts

- *"Make a claude-slides deck for the Q3 review, then export it to PowerPoint."*
- *"Put a landing page and its phone version side by side on a claude-design canvas."*
- *"Turn the Chakra UI component library into a design system with live component previews."*
- *"Turn this analytics CSV into a dashboard that compares the last 28 days with the 28 before."*

For best results, **give it design context** — a screenshot, a UI kit, a design system, or a codebase. Starting from real context is the single biggest lever on quality; the skill will ask for it if you don't provide it.

---

## Credits & license

This project repackages **Anthropic**'s claude.ai Artifact types and design skills so they can run on local agents. It is an independent, community effort and is not affiliated with or endorsed by Anthropic.

Repackaged and maintained by **Jim Liu 宝玉**. Released under the [MIT License](LICENSE).
