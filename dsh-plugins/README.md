# DeepSeek Harness plugins

[English](README.md) · [简体中文](README.zh-CN.md) · [Back to baoyu-design](../README.md)

Each folder here is a plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) app. A plugin
adds one baoyu-design skill: ask the agent for a slide deck, a design, a design system, a dashboard or a film, and it writes the
files into your workspace, then gives you a link to an editor that runs on your computer. The link opens in the app's
sidebar, next to the chat.

| Plugin | npm package | What it does | Comments |
|---|---|---|---|
| [Claude Slides](dsh-claude-slides/)<br>`/claude-slides` | [`dsh-claude-slides`](https://www.npmjs.com/package/dsh-claude-slides) | The agent writes editable slide decks as files and opens them in a local slide editor where you can present, edit, and export PDF, HTML, or PowerPoint. | Send to Agent |
| [Claude Design](dsh-claude-design/)<br>`/claude-design` | [`dsh-claude-design`](https://www.npmjs.com/package/dsh-claude-design) | The agent writes editable design canvases (artboards side by side) as files and opens them in a local canvas editor where you can retype copy, adjust tweaks, and send comments to the agent. | Send to Agent |
| [Claude Design System](dsh-claude-design-system/)<br>`/claude-design-system` | [`dsh-claude-design-system`](https://www.npmjs.com/package/dsh-claude-design-system) | The agent writes design systems (tokens, type, components, assets, a brand book) as files and opens them in a local page where you can browse and edit them, and send comments to the agent. | Send to Agent |
| [Claude Dashboard](dsh-claude-dashboard/)<br>`/claude-dashboard` | [`dsh-claude-dashboard`](https://www.npmjs.com/package/dsh-claude-dashboard) | The agent builds data-backed dashboards (charts, numbers and tables over your data files) and opens them in a local dashboard editor whose Sources panel shows where every number comes from, and where you can send comments to the agent. | Send to Agent |
| [Claude Motion](dsh-claude-motion/)<br>`/claude-motion` | [`dsh-claude-motion`](https://www.npmjs.com/package/dsh-claude-motion) | The agent writes short animated films (explainers, product demos, title sequences) as code, scene by scene, and plays them in a local Motion player where you watch them fill in, comment on a moment, and export MP4 or GIF. | Send to Agent |

Each of them brings along [`dsh-claude-artifacts`](dsh-claude-artifacts/), the part they share: the **Artifacts** page, and
comments reaching the agent. It installs by itself, and there is one of it however many plugins you add.

All you need is the DeepSeek Harness desktop app. The plugins run on the Node.js the app ships with, so there is nothing
else to install.

## Install

1. **Open the Plugins page.** Click **Plugins** in the left sidebar, then **Add plugin** at the top right.
2. **Enter the plugin's name** in **Package name or address**, for example `dsh-claude-slides`, and click **Install**.
   The names are in the table's **npm package** column. The app downloads the plugin from npm, or from the npmmirror
   registry when npm is out of reach.
3. **Turn it on.** The plugin now shows in the list. If its switch is off, turn it on.
4. **Quit and reopen the app.** The **Artifacts** entry in the left sidebar, and the cards for comments sent to the
   agent in the chat, show only after a restart.

To install several plugins, repeat steps 1 to 3 for each, then restart once.

**From the Discover tab.** The app can also list these plugins for you, install them with a click, and tell you when a
new version is out. Discover is an experimental feature of the app and starts switched off:

1. On the Plugins page, click **More** beside **Experimental plugins** and switch on **Custom plugin markets**. The page
   now has a **Discover** tab.
2. In **Discover**, click **Add index source**, paste this address in **Index URL**, and click **Add**:

   ```text
   https://jimliu.github.io/baoyu-design/dsh-plugins/index.json
   ```

3. Click **Install** on a plugin's card, confirm, and finish in the install dialog that opens. Then turn the plugin on
   and restart the app, as in steps 3 and 4.

The index is updated each time a new version is published to npm.

**Command line.** To install into a CLI profile, such as `web`:

```bash
dsh plugin --profile web add dsh-claude-slides
```

The desktop app's own profile only accepts plugins added from its Plugins page.

**From a folder.** You can also install from a copy of this repository: clone it (or download the ZIP and unzip it),
and in step 2 enter the full path of the plugin's own folder, the one with `package.json` in it, such as
`/Users/you/baoyu-design/dsh-plugins/dsh-claude-slides`. The app uses that folder where it is, so don't move or delete
it. The app installs no dependencies for a folder, so add the `dsh-claude-artifacts` folder too, before the first plugin.

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
   - **Send to Agent**: add a comment on the page, tick **Send to Agent**, and send it. The agent picks the comment up
     even when the chat is idle, makes the change, and replies in the comment. The comment also shows in the chat as a
     card; **View thread** on the card opens it in the editor. The box only shows while the agent is waiting for
     comments, and it starts waiting each time it gives you a link.
   - **None**: this editor has no comments. Tell the agent in the chat what to change and where.

To come back later, click **Artifacts** in the left sidebar. It lists every deck, design, design system, dashboard and film
the agent has opened with these plugins. Click one: the
app goes back to the conversation that made it and opens the editor in the right sidebar's browser. If that
conversation was deleted or archived, the editor opens in a new window instead. You can also open a session in the same
workspace and ask the agent to open it again; it starts the editor and gives you a new link.

On that page you can also:

- **Start something new.** Click a tile at the top (Slides, Design, Dashboard, …) or **+** at the top right. The app starts a new session with the input filled in (`/claude-slides Make me a slide deck about: `, say); finish the sentence and send it, and the agent uses that skill. A plugin you have not installed yet has a dimmed tile marked **Not installed**: click it to see what the plugin does, and **Install** to add it without leaving the page (where the app cannot install from there, the tile tells you to use the Plugins page). Once it is in, its tile works like the others; if the app asks for a restart, quit and reopen it. A plugin you switched off has no tile.
- **See thumbnails.** The desktop app opens each artifact's editor once to take its picture, and takes it again when you come back after its files changed. `dsh web` cannot take pictures, so its cards show a drawing of the type.
- **Change the view, search, sort and filter.** The buttons at the top right switch between a grid and a list, search by title, conversation or path, sort by last opened, last edited, date created or name, and filter by type, date opened, sharing or pinned.
- **Pin, rename, copy the link, delete.** Hover over an artifact and click **…** (while the menu is open, P, R and C work too). Rename changes the title in the editor. The link is the editor's address on this computer, and the editor stays running. Delete moves the folder to `baoyu-design/trash/` in the app's data folder (`~/.dsh` by default); the message that follows has an Undo, and you can delete it for good there. A folder that holds other files too is only taken off the page, and stays where it is.

## Keep a skill to one preset

A plugin's skill is there in every [agent preset](https://github.com/deepseek-ai/deepseek-harness) until you say otherwise.
To have a skill only in the sessions of one preset:

1. **Turn its row off.** On the Plugins page, open the plugin and, under **Components**, switch off its own row (**Claude
   Slides**, say). Leave the plugin's main switch on, and leave **Claude Artifacts** on.
2. **Declare it in a preset.** Add a preset to the end of the profile's `cordis.patch.yml` (for the desktop app,
   `~/.dsh/profiles/desktop/cordis.patch.yml`), naming the plugins by their package names:

   ```yaml
   - insert:
       - id: preset-slides-dashboard
         name: '@deepseek-ai/dsh-agent-preset'
         config:
           id: slides-dashboard
           name: Slides and dashboards
           description: Only the claude-slides and claude-dashboard skills.
           order: 10
           plugins:
             - id: persona
               name: '@deepseek-ai/dsh-persona'
               config:
                 prefix: You are an agent powered by the {{model}} model.
             - id: tool-bash
               name: '@deepseek-ai/dsh-tool-bash'
               disabled: !!js process.platform === 'win32'
             - id: tool-pwsh
               name: '@deepseek-ai/dsh-tool-pwsh'
               disabled: !!js process.platform !== 'win32'
             - id: tool-fs
               name: '@deepseek-ai/dsh-tool-fs'
             - id: tool-skill
               name: '@deepseek-ai/dsh-tool-skill'
             - id: claude-slides
               name: dsh-claude-slides
             - id: claude-dashboard
               name: dsh-claude-dashboard
   ```

   A preset holds everything its sessions get, so this one lists the tools the skills need: the shell, files, and loading
   skills. **Settings** → **Agent presets** shows what the built-in presets hold, and says why a preset failed to load.
3. **Quit and reopen the app**, start a new session, and pick the preset from the mode menu above the input. `/` offers
   these skills there, and not in the other presets.

**Artifacts** goes on working: everything you made is still listed and still opens, even when its skill is in no preset,
as long as its plugin is installed. A tile on that page starts its session in a preset that has the skill, and comments
still reach the agent.

## Update

When a new version is out, the app doesn't interrupt you: the **Artifacts** row in the left sidebar gets an **Update** label (a
small dot on the icon, where a collapsed sidebar keeps its icons). Open the Artifacts page: the top says which version it is, lists
the plugins that have it and says what changed. **Update all** updates them together, with nothing to uninstall or install again,
and it's what you normally want. To take just one, click **Update** on its line; the others stay on offer, and the app may then ask
for a restart, since plugins on two versions can't always share what they share. With one plugin there's no list, and the button
just says **Update**.

- **When it looks.** Once when the app opens, then every 6 hours while it stays open. It asks the npm registry you install
  plugins from, and the npmmirror mirror when that can't be reached.
- **While it runs.** You can leave the Artifacts page: the label in the sidebar says **Updating**.
- **Afterwards.** New sessions use the new version. If the label says **Restart**, and the page says the same, quit and reopen the
  app.
- **Not now.** Click **Later**: the label goes away for this version and the Artifacts page keeps one line, with **Show** to open it
  again. The next version is offered as usual.
- **If it fails.** The label says **Failed**. The Artifacts page says why and where the plugin stands, and **Try again** picks up
  where it stopped: the rest after **Update all**, that plugin after its own **Update**.

After an update, **Code source** on the plugin's page shows a `.tgz` address. That's expected, and the Artifacts page keeps offering
that plugin updates. What changed in each version is in the [changelog](../CHANGELOG.md).

**The button on the plugin's page.** From DeepSeek Harness 0.2.2 the app has its own **Update to x** there, which can also pick another
version. A plugin the Artifacts page hasn't updated shows that one; a plugin it has updated shows the plugin's own **Update**, which
updates just that plugin. There is only ever one. **With two plugins installed, use the Artifacts page**: updating them one by one with
the app's button fails on the second. See [If something doesn't work](#if-something-doesnt-work).

**Updating by hand.** Versions 2.9.2 and earlier don't offer new versions. From DeepSeek Harness 0.2.2, open the plugin's page and click
**Update to x**. On older apps they need one update by hand:

1. On the Plugins page, open the plugin and click **Uninstall**. The decks, designs, dashboards and films you made stay in their
   workspace folders.
2. Install it again: click **Install** on its card in **Discover**, or add it by name, as in [Install](#install).
3. Quit and reopen the app, and start a new session.

Discover installs the new version right away. For a day after a release, adding a plugin by name still gets the
previous version: the app's package manager (pnpm) holds new releases back for 24 hours. To get the new one sooner,
enter the name with the version, such as `dsh-claude-slides@2.4.0`.

**A plugin added from a folder** doesn't get told about new versions: get the new version into the same folder, with `git pull` in
the repository or by unzipping the new ZIP over the old one, then quit and reopen the app and start a new session.

## Uninstall

On the Plugins page, open the plugin and click **Uninstall**. The decks, designs, dashboards and films you made stay in their
workspace folders.

## If something doesn't work

- **The skill isn't offered after you type `/`.** Check on the Plugins page that the plugin is on, then start a new
  session.
- **The agent follows different instructions.** If the workspace has its own copy of the skill, in `.agents/skills/` or
  `.dsh/skills/`, the agent uses that copy instead of the plugin's.
- **Installing fails.** Check the name against the table's npm package column. The install dialog shows the error and
  which registry the app asked; if neither npm nor npmmirror can be reached, check your network or proxy. For a folder,
  check that the path is complete (it starts with `/`, or a drive letter on Windows) and that it points to the plugin's
  own folder, the one with `package.json` in it.
- **Discover can't read the index.** In **Discover**, open the market menu and pick **Manage index sources…**: the
  reason shows under the address. The index is on GitHub Pages (`github.io`); if your network can't reach it, add the
  plugins by name instead.
- **There is no Artifacts in the sidebar, or Claude Artifacts says Not running.** For a plugin added from a folder, add the
  `dsh-claude-artifacts` folder too, and restart the app. Until then the skill works, and the agent waits for comments
  itself.
- **The app says the plugin is already installed.** To install it again, uninstall it first. Updating doesn't need that: see
  [Update](#update).
- **Update to x on the plugin's page says other configuration still uses this bundle's components, and the plugin is switched off.** That
  happens on the second plugin when you update two one by one. Your files aren't touched. Turn its switch on, click **Update** on the Artifacts
  page, then quit and reopen the app when it says to.
- **No update is offered.** After a release reaches npm, the app finds it the next time it opens, or within 6 hours. It can't look
  when neither npm nor npmmirror can be reached, and a plugin added from a folder isn't offered one.
- **The link doesn't load, or Send to Agent is missing.** This happens after the app restarts or the plugins update, for example. Ask the
  agent to open the editor again, or click it in **Artifacts**. That starts the editor and the wait for comments again.
- **Something you made is missing from Artifacts.** The page lists what the agent opened once the plugin (from the
  version that added Artifacts) was installed, and leaves out folders that were moved or deleted. Ask the agent to open
  it once and it shows up.

Each plugin's folder has its own README with more on what is inside.
