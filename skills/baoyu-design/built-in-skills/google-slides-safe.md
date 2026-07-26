---
name: "google-slides-safe"
description: "Google Slides safe\nAuthor with Google Fonts so the deck imports cleanly"
---
This deck will be exported to Google Slides. Author it so the import is clean on the first try.

Choose every typeface from Google Fonts and load each family explicitly with a `<link href="https://fonts.googleapis.com/css2?family=…" crossorigin="anonymous">` tag. Do not rely on system, brand, or locally installed fonts; if a design system or reference names one, pick the closest Google Fonts match and use that instead. Pair at most two families across the whole deck and stick to the weights you actually link.

The user will run the PPTX export with the Google Slides font option, so there is nothing to substitute at export time — the families you author with are the families that ship.
