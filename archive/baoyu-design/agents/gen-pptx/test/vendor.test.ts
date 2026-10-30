// Integration guard for the vendored PptxGenJS fork (vendor/pptxgenjs, vendored
// as TypeScript SOURCE): asserts VENDOR PATCH 1 is present, the shape-id
// contract (cNvPr id = object index + 2) holds, and a _timingXml string
// round-trips into the written .pptx at the schema-mandated position. Fails
// loudly after a careless re-vendor.
//
// The vendored source uses extensionless sibling imports and non-strict TS, so
// tests load it the same way production does: bundled by esbuild. The npm
// pretest script emits dist/vendor-bundle.test.mjs from the vendored entry; the
// computed dynamic import below keeps tsc from type-checking upstream code.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { buildTimingXml } from "../src/render/timing.ts";

const here = dirname(fileURLToPath(import.meta.url));
const vendorDir = join(here, "..", "vendor", "pptxgenjs");
const entryUrl = pathToFileURL(join(here, "..", "dist", "vendor-bundle.test.mjs")).href;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS: any = (await import(entryUrl)).default;

test("vendor: PATCH 1 is present in the vendored source", () => {
  const src = readFileSync(join(vendorDir, "src", "gen-xml.ts"), "utf8");
  assert.ok(
    src.includes("(slide._timingXml || '')"),
    "vendor/pptxgenjs/src/gen-xml.ts is missing VENDOR PATCH 1 — reapply per VENDOR.md",
  );
  const ifaces = readFileSync(join(vendorDir, "src", "core-interfaces.ts"), "utf8");
  assert.ok(
    ifaces.includes("_timingXml?: string"),
    "vendor/pptxgenjs/src/core-interfaces.ts is missing VENDOR PATCH 2 — reapply per VENDOR.md",
  );
});

test("vendor: shape-id contract and timing round-trip", async () => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "T", width: 10, height: 5.625 });
  pptx.layout = "T";

  // Slide 1: an unnamed decoy shape, then two named shapes for one animation.
  const s1 = pptx.addSlide();
  s1.addShape("rect", { x: 0, y: 0, w: 2, h: 1, fill: { color: "CCCCCC" } });
  s1.addShape("rect", { x: 1, y: 1, w: 2, h: 1, fill: { color: "FF0000" }, objectName: "anim-s1-n0-k0" });
  s1.addText("hello", { x: 1, y: 3, w: 3, h: 1, objectName: "anim-s1-n0-k1" });
  // Contract: cNvPr id = index in _slideObjects + 2.
  const predicted = [3, 4]; // decoy is index 0 → id 2
  assert.equal(s1._slideObjects.length, 3);

  s1._timingXml = buildTimingXml(
    [{ def: { effect: "fade-in", trigger: "after", delayMs: 0, durationMs: 500, order: 0, index: 0 }, spids: predicted }],
    1920,
    1080,
  );

  // Slide 2: no animations — must stay timing-free.
  const s2 = pptx.addSlide();
  s2.addText("static", { x: 1, y: 1, w: 3, h: 1 });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const zip = await JSZip.loadAsync(buffer);
  const slide1 = await zip.file("ppt/slides/slide1.xml")!.async("string");
  const slide2 = await zip.file("ppt/slides/slide2.xml")!.async("string");

  // Named shapes got the predicted ids.
  for (const [i, name] of ["anim-s1-n0-k0", "anim-s1-n0-k1"].entries()) {
    const m = slide1.match(new RegExp(`<p:cNvPr id="(\\d+)" name="${name}"`));
    assert.ok(m, `named shape ${name} not found in slide1.xml`);
    assert.equal(Number(m![1]), predicted[i], `cNvPr id drifted for ${name}`);
  }

  // Timing sits between </p:clrMapOvr> and </p:sld>, targeting those ids.
  assert.match(slide1, /<\/p:clrMapOvr><p:timing>.*<\/p:timing><\/p:sld>$/);
  assert.match(slide1, /<p:spTgt spid="3"\/>/);
  assert.match(slide1, /<p:spTgt spid="4"\/>/);
  assert.match(slide1, /<p:bldP spid="3" grpId="0" animBg="1"\/><p:bldP spid="4" grpId="0" animBg="1"\/>/);

  // No stray timing on the static slide.
  assert.ok(!slide2.includes("<p:timing>"), "slide2 must not contain a timing tree");
  assert.match(slide2, /<\/p:clrMapOvr><\/p:sld>$/);
});

test("vendor: new-effect timing round-trips (split, wheel, pulse+repeat)", async () => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "T", width: 10, height: 5.625 });
  pptx.layout = "T";

  const s1 = pptx.addSlide();
  s1.addShape("rect", { x: 0, y: 0, w: 2, h: 1, fill: { color: "336699" }, objectName: "anim-s1-n0-k0" });
  s1.addShape("rect", { x: 3, y: 0, w: 2, h: 1, fill: { color: "993366" }, objectName: "anim-s1-n1-k0" });
  s1.addText("pulse", { x: 1, y: 3, w: 3, h: 1, objectName: "anim-s1-n2-k0" });

  const base = { trigger: "after" as const, delayMs: 0, order: 0 };
  s1._timingXml = buildTimingXml(
    [
      { def: { ...base, effect: "split-in", dir: "vertical", durationMs: 500, index: 0 }, spids: [2] },
      { def: { ...base, effect: "wheel-out", durationMs: 2000, index: 1, trigger: "click" }, spids: [3] },
      { def: { ...base, effect: "pulse", scale: 1.05, durationMs: 500, index: 2, repeat: 2 }, spids: [4] },
    ],
    1920,
    1080,
  );

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const zip = await JSZip.loadAsync(buffer);
  const slide1 = await zip.file("ppt/slides/slide1.xml")!.async("string");

  assert.match(slide1, /<\/p:clrMapOvr><p:timing>.*<\/p:timing><\/p:sld>$/);
  assert.match(slide1, /filter="barn\(inVertical\)"/);
  assert.match(slide1, /transition="out" filter="wheel\(1\)"/);
  assert.match(slide1, /repeatCount="2000"/);
  assert.match(slide1, /tmFilter="0,0; \.2,\.5; \.8,\.5; 1,0"/);
});
