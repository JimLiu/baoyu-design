# Claude Slides

Adds the **claude-slides** skill to DeepSeek Harness. Ask for a slide deck ("make a 10-slide deck on our Q3 results")
and the agent writes it as files in your workspace: a folder with `project/deck.json` and one HTML file per slide. It
then starts a local slide editor and gives you its link.

## Using it

- Ask for a deck in plain words, or type `/claude-slides` to call the skill by name.
- Open the link the agent gives you. In the desktop app it opens in the right sidebar's Browser, beside the
  conversation (Settings → General → Open chat links in: **In-App Sidebar**, the default).
- In the editor you can present, retype text, drag elements, and export PDF, HTML, or PowerPoint (.pptx). Your edits
  are saved back into the same files, and the agent's changes show up in the page as it writes them.
- Comment on anything in the editor (Comment, or C). Tick **Send to agent** and the agent picks it up at once, even when
  the conversation is idle: it changes the slide and replies in the comment. The box is there while the agent waits for
  comments, which it starts each time it gives you the link (a background job in the conversation). After restarting
  the app, ask the agent to open the deck again to bring it back.
- To change a deck later, ask the agent to revise the folder that holds its `project/deck.json`.
- A workspace that has its own `claude-slides` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead
  of this plugin's.

## What runs where

The editor is a small server on 127.0.0.1 that the skill's script starts in the background, one per deck. It reads
and writes only that deck's folder. The desktop app's own Node runtime runs it; nothing else is installed.
