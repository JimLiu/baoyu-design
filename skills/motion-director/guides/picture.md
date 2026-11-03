# The picture: what to show, and when

After the takes, or straight after the brief for a film with no voice. claude-motion's rules write each scene (its
`finalize.md`, `motion.md` and `film-api.md`, read when its step 2 says); this page is what you bring to them: what
each scene shows, and when, against its words. In a narrated film the voice sets every scene's length and the moment
each thing appears. The picture is fitted to the voice, never the other way round.

## Before the scenes: the beats

Once `sync` is done and before the first scene, run `node $A beats <root> --text --words` once and keep its output in
view: each line's start and end and each word's time, in the scene's seconds (and where the scene starts in the film).
That is what every scene is written to. A long film: `beats <root> --text --words --only <ids>` for the scenes of one
part, part by part. Lines changed later: `beats` again for those scenes.

claude-motion's "Timing" says how a scene reads those times in its code (`kit.cue`, `kit.beat`, `kit.when`): write the
motion to them, never to seconds typed in, so that new words or another voice move the motion with them.

- **How exact they are:** `beats` says per scene `aligned` (from `align`) or `guessed` (from the words). The default
  aligner finds the pauses, so a line's start is measured, and the words inside it are spread by their length: put the
  big changes on line starts (`kit.cue`), and treat a word's time (`kit.when`) as close, not exact. A word marked `*`
  is said twice in its line: `kit.when` finds the first.
- **The score** takes its hits from the same words. In `score.js`, `kit.cue('<id>')` and `kit.when` work as they do in
  a scene; a cue counts in its scene's seconds, so add `T.<id>` for the film's: `S.fx('pop', T.s03 +
  kit.when(kit.cue('s03'), 1, '<word>'))`. The hit then moves with the word when lines or the voice change.

## A scene against its words

- **It appears as it is named.** The thing a line talks about starts to enter a little before the word that names it
  (`kit.when(c, i, '<word>')` less 0.2 to 0.3 s) and has settled as the word is heard. Late is worse than early: a
  picture after its word looks like an afterthought.
- **One thing moves at a time.** What is not being talked about stays still or steps back (dimmed, smaller).
- **One channel leads each beat.** Know what the viewer learns in it, where they look, and what carries it: the
  picture, the voice, words on screen, or a sound. The others serve that one. When two compete (a line said while a
  label must be read, a chart still drawing as the next number is said), split the beat or lengthen the hold so they
  arrive one after the other.
- **Each line is a beat.** A new line is the moment for the next change on screen; a scene where nothing changes for
  three lines has lost the viewer.
- **Numbers land on the word.** A counter or a bar that grows reaches its value as the number is said.
- **Text on screen that isn't said** needs time to be read while the voice goes on: keep it to a few words, or show it
  in a pause (a `hold`, the gap). Anything longer than a title is read in the voice's place, not over it.
- **Cuts fall in the gaps.** A scene ends after its take and its `gap`: the change to the next scene falls there,
  between sentences, never inside one.
- **The last line's picture stays** through the gap: the result, not an empty frame.

## Pictures for the job

What a director reaches for, by what the picture has to do. Pick what serves the device and the point; none of it is
required.

**Making a mechanism clear.**

- One drawing that grows across the scenes that explain it, each step adding a part and dimming the last, so the
  viewer keeps their place. A cut to a new picture is for a new idea.
- Zoom from the whole to the part being talked about, and back out, so the part stays placed.
- A small step marker ("2 of 3") when the steps are long.
- An analogy drawn, then turned into the real thing.

**Comparing and sizing.**

- Before and after, with and without, side by side in one frame, the difference marked.
- A number turned into things the eye can count or compare: a bar, a grid of dots, a known object.

**Numbers and charts.** Read the dataviz skill (installed beside claude-motion) before the first chart: its rules for
choosing a chart, its colours and its marks hold here; this adds what motion changes.

- One chart a scene, asked one question: change over time is a line, comparing amounts is bars, a share of a whole is
  a stacked bar or a grid of units. A pie only for two or three parts.
- Built while it is said: the axes, then the data drawing in, then the mark on the point the line names, each on its
  word.
- One series in colour, the rest grey; labels on the lines and bars themselves, no legend.
- Units and the source on screen, small and steady, for as long as the chart is up.
- Honest scale: bars start at zero, a cut axis is marked as cut, two charts compared share a scale.
- In a vertical film: one chart a scene, larger type.

**A product in use.**

- **First, what must the viewer believe?** The answer picks the spine; a film can blend them, but one carries it.
  - That it turns what you ask into something delivered: one real task followed from the first step to the result,
    each part acting on what the last one made, so the viewer never starts over. Other examples, if any, go in one
    short run of results, not as separate restarts.
  - That what it makes is good (a model, a renderer, a design tool): the results are the film, many distinct ones in
    quick succession, each strong; the making shown once.
  - That it beats the old way: the same task done both ways, side by side or back to back, the old one slow and flat.
  - That a claim holds: the claim, then the run that measures it, with the number on screen.
- **One feature is the hero:** the one they named, or the one nothing else has. It gets the longest stretch, the
  clearest frame and the film's peak. Two or three steps that show what it is worth beat a visit to every menu. A
  reveal that the film was made with the product is not a peak: if it stays, it stays short and after the point.
- **Their product, really running**, beats anything rebuilt: `record` films a page of it with a scripted run
  (claude-motion's "Devices the references don't name"); a screen recording of theirs does for what `record` can't
  reach, such as a desktop app. Do the run for real first: what you find doing it (a download that doesn't land) is
  worth knowing before it is in a film.
- Can't be run here: their interface lifted, not redrawn, from screenshots, a link or their code, as claude-motion's
  `recreate-ui.md` says, so a still passes for a screenshot. Nothing given: an interface built from what they
  describe, plainly a mock-up, in their colours; say so at the end. Never another company's interface standing in for
  theirs.
- **The doing is on screen.** If the claim is "you ask and it makes it", the asking and the making are seen, not only
  the before and the after. A prompt that dissolves into a finished result proves nothing.
- **Start clean, keep cause before effect.** The run starts from a clean state (no stray tabs, test data or account
  names), and every result appears after the action that causes it, in the composed frame too: a plate behind, a label
  or a sound that arrives before its click gives the trick away.
- **A wait is compressed out loud:** a second or two at speed with its factor on screen (`▶▶ 53×`), and the real total
  when it ends. Cutting it hides what the viewer most wants to know. Typing is never sped up, it looks false at once:
  trim around it. While something builds, show progress the eye can read: parts ticking off, a count filling in.
- **Stills only for states that happened.** A plate of a real state from the run is fine; a sequence of plates with a
  change patched in is a mock-up: say so, or record it.
- **Framing follows the screen it is seen on.** claude-motion's `walkthrough.md` frames for a phone: zoom to the part
  in use until its text reads, the whole window only to place it. A film seen large can hold the whole window longer,
  with a label saying what matters, but then the point is never left in the interface's small text.
- **Words point.** A label on the thing as it happens (`kit.callout`, or `walkthrough.md`'s chips): a few words, next
  to what it names, up long enough to read and gone when the next arrives. Without them the viewer has to read the
  interface, and won't. Colour carries meaning: the hero gets a colour nothing else has.
- **An honest cursor:** on screen only while it is doing something, arriving a beat before each click; it leaves
  rather than idling.
- One feature, one result: each scene ends on what the user gets (the report filled in, the message sent), held long
  enough to read.
- The end says how to get it, in the real command or the real place, large enough to read at thumbnail size.

**A name or a mark.**

- One idea for how it forms, carried through: assembled from parts that fly or slide in, cut out of a field of colour
  by light or a mask, drawn by a single line, typed letter by letter, unfolded like a card, a shape from the subject
  (a wave, a gear, a leaf) that becomes the mark. Two ideas in eight seconds is none.
- Something moves before anything can be read; the first frame is already part of it. The name lands on the score's
  hit, then holds, still and readable, at least 1.5 s.
- Their logo file as it is, never redrawn or recoloured beyond what they ask; no file: the name set in type, and say
  so at the end. The mark's own colours win where they meet the palette. A real brand that isn't theirs:
  claude-motion's rules.
- An opener ends on a frame their footage can cut from (the mark on a plain ground, or fading to it); a closer ends on
  what to do next, held 2 s or more.

**A film for a feed.**

- It reads with the sound off: each line's key word or number on screen as a large title (the captions carry the
  sentence; the title is not the line again).
- Captions higher and shorter: `captions.at` about 0.68, a large size.
- Out of the apps' way: nothing to read in the top 15%, the bottom 25% or a strip down the right edge, where the apps
  put their own buttons and text.
- Big and few: one subject a frame, filling it; type that reads at thumb size.
- A last frame that leads back into the first makes it loop.

**The end.** The takeaway on screen as it is said, then held (a `hold` of 2 to 3 s), complete in the last frame.

## Writing `scenes.json` at the end

claude-motion writes `scenes.json` whole after the scenes: keep each voiced scene's `dur` as `sync` left it, or run
`sync` again after it. `check` says where a `dur` and its `speech` + `gap` + `hold` disagree: fix it before stills.

## Films with no takes

- **Words to read, no voice** ("No voice", "just text on screen"): the words are the picture's type, not subtitles.
  The player's captions are made for speech: each stays up only as long as its line would take to say, so a held
  moment (the extra second, a `hold`, the end) is left without its words. So `voice.json` holds the lines with
  `"captions": false`, and each scene draws its own: `kit.json('voice.json')` has them (the Script tab still edits
  them there) and `kit.cue()` their times, estimated from the words. A line enters on its cue and stays until the
  scene gives way; the last scene's is the takeaway, complete in the final frame. Each scene's `dur` is its words at
  the speaking pace (guides/script.md) + `gap` + a second for the eye, since reading lags speech, + any `hold`.
- **No words at all** (an opener, a sting, a silent short): no `voice.json`, no captions. The cut sets the rhythm:
  plan each scene's seconds from the treatment, and fit the score to the cut as claude-motion's `sound.md` says (for a
  sting, a rise under the lead-in, a hit on the reveal, a tail through the settle).
