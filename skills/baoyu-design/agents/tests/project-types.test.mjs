import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, "../..");
const manifest = JSON.parse(
  await readFile(path.join(skillRoot, "project-types.json"), "utf8"),
);

const expectedTypes = [
  "Slides",
  "Mobile app design",
  "Wireframe",
  "Document",
  "Animation",
  "UI mockups",
  "Résumé",
  "3D object",
  "Research",
  "HTML email",
  "Color + type system",
  "Diagram",
  "Flier",
];

const markers = {
  slides: {
    skill: ["static HTML", "data-anim"],
    starter: ["multi-selection", "data-anim", "noscale"],
  },
  "mobile-app-design": {
    skill: ["mobile", "viewport"],
    starter: ["ios-frame", "android-frame"],
  },
  wireframe: {
    skill: ["3-5", "low-fi"],
    starter: ["design-canvas"],
  },
  document: {
    skill: ["doc-page", "Flowing pages"],
    starter: ["customElements.define", "doc-page"],
  },
  animation: {
    skill: ["animations_v3.jsx", "OM_SCENES"],
    starter: ["CompositionStage", "OM_SCENES"],
  },
  "ui-mockups": {
    skill: ["high-fidelity", "design-canvas"],
    starter: ["image-slot", "design-canvas"],
  },
  resume: {
    skill: ["resume", "doc-page"],
    starter: ["customElements.define", "doc-page"],
  },
  "3d-object": {
    skill: ["three_d_stage", "OBJ", "GLB"],
    starter: ["setObject", "download"],
  },
  research: {
    skill: ["4-10", "source", "URL"],
    starter: ["data-overlay"],
  },
  "html-email": {
    skill: ['table role="presentation"', "Inline EVERY style", "No JavaScript"],
    starter: [],
  },
  "color-type-system": {
    skill: ["styles.css", "compiler", "typography"],
    starter: ["design-canvas"],
  },
  diagram: {
    skill: ["chart", "visual"],
    starter: ["chart-stage"],
  },
  flier: {
    skill: ["doc_page.js", "exactly one", "print"],
    starter: ["customElements.define", "doc-page"],
  },
};

test("project type manifest contains the 13 synchronized types in order", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    manifest.projectTypes.map((entry) => entry.name),
    expectedTypes,
  );
  assert.equal(
    new Set(manifest.projectTypes.map((entry) => entry.id)).size,
    expectedTypes.length,
  );
});

for (const projectType of manifest.projectTypes) {
  test(`project type: ${projectType.name}`, async () => {
    assert.ok(projectType.skills.length > 0, "must route to at least one skill");

    const skillTexts = [];
    for (const skill of projectType.skills) {
      const text = await readFile(
        path.join(skillRoot, "built-in-skills", `${skill}.md`),
        "utf8",
      );
      assert.match(text, new RegExp(`name:\\s*["']?${escapeRegExp(skill)}`));
      assert.ok(text.length > 120, `${skill}.md is unexpectedly small`);
      skillTexts.push(text);
    }

    const starterTexts = [];
    for (const starter of projectType.starters) {
      const text = await readFile(
        path.join(skillRoot, "starter-components", starter),
        "utf8",
      );
      assert.ok(text.length > 120, `${starter} is unexpectedly small`);
      starterTexts.push(text);
    }

    const expected = markers[projectType.id];
    assert.ok(expected, `missing verification markers for ${projectType.id}`);
    const skillCorpus = skillTexts.join("\n");
    const starterCorpus = starterTexts.join("\n");
    for (const marker of expected.skill) {
      assert.ok(
        skillCorpus.toLowerCase().includes(marker.toLowerCase()),
        `${projectType.name}: skill marker not found: ${marker}`,
      );
    }
    for (const marker of expected.starter) {
      assert.ok(
        starterCorpus.toLowerCase().includes(marker.toLowerCase()),
        `${projectType.name}: starter marker not found: ${marker}`,
      );
    }
  });
}

test("operative system prompt exposes every project type and exact upstream snapshot", async () => {
  const operative = await readFile(path.join(skillRoot, "system-prompt.md"), "utf8");
  const upstream = await readFile(
    path.join(skillRoot, "references", "upstream-system-prompt.md"),
    "utf8",
  );
  for (const name of expectedTypes) {
    assert.ok(operative.includes(name), `system prompt does not mention ${name}`);
  }
  assert.ok(upstream.length > 20_000, "upstream system prompt snapshot is too small");
  assert.match(upstream, /ready_for_verification/);
});

test("merged deck-stage retains upstream rail editing and local PPTX animation", async () => {
  const deck = await readFile(
    path.join(skillRoot, "starter-components", "deck-stage.js"),
    "utf8",
  );
  for (const marker of [
    "multi-selection",
    "drag to reorder",
    "Delete/Backspace",
    "_animOnNav",
    "data-anim-auto-reverse",
    "noscale",
  ]) {
    assert.ok(deck.includes(marker), `deck-stage missing merged marker: ${marker}`);
  }
});

test("non-deck local feature overlays survive the upstream sync", async () => {
  const tweaks = await readFile(
    path.join(skillRoot, "starter-components", "tweaks-panel.jsx"),
    "utf8",
  );
  assert.match(tweaks, /TweakSuggestionBar/);
  assert.match(tweaks, /__edit_mode_chat/);

  for (const [file, marker] of [
    ["design-system-authoring-guide.md", "compile-design-system"],
    ["import-from-figma.md", "import-figma"],
    ["export-as-video.md", "gen_video"],
  ]) {
    const text = await readFile(
      path.join(skillRoot, "built-in-skills", file),
      "utf8",
    );
    assert.ok(text.includes(marker), `${file} lost local marker ${marker}`);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
