# dsh-claude-slides

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds the **claude-slides** skill from
[baoyu-design](https://github.com/JimLiu/baoyu-design): the agent writes editable slide decks as files in your
workspace and opens them in a local slide editor, where you can present, edit, and export PDF, HTML, or PowerPoint.

## Install

In the DeepSeek Harness desktop app: **Plugins** → **Add plugin** → enter `dsh-claude-slides` in **Package name or
address** → **Install**, and turn the plugin on. From the command line, for a CLI profile such as `web`:

```sh
dsh plugin --profile web add dsh-claude-slides
```

Then quit and reopen the app, start a new session, and ask for a deck, or type `/claude-slides`. A workspace that has
its own `claude-slides` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead of this plugin's.

To update, uninstall the plugin, install it again, and quit and reopen the app. For a day after a release the app's
package manager (pnpm) still picks the previous version; to get the new one sooner, enter the name with the version,
such as `dsh-claude-slides@2.4.0`.

## What is inside

- `skills/claude-slides/`: the skill as baoyu-design publishes it (`SKILL.md`, `artifact-type/reference/`, and the
  prebuilt `scripts/`: the editor page, `artifact.mjs`, and its server).
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells
  the agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app
  ships, or `node` on PATH. Set `node` in the `claude-slides` row's config to choose another. Whenever the agent opens
  the editor, the plugin also waits for comments, so a comment's **Send to agent** box is there: send one and the agent
  wakes up, changes the slide, and replies in the comment.
- `lib/client.js`: the part that runs in the app's window. It shows a comment sent to the agent as a card in the chat;
  **View thread** on the card opens it in the editor.
- `cordis.patch.yml`: the bundle layer that mounts the plugin row.

The editor server listens on 127.0.0.1 only and reads and writes only the deck's folder.

## License

Not all MIT. The plugin's own code and files (`lib/`, `cordis.patch.yml`, `locale/`, `docs/`, `icon.svg`) and the skill's local tooling are MIT, in `LICENSE`. The bundled `claude-slides` skill is adapted from Anthropic's claude.ai Slides type: its instructions, references, editor and icon fonts stay Anthropic's and are not under the MIT License. `NOTICE.md` sets out which is which. The editor's open-source licenses are in `skills/claude-slides/scripts/editor/third-party-licenses.txt`.
