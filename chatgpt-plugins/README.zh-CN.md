# ChatGPT 插件

[English](README.md) · [简体中文](README.zh-CN.md) · [返回 baoyu-design](../README.zh-CN.md)

这里的每个文件夹都是一个插件，ChatGPT 桌面版和 Codex 都能用，装的是同一个包。你让 Agent 做幻灯片、设计稿、设计系统、仪表盘或影片，它会把文件写进你的工作区，再给你一个编辑器链接，编辑器就跑在你自己的电脑上。

| 插件 | 技能 | 能做什么 |
|---|---|---|
| [Baoyu Slides](baoyu-slides/)<br>`baoyu-slides` | `claude-slides` | 可编辑的幻灯片：放映、改字、拖动，导出 PDF、HTML、PowerPoint |
| [Baoyu Canvas](baoyu-canvas/)<br>`baoyu-canvas` | `claude-design` | 可编辑的设计画布：画板并排比较，改字、调参数 |
| [Baoyu Design System](baoyu-design-system/)<br>`baoyu-design-system` | `claude-design-system` | 设计系统：令牌、字体、组件、素材和品牌手册 |
| [Baoyu Dashboard](baoyu-dashboard/)<br>`baoyu-dashboard` | `claude-dashboard` | 数据仪表盘：每个数字都能追到来源 |
| [Baoyu Motion](baoyu-motion/)<br>`baoyu-motion` | `claude-motion`<br>`motion-director`<br>`dataviz` | 动画影片：逐场景写成代码，本地播放，导出 MP4、GIF；带导演技能 |
| [Baoyu Dataviz](baoyu-dataviz/)<br>`baoyu-dataviz` | `dataviz` | 图表方法：选图形、配色公式和校验脚本、图形规范，不需要本地服务 |

按需安装，每个插件都能单独用。会打开编辑器的插件要在你的电脑上运行，所以只能用在桌面版和本地运行的对话里，电脑上还要有 [Node.js](https://nodejs.org)：20 或更高，Dashboard 和 Motion 要 22 或更高。这些插件没有上架 OpenAI 的插件目录，要从本仓库添加。

## 安装

**1. 把本仓库添加为 marketplace**，只需要一次：

```bash
codex plugin marketplace add JimLiu/baoyu-design --sparse .agents/plugins --sparse chatgpt-plugins
```

两个 `--sparse` 让它只下载插件，不下载仓库里别的内容。没有 `codex` 命令的话，Mac 上的 ChatGPT 桌面版自带一个，在 `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`。

**2. 安装插件。** 在 ChatGPT 桌面版里：重启应用，打开 Plugins Directory，来源选 **Baoyu Design**，装你要的插件。也可以用命令行：

```bash
codex plugin add baoyu-slides@baoyu-design
```

**从文件夹安装。** 克隆本仓库，把 marketplace 命令里的来源换成它的路径：`codex plugin marketplace add /path/to/baoyu-design`。

## 使用

在新对话里点名插件，或者直接说要做什么：

> @baoyu-slides 根据这份文档做一套 10 页的幻灯片

Agent 把文件写到工作区的 `designs/<名字>/` 下，然后给你编辑器链接。应用有内置浏览器的话，它可以直接在那里打开；没有就用你自己的浏览器打开。

**要允许访问本机网络。** 编辑器是 `127.0.0.1` 上的一个小服务器，而 Agent 运行命令的默认沙箱不允许访问本机网络，`open` 在那里会返回 `NETWORK_BLOCKED`。所以 `open`（还有 `comments --wait`、`share`）要在允许本机网络的情况下运行：应用来问就批准，或者换一个允许本机网络的权限模式。只有和编辑器通信的命令需要这样，写文件、检查文件在沙箱里都能做。

**评论。** 在页面上写评论，勾选 **Send to Agent**。这个选项只在 Agent 等评论时才有，看不到的话，让 Agent 等你的评论就行。不等的时候评论也会保存下来，你开口时 Agent 再去读。

## 更新

```bash
codex plugin marketplace upgrade baoyu-design
```

然后重启应用，或者用 `codex plugin add` 重新安装插件。

## 许可

每个插件都带着 `LICENSE` 和 `NOTICE.md`。MIT 只覆盖维护者自己写的代码；改编自 Anthropic 的 claude.ai Artifact 类型的技能说明、reference 和编辑器仍归 Anthropic。详见 [NOTICE.md](../NOTICE.md)。
