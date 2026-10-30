# Vendored PptxGenJS (TypeScript source)

- **Upstream**: https://github.com/gitbrent/PptxGenJS, branch **version-3.13.0** (package version `3.13.0-beta.1`, MIT — `LICENSE` copied alongside). Copied 2026-07-01.
- **Files**: `src/*.ts` (the library's real TypeScript source — edit HERE), `types/index.d.ts` (public typings; gen-pptx's tsconfig `paths` maps `pptxgenjs` to it), `libs/jszip.min.js` + `libs/polyfill.min.js` (upstream's prebuilt browser libs, kept as JS by design — not used by the node build).
- **Why vendored as source**: PptxGenJS has no animation API. PPTX animations are a `<p:timing>` tree inside each `ppt/slides/slideN.xml`; we patch the source serializer so the library emits a precomputed timing string per slide. All animation logic (parsing `data-anim-*`, building timing XML, computing shape ids) lives in gen-pptx's own `src/` — the vendored source carries only the splice hook. Future library changes should be edits to these `.ts` files, recorded as patches below.
- **Build wiring**: `npm run build:cli` bundles the source directly via esbuild `--alias:pptxgenjs=./vendor/pptxgenjs/src/pptxgen.ts`. `jszip` stays an external npm dependency (the source does `import JSZip from 'jszip'`); `node:fs`/`node:https` are dynamic node-builtin imports and stay external automatically. Type-checking uses `types/index.d.ts`, not the source (the upstream source is not strict-clean, and it uses extensionless sibling imports node can't resolve directly); tests exercise it exactly like production — the npm `pretest` script bundles the vendored entry with esbuild to `dist/vendor-bundle.test.mjs`, which `test/vendor.test.ts` loads via a computed dynamic import.

Contract the rest of gen-pptx relies on (guarded by `test/vendor.test.ts`):

- Shape ids: `p:cNvPr/@id = idx + 2` where `idx` is the object's index in `slide._slideObjects` (`src/gen-xml.ts` — text/shape ~412, image ~559; tables and media use different formulas and are never animated).
- `options.objectName` lands verbatim in `p:cNvPr/@name`.
- `makeXmlSlide` (src/gen-xml.ts) ends slide XML with `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>` — the patch point.

## Upgrade flow

1. Download the new upstream branch/tag, copy `src/*.ts`, `types/index.d.ts`, `libs/*`, `LICENSE` over the files here; update the version above.
2. Reapply each patch below, locating it by its anchor string (line numbers will shift).
3. `npm test && npm run build` — `test/vendor.test.ts` fails loudly if a patch is missing or the id/name contract drifted.

---

## Patch 1: emit per-slide animation timing XML — `src/gen-xml.ts`

**Motivation**: gen-pptx sets `slide._timingXml` (a fully built `<p:timing>…</p:timing>` string from gen-pptx's `src/render/timing.ts`) on slides that carry `data-anim` animations. The slide serializer must append it in the schema-mandated position (after `clrMapOvr`, before `</p:sld>`).

**Anchor** (inside `export function makeXmlSlide`):

```ts
'<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
```

**Replace with**:

```ts
// VENDOR PATCH 1 (see VENDOR.md): emit the slide's animation timing tree.
// CT_Slide orders cSld, clrMapOvr, transition, timing, extLst — so the
// precomputed <p:timing> string slots between clrMapOvr and </p:sld>.
'<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' + (slide._timingXml || '') + '</p:sld>'
```

Only the occurrence inside `makeXmlSlide` — the similar tail strings in the notes/layout serializers stay untouched.

## Patch 2: `_timingXml` field on `PresSlide` — `src/core-interfaces.ts`

**Anchor**:

```ts
	_slideObjects?: ISlideObject[]
```

**Insert after**:

```ts
	// VENDOR PATCH 2 (see VENDOR.md): prebuilt <p:timing> XML spliced in by makeXmlSlide.
	_timingXml?: string
```

**Verification**: `npm test` (vendor.test.ts asserts the Patch 1 string is present in `src/gen-xml.ts` and that an injected `_timingXml` round-trips into the written .pptx at the schema position), then `npm run build` and a real export.
