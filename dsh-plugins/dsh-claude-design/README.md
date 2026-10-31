# dsh-claude-design

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds the **claude-design** skill from
[baoyu-design](https://github.com/JimLiu/baoyu-design): the agent writes editable design canvases (artboards side by
side) as files in your workspace and opens them in a local canvas editor, where you can retype copy and adjust each
artboard's tweaks.

## Install

In the DeepSeek Harness desktop app: **Plugins** → **Add plugin** → enter `dsh-claude-design` in **Package name or
address** → **Install**, and turn the plugin on. From the command line, for a CLI profile such as `web`:

```sh
dsh plugin --profile web add dsh-claude-design
```

Then quit and reopen the app, start a new session, and ask for a design, or type `/claude-design`. A workspace that has
its own `claude-design` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead of this plugin's.

To update, uninstall the plugin, install it again, and quit and reopen the app. For a day after a release the app's
package manager (pnpm) still picks the previous version; to get the new one sooner, enter the name with the version,
such as `dsh-claude-design@2.4.0`.

## What is inside

- `skills/claude-design/`: the skill as baoyu-design publishes it (`SKILL.md`, `artifact-type/reference/`, and the
  prebuilt `scripts/`: the editor page, `artifact.mjs`, and its server).
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells
  the agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app
  ships, or `node` on PATH. Set `node` in the `claude-design` row's config to choose another. Whenever the agent opens
  the editor, the plugin also waits for comments, so a comment's **Send to agent** box is there: send one and the agent
  wakes up, changes the artboard, and replies in the comment.
- `lib/client.js`: the part that runs in the app's window. It shows a comment sent to the agent as a card in the chat;
  **View thread** on the card opens it in the editor.
- `cordis.patch.yml`: the bundle layer that mounts the plugin row.

The editor server listens on 127.0.0.1 only and reads and writes only the canvas's folder.

## License

MIT. The editor's third-party licenses are in `skills/claude-design/scripts/editor/third-party-licenses.txt`.
