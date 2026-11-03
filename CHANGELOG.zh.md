# 更新日志

[English](./CHANGELOG.md) | 中文

本文档记录 `baoyu-design` 的重要变更。

## 2.8.0 - 2026-11-02

### 新功能
- **Motion 正式发布。** `claude-motion` 用来做动画影片：Agent 把每一场写成代码，存进影片的文件夹，你在本地播放器里看着它写出来。然后可以改台词、拖动场景长度、在 **Tweaks** 里换样式、在某个时刻留评论发给 Agent、分享到局域网、在 History 里回看。从播放器导出 MP4 或 GIF，也可以在命令行用 `export`（要有 Chrome，不用开页面）。
- 带旁白的长片：最长 900 秒、40 场，有一条每场一段配音的配音轨。`voice` 用你自己的语音服务生成配音（`voice --providers` 列出哪些可用），`--take` / `--takes` 用别处做好的配音，`align`、`sync`、`beats` 让场景和动作对上台词。字幕跟着配音走，中日韩文字会正确断行，`captions` 或 `export --captions` 写出字幕文件。Tweaks 面板的 **Script** 标签可以改台词，配音轨上画出每段配音的波形。
- 声音和素材：`score` 报告影片放了什么、响度多少，`S.bed` 在影片底下铺一段录好的配乐，`music` 测量一段音乐，`arrange` 把它剪成影片的长度，`export --audio-only` 几秒钟就渲染出混音。`record` 把你自己产品的页面拍成素材（要 ffmpeg），`stills` 取指定时刻的画面，`import-explainer` 把讲解视频项目转成影片。
- **`motion-director`** 是新技能，给有话要说的影片当导演：找到要说的那一点和撑得起它的画面，写适合听的旁白，配音，让每一场对上台词，像观众那样检查画面，最后在播放器里交片。要和 `claude-motion` 装在一起。
- DeepSeek Harness：新插件 `dsh-claude-motion`。评论和播放器的 **Continue**、**Finalize**、**Make the animation**、**Ask Agent** 按钮都能送到 Agent，影片也列在 **Artifacts** 页上。
- 同一类型打开的 artifact 现在共用一个服务器和端口，不再各占一个端口。每个页面有自己的地址，比如 `http://127.0.0.1:4710/slides/<id>/`，重新启动后地址不变。服务器根路径列出正在打开的内容，最后一个关掉后服务器退出。分享仍然按 artifact 算，分享链接也加上了同样的路径，所以旧版本的链接会失效。

### 修复
- `share <root> --disable`、`--enable`、`--reset`、`--role` 不再把页面开放到局域网。以前分享关着时它们会把它打开，所以刚 `--off` 又停用链接，页面就又回到了网络上。现在只有不带选项的 `share <root>` 才会开放；服务器没在运行时，这些选项只改链接，不启动服务器。

## 2.7.2 - 2026-11-02

### 新功能
- 幻灯片和设计稿：已安装的设计系统落后于它的源系统时，现在会提示，也能重新同步。**Theme** 标签显示 `Behind its source: N files changed` 和 **Sync** 按钮（主人才有），点了以后打开的页面立刻更新。命令行用 `artifact.mjs ds-sync <root> [<folder>] [--check]` 做同样的事，`check` 也会提示落后的拷贝。源系统新增的文件不会复制，它删掉的文件仍留在拷贝里（[#26](https://github.com/JimLiu/baoyu-design/issues/26)）。
- 用相对路径记录的源系统，会依次从工作目录、artifact 所在目录和它上面的各级目录查找，所以从别的目录重新打开的编辑器（比如 DeepSeek Harness 的 **Artifacts** 页）也能比较。找不到源系统时，Theme 标签会说明。

## 2.7.1 - 2026-11-02

### 修复
- DeepSeek Harness：**Artifacts** 页和评论等待不再取决于 agent 怎么写命令。通过 shell 变量（`"$SKILL/scripts/artifact.mjs" open …`）、`cd` 之后，或用工作区 `.agents/skills/`、`.dsh/skills/` 里的技能副本执行的 `open`，现在都会登记并启动评论等待。以前这几种写法都不行：卡片不出现，**Send to Agent** 发的评论也悄悄送不到 agent（[#27](https://github.com/JimLiu/baoyu-design/issues/27)）。
- 对已经在运行的编辑器再跑一次 `open`，也会像第一次那样打印 `log` 和 `stop`。

## 2.7.0 - 2026-11-02

### 新功能
- Share 面板多了 **Export** 页。页面能下载成什么，都列在这里，每行有图标和说明（幻灯片：PDF、HTML、PNG、PPTX；设计稿：Standalone 页面等），最后是主人才有的 **Whole folder (.zip)**。设计系统和 dashboard 原来本地没有下载按钮，现在也在这里下载。
- 每个编辑器都能把整个 artifact 文件夹下载成 zip，命令行是 `archive <root> [--out file.zip|dir]`。zip 里不含编辑器自己的状态、日志、分享文件、`exports/`、临时文件和符号链接。
- 幻灯片和设计稿：**Theme** 标签页链接到当前所用设计系统的只读页面，有按主题分的颜色、文字样式、其他 token、组件和指南。页面不运行脚本，也不读符号链接指向的文件。
- 画布导出的独立 HTML 能跟随画板之间的链接：相对路径的 `<a href="B.dc.html">` 会在同一个画框里打开目标页面，Back 可以返回（[#25](https://github.com/JimLiu/baoyu-design/issues/25)）。
- 幻灯片的 HTML、PPTX 导出和设计稿的 Standalone 页面会带上用到的字体。名单里无法确认授权的字体照样带上，并提示你自己确认许可，已知许可页时文件里会附上它的地址。按 unicode-range 切成多块的字体，PPTX 里嵌入一个子集文件；字体体积上限从 4 MiB 提到 16 MiB。
- **Copy link** 现在给的是局域网里别人能打开的地址，复制时顺便把页面共享到网络上。访客可以转发页面，但不能导出：没有 Export 页、没有文件夹 zip、不能下载。
- 编辑器第一次打开一个项目时，会写一份默认的 `.gitignore`（状态、日志、分享文件、`history/`、临时文件），已有的不动。每个 `SKILL.md` 增加了「放进 git 管理」一节（[#24](https://github.com/JimLiu/baoyu-design/issues/24)）。
- Share：Tailscale 地址不再当作主链接，而是单独给一条，面板和 `share` 都说明它是明文 http、拿到链接就有权限。
- DeepSeek Harness：左侧栏多了 **Artifacts** 页，列出 agent 打开过编辑器的所有文件夹，卡片按类型着色，有分类标签页和搜索。点一张卡片会打开它所在的对话，并在那个对话的 Browser 里打开编辑器。所有插件共用这一个入口。
- DeepSeek Harness：下载能存下来了。它的浏览器会丢掉所有下载，现在导出文件和文件夹 zip 都存进项目的 `exports/`（不覆盖已有的文件），提示里写明路径。
- Artifacts 侧栏图标改成两张叠在一起的卡片，和 claude.ai 一致。

### 修复
- `claude-slides`：下载对话框里选 **PDF** 会让整个页面崩溃，页面不崩以后 Download 按钮又没反应。现在都正常。
- 保存时没带上自己起始版本的写入，如果别人在这期间存过同一个文件，现在会被拒绝并提示冲突，不再悄悄覆盖。
- `claude-dashboard`：两个页面几乎同时创建同一份文档时，后一个不再把前一个覆盖掉，两边的字段合并，两边设了不同值的字段记进 History。
- DeepSeek Harness：agent 在同一个 shell 调用里先跑了别的脚本命令再 `open` 时，评论等待照样启动，artifact 也会被记录。

### 文档
- README 和各 `SKILL.md` 说明了 Export 页、文件夹 zip、Theme 页的设计系统页面，以及放进 git 管理。

## 2.6.1 - 2026-11-01

### 修复
- `claude-dashboard`：你正在编辑页面时别人先存了，页面提示 "This dashboard changed. Save to overwrite that change"，你再点 **Save**，现在算你自己选的覆盖，和幻灯片里的**保留我的**一样。History 里这一版标 "Saved over <名字>'s change"，对方收到的提醒说你保存时盖掉了他的修改（不再是"紧接着也改了"那种），你自己不收提醒。改的是不同的行照旧合并、两边都留；**找回**也照旧只找回被换掉的那几行。

## 2.6.0 - 2026-11-01

### 新功能
- `claude-slides`、`claude-design`、`claude-design-system` 和 `claude-dashboard` 有了版本历史：每一次修改都存成一个版本，放在项目的 `history/` 文件夹里，记着是谁改的（访客按他加入时填的名字，主人，或者 **Agent**，指直接改这台电脑上的文件）。Share 旁边的 **History** 按钮按天列出所有版本；点开一个版本能逐行看它改了什么，预览当时的整体样子，或者把整个版本（也可以只挑其中一处）恢复成一个新版本。
- 一个人的保存盖掉了另一个人的修改时，这个版本会记下它覆盖了谁，被盖的人会收到提醒，可以**看看差别**、一键**找回**。找回的只是被盖掉的那部分，对方别处的修改照样留着。
- 谁在这儿：别人开着同一个页面时，他们的头像排在 History 旁边。在幻灯片和画布编辑器里，能看到每个人在第几页、哪块画板、是不是正在改，页面上也有他们的光标和选中框；有人开始改你正在看的地方，会弹一句提醒。什么都不会锁住。Agent 改了文件之后，也会在这一排里出现一会儿。
- 在幻灯片、设计稿和设计系统编辑器里，别人保存后你的页面就地更新，不再整页刷新。
- 两个人改同一页、同一块画板或同一个文件：先合并，画布按元素，幻灯片和设计系统的文件按行（token 文件按 token），改的是不同的元素或不同的行，两边都留着。合不了（比如改到同一行）才出一条提示，让你选用他的、保留你的，还是两份都留。
- `claude-dashboard`：页面写入时和别人这期间存的内容合并，按字段合，页面文件按行合；只有改到同一个值才发提醒。编辑页面时，保存以草稿开始时的那一版为准。
- Agent 统一叫 **Agent**，用机器人头像：History、头像一排和评论按钮（**Send to Agent**）里都是。

### 修复
- 开着 TUN 模式代理时 `open` 能用了：代理的网卡在每个端口上都有应答，`open` 以前会报 `PORT_IN_USE`；分享链接里也不再列出那块网卡的地址（[#23](https://github.com/JimLiu/baoyu-design/issues/23)）。
- `comments --wait --timeout` 不会再随机以 `SERVER_GONE`（"The value of \"delay\" is out of range"）退出。
- DeepSeek Harness 插件：Agent 通过 shell 变量运行 `open` 时，也会开始等待评论；Agent 还在干活时发来的评论，等这一轮做完再交给它，不会中途插进来。

### 文档
- 每个编辑器的 `SKILL.md` 都加了 History 一节：版本存在哪里、提醒是什么意思、有人问谁改了什么时怎么读 `history/index.json`。README 介绍了版本历史、覆盖提醒、谁在这儿和合并。

## 2.5.0 - 2026-10-31

### 新功能
- 局域网分享：`claude-slides`、`claude-design`、`claude-design-system` 和 `claude-dashboard` 可以把项目开放到同一个 Wi‑Fi 或内网。`share <root>`（或 `open <root> --lan`）给每种角色打印一个链接：`editor` 能改也能评论，`commenter` 只能评论，`viewer` 只能看。拿到链接的人输个名字就能进来；一个人保存，其他打开的页面马上跟着变，每条评论记在写它的人名下。DeepSeek Harness 插件也一样带上了。
- 坐在这台电脑前的主人有一个仿照 claude.ai 分享对话框的 **Share** 按钮：谁加入了、谁在线，每个人的角色菜单和移除，访问范围（只有这台电脑，或网络里拿到链接的人），每个链接的复制、关闭和重置。命令行里也能做：`share <root> --disable <角色>`、`--enable <角色>`、`--reset <角色>`、`--role <访客>=<角色>`、`--off`。
- 访客也有 Share 按钮：里面是他可以转发的链接（自己这一级和更低的角色），以及复制当前页面地址的 Copy link，只有有权限的人打得开，其他人看到 "No access" 页。
- 角色处处生效：commenter 和 viewer 看到的是编辑器的只读模式，viewer 只能看评论，只有作者能改自己的消息，只有主人能把评论发给 Agent。仪表盘上主人和 editor 能写数据，commenter 和 viewer 什么都写不了，连自己的 `data/users` 也不行。
- 每个技能的服务器有自己的端口：slides 4710、design 4720、design system 4730、dashboard 4740，被占用时顺延到下一个空闲端口。`--port n` 从 n 开始找，`--port 0` 随便取一个空闲端口。
- `claude-design-system`：评论和 Share 放在页面顶部的一条栏里，和 claude.ai 的 artifact 页头一样。
- `claude-dashboard`：页面的地址是 `/dashboard/<id>/`，重启后不变，开着的旧标签页不会显示后来占了这个端口的别的文件夹。
- Share 按钮跟着所在工具栏的样式走，浅色和深色模式都一样。

### 文档
- 每个编辑器的 `SKILL.md` 都加了 Sharing 一节。README 介绍了局域网分享，并把仪表盘页面列进支持评论的页面。

## 2.4.1 - 2026-10-31

### 新功能
- `claude-dashboard`：可以给图表、数字、表格或页面上任何地方加评论，勾 **Send to agent** 发给 Agent。新增 `comments`、`comment-reply`、`comment-resolve` 命令；`comments --wait` 会输出页面地址和标题。`dsh-claude-dashboard` 插件会等评论，发出的评论以卡片形式出现在对话里。
- `claude-slides`、`claude-design`、`claude-design-system`：单独打开的页面上，评论按钮放到右上角的工具栏里。
- 编辑器换上 claude.ai 现在的图标。
- DeepSeek Harness：给「发现」页提供插件市场索引，地址是 `https://jimliu.github.io/baoyu-design/dsh-plugins/index.json`，每次发版后自动重新生成。

### 修复
- `claude-dashboard`：编辑器和其他编辑器一样，在 `scripts/editor/third-party-licenses.txt` 里带上所用开源包的许可。

### 文档
- 新增 `NOTICE.md`，写明各部分的许可：MIT 只管维护者自己写的部分；取自 Anthropic 的内容（改编自 Artifact 类型的技能说明和参考文档、`dataviz`、从 claude.ai 还原的编辑器、Anthropicons 图标字体，以及 `archive/` 里的 Claude Design 系统提示词、内置技能和起步组件）权利归 Anthropic，不适用 MIT；归档的 `frontend-design` 技能是 Apache 2.0，许可全文放在它旁边；开源代码各按原许可。`LICENSE`、README 和每个 `SKILL.md` 都指向它，DeepSeek Harness 插件也带上了它（`"license": "SEE LICENSE IN LICENSE"`）。
- README 补上从 npm 和从「发现」安装 DeepSeek Harness 插件的说明。

## 2.4.0 - 2026-10-30

### 新功能
- 四个编辑器的 DeepSeek Harness 插件发布到 npm：`dsh-claude-slides`、`dsh-claude-design`、`dsh-claude-design-system` 和 `dsh-claude-dashboard`。在应用里打开 **Plugins** → **Add plugin**，填插件名就能装。每个插件带着本仓库发布的那份技能和预先构建好的编辑器；插件文件夹也在 `dsh-plugins/` 里。
- DeepSeek Harness 插件里，Agent 每次打开编辑器，插件都会开始等评论，所以对话空闲时勾 **Send to agent** 也能叫醒 Agent。发给 Agent 的评论会以卡片的形式出现在对话里，点卡片上的 **View thread** 会在编辑器里打开这条评论。
- 评论：评论发给 Agent 以后，会自动打开这条评论，显示 "Working…"，直到 Agent 回复。编辑器地址里加 `?comment=<id>` 会打开那条评论；`comments --wait` 也会输出编辑器地址和作品标题。
- 评论：All comments 面板里，鼠标移到一条评论上会出现"解决"按钮和更多菜单（编辑、重新打开、删除整条评论），选中的那条一直显示；编辑和删除确认都在这一行里展开。在面板菜单里按 Escape 只关菜单。

### 文档
- `dsh-plugins/README.zh-CN.md`：按插件名安装、使用、更新、卸载和常见问题。

### 维护
- 打版本 tag 时，由 GitHub Actions 把 DeepSeek Harness 插件发布到 npm。

## 2.3.0 - 2026-10-30

### 变更
- 归档 `baoyu-design` 技能：从 `skills/` 移到 `archive/baoyu-design/`，`skills` CLI 不再安装它。README 改为只介绍四个 artifact 技能和 `dataviz`。

### 修复
- `claude-slides`：补齐 2026-10-29 版编辑器的其余部分，包括 YouTube 以外的视频嵌入、Present 菜单、手机横屏提示和底部工具栏；按钮和菜单的间距恢复正常。
- `claude-design-system`：加入新的控件（二维取色器、分段控件、属性行、数字输入框）；删除确认框可以再次打开。
- `claude-dashboard`：同步 2026-10-29 版页面界面和提示文字，并支持在单写入者页面上手动编辑页面（Edit the page，Beta）。
- 评论：修复从右到左页面里的提示位置，以及危险菜单项的高亮。

### 文档
- 更新 README 中的编辑器截图。

## 2.1.0 - 2026-10-30

### 新功能
- `claude-slides`、`claude-design` 和 `claude-design-system`：可以在编辑器里对元素或区域留下评论，评论连同对应文件和位置保存在本地；Agent 可以读取、回复、解决和重新打开评论。Agent 等待评论时，编辑器会显示 **Send to agent** 复选框，让你把评论交给它处理。
- 新增 `dataviz` 图表设计技能，适用于各种输出载体，涵盖图表形式、配色、图形标记、图例、无障碍和交互，并附带 JavaScript 和 Python 配色校验脚本。
- 四类 artifact 编辑器同步到 2026-10-29 的上游版本，包括设计画布的 Theme 面板、从代码同步的只读设计系统，以及更新的字体和图标资源。
- `claude-slides`：单独打开幻灯片页面时提供更多导出格式；PowerPoint 导出会嵌入链接的 Google Fonts，并在页面中解码 WOFF2 字体。

### 修复
- 编辑器服务遇到端口被占用时会报错退出，不再一直挂起。

### 变更
- Artifact 工具和编辑器均以预构建文件提供，移除单独的 `tools/artifact-skills/` 构建工具。
- `claude-dashboard` 与其他 artifact 服务共用服务状态和 HTTP 辅助代码。

### 文档
- 四类 artifact 技能和参考文档同步到 2026-10-29 的上游说明，涵盖设计系统设置、幻灯片链接、画布便签和仪表盘数据工作流。
- 中英文 README 按技能重新组织，补充编辑器截图、更新后的示例、dataviz 和评论用法；中文 README 加入演示视频。

## 2.0.3 - 2026-10-29

### 修复
- `claude-design`：页面旁边的手机版画板现在做成 390×844 的手机屏，内容在框里滚动，全屏 Fit 时按原尺寸显示，和手机上一样。之前它的高度等于整页长度，Fit 会把它缩成一条细线。

## 2.0.2 - 2026-10-28

### 修复
- `claude-dashboard`：仪表盘里的数字、日期和状态提示跟随用户的语言（中文用万/亿、`10月1日`、`加载失败`）；标题不是拉丁字母时，文件夹取一个简短的英文名。
- `claude-dashboard`：不是 ISO 格式的日期（比如 X 数据导出里的 `Thu, Oct 29, 2026`）用 `d3.utcParse` 按 UTC 解析，不用 `new Date()`，它在 UTC 以东的时区会显示成前一天。
- `claude-dashboard`：通过 shell heredoc 传批量写入时，结束标记要加引号（`<<'EOF'`）；不加的话，shell 会把 `{"$file": …}` 里的 `$file` 展开掉。

## 2.0.1 - 2026-10-28

### 修复
- `claude-design-system`：从组件库导入的设计系统现在带可交互的组件预览，不再只有说明文档或手绘的静态卡片。agent 会收录全部导出组件，安装 npm 上已发布的包（加 `--ignore-scripts`，不运行仓库里的任何代码）并打包；仓库自己的构建只用于未发布的包，静态预览只作为标明了的备选。
- `claude-design-system`：说明需要 React 19 的库怎么处理（打成 `components/lib/react.js` 和 `react-dom.js` 并登记到 `libraries`），以及 Typekit 等 Google Fonts 以外的字体在预览里会改用回退字体。
- `baoyu-design`：导入设计系统时，读取或复制的每个路径都限定在设计系统文件夹和项目之内；指向外面的 `@import`、清单条目或符号链接会被跳过并报告 (#16)。

## 2.0.0 - 2026-10-28

### 新功能
- 新增四个 skill，把 claude.ai 的 Artifact 类型带到本地 agent：`claude-slides`（幻灯片）、`claude-design`（多画板画布）、`claude-design-system`（设计系统）和 `claude-dashboard`（数据看板）。每个 `SKILL.md` 保留该类型的原始说明，只把 Artifact 工具调用换成本地的 `scripts/artifact.mjs`（Node 20+，看板需 Node 22+，无需安装依赖）。
- 每个 skill 自带预构建的编辑器（`scripts/editor/`），并各自起一个本地服务：agent 写入的文件会立刻显示在编辑器里，在编辑器里的修改也会存回同一批文件，你和 agent 可以轮流改。
- 幻灯片和画布可以安装用 `claude-design-system` 做的设计系统，之后编辑器的主题和颜色菜单会提供它的颜色和文字样式。
- `claude-design` 编辑器右上角工具栏新增「Export」按钮，可把整份设计导出为独立 HTML 网页、PDF 或 PNG 图片。导出 PDF 和 PNG 前先选要包含的画板；PNG 支持 1× 或 2×，多个画板打包成 .zip 下载。
- 新增 `tools/artifact-skills/`，用于重新构建预构建的编辑器。

### 变更
- `baoyu-design` 只在任务真正要创建或修改视觉交付物时触发；架构或协议分析、渲染引擎或后端实现、技术类 Markdown 本身不再触发它。

### 文档
- 中英文 README 介绍四个 artifact skill、它们的 `artifact.mjs` 命令，以及 `claude-design` 的导出功能。

## 1.3.0 - 2026-09-23

### 新功能
- 同步 9 月 14 日版 Claude Design：新增 `watercolor-kit` 起步组件，用代码生成可复现的水彩画，并能逐笔回放绘制过程；`animations-v3` 同步加入水彩组件，用于有手绘质感的动画片段；宿主没有绘画工具时也有可移植的本地方案。
- 合入上游关于 GitHub 同步记录、文字最低对比度和流式布局的设计规则；导出 PDF 时会重新读取设计文件生成打印副本，并可记录来源版本。

### 修复
- 设计画布的滚轮缩放更平缓：每格从约 20% 降到 10%，并按一次滚动整体判断是缩放还是平移，触控板或 Magic Mouse 的惯性滚动不会再在平移途中把画布猛地放大。
- `doc-page` 的 fit 模式内容打印时保持在同一页，不再溢出到第二页。
- 导入设计系统时拒绝绝对路径的资源，修复路径穿越问题 (by @anupamme)

### 变更
- 参数面板发送的聊天内容会区分建议、自由输入和请求新点子，建议栏每次会话只上报一次曝光。
- 设计画布的本地补丁与 deck-stage 补丁一样单独记录，上游同步后可重新应用，并有测试守护。

### 文档
- 中英文起步组件介绍加入水彩绘画运行时。

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
