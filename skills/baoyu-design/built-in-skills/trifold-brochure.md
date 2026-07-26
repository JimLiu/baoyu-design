---
name: "trifold-brochure"
description: "Trifold brochure\nPrint-ready two-sided fold"
---
Design a print-ready trifold brochure as a single self-contained HTML
file: exactly two fixed-size pages — the two sides of one sheet — of
three panels each.

Sheet setup:
- START by calling copy_starter_component with kind: "doc_page.js",
  then build inside <doc-page orientation="landscape"> with exactly
  two explicitly paginated sides: <section class="page" id="side1">
  and <section class="page" id="side2">. The component owns the page
  geometry, the page breaks, and all print CSS — do NOT write your
  own @page rule, body background, break-after rules, or hard-coded
  paper dimensions, and never add an omelette-owns-print meta.
- Each side prints as a FIXED full-bleed page box with overflow
  hidden — landscape letter by default, the user's chosen paper
  (landscape letter or A4) when they export — so content that misses
  the box is clipped, never reflowed. Design each side to FILL the
  page box and fit both papers without overlap. The print dialog must
  show exactly 2 pages.
- Each side is a 3-column layout (3 panels of ~33.3% width). On a
  roll fold the tucked flap is ~1/16in narrower than the other
  panels — favor safe inner margins over exact flap math, and keep
  content ≥5% from every fold line and page edge (pages are
  full-bleed; the panels own their insets).

Panel order IS the fold order — this is where trifolds go wrong:
- Side 1 (outside): [inside flap] [back cover] [FRONT COVER] — the
  front cover is the RIGHTMOST panel.
- Side 2 (inside): panels read left → middle → right as one spread
  when fully opened.
- The narrative order the reader experiences: front cover → open once
  to see the inside flap beside two inside panels → fully open to the
  three-panel spread → back cover last. Write the content to unfold
  in that order: cover makes one promise; the inside delivers it in
  three readable beats; the back carries logistics and contact.

Print discipline:
- Never viewport units (vh/vw) — they track the window, not the page
  (the page is a size container). Physical units are fine for small
  fixed details (hairlines, safety insets).
- Solid colors and vector shapes print crisply; avoid huge dark flood
  fills (ink) and hairlines under 0.5pt.
- On screen, show thin dashed fold guides on each side; strip them in
  @media print so the printed sheets are exact.
- Keep body type readable at arm's length — roughly ≥2.2cqh for body
  copy, with headlines clearly dominant.

Tell the user how to print it: double-sided, flip on short edge,
scale 100% ("Actual size"), then fold the right panel in first.
