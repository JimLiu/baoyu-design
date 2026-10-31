# Notices

baoyu-design holds material under three different sets of terms. The MIT License in [LICENSE](LICENSE) covers only the first. The same applies to the DeepSeek Harness plugins on npm, which ship this file next to their `LICENSE`.

[中文说明](#中文说明)

## 1. The maintainer's own work: MIT

Copyright (c) 2026 Jim Liu 宝玉, under the MIT License in [LICENSE](LICENSE):

- The local tooling: each skill's `scripts/artifact.mjs` and `scripts/server.mjs` (the command line and the local editor server), the local comments, and what lets the editors run on a local machine instead of claude.ai.
- The DeepSeek Harness plugins' own code and files: `dsh-plugins/*/lib/`, `cordis.patch.yml`, `locale/`, `docs/` and `icon.svg`.
- The parts of the skills' text written for local agents: how to open and run the editors, local paths and files, comments.
- The READMEs, the changelogs, the images in `assets/` and the files in `.github/`.
- The maintainer's tools in `archive/baoyu-design/agents/`, apart from the open-source code vendored there (section 3).

## 2. Material from Anthropic: not MIT

baoyu-design brings claude.ai's Artifact types and Claude Design to local agents, so much of what it ships comes from Anthropic, PBC. That material stays Anthropic's. Anthropic has published no license for it, apart from the one file in section 2.1, and this project grants none: the MIT License does not apply to it. It is included so the skills work as they do on claude.ai. This project is independent and is not affiliated with or endorsed by Anthropic.

- **Skill instructions.** Each `skills/claude-*/SKILL.md` adapts the SKILL.md of a claude.ai Artifact type. The maintainer's local-agent changes are described in section 1.
- **Reference docs.** `skills/*/artifact-type/reference/`, and the copies under `scripts/editor/artifact-type/`: the craft, format and layout guides, font lists and other references of the Artifact types.
- **The `dataviz` skill.** `skills/dataviz/` is Anthropic's dataviz skill. Its palette validators include code from Color.js (MIT, Lea Verou and Chris Lilley), credited in the files.
- **The editors.** `skills/claude-*/scripts/editor/` holds editors reconstructed from the claude.ai Artifact-type runtimes: their interface, wording and behaviour are Anthropic's. The built files mix that reconstruction with the maintainer's local additions (section 1) and with open-source packages (section 3).
- **Icon fonts.** The Anthropicons icon fonts: the `anthropicons-*.woff2` files in the editors' `assets/` and `artifact-type/` folders, and the Anthropicons font faces embedded as data URIs in the editors' CSS.
- **The archived `baoyu-design` skill.** In `archive/baoyu-design/`: `system-prompt.md`, `references/upstream-system-prompt.md` and `references/upstream-sync/` (the Claude Design system prompt, a snapshot of it and its sync records), `built-in-skills/` (Claude Design's built-in skills) and `starter-components/` (Claude Design's starter components; the local patches are recorded in the `*-patch.md` files there).

### 2.1 frontend-design: Apache License 2.0

`archive/baoyu-design/built-in-skills/frontend-design.md` is Claude Design's copy of Anthropic's frontend-design skill, which Anthropic publishes under the Apache License 2.0. The full license text is in [`archive/baoyu-design/built-in-skills/LICENSE-frontend-design.txt`](archive/baoyu-design/built-in-skills/LICENSE-frontend-design.txt). The file was changed from the original: its frontmatter was rewritten for the built-in-skill format, and its text follows the version Claude Design ships.

## 3. Third-party open-source code

The editors bundle open-source packages, such as React, Base UI, d3 and pptxgenjs. Each keeps its own license, which this project's license does not replace. The licenses are in each editor's `scripts/editor/third-party-licenses.txt`, and for the slides compiler in `scripts/editor/node/third-party-licenses.txt`.

The archived `baoyu-design` skill vendors React, ReactDOM, Babel and fflate (MIT) in `archive/baoyu-design/agents/vendor/`, and pptxgenjs (MIT) in `archive/baoyu-design/agents/gen-pptx/vendor/pptxgenjs/`, with its `LICENSE`.

## Questions and removal

If you hold rights in anything here and want it credited differently, changed or removed, open an issue at <https://github.com/JimLiu/baoyu-design/issues>.

## 中文说明

本仓库（以及 npm 上的 DeepSeek Harness 插件）里的内容分三类，许可各不相同。[LICENSE](LICENSE) 里的 MIT 许可只管第一类。

1. **维护者自己写的部分，MIT。** 本地命令行和编辑器服务器（各技能的 `scripts/artifact.mjs`、`scripts/server.mjs`）、本地评论、让编辑器离开 claude.ai 在本机运行的那部分代码；DeepSeek Harness 插件自己的代码和文件（`dsh-plugins/*/lib/`、`cordis.patch.yml`、`locale/`、`docs/`、`icon.svg`）；技能说明里为本地 Agent 写的部分；README、更新日志、`assets/` 里的图片、`.github/`；`archive/baoyu-design/agents/` 里维护者写的工具。
2. **取自 Anthropic 的部分，不适用 MIT。** 权利归 Anthropic。除 frontend-design 外，Anthropic 没有为这些内容公开许可，本项目也不授予任何许可。包括：
   - 各 `skills/claude-*/SKILL.md` 所改编的 Artifact 类型技能说明；
   - `artifact-type/reference/` 里的参考文档；
   - `skills/dataviz/`（Anthropic 的 dataviz 技能）；
   - `scripts/editor/` 里从 claude.ai 运行时还原的编辑器（界面、文案和行为）；
   - Anthropicons 图标字体（`anthropicons-*.woff2` 文件，以及编辑器 CSS 里内嵌的字体）；
   - `archive/baoyu-design/` 里的 Claude Design 系统提示词、内置技能和起步组件。
   
   `archive/baoyu-design/built-in-skills/frontend-design.md` 取自 Anthropic 以 Apache License 2.0 发布的 frontend-design 技能，许可全文见同目录的 `LICENSE-frontend-design.txt`。
3. **第三方开源代码，各按原许可。** 编辑器打进去的开源包（React、Base UI、d3、pptxgenjs 等）的许可见各编辑器的 `scripts/editor/third-party-licenses.txt`；归档技能里内置的 React、Babel、fflate、pptxgenjs 见 `archive/baoyu-design/agents/vendor/` 和 `agents/gen-pptx/vendor/pptxgenjs/LICENSE`。

本项目是独立的社区项目，与 Anthropic 无隶属或背书关系。权利人希望调整署名、修改或移除某部分内容，请在 <https://github.com/JimLiu/baoyu-design/issues> 提 issue。
