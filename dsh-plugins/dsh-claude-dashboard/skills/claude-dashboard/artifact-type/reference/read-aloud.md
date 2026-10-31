# Reading a dashboard aloud

A progressive enhancement. The dashboard has a voice of its own, Claude's and
not the browser's, for some readers only: many have none, and no page can turn
it on. So a page is whole without it, and shows or says nothing about listening
unless the dashboard says there is a voice.

- `data-read` goes on the one element whose words are read, in order. Only that
  element is read; tables, controls and what is hidden are skipped.
- `data-read-step` goes on each part of it that is one step, as a Scroll
  story's chapters are: each is read as one, and brought to the middle of the
  view as it is read, or as near as its height allows. Whatever is outside a
  step is read a paragraph at a time. Past 100 steps and paragraphs, 2,000
  characters in one, or some 20,000 in all, nothing is read.
- Where there is a voice the dashboard draws its own Listen button just above
  the `data-read` element, and its own player there once that is pressed. For
  room it makes that element's top margin 44px (64px on a touch screen) where
  it is less and not negative. The page writes no player, no script for either
  and no `speechSynthesis`.
- `data-read-play` on a `<button>` of the page's own starts the reading instead,
  wherever the design wants it; the dashboard then draws no button, and makes
  the room only while its player is open. Where a press would do nothing the
  dashboard hides it, whatever `display` the page's CSS gives it: never set
  `hidden` on it yourself, and leave nothing around it (a bar, a rule, a margin)
  that looks empty then.
- `#dash-root` has `data-dash-read="ready|reading"` where there is a voice and
  `data-dash-read="unavailable"`, or none yet, where there is not. It changes
  after the page loads, so anything else about listening (a line of words, an
  icon, a caption) is shown by CSS alone, and kept outside the `data-read`
  element, or it is read aloud too:
  `#dash-root:not([data-dash-read="ready"], [data-dash-read="reading"]) .hear { display: none }`.
- While the player is open `#dash-root` also has
  `data-dash-read-phase="starting|playing|paused|ended"`, and the
  `data-read-step` being read, or read last, has `data-dash-read-now`. Both go
  when the player is closed. A page can move with the reading by these two, in
  CSS or through a `MutationObserver` on `#dash-root` (`subtree`, and
  `attributeFilter` with the two names). Four things break otherwise:
  - Put every rule that fades what lacks the stamp under
    `#dash-root:has([data-dash-read-now])`. With no voice, before Listen is
    pressed, and while words before the first step are read, no step has the
    stamp, and a bare rule would fade them all:
    `#dash-root:has([data-dash-read-now]) [data-read-step]:not([data-dash-read-now]) { opacity: 0.25 }`.
  - Let motion run while the phase is `playing`, and test for that, not for
    `paused`: nothing is heard during `starting` or after `ended` either.
    `#dash-root[data-dash-read-phase]:not([data-dash-read-phase="playing"]) [data-read-step] * { animation-play-state: paused }`
    holds the CSS animations inside the steps.
  - Fade a step with `opacity`, never `hidden`, `display: none`,
    `visibility: hidden` or `aria-hidden="true"`: a step hidden in one of those
    ways when the reading starts is not read.
  - Keep the steps in the HTML, outside every drawing, and don't make one again
    by script: the stamp goes on the elements that were there when the reading
    started.
- Each step is spoken as one take. 10 to 30 seconds of speech, some 150 to 450
  characters, is a good length, and under 5 seconds (75 characters) is short
  for a take. What the person asks for comes first.
- For chapters, `data-read-play="ch2"` on a `<button>` starts the reading at the
  step whose `id` is `ch2`, wherever the button is, and moves a reading that is
  under way. A press for the step being read leaves it playing, or resumes it.
  For a step that is not among those read, the button acts as a plain
  `data-read-play`. A move can take about a second, which suits chapters better
  than a slider.
- Where an animation stays in one place and shows the reading's place itself,
  `data-read-stage` on the `data-read` element, or one around it, stops the
  dashboard tinting words and bringing each step to the middle. It brings the
  `data-read-stage` element into view as the player opens, and then leaves the
  scrolling to the viewer. The Listen button and the player then stand just
  below the `data-read` element, not above it, as a video's controls do, and
  the room is made at its bottom margin. So the `data-read` element reads best
  as the last thing in the stage, where nothing falls between the words and
  the controls, with a bottom margin of 48px (68px on a touch screen) from the
  start, so that nothing moves when a voice comes. A stage that fits the view
  with that margin shows whole. Of a taller one only the end that has the
  controls shows as the player opens, and at rest a Listen button at its foot
  is below the fold.
- Say nothing of listening in your reply unless the person asked to listen.
  Then say only that a Listen button shows for readers who have read-aloud,
  which may not yet include them.
