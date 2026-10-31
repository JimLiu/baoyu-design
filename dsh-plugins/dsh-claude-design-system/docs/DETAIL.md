# Claude Design System

Adds the **claude-design-system** skill to DeepSeek Harness. Ask for a design system ("a design system from this
repo's styles", "a brand kit for a tea shop") and the agent writes it as files in your workspace: a folder with
`project/design-system.json`, `tokens.json`, a README brand book, component previews, fonts and assets. It then starts
a local design-system page and gives you its link. claude-slides and claude-design can use the systems it makes.

## Using it

- Ask for a design system in plain words, or type `/claude-design-system` to call the skill by name.
- Open the link the agent gives you. In the desktop app it opens in the right sidebar's Browser, beside the
  conversation (Settings → General → Open chat links in: **In-App Sidebar**, the default).
- On the page you browse and edit the tokens, colors, type, components and assets. Your edits are saved back into the
  same files, and the agent's changes show up in the page as it writes them.
- Comment on a token, color, type style, component, asset or section (Comment, or C). Tick **Send to agent** and the
  agent picks it up at once, even when the conversation is idle: it changes the system and replies in the comment. The
  box is there while the agent waits for comments, which it starts each time it gives you the link (a background job
  in the conversation). After restarting the app, ask the agent to open the system again to bring it back.
- To change a system later, ask the agent to revise the folder that holds its `project/design-system.json`.
- A workspace that has its own `claude-design-system` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy
  instead of this plugin's.

## What runs where

The page is served by a small server on 127.0.0.1 that the skill's script starts in the background, one per system.
It reads and writes only that system's folder. The desktop app's own Node runtime runs it; nothing else is installed.
