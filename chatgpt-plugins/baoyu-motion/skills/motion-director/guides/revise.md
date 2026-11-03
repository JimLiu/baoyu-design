# Changes after the first video

A film that already exists (`<root>` holds `modules/scenes.json`). claude-motion's "Revising a film" and "Comments"
say how to read it, map a moment to its scene, apply a round and reply; this page says what each kind of change costs
in takes and renders, so a change redoes only what it touches.

A note points at a moment, but what it asks can be about the film: "I don't get this part" is rarely a font size. Read
it against the treatment at the top of `src/script.md` and fix the cause, a line or a scene, at the smallest cost that
fixes it; when the fix is bigger than what they asked (a part rewritten), say so before doing it.

## First

- `read-db <root> modules` (and `film/script`): the store is the truth. Lines may have changed in the player's Script
  panel since you last wrote `voice.json`; `read-db <root> modules/voice.json --text` into `src/voice.json` before you
  edit it.
- `comments <root>`: open threads, if they point at moments.
- Read `src/script.md` for what each scene shows and where its facts come from.
- `voice.json`'s `voice.provider` is `command`: every `voice` run needs `--command '…'` again (guides/voice.md); it is
  never kept in the film. Ask for their program if it isn't `MOTION_TTS_COMMAND` or the Mac's voice.

## What each change redoes

| The change | Redo | Then |
|---|---|---|
| Words of some lines | `voice.json`; `voice` (only those scenes are stale), `align`, `sync` | `beats --only <those ids>`; the scenes' motion follows `kit.cue`, check their stills |
| A word said wrong | its `say` entry; `voice --only <scenes with it>`, `align`, `sync` | as above |
| Another voice, or another speed | `voice.json`'s `voice`; every take again (`voice` finds them all stale), `align`, `sync` | the length may move: guides/voice.md, "The length". Tell them it remakes every take, and how many, before doing it |
| Their own recording for some scenes | `voice --take <id>=<file>`, `align`, `sync` | as for words |
| The picture of a scene | that scene's module (claude-motion's rules) | `check`, its stills |
| Colors, fonts, the look | `base.css` and what uses it | `check`, stills of a few scenes |
| The music | `score.js` (claude-motion's sound.md); their own track: claude-motion's "Recorded music" | `score` for the levels and the cuts on the beat; `export --audio-only` to listen, in seconds |
| Scenes reordered, added or cut | `scenes.json` and `voice.json` together (each voiced scene keeps its id and take) | `sync`, `check`, `beats` for new scenes |
| Captions' place or size | `voice.json` `captions` | stills of a busy frame |
| Captions' words only, not the voice | not possible: captions are the lines, and the lines are the take. A typo in both: as words | |

The player shows the change at once. A video already made is now out of date: say so, and `export` again only when
they ask (guides/review.md). Only a subtitle file changed: `captions <root>` again, not the video.

## Another shape

A vertical cut of a landscape film, or a square one: a new film, beside the first. Copy `<root>` to a new folder
without `exports/`, `history/`, `comments.json`, `.artifact-server.json`, `.artifact-server.log` and `.sharing.json`
(the new film starts its own); in the copy set `scenes.json`'s `width` and `height`, and rewrite each scene's layout
for the new frame (the takes, lines and timing stay). `check`, stills of every scene; its own export when they ask. Two shapes
asked at once: finish one first.

## Another language

Also a new film beside the first: the same structure, new lines written for that language's ear (not translated line
by line; guides/script.md), a voice they pick for it, then takes, timing and the scenes' text. The pictures mostly
stay.

## Replies

A change asked in a comment: write it, then `comment-reply` in a sentence (what changed, in their words), and leave
resolving to them unless they asked. When they asked for the video remade, the reply says so and where it is.
