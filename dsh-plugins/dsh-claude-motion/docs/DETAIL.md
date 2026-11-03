# Claude Motion

Adds the **claude-motion** skill to DeepSeek Harness. Ask for a short animated film ("a 15-second explainer of how our
sync works", "a logo sting for the launch") and the agent writes it as code, scene by scene, into a folder in your
workspace (`designs/<name>/` unless you name another). It starts a local Motion player and gives you its link; the film
fills in there as the agent writes it.

## Using it

- Ask in plain words, or type `/claude-motion` to call the skill by name. It works best with your own material:
  screenshots, a logo, brand colours, fonts.
- Open the link the agent gives you. In the desktop app it opens in the right sidebar's Browser, beside the
  conversation (Settings → General → Open chat links in: **In-App Sidebar**, the default).
- In the player you play and scrub the film. Its **Continue**, **Finalize**, **Make the animation** and **Ask Agent**
  buttons send their request to the agent, like a comment: it shows in the chat as a card and the agent takes it from
  there, even when the conversation is idle. When the agent isn't waiting (after restarting the app, until it opens the
  film again), they copy the request instead, and you paste it into the chat.
- Comment on a moment: the comments button in the bar at the top turns comment mode on. Click the picture to comment on
  that moment and point, drag for a box, or press R to mark a stretch of time. Tick **Send to Agent** and the agent picks
  it up at once, even when the conversation is idle: it changes the film and replies in the comment. The comment also
  shows in the chat as a card; **View thread** on the card opens it in the player. The box is there while comments can
  reach the agent, which starts each time it gives you the link. After restarting the app, ask the agent to open the
  film again to bring it back.
- Export: the download button under the film encodes MP4 or GIF in the page and saves it to your downloads.
- To change a film later, ask the agent to revise its folder.
- A workspace that has its own `claude-motion` skill (in `.agents/skills/` or `.dsh/skills/`) uses that copy instead
  of this plugin's.

## What runs where

The player is a small server on 127.0.0.1 that the skill's script starts in the background, one per film. It reads and
writes only that film's folder. The desktop app's own Node runtime runs it; nothing else is installed.
