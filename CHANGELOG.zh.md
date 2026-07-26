# 更新日志

[English](./CHANGELOG.md) | 中文

本文档记录 `baoyu-design` 的重要变更。

## 1.2.0 - 2026-07-25

### 新功能
- 同步 13 类项目路由和 7 月 25 日版 Claude Design system prompt，覆盖幻灯片、移动应用、线框图、文档、动画、UI mockup、简历、3D 对象、研究、HTML 邮件、色彩/字体系统、图表和传单。
- 新增 3D 对象、数据科学与可视化、设计反馈、实验工作流、HTML 邮件、地图、社交媒体活动、三折页、水彩插画、网页研究、落地页及更多导出格式等专项流程。
- 新增时间轴动画、图表与数据叠层、文档与文件视图、3D 场景、浏览器/设备外壳和主流社交平台等 starter components。

### 变更
- 将上游改进合入 `deck-stage`、`image-slot`、设计指引和项目路由，同时保留本地原生 PowerPoint 动画、微调建议、设计系统工具、导入流程和视频导出能力。
- 记录可复现的上游同步来源与清单，并新增测试以验证全部项目类型、保护本地扩展不被同步覆盖。

### 文档
- 扩充中英文能力概览，加入新工作流和 starter components。

## 1.1.1 - 2026-06-22

### 变更
- `make-a-deck`：澄清「中文能渲染好」不等于优先用 AI 画图——结构化、精确的幻灯片内容仍默认走 HTML/CSS，生成式图片只作辅助，保留给概念场景、吉祥物、主视觉/分区配图和真正的信息图（确实要做信息图时，中文标注与文案无需回避）。

## 1.1.0 - 2026-06-22

### 变更
- `generate-images`：更新光栅图片生成指引，承认现代图片后端已经能可靠渲染文字，包括中文 / CJK；只有在需要可编辑、精确还原或数据绑定时，才把文字密集型信息图转交 HTML/CSS。
- `make-a-deck`：同步 deck 图片生成指引，允许生成式幻灯片信息图包含标题、标签、标注和中文文案；只有需要实时编辑或精确数字绑定时才使用 HTML/CSS。

## 1.0.0 - 2026-06-22

### 新功能
- 发布可移植的 `baoyu-design` Agent Skill，包含核心设计方法、Claude Code/Cursor/Codex 运行环境参考、内置设计流程、starter components、设计系统工具，以及本地导入/导出 agents。
- 新增 `release-skills`，提供可复用的发布流程，覆盖版本选择、多语言 changelog、annotated tag 和 GitHub Release。
- 新增本地 deck、文档、PPTX、视频、图片生成、Figma `.fig`、GitHub 仓库、HTML/CSS 导入，以及设计系统 preview 流程。

### 修复
- `gen-pptx`：通过按 z-index 顺序绘制子元素、向导出子树传播祖先 opacity、光栅化渐变蒙版、保留 Unicode 文件名、保留文本换行，并为卡住的 capture 加逐次超时，提高 editable PowerPoint 导出的视觉一致性。
- `make-a-deck`：补充全高 slide wrapper 规则，确保全出血幻灯片内容能稳定导出。

### 文档
- 在英文和中文 README 中补充安装、本地使用、设计系统、导入来源、deck/PPTX 导出，以及支持的 agent 运行环境。

## 2026-06-19

### 新功能
- `generate-images`：新增跨运行环境的图片生成调度 skill，并接入需要光栅图片输出的设计流程。该调度会先写入 prompt 文件，再选择运行时原生 provider，最后才回退到已安装的 `baoyu-image-gen` CLI；同时统一 `imgs/` + `prompts/` 输出约定，并移除已过时的 `gemini-image` 内置 skill。

### 变更
- PPTX 导出默认改为 editable 模式；显式要求截图模式时仍可使用 screenshot export。

### 修复
- `make-a-deck`：明确每张幻灯片的内容包裹元素必须撑满其 `<section>`。deck-stage 只负责设置 section 的尺寸（通过 `::slotted`），管不到里面的包裹元素，因此当包裹元素的子元素全为绝对定位时会塌缩成 0 高——导致导出时全屏图整张丢失，或主视觉底图只显示一半高度。新增一条基础 CSS 规则（`section[data-label] > *`）、背后的原理说明，以及一项验证检查。
- `gen-pptx` / `gen-video`：通过共享的 `safeBasename` 清洗函数，在导出文件名中保留 Unicode 字符（中日韩、西里尔、带重音的拉丁字符），不再把每个非 ASCII 单词字符替换为 `_`（旧逻辑会把 `小米SU7-外观与价格` 这类名字变成一串下划线）。
- `gen-pptx`：在 editable PPTX 导出中，将 CSS 渐变背景（封面/主视觉的压暗蒙版、渐隐遮罩）光栅化为带透明通道的 PNG。PowerPoint 没有渐变填充，导出器此前会把渐变压成第一个色标的纯色——将 `linear-gradient(105deg, rgba(8,10,13,.92) → .05)` 这类向右渐隐的蒙版变成近乎不透明的深色矩形，整张图被均匀压暗，蒙版下本应清晰的主体也随之消失。现在导出器用 canvas 按每个色标的 alpha 绘制渐变（支持线性+径向、角度 / `to` 方向 / 角点、%/px 色标、圆角裁剪），蒙版渐隐与浏览器完全一致；无法识别的形式（conic / repeating）回退到原先的纯色填充。

## 2026-06-16

### 新功能
- `animated-video`：新增本地 `gen-video` CLI，可导出 MP4/WebM/GIF。它通过 Playwright 驱动 Chromium，经由 `window.__animStage` 逐帧 seek 时间线动画，超采样截图后将帧流交给 ffmpeg。
- `starter-components/animations.jsx`：新增 `window.__animStage` 时间线桥接和 `?capture` 行为，使导出时动画从暂停状态开始、全出血渲染，并隐藏编辑控件。

### 修复
- `gen-pptx`：为 setup 和 capture 调用增加逐次超时，避免单页卡死导致导出永久挂起。
- `gen-pptx`：editable PPTX 文本导出保留代码块换行和 `<br>`。

### 文档
- README：补充 deck/PPTX 导出流程，并新增中英文流程图。

## 2026-06-15

### 新功能
- `gen-pptx`：为 Claude Code 新增本地 PPTX 导出器。TypeScript CLI 使用 Playwright 和 PptxGenJS，将 baoyu-design deck 导出为 editable 或 screenshot 模式，并输出结构化校验结果。
- `deck-stage`：新增原生全屏支持、Fullscreen API 模式下自动隐藏缩略图栏、全屏工具按钮、`F` 快捷键，以及 Duplicate slide 操作。
- `deck-stage`：缩略图栏变更改为 host 驱动的 `dc-op` 模型，同时保留 standalone HTML 回退行为。
- `make-a-doc`：新增面向纸张页面和打印优先文档的内置 skill。
- `something-cool`：新增 "show me something cool" 流程，先让用户选择创作方向再继续执行。
- `tweaks-panel`：新增 `TweakSuggestionBar`，可将 edit-mode 微调建议投递到宿主 chat 输入框。

### 变更
- 全面刷新内置 skill 提示词，覆盖 deck 编写、speaker notes、移动原型、打印/PDF、handoff、PDF 阅读、视觉设计、动画、音效、Canva 和 PPTX 导出等流程。
- `design-canvas`：持久化并恢复视口平移/缩放；当恢复位置不可见时自动回退，并允许嵌套 deck 缩略图栏继续使用原生滚动。
- `SKILL.md`：新增 PPT/PPTX/PowerPoint 触发词，将 PPTX 导出范围限定为 baoyu-design 创建的 deck，并把 skill description 压到运行时长度限制内。

### 修复
- `deck-stage`：打印/PDF 导出时强制幻灯片动画和 transition 到结束状态，避免捕获到入场动画中间帧。

## 2026-06-11

### 新功能
- 新增 `import-from-github` 与 `import-from-html` 内置 skill，用于把 GitHub 仓库和现有 HTML/CSS 页面作为设计来源，并要求保留来源、遵守内容即数据的防注入边界。
- 设计系统工具现在会从 `.d.ts` 解析组件 props 契约，在 `_ds_prompt.md` 中输出完整 enum/default props 指引，并检测 `status`、`open`、`location` 等危险顶层 Babel 全局变量名。
- 新增 GitHub Actions 测试 workflow，以及覆盖设计系统、Figma 导入、preview、asset 与 prompt 工具的 Node 测试。

### 修复
- `build-preview.mjs`：内联 card script 与 JSX 字符串字面量中的资源引用，避免生成的 `preview.html` 因脚本侧资源路径而显示破图。
- `fig-materialize.mjs`：使用解码器的有序字体粗细表，正确 materialize Semi Bold、Extra Bold、Thin 等字重。
- `ds-prompt.mjs`：提取组件 prompt 摘要时保持 fenced JSX 示例完整。

### 文档
- README：新增 "Import design sources" 小节，说明离线 Figma `.fig`、GitHub 仓库和现有 HTML/CSS 参考的导入方式。

## 2026-06-10

### 新功能
- 新增本地离线 Figma `.fig` 导入器，支持 `outline`、`mount`、`materialize`、`render` 和 `design-system` 子命令。
- 新增 `design-system-preview` 内置 skill 与 `agents/build-preview.mjs`，可为已编译设计系统生成自包含的交互式 `preview.html`。

### 变更
- `.fig` 导入器输出可直接复制执行的下一步命令；遇到大小写不敏感文件名冲突会警告；生成的 README 会记录 mount/render 使用规则。
- 大型设计系统的 preview 摘要增加数量上限，避免校验输出不可读。

### 修复
- 设计系统 bundle 改为依赖安全顺序输出，确保本地组件依赖先于使用方定义。
- token 提取不再把 BEM 伪类选择器误判为 CSS 自定义属性声明。
- preview 回退提示现在区分缺少 manifest 和 manifest 内没有可预览条目的两种情况。

## 2026-06-09

### 新功能
- 新增端到端设计系统支持：发现、项目绑定、同步到 `_ds/<slug>/`、生成每次加载用的 `_ds_prompt.md`，并在 `_d_meta.json` 中记录项目元数据。
- 新增只读 fork-verifier subagent，用于在 Claude Code、Codex 和 Cursor 环境中执行构建后的校验。
- 设计系统 prompt 改为 bundle-first wiring，内嵌组件 prompt 摘要，并在安全时暴露没有 `.d.ts` 契约的 PascalCase `.jsx`/`.tsx` 导出。

### 变更
- 扩展设计系统编写文档，补充 GitHub 源导入、组件 import、可接受的全局 CSS 入口名和运行时 wiring。
- 缩短 `baoyu-design` skill description，同时保留关键触发词 (by @easonshen90, [#8](https://github.com/JimLiu/baoyu-design/pull/8))。

### 致谢
- `baoyu-design` skill description 缩短由 @easonshen90 贡献（[#8](https://github.com/JimLiu/baoyu-design/pull/8)）。

## 2026-06-08

### 新功能
- 新增可移植设计系统编写工具链：compiler、checker、core parser、vendored Babel runtime，以及只读 checker subagent。
- 新增设计系统消费侧导入/同步工具，包括 `_ds/<slug>/` binding、生成每次加载用 prompt，以及 `_d_meta.json` 项目元数据。
- 新增 asset 记录工具，用于跟踪生成交付物、版本、状态、viewport、副标题和所属 section。

### 变更
- 各运行环境参考文档改为指向共享设计系统编写指南，并明确何时内联运行检查、何时通过隔离的只读 subagent 检查。

### 修复
- 移除已纳入版本控制的 `skills/baoyu-design/.DS_Store` 文件 (by @HCS9527, [#2](https://github.com/JimLiu/baoyu-design/pull/2))。

### 致谢
- 已跟踪 `.DS_Store` 移除由 @HCS9527 贡献（[#2](https://github.com/JimLiu/baoyu-design/pull/2)）。

## 2026-06-07

### 修复
- `SKILL.md`：修复 frontmatter 元数据，确保 skill 能正确加载 (by @y122972, [#1](https://github.com/JimLiu/baoyu-design/pull/1))。
- 移除根目录 `.DS_Store` 并将 `.DS_Store` 加入 `.gitignore`。
- 修正 README 截图文件映射。

### 文档
- 在中英文 README 中添加截图，补充 Reader Mac App prompt 与 Claude Design 对比示例，并将截图资源优化为 WebP。

### 致谢
- `SKILL.md` frontmatter 修复由 @y122972 贡献（[#1](https://github.com/JimLiu/baoyu-design/pull/1)）。

## 2026-06-06

### 新功能
- 新增可移植的 `baoyu-design` Agent Skill，包括核心设计方法、内置 skill prompts、starter components、导出/handoff 流程，以及 Claude Code/Cursor 运行环境参考。
- 新增 Codex Agent 支持：`skills/baoyu-design/references/codex.md` 覆盖提问、浏览器预览、截图、调试、交付物展示和 subagent 校验默认规则。

### 文档
- 新增英文和简体中文 README。
- 新增本更新日志，并明确最终设计/原型交付应展示可运行 preview，而不仅是生成文件。

### 维护
- 新增初始仓库文件和 MIT License。
