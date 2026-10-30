---
name: "exportable-video"
description: "Exportable video\nMake animations the user can export as video"
---
To make content the user can export as a video (Share → Export → Video):

IF YOU ARE BUILDING ON AN ANIMATIONS STARTER (`animations_v3.jsx`, or `animations_v2.jsx` in an older project — see the "Animated video" skill; the normal case): the stage component (`<CompositionStage>` / `<SceneStage>`) ALREADY SATISFIES THIS ENTIRE CONTRACT — it owns the exportable attribute, the seek listener, the svg/foreignObject wrapper, and font inlining (animations_v2 additionally provides a `<VideoSprite>` helper for looped <video> clips). Do NOT add `data-om-exportable-video-with-duration-secs` to any element yourself. Adding it to a wrapper ABOVE the stage creates two nested exportable roots, and the export and timeline transport bind to the wrong (outer) one — playback control and export silently break.

Only for a page built WITHOUT the starter, implement the contract yourself:

- Put `data-om-exportable-video-with-duration-secs="<N>"` on the ONE root element you want exported (N ≤ 300; longer is clamped). Exactly one element in the document may carry this attribute — never nest it.
- That element MUST listen for the custom event `data-om-seek-to-time-frame` (`detail: {time, frame}`): on receipt, pause playback and synchronously render that exact timestamp so every visible child is at that point.
- Nested `<video>` elements that should contribute audio must carry `data-om-exportable-video-play-start`, `data-om-exportable-video-play-end` (seconds into the source), and optionally `data-om-exportable-video-play-speed`; they loop within [start,end] at that speed and their audio is mixed into the export. Keep their visual frame in sync with the timeline yourself (set `video.currentTime` from the seek event / your clock).
- For best results, make the root an `<svg><foreignObject>` wrapper and inline your @font-face rules into it once — the exporter then serializes the svg directly per frame (fast, pixel-perfect). A plain div works too, just slower (full-page snapshot per frame).

A page carrying this contract also gets a live timeline under the preview — the host scrubs and plays it by dispatching the same seek event, so treat every seek as pause-and-hold (don't resume your own clock until seeks stop arriving).
