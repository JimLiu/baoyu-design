# DeepSeek Harness plugins

[English](README.md) · [简体中文](README.zh-CN.md) · [Back to baoyu-design](../README.md)

Each folder here is a plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) app. A plugin
adds one baoyu-design skill: ask the agent for a slide deck, a design, a design system or a dashboard, and it writes the
files into your workspace, then gives you a link to an editor that runs on your computer. The link opens in the app's
sidebar, next to the chat.

| Plugin | What it does | Comments |
|---|---|---|
| [Claude Slides](dsh-claude-slides/)<br>`/claude-slides` | The agent writes editable slide decks as files and opens them in a local slide editor where you can present, edit, and export PDF, HTML, or PowerPoint. | Send to agent |
| [Claude Design](dsh-claude-design/)<br>`/claude-design` | The agent writes editable design canvases (artboards side by side) as files and opens them in a local canvas editor where you can retype copy, adjust tweaks, and send comments to the agent. | Send to agent |
| [Claude Design System](dsh-claude-design-system/)<br>`/claude-design-system` | The agent writes design systems (tokens, type, components, assets, a brand book) as files and opens them in a local page where you can browse and edit them, and send comments to the agent. | Send to agent |
| [Claude Dashboard](dsh-claude-dashboard/)<br>`/claude-dashboard` | The agent builds data-backed dashboards (charts, numbers and tables over your data files) and opens them in a local dashboard editor whose Sources panel shows where every number comes from. | None |

All you need is the DeepSeek Harness desktop app. The plugins run on the Node.js the app ships with, so there is nothing
else to install.

## Install

1. **Open the Plugins page.** Click **Plugins** in the left sidebar, then **Add plugin** at the top right.
2. **Enter the plugin's name** in **Package name or address**, for example `dsh-claude-slides`, and click **Install**.
   The names are in the table above. The app downloads the plugin from npm, or from the npmmirror registry when npm is
   out of reach.
3. **Turn it on.** The plugin now shows in the list. If its switch is off, turn it on.
4. **Quit and reopen the app.** The chat shows comments sent to the agent as cards only after a restart.

To install several plugins, repeat steps 1 to 3 for each, then restart once.

**Command line.** To install into a CLI profile, such as `web`:

```bash
dsh plugin --profile web add dsh-claude-slides
```

The desktop app's own profile only accepts plugins added from its Plugins page.

**From a folder.** You can also install from a copy of this repository: clone it (or download the ZIP and unzip it),
and in step 2 enter the full path of the plugin's own folder, the one with `package.json` in it, such as
`/Users/you/baoyu-design/dsh-plugins/dsh-claude-slides`. The app uses that folder where it is, so don't move or delete
it.

## Use

1. **Start a new session.** Sessions that were open before you installed the plugin don't have the new skill. Pick a
   workspace folder for the session: that is where the agent writes the files.
2. **Ask for what you want.** You can ask in plain words, for example "make a 10-slide deck on our Q3 results". You can
   also name the skill: type `/` and pick it, such as `/claude-slides`. You can give the agent files to work from, such
   as notes, a brief, or a CSV for a dashboard.
3. **Open the link** the agent gives you, which starts with `http://127.0.0.1:`. It opens in the right sidebar's browser,
   next to the chat. If it opens somewhere else, check **Settings → General** for where chat links open, and choose the
   in-app sidebar.
4. **Work in the editor.** The editor saves your changes to the same files, and the agent's changes appear in the page
   as it makes them. To change more, ask in the chat or leave a comment.
5. **Send comments to the agent** (see the Comments column above):
   - **Send to agent**: add a comment on the page, tick **Send to agent**, and send it. The agent picks the comment up
     even when the chat is idle, makes the change, and replies in the comment. The comment also shows in the chat as a
     card; **View thread** on the card opens it in the editor. The box only shows while the agent is waiting for
     comments, and it starts waiting each time it gives you a link.
   - **None**: this editor has no comments. Tell the agent in the chat what to change and where.

To come back later, open a session in the same workspace and ask the agent to open the deck, design or dashboard
again. It starts the editor and gives you a new link.

## Update

The app doesn't update these plugins by itself. To get a new version:

1. On the Plugins page, open the plugin and click **Uninstall**. The decks, designs and dashboards you made stay in their
   workspace folders.
2. Add it again by name, as in [Install](#install).
3. Quit and reopen the app, and start a new session.

For a day after a release, adding a plugin by name still gets the previous version: the app's package manager (pnpm)
holds new releases back for 24 hours. To get the new one sooner, enter the name with the version, such as
`dsh-claude-slides@2.4.0`. The versions are in the [changelog](../CHANGELOG.md).

A plugin added from a folder: get the new version into the same folder, with `git pull` in the repository or by
unzipping the new ZIP over the old one, then quit and reopen the app and start a new session.

## Uninstall

On the Plugins page, open the plugin and click **Uninstall**. The decks, designs and dashboards you made stay in their
workspace folders.

## If something doesn't work

- **The skill isn't offered after you type `/`.** Check on the Plugins page that the plugin is on, then start a new
  session.
- **The agent follows different instructions.** If the workspace has its own copy of the skill, in `.agents/skills/` or
  `.dsh/skills/`, the agent uses that copy instead of the plugin's.
- **Installing fails.** Check the name against the table above. The install dialog shows the error and which registry
  the app asked; if neither npm nor npmmirror can be reached, check your network or proxy. For a folder, check that the
  path is complete (it starts with `/`, or a drive letter on Windows) and that it points to the plugin's own folder, the
  one with `package.json` in it.
- **The app says the plugin is already installed.** To install it again, for example to update it, uninstall it first.
- **The link doesn't load, or Send to agent is missing.** This happens after the app restarts, for example. Ask the
  agent to open the editor again. That starts the editor and the wait for comments again.

Each plugin's folder has its own README with more on what is inside.
