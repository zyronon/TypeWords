# 单词练习 v2 当前实现上下文

> 更新时间：2026-07-24  
> 适用范围：`Typewords/apps/nuxt` 的单词练习 v2、流程编排和相关例句组件  
> 文档定位：这是后续 Agent 冷启动时应优先阅读的“当前事实文档”。

历史设计、问题审计和阶段演进记录仍保留在 [`practice-words-v2-refactor.md`](./practice-words-v2-refactor.md)。如果历史计划与本文冲突，以本文描述的当前实现和用户确认的决策为准。

---

## 1. 冷启动摘要

TypeWords 的单词练习 v2 是一条与 v1 并行的实验/演进线路，核心目标是把 v1 页面中硬编码的阶段流转拆成可序列化流程：

```text
FlowConfig
  → validateFlowConfig
  → compileFlowConfig
  → ActiveFlowRegistry
  → Cursor + Navigator
  → 当前练习类型 / 词表 / 显隐策略
  → PracticeSaveWordV2
```

进入代码前先记住以下事实：

1. v1 仍然存在，正式入口 `/words` 仍进入 v1。
2. v2 的入口是 `/words-v2`，练习路由是 `/practice-words-v2/:id`。
3. v2 使用独立缓存 `PracticeSaveWordV2`，不与 v1 共用练习缓存。
4. 流程由 `nodes → steps → wordLoop subSteps/onEnd` 描述，运行位置由 `PracticeFlowCursor` 唯一标识。
5. 自定义流程保存在 `PracticeFlowV2`，支持多份配置和一个当前激活 ID。
6. `WordMetaPanelV2` 中保留例句输入是用户确认过的布局决策，不要擅自改回纯只读。
7. v2 继续复用 core 的 `event.ts` 键盘分发，这是用户确认过的决策。
8. `/practice-sentences/:id` 当前主要是验证 `TypingSentence` 可独立使用的实验页面，不是已正式交付的完整例句会话。
9. `collectWrongWords`、`generateReport` 和通用字符串 `navigate` 是预留 action；当前未完整实现是已知状态。
10. Phase 4 以职责拆分完成为准，文件行数目标不是当前阻塞项。

---

## 2. 用户已确认的产品与架构决策

以下内容已经由用户明确确认。除非用户提出新要求，后续 Agent 不应以“与旧计划不一致”为理由自行回退。

### 2.1 v1、core 与键盘逻辑

- core 中 `event.ts`、`TypeWord.vue` 的相关调整是用户手动完成并确认无影响的。
- v2 不再单独维护 `usePracticeWordKeyboard.ts`，直接沿用：

  ```ts
  useStartKeyboardEventListener()
  ```

- 不要仅为了恢复旧计划中的“绝对零侵入”而还原这些修改。

### 2.2 v2 的例句输入布局

- `WordMetaPanelV2` 不再是旧计划描述的纯只读组件。
- 当前会在单词卡片内部渲染 `TypingSentence`。
- 当 `settingStore.practiceSentence` 开启时，单词输入完成后会进入当前单词的例句输入，再触发单词完成。
- 这是用户根据实际布局手动确定的方案，不要擅自拆成只能跳转独立页面的模式。

### 2.3 独立例句页面

- `/practice-sentences/:id` 已有页面 UI、缓存和 session 草稿。
- 该页面当前用于验证 `TypingSentence` 能否单独运行。
- 页面尚未完整接通 `usePracticeSentenceSession()`，也没有正式用户入口。
- 不要把它当作已上线能力，也不要在没有用户要求时顺手大改。

### 2.4 v1/v2 入口

- `/words` 保持 v1。
- `/words-v2` 是 v2 独立入口，并提供流程编排入口。
- 当前并行结构是用户手动选择，不需要把 `words.vue` 自动切到 v2。

### 2.5 预留 action

以下类型已经进入 schema，但运行时仍是预留设计：

- `collectWrongWords`
- `generateReport`
- `navigate` 的任意字符串目标

当前内置流程主要依赖 `wrongWordClear`，`navigate: complete` 已有基本处理。不要因为预留 action 暂未落地而删除类型；如果要开放给用户使用，需要先实现运行时行为和测试。

---

## 3. 路由与入口

| 路由                      | 状态         | 说明                                          |
| ------------------------- | ------------ | --------------------------------------------- |
| `/words`                  | 正式 v1 入口 | 仍使用 v1 缓存和 v1 练习页                    |
| `/practice-words/:id`     | v1 练习页    | 旧状态机，保留用于对照                        |
| `/words-v2`               | v2 入口      | 生成 v2 routeData、继续 v2 缓存、进入流程编排 |
| `/practice-words-v2/:id`  | v2 主练习页  | 当前重构主线                                  |
| `/practice-flow-editor`   | v2 流程编排  | 管理内置流程副本和用户流程                    |
| `/practice-sentences`     | 实验入口页   | 当前没有从 `words-v2` 正式接入                |
| `/practice-sentences/:id` | 实验练习页   | 用于验证 `TypingSentence` 独立运行            |

关键入口文件：

```text
apps/nuxt/app/pages/(words)/words-v2.vue
apps/nuxt/app/pages/(words)/practice-words-v2/[id].vue
apps/nuxt/app/pages/(words)/practice-flow-editor.vue
apps/nuxt/app/pages/(words)/practice-sentences/index.vue
apps/nuxt/app/pages/(words)/practice-sentences/[id].vue
```

---

## 4. 关键目录与职责

### 4.1 流程模型与执行器

```text
apps/nuxt/app/composables/practice-words/
  registry-types.ts
  phase-templates.ts
  builtin-flows.ts
  flow-schema.ts
  flow-compiler.ts
  practice-phase-registry.ts
  usePracticeWordInit.ts
  usePracticeWordNavigator.ts
```

| 文件                          | 实际职责                                                                 |
| ----------------------------- | ------------------------------------------------------------------------ |
| `registry-types.ts`           | Flow、Node、Step、Cursor、Display、Snapshot 的类型定义                   |
| `phase-templates.ts`          | 5 种纯练习动作模板和默认显隐策略                                         |
| `builtin-flows.ts`            | System、Free、Review 等内置可序列化流程                                  |
| `flow-schema.ts`              | 对用户/内置流程做基础校验，非法配置回退 System                           |
| `flow-compiler.ts`            | 将 nodes/steps 编译为 `phasesByCursor` 和 `stepAdvance`                  |
| `practice-phase-registry.ts`  | 保存当前 ActiveFlowRegistry，按 Cursor 解析主相位、loop 子相位和错词相位 |
| `usePracticeWordInit.ts`      | 新会话选取首个有词 Node，并返回真实起始 Cursor                           |
| `usePracticeWordNavigator.ts` | 单词推进、wordLoop、onEnd、错词清空、阶段切换、快照恢复                  |

### 4.2 显隐、缓存与计时

```text
apps/nuxt/app/composables/practice-words/
  usePracticeDisplayPolicy.ts
  practice-word-cache-v2.ts
  usePracticeWordPersistenceV2.ts
  usePracticeIdleTimer.ts
  usePracticeWordAudioV2.ts
```

| 文件                              | 实际职责                                           |
| --------------------------------- | -------------------------------------------------- |
| `usePracticeDisplayPolicy.ts`     | `sessionDisplay + displayOverride + localReveal`   |
| `practice-word-cache-v2.ts`       | IndexedDB key、缓存结构与基础读写                  |
| `usePracticeWordPersistenceV2.ts` | 单词对象压缩为单词字符串，恢复时从当前词书映射回来 |
| `usePracticeIdleTimer.ts`         | 三分钟无输入暂停、恢复计时                         |
| `usePracticeWordAudioV2.ts`       | 单词音频、例句链式播放、可见性判断                 |

### 4.3 v2 组件

```text
apps/nuxt/app/components/practice-words-v2/
  TypeWordV2.vue
  WordTypingCoreV2.vue
  WordIdentifyPanelV2.vue
  WordMetaPanelV2.vue
  FooterV2.vue
  StatisticsV2.vue
  PracticeOnboardingHostV2.vue
```

实际边界：

- `TypeWordV2.vue`：组合壳、笔记/收藏、局部揭示、单词与例句输入衔接。
- `WordTypingCoreV2.vue`：单词逐字符输入、错误、重复、完成、光标。
- `WordIdentifyPanelV2.vue`：自测和单词测试交互。
- `WordMetaPanelV2.vue`：翻译、音标、例句、短语、词源，同时承载用户确认保留的例句输入。
- `FooterV2.vue`：从 Registry + Cursor 推导进度。
- `StatisticsV2.vue`：结算展示。
- `PracticeOnboardingHostV2.vue`：输入法冲突、收藏提示、引导。

拆分已经降低了单文件职责密度，但并未达到旧计划中的目标行数。这不是当前功能阻塞项。

---

## 5. 流程数据模型

### 5.1 三层结构

```text
PracticeFlowConfig
  └─ nodes[]                 一批词及其练习阶段
       ├─ source             taskNew/taskReview/current/wrongWords
       └─ steps[]            对这批词依次怎么练
            ├─ templateId    followWrite/spell/listen/dictation/identify
            ├─ wordAdvance   increment 或 wordLoop
            ├─ shuffleOnEnter
            ├─ displayOverride
            └─ onEnd[]
```

Step Template 只描述“怎么练”，不决定词从哪里来：

| templateId    | PracticeType | 核心表现                           |
| ------------- | ------------ | ---------------------------------- |
| `followWrite` | FollowWrite  | 单词、翻译和扩展信息默认可见       |
| `spell`       | Spell        | 单词遮罩，作为 wordLoop 常用子步骤 |
| `listen`      | Listen       | 隐藏文字信息，以听音输入为主       |
| `dictation`   | Dictation    | 隐藏单词，执行默写                 |
| `identify`    | Identify     | 自测/选择式识别                    |

### 5.2 Cursor

当前运行位置只认 `PracticeFlowCursor`：

```ts
interface PracticeFlowCursor {
  nodeIndex: number
  stepIndex: number
  inWrongWordClear: boolean
  loop: null | {
    startIndex: number
    endIndex: number
    subStepIndex: number
  }
  endActionIndex: number | null
}
```

重要不变量：

- `nodeIndex + stepIndex` 定位静态主 Step。
- `loop` 表示当前正在复练一组词的某个 subStep。
- `inWrongWordClear` 表示当前相位由 `wrongWordClear` action 动态派生。
- `endActionIndex` 指向当前 onEnd action。
- 不要重新引入 `spellSubStep`、`wrongRetry` 或以 `statStore.stage` 作为主导航依据。

---

## 6. 内置流程现状

| flowId          | mode          | Node/Step 摘要                             |
| --------------- | ------------- | ------------------------------------------ |
| `system`        | System        | 新词：跟写→听写→默写；复习：自测→听写→默写 |
| `free`          | Free          | current 词表单步跟写                       |
| `review`        | Review        | taskReview：自测→听写→默写                 |
| `identifyOnly`  | IdentifyOnly  | 新词自测 + 复习自测                        |
| `dictationOnly` | DictationOnly | 新词默写 + 复习默写                        |
| `listenOnly`    | ListenOnly    | 新词听写 + 复习听写                        |
| `shuffle`       | Shuffle       | taskReview 随机默写                        |

System 新词跟写使用：

```ts
wordAdvance: {
  type: 'wordLoop',
  groupSize: 7,
  subSteps: [{ templateId: 'spell' }],
}
```

内置 Step 默认在 onEnd 执行 `wrongWordClear`：

```ts
{
  type: 'wrongWordClear',
  templateId: 'followWrite',
  wordAdvance: {
    type: 'wordLoop',
    groupSize: 7,
    subSteps: [{ templateId: 'spell' }],
  },
}
```

---

## 7. 新会话初始化

入口函数：`resolveFlowStart(mode, taskWords, flowId?)`。

执行顺序：

1. 根据 mode 得到内置 flowId；Custom 得到 `'custom'`。
2. `loadPracticeFlow()` 校验并编译流程。
3. 查看第一个 Node 的词源是否有词。
4. 如果第一个 Node 没词，向后寻找第一个有词的 Node。
5. 返回：

   ```ts
   {
     practiceType,
     words,
     total,
     newWordNumber,
     reviewWordNumber,
     cursor,
   }
   ```

6. 页面必须使用返回的 `start.cursor`，不能再次无条件 `resetCursor()`。

这个约束解决了以下场景：

- System 模式当天没有新词、只有复习词时，应直接从 review Node 开始。
- 自定义流程前几个 Node 的词源为空时，应跳到第一个有词 Node。
- `data.words` 与 `activeCursor` 必须始终来自同一个 Node。

---

## 8. Navigator 推进规则

### 8.1 普通 increment

单词完成后 `data.index++`。词表结束后执行当前 Step 的 `onEnd`，然后进入下一 Step/Node 或结算。

### 8.2 wordLoop

主 Step 每完成 `groupSize` 个词：

1. Cursor 写入当前组的 `startIndex/endIndex`。
2. `subStepIndex = 0`。
3. `data.index` 回到组头。
4. 按 `subSteps[]` 顺序复练这组词。
5. 所有子步骤完成后退出 loop，从下一组继续主 Step。
6. 最后一组不足 `groupSize` 时，也必须进入 subSteps。

关键不变量：`runWordLoop()` 必须读取“当前解析相位”的 `phase.wordAdvance.subSteps`。

原因是错词清空相位并不一定等于静态主 Step：

```text
静态主 Step：listen / dictation / identify
wrongWordClear 派生相位：followWrite + wordLoop(spell)
```

如果重新读取静态主 Step，就会丢失 action 自己声明的 Spell 子步骤。

### 8.3 wrongWordClear

Step 结束时：

1. 过滤已经需要跳过/掌握的错词。
2. 有错词则把 Cursor 标记为 `inWrongWordClear`。
3. 使用 action 的 `templateId/displayOverride/wordAdvance` 派生临时相位。
4. 清空 `data.wrongWords`，对本轮错词进行练习。
5. 如果仍有错词，继续下一轮清空。
6. 错词归零后继续下一个 onEnd action；队列结束后推进主 Step。

---

## 9. 自定义流程

### 9.1 存储

localStorage key：`PracticeFlowV2`。

```ts
interface PracticeFlowStorageData {
  activeId: string
  flows: Record<
    string,
    {
      config: PracticeFlowConfig
      name: string
      createdAt: number
      updatedAt: number
    }
  >
}
```

### 9.2 加载规则

`loadPracticeFlow()` 接受：

- 内置 flowId，例如 `system`；
- 字面量 `custom`，表示加载当前激活的自定义流程；
- 自定义流程真实 ID，例如 `custom_...`；
- 直接传入 `PracticeFlowConfig`。

当恢复缓存时，快照中的 `flowId` 是 Active Registry 的真实 config ID。加载器必须先尝试 `getUserFlow(flowId)`，找不到时才回退内置配置。

### 9.3 当前快照恢复行为

恢复顺序：

1. 按 `snapshot.flowId` 加载相同流程。
2. 从加载后的 Registry 恢复 `settingStore.wordPracticeMode`。
3. 恢复 `wordPracticeType`、`identifyMethod`、错词状态和 Cursor。
4. 恢复 `sessionDisplay/displayOverride`。

页面的 `syncSessionPhase()` 只同步当前相位，不应再次根据 settingStore 重新加载流程，否则可能把刚恢复的自定义流程替换成另一份当前激活流程。

当前限制：

- 快照保存 `flowVersion`，但还没有做版本差异处理。
- 尚未实现旧计划中的 `customFlowHash`。
- 用户在未完成会话期间修改同一流程的结构，旧 Cursor 与新配置可能不完全匹配。

---

## 10. v2 练习缓存

IndexedDB key：`PracticeSaveWordV2`。

逻辑结构：

```ts
{
  taskWords,
  practiceData,
  statStoreData,
  sessionSnapshot: {
    wordPracticeType,
    identifyMethod,
    wordPracticeMode,
    flowId,
    flowVersion,
    cursor,
    sessionDisplay,
    displayOverride,
  },
}
```

实际保存时会把 `Word[]` 压缩成单词字符串数组；恢复时从当前词书构造 `wordMap` 并映射回 `Word`。

缓存不走 v1 的 `PracticeSaveWord`，也不走 v1 练习缓存的云端同步。

已知注意点：

- 当前词书中已经不存在的单词会在恢复时被过滤。
- 恢复后 index 会被限制在恢复出的 words 范围内。
- display override 的跨刷新持续性依赖 `lastPhaseKey`，调整显隐恢复逻辑时需专门验证“同一阶段下一词不清空 override”。

---

## 11. 显隐策略

显示状态分三层：

```text
phase.display
  → sessionDisplay
  → displayOverride（Footer 临时开关）
  → localReveal（当前单词显示答案/结果）
  → EffectiveDisplay
```

职责：

- `sessionDisplay`：Registry 当前相位的基础显隐。
- `displayOverride`：用户在当前相位临时切换单词遮罩或翻译。
- `localReveal`：只影响当前单词，不写缓存策略本身。
- `effective.showSentences`：同时驱动例句 UI 与首句自动播放判断。

不要重新在 v2 模板中按 `WordPracticeMode`/`WordPracticeType` 复制一套显隐判断。

用户已确认：`settingStore.dictation/translate` 可以在例句等手写逻辑中作为临时状态使用；结构化流程的主显隐仍以 `sessionDisplay + displayOverride` 为准。

---

## 12. 例句相关现状

### 12.1 单词卡片内例句

当前正式存在于 v2 单词卡片：

```text
TypeWordV2
  → WordMetaPanelV2
    → TypingSentence[]
      → TypingSentenceItem
```

行为：

- 平时展示例句、翻译和发音。
- `practiceSentence` 开启后，单词完成会进入例句输入。
- 所有例句完成后再向页面触发单词完成。
- 这是用户手写并确认保留的行为。

### 12.2 独立例句实验页

相关文件：

```text
apps/nuxt/app/composables/practice-sentences/
apps/nuxt/app/components/practice-sentences/
apps/nuxt/app/pages/(words)/practice-sentences/
```

当前定位：

- `TypingSentence` 的独立可用性已经验证。
- `usePracticeSentenceSession`、缓存、进度 UI 已有草稿。
- 页面渲染和 session 推进尚未完整接线。
- followWrite/dictation/listen 的页面模式切换尚未完整驱动输入组件。
- 暂无正式用户入口。

因此后续 Agent 应把它标记为“实验/待继续”，不要以页面存在为依据宣布完整例句练习已交付。

---

## 13. 状态所有权

| 状态                            | 所有者                                   | 说明                                                |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `taskWords`                     | v2 页面                                  | 当次任务的新词/复习词全集                           |
| `data.words/index/wrongWords`   | v2 页面 `PracticeData`                   | 当前 Step 实际词表和位置                            |
| `statStore`                     | core practice store                      | 统计、计时、结算数据；仍与其他练习共用              |
| `settingStore.wordPracticeMode` | core setting store                       | 当前模式；恢复时以加载后的 Registry mode 为准       |
| `currentPracticeType`           | 页面按 `activeCursor` 解析当前 Phase     | V2 页面和组件判断当前实际动作类型的唯一来源         |
| `settingStore.wordPracticeType` | Navigator syncPhase                      | 兼容旧逻辑、快照持久化使用的同步镜像                |
| `activeRegistry`                | `practice-phase-registry.ts` 模块级状态  | 当前编译流程                                        |
| `activeCursor`                  | `usePracticeWordNavigator.ts` 模块级 ref | 当前流程位置；`inWrongWordClear` 是错词清空唯一状态 |
| `sessionDisplay`                | `usePracticeDisplayPolicy.ts` 模块级 ref | 当前相位显隐                                        |
| `displayOverride`               | `usePracticeDisplayPolicy.ts` 模块级 ref | 当前相位用户覆盖                                    |

注意：Registry、Cursor 和 Display 目前是模块级状态，不适合同时挂载两个独立 v2 练习实例。改成实例级状态属于后续架构任务，不要在普通 bugfix 中顺手重写。

---

## 14. 已知遗留与预留能力

### 已知遗留

- `usePracticeWordTimer.ts` 当前无引用，实际页面使用 `usePracticeIdleTimer.ts` 和 statStore 计时。
- 页面仍保留较多 v1 时代的结算、统计、快捷键和数据同步逻辑。
- TypeWordV2 和页面行数仍较大，但用户已确认这不是当前阻塞项。
- 自定义流程快照尚无 hash/迁移策略。
- 流程校验目前是基础结构校验，不是完整语义校验。
- 当前相关模块没有自动化测试。

### 预留但未完整实现

- `collectWrongWords`
- `generateReport`
- 任意 URL/string 的 `navigate`
- 独立例句练习完整 session
- Phase 7 合并 v1

---

## 15. 本轮已修复的三个关键问题

### 15.1 空 Node 起始 Cursor

修复前：`resolveFlowStart()` 找到了有词 Node，但页面随后 `resetCursor()` 回 `0:0`。

修复后：页面直接采用 `start.cursor`。

### 15.2 自定义流程刷新恢复

修复前：快照保存真实自定义 ID，但加载器只识别字面量 `custom`，刷新后回退 System。

修复后：加载器支持按真实 ID 调用 `getUserFlow()`；恢复时从 Active Registry 恢复 mode，页面同步相位时不重复加载流程。

### 15.3 错词 wordLoop 子步骤

修复前：`runWordLoop()` 重新读取静态主 Step，丢失 `wrongWordClear` 派生相位的 Spell subSteps。

修复后：`runWordLoop()` 使用当前解析出的 phase，主 Step、普通 loop、错词 loop 共享同一数据来源。

---

## 16. 修改后的最低验收清单

涉及 Flow、Cursor、Navigator、缓存的修改至少验证：

### 初始化

- [ ] System：新词和复习词都有，从新词 Node 开始。
- [ ] System：没有新词、只有复习词，直接进入 review Node 的 identify Step。
- [ ] 自定义流程：前一个 Node 无词时，跳到第一个有词 Node。
- [ ] 所有 Node 都无词时，提示并返回词书页。

### wordLoop

- [ ] 7 个词：主跟写结束后完整进入 Spell。
- [ ] 8 个词：7 词组 + 1 词尾组都进入 Spell。
- [ ] 14 个词：两个完整组分别进入 Spell。
- [ ] 自定义多个 subSteps：按配置顺序执行。

### 错词清空

- [ ] FollowWrite 后有错词：进入 FollowWrite + Spell 清空。
- [ ] Listen 后有错词：仍进入 action 配置的 FollowWrite + Spell，而不是沿用 Listen 主 Step。
- [ ] Dictation/Identify 后有错词：行为同上。
- [ ] 错词再次输错：继续下一轮，直到错词归零。

### 缓存恢复

- [ ] 内置流程刷新后 mode、Cursor、词表一致。
- [ ] 自定义流程刷新后仍是同一份真实 flow ID。
- [ ] 自定义流程刷新后不会退回 System。
- [ ] loop 子步骤中刷新，范围和 subStepIndex 正确恢复。
- [ ] 错词清空中刷新，endActionIndex 和临时相位正确恢复。
- [ ] 同一相位刷新后，displayOverride 不应在下一词被意外清空。

---

## 17. Agent 修改规范

1. 开始前先读工作区根目录 `AGENTS.md` 和本文。
2. 先确认目标是 v1、v2、流程编排还是实验例句页。
3. 不要根据旧计划自行覆盖“用户已确认决策”。
4. 不要修改 `apps/vscode-web`；开发者会自行同步。
5. 保留用户工作区中已有的未提交修改，不要 reset/checkout。
6. Vue 状态优先沿用项目的 `$ref()`、`$computed()` 风格。
7. 样式修改遵循 UnoCSS、base 组件和项目 UI 规则；禁止新增原生 `button`。
8. 修改 Typewords 后不要运行 Nuxt dev/build，除非用户明确要求或任务直接涉及构建。
9. 可执行的基础检查：

   ```bash
   pnpm --filter @typewords/nuxt exec vue-tsc --noEmit
   git diff --check
   ```

10. 当前 `.nuxt/tsconfig.json` 的 `strict` 为 `false`，类型检查通过不代表不会出现 `undefined` 运行时问题。对可选配置必须显式提供默认值。
11. Flow 相关修改必须围绕“不变量 + 场景验收”验证，不能只依赖类型检查。

---

## 18. 后续建议顺序

除非用户另有优先级，后续工作建议：

1. 为 Flow compiler、Cursor、wordLoop、wrongWordClear 建立最小单元测试。
2. 补自定义 Flow 的 hash/version 迁移策略。
3. 修复并验证 displayOverride 刷新后的 phase key 恢复。
4. 决定独立例句页是继续产品化还是只保留组件实验用途。
5. 实现或隐藏预留 onEnd action 的编辑入口。
6. 最后再讨论 Phase 7：是否替换 v1、下沉 core、同步 vscode-web。

Phase 7 必须由用户单独确认，不能由 Agent 根据“v2 已基本完成”自行执行。
