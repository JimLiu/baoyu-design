# Claude Design

Adds the **claude-design** skill to DeepSeek Harness. Ask for a design ("three landing-page directions for our app")
and the agent writes it as files in your workspace: a folder with `project/canvas.json` and one `.dc.html` file per
artboard. It then starts a local canvas editor and gives you its link.

## Using it

- Ask for a design in plain words, or type `/claude-design` to call the skill by name.
- Open the link the agent gives you. In the desktop app it opens in the right sidebar's Browser, beside the
  conversation (Settings → General → Open chat links in: **In-App Sidebar**, the default).
- In the editor you see the artboards side by side, retype copy and adjust each artboard's tweaks. Your edits are
  saved back into the same files, and the agent's changes show up in the page as it writes them.
- Comment on anything on an artboard (Comment, or C). Tick **Send to agent** and the agent picks it up at once, even
  when the conversation is idle: it changes the artboard and replies in the comment. The comment also shows in the chat
  as a card; **View thread** on the card opens it in the editor. The box is there while comments can reach the agent,
  which starts each time it gives you the link. After restarting the app, ask the agent to open the design again to
  bring it back.
- To change a design later, ask the agent to revise the folder that holds its `project/canvas.json`.
- A workspace that has its own `claude-design` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead
  of this plugin's.

## What runs where

The editor is a small server on 127.0.0.1 that the skill's script starts in the background, one per design. It reads
and writes only that design's folder. The desktop app's own Node runtime runs it; nothing else is installed.
