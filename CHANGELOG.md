# TypeWords 修改记录

## 2026-02-28

---

### 一、将缓存从浏览器本地迁移到服务器

#### 背景

项目原有一套服务器同步基础设施（API 端点、用户认证系统），但被 `IS_OFFICIAL` 标志强制禁用，导致所有同步逻辑从未生效。同时，所有用户数据（词书、设置、练习进度）仅存储在浏览器的 IndexedDB 和 localStorage 中，清理浏览器缓存后数据全部丢失。

#### 修改文件

**`apps/nuxt/app/config/env.ts`**
- 将 `CAN_REQUEST = IS_LOGIN && IS_OFFICIAL` 改为 `CAN_REQUEST = IS_LOGIN`
- 去除 `IS_OFFICIAL` 限制，用户登录后即可使用服务器同步

**`apps/nuxt/app/stores/user.ts`**
- `setToken()` 方法中同步更新 `CAN_REQUEST = IS_LOGIN`，与 env.ts 保持一致

**`apps/nuxt/app/apis/index.ts`**
- 新增 5 个 API 函数，对接外部后端的新接口：
  - `syncDictList(data)` → POST `dict/syncDictList`：推送完整词书数据（含单词列表）
  - `syncPracticeWordCache(data)` → POST `dict/syncPracticeWord`：推送单词练习进度
  - `getPracticeWordCacheApi()` → GET `dict/getPracticeWord`：拉取单词练习进度
  - `syncPracticeArticleCache(data)` → POST `dict/syncPracticeArticle`：推送文章练习进度
  - `getPracticeArticleCacheApi()` → GET `dict/getPracticeArticle`：拉取文章练习进度

**`apps/nuxt/app/composables/useInit.ts`**
- base store watcher 中新增防抖 2s 的 `syncDictList()` 推送（词书变更同步到外部服务器）
- `init()` 中新增：登录后从外部服务器拉取练习缓存，预写入 localStorage

**`apps/nuxt/app/utils/cache.ts`**
- `setPracticeWordCache()` / `setPracticeArticleCache()`：登录后额外调用外部服务器同步接口

#### 外部后端需配套实现的接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `dict/syncDictList` | POST | 接收完整词书数据（含单词列表），按用户保存 |
| `dict/syncPracticeWord` | POST | 保存单词练习进度，body 为 null 时清空 |
| `dict/getPracticeWord` | GET | 返回该用户最新单词练习进度 |
| `dict/syncPracticeArticle` | POST | 保存文章练习进度，body 为 null 时清空 |
| `dict/getPracticeArticle` | GET | 返回该用户最新文章练习进度 |

已有接口（无需改动）：`dict/myDictList`、`dict/syncSetting`、`dict/getSetting`

#### 数据流（登录后）

```
用户登录 → CAN_REQUEST = true
  ↓
store.init()        → myDictList()    拉取词书+进度
settingStore.init() → getSetting()    拉取设置
init()              → getPractice*()  预写 localStorage
  ↓
用户操作时：
  修改设置 → watch → syncSetting()           推送到外部服务器
  修改词书 → watch → syncDictList()（防抖2s） 推送到外部服务器
  练习保存 → setPracticeWordCache()           localStorage + 外部服务器
```

---

### 二、本地持久化存储（数据不随浏览器缓存消失）

#### 背景

用户在本地部署时创建的个人词典，在清理浏览器缓存后丢失。根本原因：项目以 SSG（静态生成）模式部署，无服务端运行时，所有数据只能存在浏览器。

#### 解决方案

切换为 **SSR（服务端渲染）** 模式，利用 Nuxt/Nitro 内置文件系统存储，将数据持久化到服务器磁盘，不受浏览器缓存影响。

#### 新建文件

**`apps/nuxt/server/api/storage/[key].get.ts`**
```typescript
// GET /api/storage/:key
// 从本地文件系统读取存储数据
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  const storage = useStorage('localdata')
  const data = await storage.getItem<string>(key)
  return { success: true, data: data ?? null }
})
```

**`apps/nuxt/server/api/storage/[key].post.ts`**
```typescript
// POST /api/storage/:key
// 向本地文件系统写入存储数据
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  const body = await readBody(event)
  const storage = useStorage('localdata')
  if (body.data === null) await storage.removeItem(key)
  else await storage.setItem(key, body.data)
  return { success: true }
})
```

#### 修改文件

**`apps/nuxt/nuxt.config.ts`**
- 新增 `nitro.storage.localdata` 配置：使用 `fs` 驱动，数据目录默认 `./localdata`，可通过环境变量 `STORAGE_PATH` 自定义

**`apps/nuxt/app/composables/useInit.ts`**
- 新增 `localGet()` / `localSet()` 工具函数：调用 `/api/storage/:key` 进行本地服务器读写
- 新增 `hydrateFromLocalServer()` 函数：启动时从本地服务器恢复 dict、setting、practice cache，写入 IndexedDB/localStorage
- `init()` 改为并行执行 `userStore.init()` 与 `hydrateFromLocalServer()`
- base store watcher 新增防抖 1s 的本地服务器保存（独立于外部服务器同步）
- setting watcher 新增即时本地服务器保存

**`apps/nuxt/app/utils/cache.ts`**
- `setPracticeWordCache()` / `setPracticeArticleCache()`：额外调用 `fetch('/api/storage/:key')` 将练习缓存写入本地服务器

**`Dockerfile`**
- 构建阶段：`nuxt generate`（SSG）→ `nuxt build`（SSR）
- 运行阶段：nginx → Node.js 20-alpine
- CMD 改为：`node /app/.output/server/index.mjs`

**`docker-compose.yml`**
- 端口映射：`3000:80` → `3000:3000`（nginx 改为 Node.js）
- 新增 `STORAGE_PATH=/app/localdata` 环境变量
- 新增 `typewords-data` 数据卷，挂载到 `/app/localdata`（容器重建后数据不丢失）

#### 数据流（本地部署，无需登录）

```
用户清除浏览器缓存后重新访问
  ↓
hydrateFromLocalServer()
  ├── GET /api/storage/typing-word-dict    → set(IndexedDB)
  ├── GET /api/storage/typing-word-setting → set(IndexedDB)
  ├── GET /api/storage/PracticeSaveWord    → localStorage.setItem()
  └── GET /api/storage/PracticeSaveArticle → localStorage.setItem()
  ↓
store.init() / settingStore.init() 从 IndexedDB 读取（数据已恢复）
  ↓
所有词典、设置、练习进度恢复正常

用户操作时：
  修改词典 → watch → IndexedDB + POST /api/storage/typing-word-dict（防抖1s）
  修改设置 → watch → IndexedDB + POST /api/storage/typing-word-setting（即时）
  练习保存 → setPracticeWordCache() → localStorage + POST /api/storage/PracticeSaveWord
```

#### 本地运行方式

```bash
# 开发模式（数据存 ./localdata/）
pnpm install
pnpm run dev   # http://localhost:5567

# Docker 部署（数据存 Docker 卷，重建容器不丢失）
docker-compose up --build   # http://localhost:3000
```

---

## 涉及文件汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/nuxt/app/config/env.ts` | 修改 | 去除 `IS_OFFICIAL` 限制 |
| `apps/nuxt/app/stores/user.ts` | 修改 | setToken 同步 CAN_REQUEST |
| `apps/nuxt/app/apis/index.ts` | 修改 | 新增 5 个外部服务器 API 函数 |
| `apps/nuxt/app/composables/useInit.ts` | 修改 | 本地服务器数据恢复 + watcher 持久化 |
| `apps/nuxt/app/utils/cache.ts` | 修改 | 练习缓存本地/外部服务器双写 |
| `apps/nuxt/server/api/storage/[key].get.ts` | 新建 | 本地存储 GET 路由 |
| `apps/nuxt/server/api/storage/[key].post.ts` | 新建 | 本地存储 POST 路由 |
| `apps/nuxt/nuxt.config.ts` | 修改 | Nitro 文件系统存储配置 |
| `Dockerfile` | 修改 | SSG → SSR，nginx → Node.js |
| `docker-compose.yml` | 修改 | 数据卷 + 端口 + 环境变量 |
