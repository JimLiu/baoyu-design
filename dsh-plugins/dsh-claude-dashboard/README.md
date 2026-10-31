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
- `lib/index.js`: the plugin. It registers the skill with the Harness skill registry and, when the skill loads, tells the
  agent which Node executable runs `scripts/artifact.mjs`: the Host's own Node, the Node runtime the desktop app ships,
  or `node` on PATH. Set `node` in the `claude-dashboard` row's config to choose another.
- `cordis.patch.yml`: the bundle layer that mounts the plugin row.

The dashboard editor has no comments: tell the agent in the chat what to change. Its server listens on 127.0.0.1 only
and reads and writes only the dashboard's folder.

## License

MIT.
