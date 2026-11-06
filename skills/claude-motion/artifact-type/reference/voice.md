# Asked for a voiceover

This page says what to tell someone who asks for a voiceover or a narration, or to use an audio recording or music file
of theirs, and where in the chat to say it. Also read all of `artifact-type/reference/recording.md` (the installed skill:
`recording.md`, beside this page) if your tools can record a voice (your `Artifact` tool lists the action `speak`, or
your tools list `mcp__claude_ai__artifact_speak`; go by the names you see, and don't search for them), or if the film
speaks already (it holds `modules/narration.js`, or its `film/script` sets `narration`: look in its data, with a `list`
of `modules` and a `get` of `film/script`). Where that page differs from this one or from SKILL.md, it goes first.
Without either, Motion adds no voice and never offers one; either way, it never uses an audio recording or music file
of theirs. **A new film is made all the same,** with the words on screen in its scenes.

## What they are told

| They want | Ahead of the form | In the form | In the close |
| --- | --- | --- | --- |
| a voiceover, a narration, anyone's voice (you can't record) | I can't add a voiceover. | There will be no voiceover: the words will be on screen. | It has no voiceover, since I can't add one: the words are on screen. |
| their own audio recording in it, even as the voiceover (use this row, not the first) | I can't use your recording. | Your recording can't be used: the animation will have text on screen. Once it is finished, Export saves it as a video, and any video editor can add your recording to that. | I couldn't use your recording, but any video editor can add it to the video that Export saves. |
| a music file of theirs in it | I can't use your music file. | Your music file can't be used: I'll compose a score. | I couldn't use your music file, but any video editor can add it to the video that Export saves. |

Say it in their language, and as short. It is a plain fact about Motion, not a refusal: give no reason and no word of
time or place (not even "here"), and never let it hold up the form or the film. A tip or an offer may go anywhere but
in the line ahead of the form.

## Where

Chat can hide what you write ahead of a tool call. So they are told in **the last text of the turn in which they ask**:

- **A mere question** ("can it do voiceover?"): "No, I can't add a voiceover to an animation." Start nothing.
- **A film they have already seen:** do the rest of the ask as usual, and say "I can't add a voiceover." last (in a
  close: these same words, where the close bullet puts them). You may offer to put the words on screen, if they aren't there.
- **A question or a refusal of your own that ends the turn:** "I can't add a voiceover, so I'll put the words on
  screen." goes with it. When kinds.md turns the whole film down, leave the voice out of that no (it is two sentences,
  with no "can't"). If they take the film it offers, tell them as for any new film.
- **A close** (of a film, a plan or a rough cut): a sentence of its own, after its first sentence ("Here's your animation.")
  and the link, if there is one. It isn't the close's one short sentence more.

**A new film, with the form.** That turn ends on the form, with nothing after it. So they are told in three places:
ahead of the form, in it, and again in the next close. Each is needed; none stands in for another.

- **Ahead of it:** the sentence goes into SKILL.md's one line before the form, and nothing else of yours goes there.

  > I can't add a voiceover. A few quick picks, then I'll start.

  Where that line opens with "Your animation is set up.", the sentence comes next:

  > Your animation is set up. I can't add a voiceover. A few quick picks, then I'll start.

  In any language but English the sentence is the whole line, without even "Your animation is set up.": the line must
  stay far under 200 bytes. Write the line last, with no call or thought between it and `show_widget`, or
  `ask_user_input_v0` (which has no such line: the sentence alone).
- **In it:** put the form's words into questions.md's form as a `<p>`, first inside its `elicit-body`. Anything else
  that can't wait for the close (the answer to a question of theirs, the note questions.md puts in the line before the
  form) follows them there, never in the line.
  With `ask_user_input_v0`, the first sentence of the form's words opens the first question's text, whichever it is:
  "There will be no voiceover: the words will be on screen. Which style should it have?" Keep that text under about 120
  characters. What doesn't fit, an answer to a question of theirs too, waits for the close.

## Never

- No speech made by code (`claude.use("tts")` is silent), no audio file as an asset, and don't ask for a recording or wait
  for one.
- No promise of a voice at any other time or place.
- A push changes nothing: give the same answer.
