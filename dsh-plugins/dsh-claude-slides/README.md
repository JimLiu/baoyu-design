# dsh-claude-slides

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds the **claude-slides** skill from
[baoyu-design](https://github.com/JimLiu/baoyu-design): the agent writes editable slide decks as files in your
workspace and opens them in a local slide editor, where you can present, edit, and export PDF, HTML, or PowerPoint.

## Install

In the DeepSeek Harness app: **Plugins** → install → enter this package's folder (an absolute path) or its tarball.
From the command line, for a CLI profile such as `web`:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-claude-slides
```

Then start a new session and ask for a deck, or type `/claude-slides`. A workspace that has its own `claude-slides`
skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead of this plugin's.

## What is inside

- `skills/claude-slides/`: the skill as baoyu-design publishes it (`SKILL.md`, `artifact-type/reference/`, and the
  prebuilt `scripts/`: the editor page, `artifact.mjs`, and its server).
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells the
  agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app ships,
  or `node` on PATH. Set `node` in the `claude-slides` row's config to choose another. It also has the agent wait for
  comments in a background job whenever it gives you the editor's link, so a comment's **Send to agent** box is there:
  send one and the agent wakes up, changes the slide, and replies in the comment.
- `cordis.patch.yml`: the bundle layer that mounts the plugin row.

The editor server listens on 127.0.0.1 only and reads and writes only the deck's folder.

## License

MIT. The editor's third-party licenses are in `skills/claude-slides/scripts/editor/third-party-licenses.txt`.
