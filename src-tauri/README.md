# TypeWords Windows 桌面端（开发与内部测试）

更新：2026-09-19。保留现有 Nuxt/Vue、IndexedDB 和 ZIP 数据格式，使用 Tauri 2 内嵌桌面静态 SPA。宿主只有一个本地窗口，没有自定义 command、通用原生网络代理或更新器；已接入 dialog、fs、opener 插件及内部 NSIS 构建，正式发布验收未完成。

**这是实验性开源 Windows 预览，不是正式公开发布。** 安装包是未签名的内部/实验性 Windows x64 NSIS。使用前先导出 ZIP 备份。不要把唯一真实学习数据迁进默认 identifier 目录。不要用旧 setup 覆盖较新安装，升级请走仓库里的 `scripts/invoke-setup.ps1`。Win10 实机、干净机、代码签名和默认个人 profile 均未验证。桌面端云同步延后。

**后续工作按[迁移计划](../docs/plans/tauri2-desktop-migration-plan.md)第5.1节 R1–R8执行。** 优先数据安全闭环、真实事务与原生验收，再冻结版本打包。计划/证据目录目前被 Git 忽略，干净检出可能没有这些本地文档。

## 当前身份与验收状态

2026-09-12 用户授权“按照主流来即可”后，首发确定为 Windows x64，主验收 Windows 11，最低兼容目标 Windows 10 22H2。正式 identifier 沿用 `io.github.zyronon.typewords`。Win10实机验证按用户要求暂缓，非通过；平台约定不等于兼容性通过。原生探测继续使用独立临时 WebView profile，不使用个人学习数据。

Windows 生产窗口配置使用 `http://tauri.localhost`（`useHttpsScheme: false`），没有自定义 `dataDirectory`。这两个配置与 identifier 一起影响持久化来源，首次原生数据验收后保持稳定。开发窗口使用 `http://127.0.0.1:5567`，它与生产窗口不是同一个存储来源；数据迁移使用 ZIP，不能用开发窗口数据是否出现判断生产持久化。

## 命令

在具备 Windows Rust MSVC、C++ Build Tools 和 WebView2 的 Windows shell 中，从仓库根目录运行。原生 `node_modules` 必须由该平台的 pnpm 安装，不能复用 WSL 的 Linux 原生依赖。

```powershell
pnpm install --frozen-lockfile
pnpm run test:desktop
# Independent tree + lockfile install + regression (does not reuse this checkout's node_modules).
pnpm run test:desktop:clean-install
# beforeDevCommand 自动启动既有桌面前端。
pnpm run desktop:dev
# 编译内嵌静态资源的可执行文件，不生成安装包。
pnpm run desktop:build
# 重建前端/EXE并生成未签名Windows x64 NSIS内部测试包。
pnpm run desktop:bundle:internal
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Web 仍用 `pnpm run dev` / `pnpm run build`。两种前端构建共用 `.nuxt` / `.output`，保持串行。`desktop:build` 在编译前自动运行资源门禁和 `nuxt generate`；不要跳过这一步把 Web SSR 输出打进宿主。

以上是命令清单，不是一次性顺序执行脚本，`desktop:dev`会保持交互服务运行。打包输出路径以实际日志为准，显式target构建可能位于`target/x86_64-pc-windows-msvc/`。列出Rust检查命令不表示它们均在最新候选重跑。

第三十一批本地回归243/243，但部分测试读取被忽略的本地fixture/历史报告，干净检出可复现仍待修复。`pnpm run typecheck`最近结果仍为第三十批62条既有诊断及vue-router/volar导出问题，退出码2，不是通过。不得把历史证据文件校验称为本轮实时UI测试。

独立真实存储测试：`pnpm run test:desktop:idb`。需要可解析的 Playwright 和已安装的 Edge；也可用 `TYPEWORDS_PLAYWRIGHT_MODULE` 指向外部 Playwright 的 `index.mjs`，用 `TYPEWORDS_BROWSER_CHANNEL` 指定其他已安装的浏览器 channel。未将 Playwright 添加为项目依赖，不声明该命令已在干净 CI 环境复现。

该入口临时启动仅允许白名单测试文件的 loopback 服务，使用全新浏览器 context，阻止非本源网络请求；结束时关闭浏览器和服务并清理随机命名的测试数据库。四个场景验证真实 IndexedDB/idb-keyval 多键事务 abort、重开、缓存迁移、内存恢复与队列重试；词典/设置迁移器、store 方法和云客户端仍是替身，不替代完整 Pinia watcher、ZIP UI、quota 或原生 WebView 验收。测试音频只是合成 Blob 字节。

## 当前边界

- `app.security.capabilities` 显式选择 `main`；授权保存对话框、文件写入命令及限定HTTPS目标的opener。没有通用shell/原生HTTP权限。选择路径作用域与未授权请求拒绝仍须T09原生验收。
- 生产 CSP 允许本地脚本、随包资源、Blob 音频、有道/百度发音目标及`https://*.supabase.co`同步连接。开发 CSP 另外允许 Nuxt/Vite 的内联脚本、eval 和本地 WebSocket。CSP允许连接不证明服务权限或同步成功。
- Rust独立拒绝远程导航和新窗口，JS侧也校验外链；正常外链应进入系统浏览器，未信任页面不得装入有原生权限的窗口。完整T09仍未执行。
- 原生T01–T05已有部分输入、播放、路由和恢复证据；物理键盘/系统IME、英语实听、系统断网冷启动等仍待，不以旧证据或编译代替最新候选验收。
- 桌面同步仅接受托管Supabase域，真实数据安全模型/权限及真服务验收未完成；当前代码按type操作，不能把匿名开放测试表当作真实学习数据安全方案。自定义域不在本轮范围。
- 桌面在线查询API必须显式构建配置，默认禁用；百度开发代理不进入静态包。未配置同步时本地基础练习应可独立使用。
- 图标由仓库现有 `public/favicon.ico` 转换，未更换产品视觉资产。

第二十八批已重建release EXE，尚未启动原生验收。第二十三批旧0.1.0 NSIS不包含第二十四至二十八批修复；历史0.1.1只是升级测试overlay，不表示源码已升版。打包前统一版本和源码/前端/EXE/NSIS哈希，升级候选版本高于实际测试起点。

`tauri.internal.conf.json`是当前用户NSIS安装、禁止降级、`downloadBootstrapper`，不是完整WebView2离线安装包。缺运行时下载成功/失败、干净机及中文用户名仍待验证；已有运行时的离线运行另测。未签名包只称内部测试包。自动更新、其他OS、SQLite及完整离线TTS不属于本轮。

## 历史隔离原生探测（不代表当前全部状态）

第七批直接测试 Windows WebView2 生产资源协议，而非 Chrome 静态服务器。进程级环境变量指定新建临时 WebView profile，启动时核对父进程、实际 `--user-data-dir` 和调试端口；结束时正常关闭窗口并确认该 profile 的 WebView 进程及端口退出。正式配置没有加入调试端口或自定义数据目录。

已验证练习页重载、正常退出/重启后的词书/设置/缓存恢复，以及真实例句按钮的无音色/无目标语言结束提示。TTS 音色发现最多等待 1500ms；匹配请求语言，已明确保存的音色仍优先。没有英语音色的设备不宣称英语发音通过；人工听音、输入法、完整 20 词/5 句、开发窗口和安装器仍待验收。

脚本、实际 EXE 位置、测试数据目录、已知字体 CSP 问题与回退证据见 [第七批 VERIFICATION](../docs/plans/evidence/tauri2-native-smoke/VERIFICATION.txt)。

## 第八批：字体与网络失败（2026-09-12）

桌面构建不加载 Web 专用 Garamond `@font-face`，沿用 Garamond / Georgia / Times New Roman / serif 系统字体栈；Web 保留原远程字体声明。开发、生产 WebView 首页均实测没有远程字体请求或 font-src 违规，当前机器使用系统 Garamond / Noto Serif SC，不表示每台机器安装相同字体。CSP 字节未变。

单词网络播放捕获拒绝与同步异常，8 秒无播放进度后回退 TTS，进度前进时重置等待；结束、回退、取消清理事件与计时器。新 EXE 的20次网络阻断与实际媒体请求悬挂回退已验证，无英语声色时明确提示并继续手动练习。开发窗口通过 cargo dev-profile 宿主连接桌面 Nuxt 服务验证，尚未把该组合探测记成完整 `pnpm desktop:dev` 启动器验收。

旧 EXE 的20个唯一词键入与进程级离线重载证据保留版本边界。英语实听、物理输入法、完整断网冷启动、最低版本实机和完整开发/生产矩阵仍待完成。证据见 [第八批 VERIFICATION](../docs/plans/evidence/tauri2-font-offline/VERIFICATION.txt)。
