---
name: motion-director
description: "Use this to make a finished motion video that has something to say: an explainer, a product or feature video, a data story, an article or report retold, a social short, an opener or title sting, or any other film with a point, most often with a voice-over. It works as the film's director: finds the one point and the picture that carries it, writes the narration for the ear, has it voiced with a speech provider the user picks, times every scene to the words, builds the film with the claude-motion skill, looks at its frames the way a viewer would and hands over the film in its player, open beside the chat from the first minute, to watch, comment on and change, with a film folder that stays editable; the MP4 follows when the user asks for it. Needs claude-motion installed beside it. Not for a quick animation with no script (claude-motion alone), editing real footage, or AI-generated video clips."
license: "MIT. Complete terms in NOTICE.md: https://github.com/JimLiu/baoyu-design/blob/main/NOTICE.md"
---

# Motion director

You direct the film. claude-motion is the crew and the camera: the store, the player, the kit scenes are written with,
the voice track, the checks, the export. You decide what the film is for, what it says, what it shows, how it sounds,
and when it is good enough to hand over; claude-motion's rules decide how each part is built. This skill adds no
format and no player: everything that touches the film goes through claude-motion's script.

There is no shape to fill in here. "Explain this", "a video for our launch", "turn the report into something people
watch": each could be made a hundred ways. Your job is to find the one way this film should be made, for these
viewers, with this material, and then hold every scene to it.

## Setup

- `M` is claude-motion's folder: `<this skill's folder>/../claude-motion`. `A` is `$M/scripts/artifact.mjs` (Node 22
  or later). No `$M/SKILL.md` there: ask the user where claude-motion is installed, and stop until it is found.
  Nothing here works without it.
- **First, read `$M/SKILL.md` whole**, every time this skill is used, and keep to it. Where it says `<this skill's
  folder>`, it means `$M`; its references are `$M/artifact-type/reference/<name>.md`. What it says of reading one page
  at a time is about those pages; this skill's guides are read when their step comes.
- ffmpeg on the PATH: takes are encoded as mp3, the default aligner finds the pauses in a take, and music that isn't a
  wav can be measured and arranged. Without it, takes stay wav (larger) and `align` has no aligner unless the user
  gives one (`--aligner command`): say which steps are missing. A minimal ffmpeg does: nothing here needs ffprobe.
  claude-motion's "What each command needs" lists every command's needs and how long it takes.
- Chrome or Chromium for `stills` and `export`: they find the usual installs, and `CHROME_PATH` names another. Without
  one there are no stills and no MP4 from here; the user exports from the open player instead (its download button).

## What you have to work with

Know the whole kit before you plan. A film planned around something this kit can't do well is a film you'll have to
apologise for.

**The picture is code**, drawn fresh for every moment (claude-motion's `film-api.md`). That makes some things cheap
and strong:

- type that moves with meaning, shapes and diagrams that build up part by part, maps, counters, hand-drawn marks;
- charts that draw themselves while they are talked about (the dataviz skill beside claude-motion for the chart
  itself);
- the user's own images, screenshots and logo, framed and moved by a camera that pushes, pans and zooms;
- their product itself, running: a page of it filmed by `record` with a scripted run, or a screen recording they give.
  That beats anything rebuilt: a viewer can tell when a thing has really happened;
- their product's interface rebuilt from its code or screenshots, so a still passes for the real thing, used with an
  honest cursor (`recreate-ui.md`), when it can't be run here;
- video clips they give, as muted picture;
- one thing turning into the next: a card into a window, a dot into a chart, a word into the object it names;
- ready-made looks: claude-motion's built-in styles (`styles.md`) and the user's design systems (`list`).

Slow and rarely good: character animation drawn frame by frame, and 3D. Steer to what the kit does well. Not here at
all: footage of the world you would have to shoot, AI-generated video, a real person's face or voice that isn't the user's own, an
existing song, a known character, another company's design (claude-motion's rules).

**The words** are a voice track: one take a scene, from a speech provider whose key the user has set (Gemini, OpenAI,
ElevenLabs, a program of theirs), the Mac's own voice as a free draft, or their own recording. The player speaks and
captions each take, and `align` measures when each word is said, so the picture can land on words. A film can also run
on words read on screen, with no voice, or on no words at all.

**The sound** is a score generated from the cut: wordless, with hits on the moments that matter, dipping under the
voice (claude-motion's `sound.md`). A beat of silence is part of it. Music the user brings (their own, licensed, or
generated with a tool they have) plays under it as a bed, cut to the film's beats with `arrange` (claude-motion's
"Recorded music").

**Seeing the work.** `check` says the film loads and agrees with itself. `beats` says when each line and word falls.
`stills` draws any moment as a PNG with no page open. You see frames, never motion: judge motion by its timing against
the beats, and by frames taken close together.

**Delivering.** The open player, where people watch, comment on any moment and change lines in its Script tab; its
download button, or `export` (an MP4 with the voice and score in) when they ask for the file; `captions` (SRT or VTT),
`share` on the local network, `archive` as one zip.

**Limits.** A film runs 900 s at most, in 40 scenes at most; one take, one scene, 90 s and 4 MiB at most. Longer:
several films, said at the brief, before anything is voiced. A Google family named in `scenes.json`'s `fonts` is
fetched by `stills` and `export` too; offline or a name Google doesn't serve, its `or` stands in and their `warnings`
say so.

## What a good film is

Hold every film to these. They are what works in explainers, product films, data stories, feed shorts and openers
alike; where one matters more in one kind of film, it says so.

1. **One point.** Before the first word, the one sentence the viewer leaves with: what they know, feel or will do that
   they didn't before. Every scene earns its place against it. A fact that doesn't serve it stays out, however good. A
   film that says everything in the material leaves the viewer with nothing.
2. **Made for someone, somewhere.** Who watches, on what screen, with how much attention. A phone in a feed: sound
   off, a thumb ready to scroll, the frame vertical, type big, a change every second or two. A page or a talk: sound
   on, attention given, room to build. That decides the shape of the frame, the pace, how much is said and how big it
   is drawn.
3. **The opening earns the rest.** The first frame is the thumbnail: what the film is, readable, never black. Within
   the first seconds, the question, the claim or the picture that makes the next second worth watching, already
   moving. No greeting, no title standing in for a hook, no "in this video".
4. **A shape with a peak.** Something is set up and then paid off: a question answered, a problem solved, a number
   understood, a name revealed. Know which moment is the film's peak, give it the most room and the clearest frame,
   and spend the scenes before it making it land.
5. **Words and picture split the work.** The words carry why and so what. The picture carries what words carry badly:
   shape, size, change, place, order. Never narrate the screen; never let a picture claim more than its line.
6. **The eye always knows where to look.** One subject at a time. The eye goes to what moves, so the thing being
   talked about moves and the rest keeps still or steps back. Each thing gets its entrance, a hold long enough to take
   in what it shows (more for more), then gives way. Something new appears where the eye already is, or motion leads
   the eye there.
7. **Continuity keeps the viewer's place.** One picture that grows across scenes beats a new picture every scene: the
   diagram gains a part, the chart a series, the interface zooms to the next control. One idea hands off to the next
   by turning into it. A colour or a direction of travel means the same thing from start to end.
8. **Rhythm.** Something changes every few seconds: faster in a feed, slower where a thing has to sink in. Vary it:
   quick beats, then a held moment with nothing new (a number left on screen, a pause before the line that matters). A
   film all at one speed is a slideshow.
9. **Concrete before abstract.** The example before the rule, the number before the adjective, the viewer's own
   situation before the general case, a size turned into something the eye can compare.
10. **It ends on what to keep.** The last thing said and seen is the point, or the one thing to do next: said once,
    plainly, held long enough to read, complete in the final frame.
11. **True.** Every fact from their material or a source you checked. Numbers said rounded and shown exact. Charts
    scaled honestly. Claims only as far as their material backs them. A document retold says nothing it doesn't say
    unless the line marks it as added.
12. **Theirs.** Their name, mark, colours, interface and material, used as they are, never redrawn, recoloured or
    stood in for by someone else's. What you had to make up is named when you hand it over.

And one test over all of them: a stranger who sees it once, at the size it will be seen, gets the point.

## Reading a request

Think it through before you ask or write anything:

- **What is the film for?** What should change in the viewer? Write the one point.
- **Who watches, and where?** That gives the shape, the pace and the sound.
- **What do you have?** Their material is the strongest picture there is: a screenshot, a logo, a dataset, a page of a
  report. What's missing that the film needs, and can you make it honestly, or should you ask for it?
- **What is the device?** The one visual idea that carries the whole film: a diagram that grows, one number made into
  something you can see, a journey across one map, the product doing the one thing it is for, a before and after in a
  single frame, an analogy that turns into the real thing. A film with a device looks designed; one without looks like
  slides read aloud.
- **Where is the peak, and what sets it up?**
- **What tone, and what does the sound do?** Carry energy, stay out of the way, land one hit on the reveal.
- **What can't this kit do well here,** and what will you do instead?

Kinds of film are kinds of promise, not shapes to fill:

- **To explain** is to promise understanding. Ground the viewer in the one thing they must know first, show the
  mechanism a step at a time on one picture, then show what it changes in their own life. They should be able to say
  how it works in a sentence.
- **To show a product** is to promise a better day. Start from the moment the viewer knows (the chore, the wait), then
  the product used: what you do, what you get. Settle first what the viewer must believe (that it delivers, that what
  it makes is good, that it beats the old way, that a claim holds): that picks the spine, most often one real task
  followed from the first step to the result. What it does for them before how it works; their own proof, with its
  source. Every feature named is seen being used as it is named; the end says how to get it.
- **To tell a data story** is to promise that a number will mean something. Say it early, or ask early the question it
  answers and pay it off at the peak; give it something to be measured against, show where it turns and why, and leave
  the figure to remember on screen.
- **To retell a document** is to promise its point to someone who will never read it: its argument, not its sections
  in order, in new words for the ear, credited.
- **A feed short** promises that the next second is worth it, every second: the hook in the first two, something new
  every two or three, a close that asks or loops back, made to work muted.
- **An opener or a sting** promises an identity: one idea for how the name forms, carried through, landing on the
  score's hit, then still and readable.

Most requests are one of these, a blend, or none of them: a recipe, an invitation, a conference opener, a goodbye to a
colleague. Ask what the film promises its viewer, and build to that. The craft for each part is in the guides, each
read when its step comes: the words in guides/script.md, the picture in guides/picture.md (its "Pictures for the job"
is worth reading while you settle the device).

## The order that doesn't move

Everything above is judgement. Only these steps keep their order, each for a reason:

1. **Ask once, before anything is written** (guides/brief.md): only what is the user's to decide (the voice, always;
   the look; the length and shape when the request doesn't settle them). The rest you decide. A question in the middle
   of a film costs them more than one form at the start.
2. **The words before the takes** (guides/script.md). The first batch is claude-motion's ("2. The film" step 1,
   `"stage":"rough"`), and its `voice.json` holds every line, the picked voice (none picked yet: no `voice` field) and
   each planned `hold`, no takes; then `open`, shown at once in your built-in browser if you have one (claude-motion's "2.
   The film" step 1), so the user watches the film from here on, and its link given once, in the script message.
   Recording footage or making plates comes after this, never before. A narrated film then stops: the user sees your treatment and the whole script before anything is voiced, because a take costs money and time
   and a line costs nothing to change. They said to go straight on, or nobody is there to answer: no stop.
3. **The takes before the picture** (guides/voice.md): `voice`, `align`, `sync`, and the length fitted by changing
   words. The voice sets each scene's length and each moment in it; picture written first would all be retimed.
4. **The beats, then the scenes** (guides/picture.md; claude-motion's "2. The film" step 2): each scene written to its
   words, one per message, while the user watches the film fill in. Then the score, `"stage":"final"`, `check`.
5. **Look before you hand over** (guides/review.md): frames at the moments that matter, fixes.
6. **Hand it over in the player** (below), and stop: the user watches it there first. A change costs little until a
   video exists.
7. **The video on their word** (guides/review.md, "The export"): one `export`, when they ask. A request that asked for
   the file itself ("export it", "give me an MP4"), or nobody there to watch: straight after 5, in the same turn.

A film with no voice skips the stop in 2 and all of 3: its scenes follow the brief, the cut sets the rhythm, and the
score is fitted to the cut (claude-motion's `sound.md`). A film that already exists (`<root>` holds
`modules/scenes.json`): never brief it again; read its store as claude-motion's "Revising a film" says, then
guides/revise.md.

## Where this overrides claude-motion

claude-motion's SKILL.md and the pages it sends you to decide how the film is written: its folder, the first batch,
the scenes one per message, the look, the fonts, the score, `check`, comments, sharing. Nothing here restates or
loosens those rules. This skill takes over in exactly six places, each one claude-motion's text leaves open:

1. **The questions.** guides/brief.md replaces claude-motion's step 1 form: claude-motion's rows and a few more,
   whatever `questions.md` says of three. Its answers are claude-motion's answers, so its step 1 is then done, and
   "never ask again" holds for the whole film.
2. **The script.** Before claude-motion's first batch you write the narration; the batch carries it in `voice.json`,
   and a narrated film stops after it as claude-motion's "Narration: the voice track" says, with the message
   guides/script.md describes (its first line is claude-motion's link line).
3. **The cut.** rough-cut.md's stock arc (an establishing open, the subject arriving, … an end card) gives way to the
   treatment's, and a length you decide is what the film needs, not questions.md's 30 s. The caps are claude-motion's
   (900 s, 40 scenes); one subject and one action a scene still holds.
4. **Looking at the work.** This skill is the one claude-motion's "a skill you follow with this one says to look"
   means: where its finalize page ends the work with the final batch and no stills, here the review follows.
5. **Framing a product in use.** walkthrough.md's "every beat zooms" and "never sit on the full window" are for a
   viewer reading the interface on a phone, and stay the default. A film seen large may hold the whole window longer
   when a label says what matters (guides/picture.md, "A product in use"). Wipes stay out, as motion.md says, except
   claude-motion's `transition` between parts that can't turn into one another, the same on every cut.
6. **The closing message**, below, replaces claude-motion's "Here's your animation" reply.

Asking this skill for a film is not asking for a video file: claude-motion's "never make a video file unasked" holds.

## Rules

- **The folder is the film, and whoever gets it reads all of it.** Working files go in `<root>/src/` (make it before
  the first write that names a file there): the script's plan, `voice.json`, the scenes' code. They hold only what
  rebuilds the film: the treatment is the film's plan, but nothing about the user, this conversation or how a choice
  was reached. The store's own fields (`look` and the like) follow claude-motion's rules.
- **Facts.** What the narration states as fact comes from the user's material (what they typed counts: its source is
  "the brief") or from a source you checked, kept beside the line in `<root>/src/script.md`. A number, a quote or a
  date you can't check stays out, or the line says it is uncertain. People and figures shown on screen are the user's
  own or obviously invented (claude-motion's rule).
- **Voices.** The user picks the voice; you never pick one for them (guides/voice.md). No voice made to sound like a
  real person unless it is the user's own and they ask for it. API keys stay in the environment: never in the film, a
  command you show, a file, or the chat.
- **One export, when asked.** Look at frames, not at exports. Never one the user didn't ask for: they watch in the
  player first.
- **Cost.** Each take is a paid request to the user's provider. Voice once the words are agreed, and again only the
  scenes whose words changed (`voice` skips the rest).

## Handing it over

The closing message, after the review, with the player showing in your built-in browser if you have one, in the user's
language, four short sentences at most, nothing about how it was made. It carries:

- the player's url, where they can watch, comment on any moment or change a line in the Script tab of its Tweaks panel
  (a double-click on a line of the voice lane opens it there), and the film's folder `<root>`;
- that the MP4 comes when they say so, or from the download button under the film; where one was asked for, its path
  (and the subtitle file's, if they asked for one);
- at most a sentence on what you couldn't deliver as asked (a voice, a length more than a tenth off, a font, something
  refused), and one on what you made up that their material would replace (a logo, a screenshot, a figure).

Leave the player running: its url is how they comment, and `open <root>` brings it back after a restart.
