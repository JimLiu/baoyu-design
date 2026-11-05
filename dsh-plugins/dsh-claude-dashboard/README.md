# dsh-claude-dashboard

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that adds the **claude-dashboard** skill
from [baoyu-design](https://github.com/JimLiu/baoyu-design): the agent builds data-backed dashboards (charts, numbers
and tables over your CSV, TSV or JSON files, or data it gathers) as files in your workspace and opens them in a local
dashboard editor, with a Sources panel that shows where every number comes from.

## Install

In the DeepSeek Harness desktop app: **Plugins** → **Add plugin** → enter `dsh-claude-dashboard` in **Package name or
address** → **Install**, and turn the plugin on. From the command line, for a CLI profile such as `web`:

```sh
dsh plugin --profile web add dsh-claude-dashboard
```

Then start a new session and ask for a dashboard, or type `/claude-dashboard`. A workspace that has its own
`claude-dashboard` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead of this plugin's.

To update, uninstall the plugin, install it again, and quit and reopen the app. For a day after a release the app's
package manager (pnpm) still picks the previous version; to get the new one sooner, enter the name with the version,
such as `dsh-claude-dashboard@2.4.0`.

## What is inside

- `skills/claude-dashboard/`: the skill as baoyu-design publishes it (`SKILL.md`, `artifact-type/reference/`, and the
  prebuilt `scripts/`: the editor page and `artifact.mjs`, which is also its server).
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells
  the agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app
  ships, or `node` on PATH. Set `node` in the `claude-dashboard` row's config to choose another. That is all this row does,
  so you can turn it off and [keep the skill to one agent preset](https://github.com/JimLiu/baoyu-design/blob/main/dsh-plugins/README.md#keep-a-skill-to-one-preset).
- `cordis.patch.yml`: the bundle layer that mounts two rows: this plugin's, and `claude-artifacts`.

[`dsh-claude-artifacts`](https://www.npmjs.com/package/dsh-claude-artifacts) installs with this plugin and does the rest,
whichever way the skill is set up: whenever the agent opens the editor it waits for comments, so a comment's **Send to Agent** box is there: send one and
the agent wakes up, changes the dashboard, and replies in the comment. It shows what is sent as a card in the chat, and adds **Artifacts**
to the left sidebar, one entry for all the baoyu-design plugins: the dashboards and everything else the agent has opened,
each a click away from its conversation and editor.

The editor server listens on 127.0.0.1 only and reads and writes only the dashboard's folder.

## License

Not all MIT. The plugin's own code and files (`lib/`, `cordis.patch.yml`, `locale/`, `docs/`, `icon.svg`) and the skill's local tooling are MIT, in `LICENSE`. The bundled `claude-dashboard` skill is adapted from Anthropic's claude.ai Dashboard type: its instructions, references, page and icon fonts stay Anthropic's and are not under the MIT License. `NOTICE.md` sets out which is which. The page's open-source licenses are in `skills/claude-dashboard/scripts/editor/third-party-licenses.txt`.
