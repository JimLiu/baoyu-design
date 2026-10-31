# DeepSeek Harness 插件

[English](README.md) · [简体中文](README.zh-CN.md) · [返回 baoyu-design](../README.zh-CN.md)

这里的每个文件夹都是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，各带一个 baoyu-design 技能。你让 Agent 做幻灯片、设计稿、设计系统或数据看板，它会把文件写进你的工作区，再给你一个编辑器链接。编辑器就运行在你自己的电脑上，链接在应用的侧栏里打开，和对话并排。

| 插件 | npm 包名 | 能做什么 | 评论 |
|---|---|---|---|
| [Claude 幻灯片](dsh-claude-slides/)<br>`/claude-slides` | [`dsh-claude-slides`](https://www.npmjs.com/package/dsh-claude-slides) | Agent 把可编辑的幻灯片写成本地文件，并在本地幻灯片编辑器里打开，你可以放映、修改，导出 PDF、HTML 或 PowerPoint。 | Send to agent |
| [Claude 设计稿](dsh-claude-design/)<br>`/claude-design` | [`dsh-claude-design`](https://www.npmjs.com/package/dsh-claude-design) | Agent 把可编辑的设计画布（多个画板并排）写成本地文件，并在本地画布编辑器里打开，你可以改文字、调参数，也可以把评论发给 Agent 修改。 | Send to agent |
| [Claude 设计系统](dsh-claude-design-system/)<br>`/claude-design-system` | [`dsh-claude-design-system`](https://www.npmjs.com/package/dsh-claude-design-system) | Agent 把设计系统（设计令牌、字体样式、组件、素材和品牌手册）写成本地文件，并在本地页面里打开，你可以浏览、修改，也可以把评论发给 Agent 修改。 | Send to agent |
| [Claude 数据看板](dsh-claude-dashboard/)<br>`/claude-dashboard` | [`dsh-claude-dashboard`](https://www.npmjs.com/package/dsh-claude-dashboard) | Agent 根据你的数据文件做出数据看板（图表、数字和表格），并在本地看板编辑器里打开，来源面板会显示每个数字是从哪里来的，你也可以把评论发给 Agent 修改。 | Send to agent |

只需要 DeepSeek Harness 桌面版。插件用的是桌面版自带的 Node.js，不用另外安装任何东西。

## 安装

1. **打开插件页。** 点左侧栏的 **Plugins**（插件），再点右上角的 **Add plugin**。
2. **填插件名。** 在 **Package name or address** 一栏填插件名，比如 `dsh-claude-slides`，点 **Install**。插件名见上面表格的"npm 包名"一列。应用会从 npm 下载插件，连不上 npm 时改从 npmmirror 镜像下载。
3. **打开开关。** 插件会出现在列表里，开关没开就打开。
4. **退出应用再重新打开。** 重启以后，发给 Agent 的评论才会以卡片的形式出现在对话里。

想装几个插件，就把第 1 到 3 步做几遍，最后重启一次。

**从「发现」安装。** 应用也能把这些插件列出来，点一下就装，出了新版本还会提示你。「发现」是应用的实验功能，默认关着：

1. 在插件页点 **Experimental plugins**（实验性插件）旁边的 **More**（更多），打开 **Custom plugin markets**（自定义插件市场）。插件页会多出一个 **Discover**（发现）标签页。
2. 在「发现」里点 **Add index source**（添加索引源），把下面这个地址粘贴到 **Index URL**（索引 URL）一栏，点 **Add**（添加）：

   ```text
   https://jimliu.github.io/baoyu-design/dsh-plugins/index.json
   ```

3. 在插件卡片上点 **Install**（安装），确认后在弹出的安装对话框里完成安装。然后像第 3、4 步那样打开插件开关、重启应用。

每次有新版本发布到 npm，这个索引都会跟着更新。

**命令行安装。** 装到某个 CLI profile（比如 `web`）：

```bash
dsh plugin --profile web add dsh-claude-slides
```

桌面版自己的 profile 只接受从插件页添加的插件。

**从文件夹安装。** 也可以从本仓库的副本安装：克隆仓库（或者下载 ZIP 解压），第 2 步填插件自己文件夹（里面有 `package.json` 的那个）的完整路径，比如 `/Users/you/baoyu-design/dsh-plugins/dsh-claude-slides`。应用直接使用这个文件夹，不会复制，所以文件夹不要挪走或删掉。

## 使用

1. **新开一个会话。** 装插件之前就开着的会话里没有这个新技能。给会话选一个工作区文件夹，Agent 会把文件写在这里。
2. **说出你要什么。** 可以直接用自然语言说，比如"做一份 10 页的三季度业绩汇报"；也可以点名技能：输入 `/` 后选它，比如 `/claude-slides`。可以把材料交给 Agent，比如笔记、需求说明，做看板时给一个 CSV。
3. **打开 Agent 给的链接**，以 `http://127.0.0.1:` 开头。它会在右侧栏的浏览器里打开，和对话并排。如果在别处打开了，到 **设置 → 通用** 里把聊天链接的打开方式改成应用内侧栏。
4. **在编辑器里修改。** 你的修改会存回同一批文件，Agent 的改动也会实时出现在页面上。还想改什么，在对话里说，或者留评论。
5. **把评论发给 Agent**（看上面表格的"评论"一列）：
   - **Send to agent**：在页面上加评论，勾选 **Send to agent** 再发送。对话空闲时 Agent 也会接手，改好以后在评论里回复你。评论也会以卡片的形式出现在对话里，点卡片上的 **View thread**（中文界面是「查看评论」）会在编辑器里打开这条评论。这个勾选框只在 Agent 等评论时出现；Agent 每次给你链接时都会开始等。
   - **无**：这个编辑器没有评论功能。直接在对话里告诉 Agent 要改哪里、怎么改。

以后要接着改，在同一个工作区里开会话，让 Agent 再打开那份幻灯片、设计稿或看板。它会启动编辑器，给你一个新链接。

## 更新

应用不会自己更新这些插件。如果你在[「发现」](#安装)里加了索引，出了新版本时，插件卡片上会显示 **Update available**（有新版本）。要装新版本：

1. 在插件页打开这个插件，点 **Uninstall**。你做好的幻灯片、设计稿和看板还留在各自的工作区文件夹里。
2. 重新安装：在「发现」里点它卡片上的 **Install**，或者按[安装](#安装)的步骤用插件名重新添加。
3. 退出应用再重新打开，再新开一个会话。

从「发现」安装马上就能装到新版本。新版本发布后的一天之内，用插件名添加装到的还是上一版：应用用的包管理器 pnpm 会把新发布的版本压 24 小时。想马上用新版本，就连版本号一起填，比如 `dsh-claude-slides@2.4.0`。各版本见[更新日志](../CHANGELOG.zh.md)。

从文件夹安装的插件：把新版本放到同一个文件夹（在仓库里 `git pull`，或者重新下载 ZIP 解压覆盖旧的），然后退出应用再重新打开，再新开一个会话。

## 卸载

在插件页打开这个插件，点 **Uninstall**。你做好的幻灯片、设计稿和看板还留在各自的工作区文件夹里。

## 遇到问题

- **输入 `/` 后找不到这个技能。** 到插件页确认插件已经打开，再新开一个会话。
- **Agent 的做法和插件说的不一样。** 如果工作区里有同名技能的副本（在 `.agents/skills/` 或 `.dsh/skills/` 下），Agent 会用那一份，而不是插件里的。
- **安装失败。** 对照上面表格的"npm 包名"一列检查插件名。安装对话框里会显示错误，以及应用问过哪个源；npm 和 npmmirror 都连不上时，检查网络或代理。从文件夹安装的，检查路径是不是完整的（以 `/` 开头，Windows 上以盘符开头），是不是指向插件自己的文件夹，也就是里面有 `package.json` 的那个。
- **「发现」读不到索引。** 在「发现」里打开市场菜单，选 **Manage index sources…**（管理索引源…），地址下面会写原因。索引放在 GitHub Pages（`github.io`）上，你的网络连不上的话，就改用插件名添加。
- **提示插件已经安装。** 要重新安装（比如为了更新），先卸载。
- **链接打不开，或者没有 Send to agent。** 比如重启应用以后就会这样。让 Agent 再打开一次编辑器，编辑器和等评论都会重新启动。

每个插件的文件夹里还有它自己的 README，介绍里面有什么。
