# Safari Dark Reader (Tampermonkey)

[简体中文](#安装) | [Technical notes](docs/ARCHITECTURE.md)

A **Safari-first** Tampermonkey userscript powered by the upstream [Dark Reader](https://github.com/darkreader/darkreader) rendering engine. It adds a small, accessible floating control and **per-site Auto / On / Off** preferences without reimplementing the entire CSS engine.

> Project version: **2.0.1** (pre-release pending Safari + Tampermonkey acceptance testing). Upstream runtime: `darkreader@4.9.135` pinned. Not affiliated with the official Dark Reader extension or its maintainers.

## 安装

1. 在 macOS Safari 中安装并启用 [Tampermonkey for Safari](https://www.tampermonkey.net/index.php?browser=safari)。
2. 打开 [`safari-dark-reader.user.js`](https://github.com/1998x-stack/dark-reader/raw/main/safari-dark-reader.user.js) 以安装。如果 Safari 下载而不是打开脚本，进入 Tampermonkey → 新建脚本 → 粘贴原始内容 → 保存。
3. 在 Safari 设置 → 扩展中为需要使用的站点允许 Tampermonkey 访问。重载页面。
4. 首次使用默认 **开启（On）** 深色模式，即使 macOS 是浅色外观也会立即启用；已保存的网站模式不变。左下角按钮循环切换 **自动 → 开启 → 关闭**。齿轮按钮打开站点模式和亮度 / 对比度 / 暖色调设置。

### 快捷键

- `⌘ ⇧ B`：快速在启用与关闭之间切换（与部分浏览器的书签栏快捷键可能冲突，Safari 未必会把按键事件交给网页）。
- `⌥ ⇧ D`：循环自动 / 开启 / 关闭；浏览器未接收到快捷键时始终可使用左下角浮动按钮。
- 在输入框、文本域和可编辑内容中不拦截快捷键。

### 行为说明

- **Auto**：仅当系统处于深色外观且页面未识别为原生深色主题时开启。
- **On（默认）**：不依赖系统外观，直接启用 Dark Reader，包括原生深色网页（若出现双重变暗，请改回 Auto）。
- **Off**：保持网站原样。
- 首次访问或站点偏好缺失 / 无效时默认 **On**；已保存的 Auto / On / Off 选择保持原样。模式按 **精确主机名** 保存；色彩滑块为跨站全局偏好，存储在 Tampermonkey 的 GM 存储中。仅在缺少 GM API 时降级为站点 `localStorage`。
- 默认跳过 Docs / Sheets / Slides / Maps / Figma / Canva / Miro 等高风险画布和编辑器站点。`@noframes` 跳过 iframe。
- 默认不收集统计数据，没有后台服务器。**不过运行时会从第三方 CDN 下载被钉住版本的 Dark Reader 库**，并且 Dark Reader 在处理 CSS 时可能按浏览器权限请求样式资源。请不要把这理解成完全离线软件。

### Safari 完全没有变暗：按顺序检查

1. **网页授权**：Safari → 设置 → 扩展 → Tampermonkey，确认扩展已启用；在 Safari 的 Tampermonkey 网站访问权限中选择“始终允许所有网站”，或针对测试站点选择“始终允许”。仅在 Tampermonkey 面板中打开脚本**不代表** Safari 已允许它注入网页。
2. **确认脚本实际运行**：在普通网页（建议 `https://example.com/`）重新载入，检查左下角是否出现“☾ 开启”和齿轮控制。若两者都不存在，优先检查网站权限、Tampermonkey 的全局启用状态、脚本是否匹配当前域名，或 `@require` 依赖是否阻止了注入。
3. **确认版本及站点偏好**：在 Tampermonkey 的已安装脚本列表确认版本至少为 `2.0.1`，并确认脚本已启用。已有站点设置若保存为 `Auto`（macOS 浅色时通常不启用）或 `Off`，升级不会覆盖；在左下角设置中手动选 `On`，再刷新。
4. **确认外部依赖**：若左下角显示“加载失败”，或明明有按钮却显示“错误”，检查 `https://cdn.jsdelivr.net/npm/darkreader@4.9.135/darkreader.js` 是否可以访问；它是用户脚本安装/运行所依赖的外部库。也可在 Safari 的“开发 → 显示网页检查器 → 控制台”检查报错。无法访问 CDN 时，不应将按钮状态当作网页已经着色的证明。
5. **测试站点范围**：请用普通 `http://` / `https://` 页面测试。Safari 起始页、浏览器设置页、`file:` 页面与排除的 Google Docs/Sheets/Slides/Maps、Figma、Canva、Miro 等不在支持范围内。

**三种现象的含义**：无浮动按钮 → 脚本未成功执行或被站点排除；有按钮且显示“加载失败/错误” → 引擎初始化失败；有“☾ 开启”但页面仍然白色 → 需要进一步检查网站样式、注入隔离环境和控制台报错，不要直接假定实际转换成功。

### 其他故障排查

- **没出现按钮**：检查 Safari 扩展是否开启、站点授权是否允许、是否属于排除的编辑器域名、Tampermonkey 是否运行。`file:`, `about:`, `safari-extension:` 不匹配 HTTP(S) userscript。
- **显示“加载失败”**：检查 `@require` 所用 CDN 可访问性，重开脚本管理器，检查控制台；上游库没有成功加载时，本脚本不会假装已启用。
- **网页原本就是黑色**：Auto 可能会跳过；改为 On 可强制覆盖。原生主题检测是启发式，并非对所有 SPA 可靠。
- **页面颜色有问题**：先关停该站点、刷新，再带页面 URL、Safari/Tampermonkey 版本、截图与复现步骤提交 issue。关闭浏览器自身的 Adaptive Dark Mode 或其他同类扩展，避免重复转换。

## 架构与安全取舍

相比旧版逐元素 `getComputedStyle()` 扫描，本项目使用官方 Dark Reader 的 CSS 引擎来转换复杂样式，由一个非常薄的控制层处理热键、页面状态、GM 存储及浮动设置面板。

上游 `@require` 使用 **精确版本** `4.9.135`，避免跟随最新版本自动引入未经测试的 breaking change；但**未提供 SRI 哈希**，原因是本环境无法取得并独立验证原始 CDN 文件内容。生产环境更强的供应链控制应通过可信来源下载、核算 SHA-256 并在 `@require` 中附加 [Tampermonkey SRI](https://www.tampermonkey.net/documentation.php?ext=iikm&q=sri)。在此之前，请将 CDN 视为信任依赖。

详见 [设计说明](docs/ARCHITECTURE.md)、[测试计划](docs/TEST_PLAN.md)、[排错记录](docs/gotchas.md)、[更新记录](CHANGELOG.md)。

## 验证

```bash
node --check safari-dark-reader.user.js
python -m pip install playwright==1.57.0
python -m playwright install chromium webkit
REQUIRE_WEBKIT=1 python -m unittest discover -s tests -v
```

2026-11-09 最新 CI：**10 组 mock-API 控制逻辑测试通过（Chromium、WebKit）**，另外 **1 组真实 Dark Reader 4.9.135 转换测试通过（Chromium、WebKit）**，确认浅色网页的实际背景被转换为深色。**macOS Safari + Tampermonkey 扩展注入、用户站点 CDN 权限与真实网站端到端验证仍为 NOT RUN**。详见 [测试计划](docs/TEST_PLAN.md)，不要将 mock 测试误解为 Safari 生产兼容性证明。

## 许可证与归属

脚本控制层采用 MIT，详见 [LICENSE](LICENSE)。Dark Reader 项目与运行时属于其原作者，遵循其自身的 [MIT License](https://github.com/darkreader/darkreader/blob/main/LICENSE)。本仓库并非 Dark Reader 官方分支。
