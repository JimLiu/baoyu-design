# The treatment and the words

After the brief, before the first batch. A narrated film's words are its spine: the voice sets every scene's length,
so the film is built here, in words, before any of it is drawn. A film with no voice has the same script, its lines
read instead of heard. A film with no words at all (an opener, a sting) still has a treatment: its point, its device
and its seconds.

## The treatment

Read the material whole first. Then settle, for yourself, in a few lines:

- **The point:** the one sentence the viewer leaves with.
- **The viewer:** who, and where they watch.
- **The device:** the visual idea that carries the film (SKILL.md, "Reading a request").
- **The arc:** the parts in order, with rough seconds, and which one is the peak.
- **The tone,** and what the sound does.

The arc comes from the point, not from a stock shape. Ways to find it:

- **Start from the end.** What is the last thing said and seen? What does the viewer need to have seen to believe it?
  Work back from there.
- **Follow the viewer's questions.** Each part answers the question the one before it raised: "what is it?", "why
  should I care?", "how?", "so what?". A question the viewer would ask is a good line to open a part with.
- **Put the weight on the peak.** The scene that carries the point gets the most time and the clearest picture; the
  scenes before it build to it, the ones after it let it land.
- **Cut.** Each part, each scene and each line, against the point: does the viewer miss it if it goes? Three strong
  steps beat five adequate ones.
- **Material of theirs to retell** (an article, a report, a deck): the one sentence it argues, then the three to five
  points that carry it, in the order that explains it best, not in the order of its sections.

## Scenes and how many words

- **A scene is one idea on screen, and one take.** It runs about 4 to 15 seconds in most films, 3 to 6 in a feed
  short, where the picture still changes every two or three seconds inside it; longer only when the picture keeps
  changing (a chart drawing, a list building). 90 seconds is the hard limit of a take.
- **Count:** roughly one scene for every 6 to 10 seconds of a narrated film, every 3 to 6 in a feed short. 40 at most;
  a film that needs more is two films.
- **The word budget** comes from the length asked:
  - Chinese about 4.5 characters a second (characters only, not punctuation), English about 2.5 words a second (150 a
    minute), other languages near the English pace, each counted as said: a figure is the words it takes to say it
    ("177,700" is six words aloud, "2007年" five characters);
  - take off each scene's `gap` (0.45 s) and any `hold`: a moment that stays on screen after its words (an end card 2
    to 4 s, a big number left to sink in);
  - so a 60-second Chinese film in 8 scenes, with a 3-second end card, has room for about (60 − 8 × 0.45 − 3) × 4.5 ≈
    240 characters; a 90-second English one in 12 scenes, about 210 words.
- Write to the budget. Each scene's `dur` in the first batch is its words at that pace + `gap` (+ its `hold`; with no
  voice, a second more for the eye: guides/picture.md), and every `hold` you plan goes in the first batch's
  `voice.json`. The sum may run up to a tenth over the length asked; more than that: cut lines now, while it costs
  nothing.

## Writing for the ear

The lines are said once, at the speed of speech, and the viewer can't go back. They are also the captions, word for
word.

- **One idea a sentence**, the subject and its verb early. No brackets, no "the former", no list read out with
  semicolons. Two short sentences beat one with a clause in the middle.
- **A line is one beat:** what one caption shows, and what one change on screen is timed to. Break where something new
  should appear. Keep a line to what fits a caption: about 8 to 18 Chinese characters, or up to 12 English words (in a
  feed short about 10 Chinese characters or 6 English words); a longer sentence becomes two lines.
- **Say the thing while it is shown.** The words carry why and so what; the picture carries the rest. Never narrate
  the screen ("as you can see here"). A point the picture can't show in its scene is a sign the scene is wrong, or the
  line is.
- **Open on the point or the question**, the hook in the first words. No greeting, no film title, no "in this video".
  **Close on what to keep or do**, said once, plainly; no sign-off but that.
- **One new term a scene at most,** defined the first time it is said, and then always called the same thing: a new
  word sounds like a new thing. A name (a product, a person) is introduced, then used sparingly.
- **What it does for them before how it works:** "your week's invoices, sent in one click", not "a batch invoicing
  engine".
- **Numbers as they are heard.** Round what doesn't need to be exact ("nearly a third", "about 3 million") and keep
  the exact figure on screen, where the eye can take it. The caption then reads "about 3 million" beside a 3,048,112
  drawn on screen: that is as it should be. One figure a sentence; never two numbers the ear has to hold at once.
  Dates and units said whenever they change. Symbols written so they read one way only.
- **`say` for what a provider misreads:** a name, an abbreviation, a version number, a word in another language.
  `"say": {"GPT-5": "G P T five"}`: the take says the right side, the caption keeps the left. A key is replaced
  wherever it appears, inside longer words too, so make it the whole term. Add it before the first take, not after a
  wrong one.
- **Pauses** come from punctuation: a full stop is a breath, a new line inside a scene is a beat. A marker like
  `<short pause>` reaches Gemini alone, and only when punctuation can't do it.
- **The tone** follows the style picked and the audience; `voice.style` (guides/voice.md) says the same in a few words
  to the provider.

## Facts and sources

What a line states as fact needs a source: the user's material (its file and page or section; a figure they typed in
the request: "the brief") or a page you read. Can't check it: leave it out, or the line says it's uncertain
("reportedly", "an estimate"). Don't round a number into a different claim, and don't let a picture claim more than
its line does.

- With no material of theirs (general knowledge): an encyclopedia, a textbook or the primary source; one good source a
  fact, two where sources disagree, and then the line says "about" or picks the careful one.
- A figure you work out from a sourced rule or sourced data (a change in percent, a share per person) counts as
  checked: write the working beside it.
- Claims about a product only as far as their material backs them: no "best", "fastest" or "first" they can't show,
  and a number only with its source.

## Retelling someone's material

- **A new telling, not a reading:** lines written for the ear, never sentences lifted and read out. Its own terms are
  kept where it defines them.
- **Quotes:** short, word for word, credited on screen (the document and the page), and only where the exact words
  matter.
- **Its figures** drawn again from its numbers, not shown as pictures of the page, unless the page itself is the point
  (a famous chart, a headline): then as an asset, credited.
- **Nothing it doesn't say.** Context you add from elsewhere is marked in the line ("other studies find…") and has its
  own source. Its caveats keep their place.
- **Credit it on screen,** at the start or the end: title, author or publisher. Someone else's whole article: make the
  film about it (its points, credited), not a copy of it.

## `<root>/src/script.md`

The plan of the film, beside `src/voice.json`, kept for whoever rebuilds or changes it, in the film's language. It
holds what `voice.json` can't: the treatment at the top, in a few lines (the film's plan, not an account of the
conversation); then, for each scene in order under its id, roughly how long it runs and what is on screen, and each
fact its lines state with where it comes from (file and page, or URL), any working beside a figure you derived. The
lines themselves live only in `voice.json` (the store's copy is the truth: the Script tab and comments change it
there). A film over about three minutes: write the parts and their scenes here first, with seconds, then the lines
part by part.

## Showing the script

A narrated film, after the first batch is written and the film is open. A film with no voice goes straight on: its
words cost nothing to change later.

In the user's language, in chat:

1. One line: the link (this is claude-motion's link line too: one link, not two), and the estimated length beside the
   length asked ("about 95 s; you asked for 90").
2. The treatment, in two or three plain sentences: what the viewer should come away with, the picture that carries it,
   and where the film builds to. This is what they are agreeing to, more than any line.
3. The scenes in order, each one short block: its number and estimated seconds, a few words in italics on what is on
   screen, then its lines as they will be said.
4. One question: is this the film, and are the words right? They can answer here or change a line in the Script tab
   of the player's Tweaks panel.
5. Then, once each and only what applies:
   - no voice picked yet (no form, or "Other" named one that isn't ready): the options as the brief's Voice row would
     list them, in words;
   - material that would replace something you made up (their logo, a screenshot, photos), naming the scene it goes
     in;
   - a fact in what they gave that doesn't add up (two dates and a span that disagree), and which you used for now;
   - a draft voice, or none, for want of a ready provider: the key that would give a better one (guides/brief.md).

Then the turn ends: no take before they answer. When they answer:

- **It's right** ("go", "looks good"): the takes (guides/voice.md).
- **Changes:** first `read-db <root> modules/voice.json --text` (they may have changed lines in the player), make the
  changes in `src/voice.json`, write it back with each changed scene's `dur` estimated again, and go on to the takes
  unless the changes were large enough that they'd want to see it again (a new part, a different angle): then show it
  again, the same way.
- **They had said to go straight on** in the request, or nobody is there to answer: no stop; the takes straight after
  the first batch.
