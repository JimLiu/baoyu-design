# Watching it as the audience; the video when asked

The player plays what the store holds; `check` says it loads and agrees with itself, not that it is any good. Before
you hand it over, look at the film the way its viewer will: once, at the size they'll see it, knowing nothing. Then the
user watches it in the player; the MP4 waits for their word.

## When

After the last scene, the score and `"stage":"final"`, once `check <root>` reports no problems. Not between scenes: a
still of a half-written film shows nothing worth fixing.

## Listening by numbers

You can't hear the film either. With a score, `node $A score <root>` reads what `score.js` plays, with no page open:

- `silent`: drum and effect names the synth doesn't know; they play nothing. `marimba`: instruments it doesn't know,
  played as marimba. Fix the names in `score.js`.
- The sound as the export renders it: the loudness (the range the file is checked against, below), the voice's level,
  the music alone in each gap between takes (`gaps`; a gap under 0.75 s stays ducked), and `quiet`, whole seconds
  below −30 dB: a stretch gone dead, unless that silence is meant.
- `--levels` gives each second's level, for a stretch that needs a closer look.

## Which frames

1. **The fullest moment of every scene**: just before its last line ends, from `beats` (the line's `end` less 0.3 s),
   where most has built up, nothing has left yet and the line's caption is still up. One `stills` call for all of
   them, at the default width (960): `node $A stills <root> --at s01+6.8,s02+9.1,…`. A scene with no lines: its middle
   (`--at <id>`).
2. **Small text at full size**: a chart's labels, a table, a screenshot, captions over a busy frame. Those moments
   again with `--width <the film's width>`.
3. **The first and last frames**: `--at 0` and the film's length less 0.1 s (the end card, complete).
4. **A long film** (over 20 scenes): the first pass at `--width 640`, then full size only where something looks off.
5. **The rhythm**, for a film up to about two minutes: one strip of small frames across the whole film (`--every 3
   --width 480`), read in order like a contact sheet. You can't watch it move; this is the nearest thing.

Read every file of its result's `stills`: each call numbers on from the stills already in the folder, so a later pass
never takes an earlier one's numbers. They are scratch, never sent unasked.

## What to look for

First the film, against SKILL.md's "What a good film is":

- **The first frame** (`--at 0`) is finished, not the start of an entrance: what the film is, and whose, readable at
  thumbnail size. A sentence still to be typed or a line still to come fails. By the third second there is a reason to
  keep watching.
- **Between scenes:** in the strip, is each change carried (one thing turning into the next, a camera move, or a
  bridge the film always uses)? A run of bare cuts from one unrelated frame to another reads as a slideshow.
- **Showing a product:** could a stranger say, from the frames alone, what you do with it and in what order? Is the
  hero the peak? Mark where a task film starts over: there should be no such place. Each thing a scene is about has a
  label. The run starts from a clean state, and each result appears after the action that causes it. A wait shows
  its factor and its real total.
- **The point** comes through: from the frames and the lines alone, could a stranger say it?
- **The device** holds: the picture that carries the film is there from its first scene to its last, not dropped
  halfway for a run of unrelated frames.
- **The peak** has the room and the clearest frame; the scenes before it build to it.
- **The rhythm:** in the strip, something new every few seconds, and a held moment where one should land. A run of
  near-identical frames is a stretch where the viewer leaves.
- **The eye:** in each scene's fullest moment, one thing is plainly the subject.
- **Muted,** a feed film still makes its point from what is on screen.
- **The end** is the takeaway or the next step, complete and held.

Then the frames:

- **Overflow:** text cut by the frame's edge or by a box, words breaking mid-word, a line wrapping where it shouldn't,
  something sitting outside the frame that should be in it.
- **Captions over the picture:** the player draws them at `captions.at` of the height. A frame whose content sits
  there: move the content, or move the captions for the film (`captions.at` in `voice.json`).
- **Vertical films for a feed:** apps cover about the top 15% and bottom 25% with their own buttons and text, and a
  strip on the right. Keep words and faces out of those; captions near `at` 0.7 rather than the bottom.
- **Contrast and size:** text that is hard to read at 960 wide is too small or too faint on a phone.
- **Empty or late frames:** a scene whose fullest moment is still half empty is missing its picture, or its motion
  runs late against its words.
- **Plain type:** every heading in the system sans at bold, with no second voice, looks like a default. Choose the
  display face.
- **Style:** `check`'s warning that a colour is off the film's four means the theme they picked has no palettes beside
  it in the player's Style panel. Fix it before handing over.
- **Fonts:** a still in a fallback font means a font didn't load: claude-motion's rules on fonts. When the stills'
  `warnings` name a family, the MP4 will show its stand-in too: fetch it again, or upload the family's files.
- **The end:** the last frame finished and held, nothing half faded.
- **Facts on screen:** every number and name matches its line and its source.

## Fixing

Fix the scene (claude-motion's rules for writing a scene), `check`, then stills again for that scene's moments only. A
fix in `base.css` or anything every scene uses: the first pass's moments again, all of them. A problem with the film
rather than a frame (the point doesn't come through, the peak is buried, a stretch is dead): that is a scene to
rethink, or a line to cut, not a nudge to a layout. Lines changed mean takes again (guides/voice.md); say so in the
closing message when words they agreed changed. Three rounds on one problem without it going away: leave it, and name
it in the closing message.

## The export

Not part of handing over. When the user asks for the file (or asked in the request, or nobody is there to watch), after
the stills, once:

```bash
node $A export <root> --quality high
```

- It renders the film as it plays, about as long as its running time or longer: run it in the background for any film
  over a minute, and wait for it to finish rather than polling. `--timeout <s>` is how long it may stall with no
  progress (180 by default), not a limit on the whole.
- It writes into `<root>/exports/` (`--out` elsewhere); its result's `out` is the file. A vertical film keeps its
  shape.
- **Subtitles** when they asked for a subtitle file: `--captions` (SRT) or `--captions vtt`, beside the video. The
  captions are already in the picture either way, unless `captions` is `false`.
- Its result's `warnings`, when it has any: read them. A frame that failed or a voice take missing means the video is
  wrong: fix and export again, and say so.

## Checking the file

With ffmpeg here, one quick check on the MP4 itself: `node $A music <mp4>` reads its sound (the video left out, no
ffprobe needed):

- **Length:** its `seconds` within a frame or two of the film's; an error or near-silent `sections` when it has a
  voice or a score means the sound is missing.
- **Loudness:** its `loudness.lufs`. Between about −18 and −13 LUFS is right for the web and phones. Far outside it (a
  quiet provider, a loud score): fix the mix in the film (`voice.json`'s `duck`, the bed's `gain`, `S.master`), check
  it with `export <root> --audio-only` in seconds, and export again. With a full ffmpeg (an AAC encoder), `ffmpeg -y
  -i <mp4> -c:v copy -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k <mp4 without .mp4>-level.mp4`
  levels the file instead: check it the same way, then move it over the first, so there is still one video.

Without ffmpeg, `export <root> --audio-only` gives the same mix's loudness.
