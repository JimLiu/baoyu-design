# DeepSeek Harness 插件

[English](README.md) · [简体中文](README.zh-CN.md) · [返回 baoyu-design](../README.zh-CN.md)

这里的每个文件夹都是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，各带一个 baoyu-design 技能。你让 Agent 做幻灯片、设计稿、设计系统、数据看板或影片，它会把文件写进你的工作区，再给你一个编辑器链接。编辑器就运行在你自己的电脑上，链接在应用的侧栏里打开，和对话并排。

| 插件 | npm 包名 | 能做什么 | 评论 |
|---|---|---|---|
| [Claude 幻灯片](dsh-claude-slides/)<br>`/claude-slides` | [`dsh-claude-slides`](https://www.npmjs.com/package/dsh-claude-slides) | Agent 把可编辑的幻灯片写成本地文件，并在本地幻灯片编辑器里打开，你可以放映、修改，导出 PDF、HTML 或 PowerPoint。 | Send to Agent |
| [Claude 设计稿](dsh-claude-design/)<br>`/claude-design` | [`dsh-claude-design`](https://www.npmjs.com/package/dsh-claude-design) | Agent 把可编辑的设计画布（多个画板并排）写成本地文件，并在本地画布编辑器里打开，你可以改文字、调参数，也可以把评论发给 Agent 修改。 | Send to Agent |
| [Claude 设计系统](dsh-claude-design-system/)<br>`/claude-design-system` | [`dsh-claude-design-system`](https://www.npmjs.com/package/dsh-claude-design-system) | Agent 把设计系统（设计令牌、字体样式、组件、素材和品牌手册）写成本地文件，并在本地页面里打开，你可以浏览、修改，也可以把评论发给 Agent 修改。 | Send to Agent |
| [Claude 数据看板](dsh-claude-dashboard/)<br>`/claude-dashboard` | [`dsh-claude-dashboard`](https://www.npmjs.com/package/dsh-claude-dashboard) | Agent 根据你的数据文件做出数据看板（图表、数字和表格），并在本地看板编辑器里打开，来源面板会显示每个数字是从哪里来的，你也可以把评论发给 Agent 修改。 | Send to Agent |
| [Claude 动画](dsh-claude-motion/)<br>`/claude-motion` | [`dsh-claude-motion`](https://www.npmjs.com/package/dsh-claude-motion) | Agent 用代码一幕一幕地写出短动画（讲解视频、产品演示、片头等），在本地 Motion 播放器里播放。你可以看着它一点点成形，在某个时刻留评论，再导出 MP4 或 GIF。 | Send to Agent |

每个插件都会带上 [`dsh-claude-artifacts`](dsh-claude-artifacts/)，也就是它们共用的部分：「作品」页，以及把评论送到 Agent。它会自动安装，装几个插件都只有一份。

只需要 DeepSeek Harness 桌面版。插件用的是桌面版自带的 Node.js，不用另外安装任何东西。

## 安装

1. **打开插件页。** 点左侧栏的 **Plugins**（插件），再点右上角的 **Add plugin**。
2. **填插件名。** 在 **Package name or address** 一栏填插件名，比如 `dsh-claude-slides`，点 **Install**。插件名见上面表格的"npm 包名"一列。应用会从 npm 下载插件，连不上 npm 时改从 npmmirror 镜像下载。
3. **打开开关。** 插件会出现在列表里，开关没开就打开。
4. **退出应用再重新打开。** 重启以后，左侧栏才会有 **Artifacts**（中文界面是「作品」）入口，发给 Agent 的评论才会以卡片的形式出现在对话里。

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

**从文件夹安装。** 也可以从本仓库的副本安装：克隆仓库（或者下载 ZIP 解压），第 2 步填插件自己文件夹（里面有 `package.json` 的那个）的完整路径，比如 `/Users/you/baoyu-design/dsh-plugins/dsh-claude-slides`。应用直接使用这个文件夹，不会复制，所以文件夹不要挪走或删掉。应用不会替文件夹里的插件安装依赖，所以还要添加 `dsh-claude-artifacts` 这个文件夹，而且要先于第一个插件添加。

## 使用

1. **新开一个会话。** 装插件之前就开着的会话里没有这个新技能。给会话选一个工作区文件夹，Agent 会把文件写在这里。
2. **说出你要什么。** 可以直接用自然语言说，比如"做一份 10 页的三季度业绩汇报"；也可以点名技能：输入 `/` 后选它，比如 `/claude-slides`。可以把材料交给 Agent，比如笔记、需求说明，做看板时给一个 CSV。
3. **打开 Agent 给的链接**，以 `http://127.0.0.1:` 开头。它会在右侧栏的浏览器里打开，和对话并排。如果在别处打开了，到 **设置 → 通用** 里把聊天链接的打开方式改成应用内侧栏。
4. **在编辑器里修改。** 你的修改会存回同一批文件，Agent 的改动也会实时出现在页面上。还想改什么，在对话里说，或者留评论。
5. **把评论发给 Agent**（看上面表格的"评论"一列）：
   - **Send to Agent**：在页面上加评论，勾选 **Send to Agent** 再发送。对话空闲时 Agent 也会接手，改好以后在评论里回复你。评论也会以卡片的形式出现在对话里，点卡片上的 **View thread**（中文界面是「查看评论」）会在编辑器里打开这条评论。这个勾选框只在 Agent 等评论时出现；Agent 每次给你链接时都会开始等。
   - **无**：这个编辑器没有评论功能。直接在对话里告诉 Agent 要改哪里、怎么改。

以后要接着改，点左侧栏的 **Artifacts**（「作品」）。这里列着 Agent 用这些插件打开过的所有幻灯片、设计稿、设计系统、看板和影片。点一个，应用就回到做它的那个对话，在右侧栏的浏览器里打开编辑器；那个对话已经删除或归档的，编辑器改在新窗口里打开。也可以在同一个工作区里开会话，让 Agent 再打开它，Agent 会启动编辑器，给你一个新链接。

在这一页还可以：

- **新做一个。** 点顶部的入口（幻灯片、设计、看板……）或右上角的 **+**，应用会新开一个会话，输入框里填好开头（比如 `/claude-slides 帮我做一份幻灯片，主题是：`），接着写完发送，Agent 就会用对应的技能。只有开着的插件才有入口。
- **看缩略图。** 桌面版会打开一次编辑器给每个作品截图，文件改过以后再回到这一页会重新截。`dsh web` 里截不了图，卡片上是一张示意图。
- **换视图、搜索、排序和筛选。** 右上角可以切换网格和列表，可以按标题、对话或路径搜索，可以按最近打开、最近修改、创建时间、名称排序，按类型、打开时间、是否共享、是否固定筛选。
- **固定、重命名、复制链接、删除。** 鼠标移到作品上，点 **…**（菜单打开时也可以按 P、R、C）。重命名会改编辑器里的标题。复制的是本机的编辑器地址，编辑器会一直开着。删除会把文件夹移到应用数据目录（默认 `~/.dsh`）的 `baoyu-design/trash/`，提示条上可以撤销，要彻底删除就到那里删；文件夹里还有别的文件时只从这一页移除，文件夹留在原处。

## 只让某个预设用某个技能

插件的技能默认在所有 [Agent 预设](https://github.com/deepseek-ai/deepseek-harness)里都能用。要让技能只在某个预设的会话里出现：

1. **关掉它自己那一行。** 在插件页打开这个插件，在 **包含的组件**（英文界面是 **Components**）下面关掉它自己那一行（比如 **Claude 幻灯片**）。插件的总开关保持打开，**Claude 作品** 也保持打开。
2. **在预设里声明它。** 在这个 profile 的 `cordis.patch.yml` 末尾加一个预设（桌面版是 `~/.dsh/profiles/desktop/cordis.patch.yml`），用包名写插件：

   ```yaml
   - insert:
       - id: preset-slides-dashboard
         name: '@deepseek-ai/dsh-agent-preset'
         config:
           id: slides-dashboard
           name: Slides and dashboards
           description: Only the claude-slides and claude-dashboard skills.
           order: 10
           plugins:
             - id: persona
               name: '@deepseek-ai/dsh-persona'
               config:
                 prefix: You are an agent powered by the {{model}} model.
             - id: tool-bash
               name: '@deepseek-ai/dsh-tool-bash'
               disabled: !!js process.platform === 'win32'
             - id: tool-pwsh
               name: '@deepseek-ai/dsh-tool-pwsh'
               disabled: !!js process.platform !== 'win32'
             - id: tool-fs
               name: '@deepseek-ai/dsh-tool-fs'
             - id: tool-skill
               name: '@deepseek-ai/dsh-tool-skill'
             - id: claude-slides
               name: dsh-claude-slides
             - id: claude-dashboard
               name: dsh-claude-dashboard
   ```

   预设里写了什么，它的会话就只有什么，所以这个例子列出了技能要用的工具：命令行、读写文件、加载技能。**设置** → **Agent 预设** 能看到内置预设的内容，预设加载失败时也会在那里说明原因。
3. **退出应用再重新打开**，新开一个会话，在输入框上方的模式菜单里选这个预设。输入 `/` 时这里有这些技能，其他预设里没有。

「作品」页照常工作：做过的东西都还在，也都打得开，哪怕它的技能已经不在任何预设里，只要插件还装着。页面上的入口会在含有这个技能的预设里新开会话，评论也照样能送到 Agent。

## 更新

发了新版本，应用会告诉你：右下角弹出一张卡片，「作品」页顶部和插件详情页也会出现 **Update**（更新）按钮。点一下就会把这些插件一起更新到新版本，不用卸载，也不用重新安装。

- **什么时候检查。** 应用打开时查一次，一直开着的话每 6 小时再查一次。问的是你安装插件用的 npm 源，连不上时改问 npmmirror 镜像。
- **更新之后。** 新开的会话用的就是新版本。卡片如果提示退出应用再重新打开，照做就好。
- **不想现在更新。** 点卡片上的 **Later**（稍后），这个版本就不再弹卡片，「作品」页和插件详情页的按钮还在。
- **更新失败。** 没更新成功的插件还是原来的版本，卡片会写明原因，点 **Try again**（重试）接着更新剩下的。

更新以后，插件详情页的「代码来源」会显示一个 `.tgz` 地址，这是正常的。各版本的改动见[更新日志](../CHANGELOG.zh.md)。

**手动更新。** 2.9.2 和更早的版本没有这个功能，要手动更新一次；想装某个指定版本时也一样：

1. 在插件页打开这个插件，点 **Uninstall**。你做好的幻灯片、设计稿、看板和影片还留在各自的工作区文件夹里。
2. 重新安装：在「发现」里点它卡片上的 **Install**，或者按[安装](#安装)的步骤用插件名重新添加。
3. 退出应用再重新打开，再新开一个会话。

从「发现」安装马上就能装到新版本。新版本发布后的一天之内，用插件名添加装到的还是上一版：应用用的包管理器 pnpm 会把新发布的版本压 24 小时。想马上用新版本，就连版本号一起填，比如 `dsh-claude-slides@2.4.0`。

**从文件夹安装的插件**不会提示新版本：把新版本放到同一个文件夹（在仓库里 `git pull`，或者重新下载 ZIP 解压覆盖旧的），然后退出应用再重新打开，再新开一个会话。

## 卸载

在插件页打开这个插件，点 **Uninstall**。你做好的幻灯片、设计稿、看板和影片还留在各自的工作区文件夹里。

## 遇到问题

- **输入 `/` 后找不到这个技能。** 到插件页确认插件已经打开，再新开一个会话。
- **Agent 的做法和插件说的不一样。** 如果工作区里有同名技能的副本（在 `.agents/skills/` 或 `.dsh/skills/` 下），Agent 会用那一份，而不是插件里的。
- **安装失败。** 对照上面表格的"npm 包名"一列检查插件名。安装对话框里会显示错误，以及应用问过哪个源；npm 和 npmmirror 都连不上时，检查网络或代理。从文件夹安装的，检查路径是不是完整的（以 `/` 开头，Windows 上以盘符开头），是不是指向插件自己的文件夹，也就是里面有 `package.json` 的那个。
- **「发现」读不到索引。** 在「发现」里打开市场菜单，选 **Manage index sources…**（管理索引源…），地址下面会写原因。索引放在 GitHub Pages（`github.io`）上，你的网络连不上的话，就改用插件名添加。
- **侧栏没有「作品」，或者 Claude 作品显示「未运行」。** 如果插件是从文件夹添加的，把 `dsh-claude-artifacts` 文件夹也添加上，再重启应用。在这之前技能照常能用，只是由 Agent 自己等评论。
- **提示插件已经安装。** 要重新安装，先卸载。更新不用卸载，见[更新](#更新)。
- **一直没有更新提示。** 新版本发布到 npm 之后，应用要下次打开或 6 小时内才会查到；连不上 npm 和 npmmirror 时查不到。从文件夹安装的插件不会提示。
- **链接打不开，或者没有 Send to Agent。** 比如重启应用或更新插件以后就会这样。让 Agent 再打开一次编辑器，或者在「作品」里点它，编辑器和等评论都会重新启动。
- **「作品」里找不到做过的东西。** 这里只列装上插件（加了「作品」的那一版起）以后 Agent 打开过的，挪走或删掉的文件夹不列。让 Agent 打开它一次，就会出现。

每个插件的文件夹里还有它自己的 README，介绍里面有什么。
