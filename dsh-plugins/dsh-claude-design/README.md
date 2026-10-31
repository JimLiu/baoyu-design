# dsh-claude-design

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds the **claude-design** skill from
[baoyu-design](https://github.com/JimLiu/baoyu-design): the agent writes editable design canvases (artboards side by
side) as files in your workspace and opens them in a local canvas editor, where you can retype copy and adjust each
artboard's tweaks.

## Install

In the DeepSeek Harness app: **Plugins** → install → enter this package's folder (an absolute path) or its tarball.
From the command line, for a CLI profile such as `web`:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-claude-design
```

Then start a new session and ask for a design, or type `/claude-design`. A workspace that has its own `claude-design`
skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead of this plugin's.

## What is inside

- `skills/claude-design/`: the skill as baoyu-design publishes it (`SKILL.md`, `artifact-type/reference/`, and the
  prebuilt `scripts/`: the editor page, `artifact.mjs`, and its server).
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells the
  agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app ships,
  or `node` on PATH. Set `node` in the `claude-design` row's config to choose another. It also has the agent wait for
  comments in a background job whenever it gives you the editor's link, so a comment's **Send to agent** box is there:
  send one and the agent wakes up, changes the artboard, and replies in the comment.
- `cordis.patch.yml`: the bundle layer that mounts the plugin row.

The editor server listens on 127.0.0.1 only and reads and writes only the canvas's folder.

## License

MIT. The editor's third-party licenses are in `skills/claude-design/scripts/editor/third-party-licenses.txt`.
