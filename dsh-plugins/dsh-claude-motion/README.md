# dsh-claude-motion

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds the **claude-motion** skill from
[baoyu-design](https://github.com/JimLiu/baoyu-design): the agent writes short animated films (explainers, product
demos, title sequences) as code, scene by scene, into a folder in your workspace, and plays them in a local Motion
player, where you watch them fill in, comment on a moment, and export MP4 or GIF.

## Install

In the DeepSeek Harness app: **Plugins** → install → enter this package's folder (an absolute path) or its tarball.
From the command line, for a CLI profile such as `web`:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-claude-motion
```

Then quit and reopen the app, start a new session, and ask for a film, or type `/claude-motion`. A workspace that has
its own `claude-motion` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead of this plugin's.

## What is inside

- `skills/claude-motion/`: the skill as baoyu-design publishes it (`SKILL.md`, `artifact-type/reference/`, and the
  prebuilt `scripts/`: the player page and `artifact.mjs`, which is also its server).
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells the
  agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app ships,
  or `node` on PATH. Set `node` in the `claude-motion` row's config to choose another. Whenever the agent opens the
  player, the plugin also waits for comments, so a comment's **Send to Agent** box is there: send one and the agent
  wakes up, changes the film, and replies in the comment. The player's **Continue**, **Finalize**, **Make the
  animation** and **Ask Agent** buttons reach the agent the same way.
- `lib/client.js`: the part that runs in the app's window. It shows a comment, or a button's request, sent to the agent
  as a card in the chat; **View thread** on a comment's card opens it in the player. It also adds **Artifacts** to the left
  sidebar, one entry for all the baoyu-design plugins: the films and everything else the agent has opened, each a
  click away from its conversation and editor.
- `cordis.patch.yml`: the bundle layer that mounts the plugin row.

The player's server listens on 127.0.0.1 only and reads and writes only the film's folder.

## License

Not all MIT. The plugin's own code and files (`lib/`, `cordis.patch.yml`, `locale/`, `docs/`, `icon.svg`) and the skill's local tooling are MIT, in `LICENSE`. The bundled `claude-motion` skill is adapted from Anthropic's claude.ai Motion type: its instructions, references, player and icon fonts stay Anthropic's and are not under the MIT License. `NOTICE.md` sets out which is which. The player's open-source licenses are in `skills/claude-motion/scripts/editor/third-party-licenses.txt`.
