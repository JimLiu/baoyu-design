# Voices and takes

Every voice is the user's pick: you offer, they choose, and the film keeps that one voice from the first take to the
last. Cast it like a director: the voice is the film's tone more than any colour is. This page says what to offer, how
the takes are made and how the film's length is fitted. claude-motion's "Narration: the voice track" holds the
commands and `voice.json`; nothing here changes them.

## What is ready here

`node $A voice --providers` (no film needed) lists each provider: whether it is ready (its key, or a program, set in
the environment of the shell that runs the commands), what it needs, and the speeds it takes. Run it before asking
(guides/brief.md). Never print, ask for or write down a key: when one is missing, name the variable and say it belongs
in their shell's environment.

## Offering voices

Three or four voices for the brief's Voice row, from the ready providers, chosen for the film's language, its viewers
and its tone: an explanation wants a voice you'd trust to teach, a feed short one with energy, a product film one that
sounds like a person, not an advert. Each one is a name, a few words on how it sounds, and the provider. Mix them: a
calm one, a warm one, a brighter one, not four of a kind.

| Provider | Model to write in `voice.model` | Voices to offer |
|---|---|---|
| `gemini` (`GEMINI_API_KEY`) | `gemini-3.8-flash-tts`, or a newer TTS model they name | Prebuilt voices that speak many languages. Calm, informative: Charon, Iapetus (clear), Schedar (even). Warm: Sulafat, Achird (friendly), Vindemiatrix (gentle). Firm: Kore, Orus. Bright: Puck (upbeat), Zephyr, Leda (youthful), Fenrir (excited). Mature: Gacrux, Sadaltager (knowing). |
| `openai` (`OPENAI_API_KEY`) | `gpt-4o-mini-tts` (takes a style) | alloy (neutral), ash (clear, assured), ballad (soft), coral (warm), echo (smooth), fable (a storyteller), nova (bright), onyx (deep), sage (calm), shimmer (light), verse (lively). Best in English. |
| `elevenlabs` (`ELEVENLABS_API_KEY`) | leave it out (their default), or one they name | The voices in their own account, by id. `curl -s https://api.elevenlabs.io/v1/voices -H "xi-api-key: $ELEVENLABS_API_KEY"` lists them (name, id, labels such as accent and age) without showing the key; offer three by name and put the id in `data-value` (`elevenlabs: <id>`). It fails: one option, "Your ElevenLabs voice", and ask for its id with the script. |
| `command` (`MOTION_TTS_COMMAND`) | what their program takes, if anything | "Your speech program": the program the variable names, its voice in `voice.name` if it takes one. |
| macOS's own voices, through `command` | none | When `voice --providers` lists `macos` (a Mac with `say` and ffmpeg): "System voice (draft)", free and flat, good for timing a film before a better voice. Chinese: Tingting, Meijia; English: Samantha, Daniel; `say -v '?'` lists the rest. `data-value` `macos: <voice>`. |

Gemini's voices and OpenAI's describe themselves loosely: the words above are a guide for the form, not a promise.
Never offer a voice "like" a real person, and never offer to clone one; the user's own voice is their recording.

## Making the takes

Once the words are agreed.

1. Settings. Write the picked voice into `voice.json`'s `voice` (or pass the flags once; they write it):
   - `provider`, `model`, `name` as the table says;
   - `style`: the delivery in a few words, in English, from the treatment's tone and the audience ("warm and
     unhurried, like explaining to a friend"; "crisp, confident, upbeat"; for a feed, "energetic, quick,
     conversational"). Gemini and OpenAI's `gpt-4o-mini-tts` use it; the others ignore it;
   - `speed`: leave it out. Only to nudge a voice that runs a little slow or fast for the whole film (0.9 to 1.1),
     where the provider takes one (Gemini doesn't: ask for the pace in `style`).
2. `voice <root> --dry-run`: what would be sent, scene by scene, without spending anything. Check the `say`
   replacements came out right.
3. Long films (more than about 10 scenes): `voice <root> --only <first id>` first, and compare its `speech` with that
   scene's estimate. Off by a quarter or more, this voice runs faster or slower than the estimate: change the style or
   speed now, before the other takes, or expect to cut or add lines when fitting the length.
4. `voice <root>`: the rest. It skips scenes whose take is up to date, so running it again after a failure goes on
   where it stopped.
5. `align <root>`, then `sync <root>`, then the length, below.

## The length

`sync <root>` gives each voiced scene its `dur` (its `speech` + `gap` + `hold`) and reports the film's `seconds`.
Compare it with the length asked. The length asked is a target the voice lands near, not a time to fill:

- **Within a tenth of it:** keep it.
- **Longer:** cut words, not speed. Take lines out of the scenes that lose least by it (rarely the opening, the peak
  or the close), write `voice.json` back, then `voice` (only those scenes are made again), `align`, `sync`. A film
  voiced by the `command` provider: pass `--provider command --command '…'` again on every `voice` run; it is never
  kept in the film.
- **Shorter:** keep it if the film says what it set out to; add a line only where it carries something. A `hold` on a
  scene that needs a moment to land (a big number, the end card) adds time without words.
- **Speed** is for a whole film a few percent off, on a provider that takes it: it is part of every take's hash, so
  changing it makes every take again. Change it once, if at all.
- Two rounds and still off: keep what you have, and say the length in the closing message.

**`hold`**: `"hold": 3` on a scene in `voice.json` keeps it on screen 3 seconds after its take and the gap. The ones
you planned are in the first batch (guides/script.md); one added now needs `sync` again. A film's last scene usually
wants 2 to 4 seconds.

## The macOS system voice

The `command` provider with the Mac's `say`, the command passed with every `voice` run (it is never read from the
film), the voice in `--voice`. `voice --providers` gives the command as `macos.run`:

```bash
node $A voice <root> --provider command --voice Tingting --command 'say -v "$MOTION_TTS_VOICE" -r 210 -o "$MOTION_TTS_OUT.aiff" -f "$MOTION_TTS_TEXT_FILE" && ffmpeg -loglevel error -y -i "$MOTION_TTS_OUT.aiff" -ac 1 -ar 24000 "$MOTION_TTS_OUT" && rm -f "$MOTION_TTS_OUT.aiff"'
```

In `voice.json` before the first take: `"voice": {"provider": "command", "name": "Tingting"}` (no model, no style: the
command uses neither). A name several languages share (Eddy, Flo) is written whole, as `say -v '?'` lists it: `"Eddy
(Chinese (China mainland))"`. Alone, `Eddy` is another language's voice, and each take comes out a fraction of a
second of nothing. `-r` is words a minute: about 210 gives Chinese its usual 4.5 characters a second; English wants
about 150. The command is not in a take's hash, so a new `-r` makes nothing stale: `voice --only <ids> --force`
remakes the scenes you choose. A film voiced this way for timing and then voiced again with another provider: all of
its takes are made again (the voice is in every take's hash), then `align` and `sync`; scenes written to `kit.cue`
follow the new timing by themselves.

## Their own takes

Their recordings, or takes made by another speech tool or skill: one file a scene, mp3 or wav, under 90 s and 4 MiB,
each saying that scene's lines as written.

- `voice <root> --take s01=<file>,s02=<file>` or `--takes <dir>` (files named `<scene id>.mp3` or `.wav`), then
  `align` and `sync` as usual.
- Recording themselves: give them the lines scene by scene, one file a scene, a second of silence at each end is fine
  (`align` finds the speech).
- A take of their own is stale when its scene's lines change, like any other: tell them which scenes to record again.

## One narrator

`voice.json` has one `voice` for the whole film. A second speaker (a quote read by another voice, a dialogue) is a
take made elsewhere (another provider's request, or their recording) and adopted with `--take` for that scene; it is
remade by hand when its lines change. Use it rarely: one voice a film is easier to follow.

## Cost, and when not to voice again

Each take is a request the user pays for. Voice once the words are agreed, and afterwards only the scenes whose words
changed (`voice` does that by itself). Never `--force` unless the voice itself changed. A whole new voice means every
take again: say so, and how many scenes, before doing it.
