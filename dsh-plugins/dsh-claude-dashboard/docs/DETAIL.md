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
- This editor has no comments: tell the agent in the chat what to change and where you are looking.
- To change or refresh a dashboard later, ask the agent to revise its folder.
- A workspace that has its own `claude-dashboard` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy
  instead of this plugin's.

## What runs where

The editor is a small server on 127.0.0.1 that the skill's script starts in the background, one per dashboard. It
reads and writes only that dashboard's folder. The desktop app's own Node runtime runs it; nothing else is installed.
