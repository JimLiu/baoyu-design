# Claude Dashboard

Adds the **claude-dashboard** skill to DeepSeek Harness. Ask for a dashboard ("a dashboard of this sales CSV by month
and region") and the agent builds it as files in your workspace: a folder holding the datasets, the files they load
and the page. It then starts a local dashboard editor and gives you its link.

## Using it

- Ask for a dashboard, metrics page, KPI tracker or report in plain words, or type `/claude-dashboard` to call the
  skill by name. Give it a CSV, TSV or JSON file, or ask it to gather the data.
- Open the link the agent gives you. In the desktop app it opens in the right sidebar's Browser, beside the
  conversation (Settings → General → Open chat links in: **In-App Sidebar**, the default).
- The Sources panel shows where every number comes from, and downloads a source's rows as CSV. The agent's changes
  show up in the page as it writes them.
- Comment on a chart, a number, a table or any other part of the page (Comment, or C). Tick **Send to agent** and the
  agent picks it up at once, even when the conversation is idle: it changes the dashboard and replies in the comment.
  The comment also shows in the chat as a card; **View thread** on the card opens it in the editor. The box is there
  while comments can reach the agent, which starts each time it gives you the link. After restarting the app, ask the
  agent to open the dashboard again to bring it back.
- To change or refresh a dashboard later, ask the agent to revise its folder.
- A workspace that has its own `claude-dashboard` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy
  instead of this plugin's.

## What runs where

The editor is a small server on 127.0.0.1 that the skill's script starts in the background, one per dashboard. It
reads and writes only that dashboard's folder. The desktop app's own Node runtime runs it; nothing else is installed.
