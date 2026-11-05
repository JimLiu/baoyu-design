# dsh-claude-artifacts

The part the [baoyu-design](https://github.com/JimLiu/baoyu-design) plugins for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) share: the **Artifacts** page in the sidebar, and
comments from their editors reaching the agent. Each plugin (`dsh-claude-slides`, `dsh-claude-design`, …) depends on this
package and its bundle patch mounts this row, so it comes with them and you normally never install it yourself.

It keeps running when a skill's own row is off, which is what lets a skill stay in one agent preset: see
[Keep a skill to one preset](https://github.com/JimLiu/baoyu-design/blob/main/dsh-plugins/README.md#keep-a-skill-to-one-preset).

## Install it yourself

Only for plugins added from a folder, whose dependencies the app does not install. Add this folder first:

```sh
dsh plugin --profile web add link:/path/to/baoyu-design/dsh-plugins/dsh-claude-artifacts
```

## What is inside

- `lib/index.js`: the Host half. When an agent runs a skill's `open`, it notes the folder for the Artifacts page and waits
  for comments (`comments <root> --wait`, again after each one), handing what comes to the agent as a message. It serves
  the page's routes and runs the skill's own script, found in the skill's plugin package, whose row can be off. Set `node`
  in the `claude-artifacts` row's config to choose the Node executable that runs it.
- `lib/client.js`: the part that runs in the app's window: the **Artifacts** page and the card a comment shows as in the
  chat, with **View thread** to open it in the editor.
- `cordis.patch.yml`: the bundle layer that mounts the row.

## License

`LICENSE` and `NOTICE.md`, as in every baoyu-design plugin. This package's own code and files are MIT; it carries no skill
and no Anthropic material.
