# Asking: what is theirs to decide

For a new film (no `modules/scenes.json` in its folder yet), before anything is written. You ask once, and only what
is the user's call or what you can't judge from the request: the voice, always; the look; the length and the shape of
the frame when the request leaves them open. What the film is for, its structure, its device and its lines are yours:
you propose them with the script, where they can be changed at no cost.

## Before asking

1. claude-motion's SKILL.md lists what is settled before any question: a request it would decline, or the single
   question whose answer decides whether it can go on. Handle that first, its way.
2. Unless they asked for no voice, run `node $A voice --providers` (it needs no film). It lists the speech providers
   that can make takes here and what each needs. It names keys, never prints one. On a Mac with `say` and ffmpeg it
   adds `macos`: the Mac's own voices, ready for draft takes, and the command that makes them (guides/voice.md).
3. Read the request for everything it already settles, and ask none of it:
   - the subject, and the material they gave (a document, a link, screenshots, a logo, figures, a product to show);
   - the language of the narration: the user's own unless they say otherwise;
   - the audience: who they name, or who the request makes plain (a farewell is watched by the colleagues); otherwise
     curious people who are not experts;
   - where it will be shown: a feed means vertical, a talk or a site means landscape.
4. Material the film needs that they mentioned but didn't give (the logo, the screenshots, the report, a screen
   recording of a product `record` can't reach, such as a desktop app): ask for it
   once, in the line before the form, or with no form in the script message, naming the scene it would go in. The film
   can start without it; what you make up in its place is named at the end.
5. More than one film can hold (over 900 s, or one take past 90 s): say in that same line that it becomes several
   films, and brief the first.

## The form

Every row answered by the request (a look, colours, a length, a shape and a voice all named): no form. One line naming
what you took from it, then the script.

Otherwise read claude-motion's `artifact-type/reference/questions.md` (it names one host's tools: read each name as
the capability, whatever yours is called) and build the form the way it builds its own: its markup, how style options
and palette tiles are written, what is fit for work, one call of your form tool (it draws a form from the HTML you give
it in the conversation and hands you back what was picked) after one short line in the user's language saying the
script comes next, then nothing more this turn. The rows, in this order, each left out when the request already answers
it:

1. **Style** and 2. **Colors**: questions.md's rows, as it writes them, the options chosen for this film's subject and
   audience.
3. **Length** (`data-name="length"`): three lengths that suit what this film has to carry: the shortest that can make
   its point, then two longer. As a guide, a feed short runs 15 to 45 s, an opener 5 to 12 s, an explanation, a
   product film or a story a minute to three. Labels short ("90 s", "2 min"), the words in `data-value` ("90
   seconds"), then "Other". Up to 900 seconds, whatever questions.md says of 30.
4. **Shape** (`data-name="aspect"`): `16:9` landscape, `9:16` vertical, `1:1` square, `4:5` portrait, each with where
   it plays ("9:16 · Reels, Shorts, TikTok"), the likeliest first; `data-value` the ratio. No "Other".
5. **Voice** (`data-name="voice"`), for any film with words to say (an opener or a sting only when they asked for a
   voice): written like the style row, a name in `<b>` and a line in `<small>`:
   - three or four voices of the ready providers that suit this film (guides/voice.md, "Offering voices"): the voice's
     name in `<b>`; how it sounds and the provider in `<small>` ("calm, clear · Gemini"); `data-value` is `<provider>:
     <voice>` (`gemini: Charon`);
   - "My own recording" (`data-value` "Own recording");
   - "No voice" with `<small>` "captions only" (`data-value` "No voice"): placed high for a feed short that didn't ask
     for a voice, since most watch muted; last when they asked for one;
   - "Other", which opens a box: another voice, a voice id, a speech tool of theirs.

   Nothing ready here: the line before the form says no speech provider is set up on this computer (setting one of the
   keys `voice --providers` names, in the shell that runs the commands, makes one), and the row offers the Mac's own
   voice as a draft (on macOS with ffmpeg only: guides/voice.md), their own recording, "No voice" and "Other".

## What the answers mean

| Answer | The film |
|---|---|
| Style, Colors, Length | As questions.md's "What an answer means" says (with no form, read only that part and its palette rules). Colours named in words in the request are answered in words: the palette you make of them is theirs. For a narrated film the length is a target the voice lands near (guides/voice.md, "The length"), not a time to fill. |
| A series or house style named (in Colors, Style or the request) | All of it, not only its colours: its type and display face, how a scene is laid out, its transitions, its cover and end card, its sound. Read their latest film or style file before the first scene; none to read: ask for one where you ask the rest, and take what the name plainly means. |
| Frame rate | Not asked. `scenes.json` `fps` 30. 60 only for a short film of fast motion (a sting, a quick feed short), where it shows: the export draws every frame, so 60 takes twice as long. |
| Shape | `scenes.json` `width` × `height`: 16:9 is 1920 × 1080, 9:16 is 1080 × 1920, 1:1 is 1080 × 1080, 4:5 is 1080 × 1350. |
| Voice: `<provider>: <voice>` | `voice.json`'s `voice`: that provider and voice, the model guides/voice.md names for it. `macos: <voice>`: the `command` provider with the Mac's voices (guides/voice.md). |
| Voice: Own recording | The takes come from them (guides/voice.md, "Their own takes"). |
| Voice: No voice | A film whose words are read: `voice.json` with the lines, no takes and `"captions": false`, the scenes drawing the words as type (guides/picture.md, "Films with no takes"). |
| Voice: Other, typed | What they typed; a provider not ready here: tell them what it needs, and ask again with the script. |
| A row left empty, or the form skipped | Its first option; for Voice, ask it again with the script (guides/script.md). |

## Without the form

Whatever the path, when the film gets a draft voice (the Mac's), or none, because no speech provider with a key is
ready here, say once which key in their shell would give a better voice later: in the script message, or in the
closing message for a film with no stop.

- No form tool, but a question tool whose card shows in a chat (choices the user clicks beside the conversation): as
  questions.md's "Without the form" says, Voice among the questions (four at most: drop the ones the request answers,
  then Shape, then Length).
- Neither (a terminal, even with a tool that prompts there): decide style, colours, length and shape as questions.md says, the length being what the
  film needs (up to 900 s, whatever it says of 30). Name them in one line before the first write, and only them. The
  voice is not decided for them: it is asked with the script, its options listed; the material to send, a fact that
  doesn't add up and the key note go in that same message (guides/script.md, "Showing the script").
- Nobody there to answer at all (they said to finish without them, or the work runs unattended): decide everything but
  the voice; its words are read on screen, with no voice, and the closing message says a voice can be added.
