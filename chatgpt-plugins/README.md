# ChatGPT plugins

[English](README.md) · [简体中文](README.zh-CN.md) · [Back to baoyu-design](../README.md)

Each folder here is a plugin for the ChatGPT desktop app and Codex, which load the same packages. Ask the agent for a slide deck, a design, a design system, a dashboard or a film, and it writes the files into your workspace, then gives you a link to an editor that runs on your computer.

| Plugin | Skills | What it does |
|---|---|---|
| [Baoyu Slides](baoyu-slides/)<br>`baoyu-slides` | `claude-slides` | Editable slide decks: present, retype, drag, export PDF, HTML or PowerPoint |
| [Baoyu Canvas](baoyu-canvas/)<br>`baoyu-canvas` | `claude-design` | Editable design canvases: artboards side by side, retype copy, adjust tweaks |
| [Baoyu Design System](baoyu-design-system/)<br>`baoyu-design-system` | `claude-design-system` | Design systems: tokens, type, components, assets and a brand book |
| [Baoyu Dashboard](baoyu-dashboard/)<br>`baoyu-dashboard` | `claude-dashboard` | Data-backed dashboards whose Sources panel shows where every number comes from |
| [Baoyu Motion](baoyu-motion/)<br>`baoyu-motion` | `claude-motion`<br>`motion-director`<br>`dataviz` | Animated films written scene by scene, exported to MP4 or GIF, with a director skill |
| [Baoyu Dataviz](baoyu-dataviz/)<br>`baoyu-dataviz` | `dataviz` | A method for any chart: choosing a form, a color formula with a validator, mark specs |

Install only the ones you need; each works on its own. The plugins that open an editor run on your computer, so they are for the desktop app and for threads that run locally, and they need [Node.js](https://nodejs.org) on your computer: 20 or later, 22 or later for Dashboard and Motion. They are not in OpenAI's plugin directory; you add them from this repository.

## Install

**1. Add this repository as a marketplace**, once:

```bash
codex plugin marketplace add JimLiu/baoyu-design --sparse .agents/plugins --sparse chatgpt-plugins
```

The two `--sparse` paths fetch only the plugins, not the rest of the repository. No `codex` command? The ChatGPT desktop app on a Mac carries one, at `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`.

**2. Install the plugins.** In the ChatGPT desktop app, restart it, open the Plugins Directory, choose **Baoyu Design** as the source, and install what you want. Or from the command line:

```bash
codex plugin add baoyu-slides@baoyu-design
```

**From a folder.** Clone this repository and give the marketplace command its path instead: `codex plugin marketplace add /path/to/baoyu-design`.

## Use

Name the plugin in a new thread, or just ask:

> @baoyu-slides make a 10-slide deck from this document

The agent writes the files under `designs/<name>/` in your workspace and gives you the editor's link. If the app has a built-in browser it can open the link there; otherwise open it in your own.

**Allow local network.** The editor is a small server on `127.0.0.1`, and the default sandbox for an agent's commands blocks local network, so `open` answers `NETWORK_BLOCKED` there. The agent has to run `open` (and `comments --wait`, `share`) with local network allowed: approve it if the app asks, or use a permission mode that allows it. Only the commands that talk to the editor need it; writing and checking files works in the sandbox.

**Comments.** Comment on the page and tick **Send to Agent**. The box is there while the agent is waiting for comments, so if you don't see it, ask the agent to wait for your comments. Without it, comments are saved and the agent reads them when you ask.

## Update

```bash
codex plugin marketplace upgrade baoyu-design
```

Then restart the app, or reinstall the plugin from the command line with `codex plugin add`.

## Terms

Each plugin carries `LICENSE` and `NOTICE.md`. MIT covers only the maintainer's own code; the skill text, references and editors adapted from Anthropic's claude.ai Artifact types stay Anthropic's. See [NOTICE.md](../NOTICE.md).
