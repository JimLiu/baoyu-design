# Sound: a score generated from the cut

The score is data. `S` only records notes and effects against the same timeline the picture uses, the player synthesizes it
in sync, and Export renders the same events into the file.

A voiceover is not part of the score. If they asked for one, or to use an audio recording or music file of theirs, the close
says there is none, in the words of `artifact-type/reference/voice.md` (read it if it isn't in this conversation; the installed skill:
`voice.md`, beside this page). Where the film speaks, recording.md's close stands instead of the voiceover's sentence; one
about their recording or music file stays.

## The method

- **Pick the tempo from the cut.** One beat is the film's cut rhythm. Land bar lines on the big moments, and if a visual beat
  misses a downbeat by a few frames, retime the beat: nobody sees three frames, and everybody hears an off-beat hit.
- **Groove on the grid, effects on exact frames.** Music takes beats. An effect takes the exact `t` of the event it belongs to.
- **Sound the world.** What the viewer sees should be heard: a `whoosh` as wind crosses, `thud` on a landing, `pop` as things
  appear, ticks for a clock.
- **Keep an arc.** Start near silent, bring the groove in with the action, drop back before the end, build into the hit as the
  end card lands, then let the last chord ring. Make the hit clearly louder than the opening.
- **Let the world pick the instruments.** A lullaby wants glockenspiel and pad, a foundry low pads and struck metal, a product
  film marimba, electric piano, round bass and a light kit. No risers, cinematic booms or vocal chops.
- **Your own tune.** Write no existing song's, theme's or jingle's melody, note by note or near enough to be recognised: write
  an original one in that mood, and say so in the close's one sentence (it names the song they asked for, not your music). The
  user's own, or the public domain, is fine. A genre, mood, tempo or instrument is fine.
- **On a later turn, if they asked for other music, name it in a plain line:** a mood and two instruments in everyday words, with no key, BPM or
  apology. Music off by request is a film with no score; mute and volume are the viewer's own.

## `S`

```js
kit.score(function (S, T) {
  const B = 60 / 96;
  S.tempo(96, { t0: T.pour - 8 * B });                   // bar lines land on the pour
  S.program('pad', 'pad', { rev: 0.6 }); S.program('bass', 'bass'); S.program('mallet', 'marimba');
  S.note('pad', 'D3', { t: 0, dur: 3, vel: 30 });        // {t, dur} in seconds, or {beat, beats} on the grid
  S.chord('pad', ['D3', 'A3', 'F#4'], { beat: 8, beats: 4, vel: 52 });
  S.pattern('mallet', 'x.x.X.xx', { from: 8, repeat: 4, pitch: ['D5', 'A4'], vel: 64 });   // step 0.5 beat; X accents
  S.drums({ kick: 'x...x...', hat: 'oxoxoxox' }, { from: 8, repeat: 4 });                  // o is a ghost note
  S.fx('whoosh', T.ring, { dur: 0.5 }); S.fx('chime', T.come + 0.4);
  S.master({ gain: -6, fadeOut: 1.2 });
});
```

A film with no list of scenes has no `kit.score`: the same body goes in `window.CUT`'s `score`.

`note`, `chord` and `drum` take `{beat, beats}` or `{t, dur}`. `S.beat(n)` gives seconds. Also `S.drum(name, {beat|t, vel})`,
`S.run(track, [pitches], {t, step, vel, cresc})` and `S.ticks(times, {vel})`, one tick per time.

- Pitched patches: `marimba`, `vibes`, `glock`, `ep`, `keys`, `pluck`, `bass`, `pad`. `S.program(track, patch, {pan, gain, rev, bright})`.
- Drums: `kick`, `snare`, `clap`, `sidestick`, `hat`, `openhat`, `shaker`, `tamb`, `woodblock`, `cowbell`, `tom`, `crash`, `ride`.
- Effects, `S.fx(name, t, {dur, vel, pitch, pan})`: `tick`, `click`, `doubleclick`, `pop`, `ding`, `chime`, `sparkle`, `whoosh`
  (`{into: 1}` reverses it), `revswell` (swells into its `t` over `dur`), `roll`, `boing`, `thud`.

An unknown drum or effect is silent. `pattern` and `drums` with `repeat` overrun happily, so compute the count to fit. An event
timed 0.1 s or more before 0 is dropped, so the sound for an early entrance goes at 0. A 30 s score is a few hundred events.
