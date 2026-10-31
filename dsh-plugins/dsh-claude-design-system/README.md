# dsh-claude-design-system

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds the **claude-design-system**
skill from [baoyu-design](https://github.com/JimLiu/baoyu-design): the agent writes design systems (tokens, type,
components, assets and a brand book) as files in your workspace, built from a code repository, a design tool or
scratch, and opens them in a local design-system page, where you can browse and edit them.

## Install

In the DeepSeek Harness desktop app: **Plugins** → **Add plugin** → enter `dsh-claude-design-system` in **Package name
or address** → **Install**, and turn the plugin on. From the command line, for a CLI profile such as `web`:

```sh
dsh plugin --profile web add dsh-claude-design-system
```

Then quit and reopen the app, start a new session, and ask for a design system, or type `/claude-design-system`. A
workspace that has its own `claude-design-system` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead
of this plugin's.

To update, uninstall the plugin, install it again, and quit and reopen the app. For a day after a release the app's
package manager (pnpm) still picks the previous version; to get the new one sooner, enter the name with the version,
such as `dsh-claude-design-system@2.4.0`.

## What is inside

- `skills/claude-design-system/`: the skill as baoyu-design publishes it (`SKILL.md`, `artifact-type/reference/`, and
  the prebuilt `scripts/`: the page, `artifact.mjs`, and its server).
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells
  the agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app
  ships, or `node` on PATH. Set `node` in the `claude-design-system` row's config to choose another. Whenever the agent
  opens the page, the plugin also waits for comments, so a comment's **Send to agent** box is there: send one and the
  agent wakes up, changes the system, and replies in the comment.
- `lib/client.js`: the part that runs in the app's window. It shows a comment sent to the agent as a card in the chat;
  **View thread** on the card opens it in the page.
- `cordis.patch.yml`: the bundle layer that mounts the plugin row.

The page's server listens on 127.0.0.1 only and reads and writes only the design system's folder.

## License

MIT. The page's third-party licenses are in `skills/claude-design-system/scripts/editor/third-party-licenses.txt`.
