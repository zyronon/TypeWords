# 单词练习当前实现上下文

> 更新时间：2026-08-10
> 适用范围：标准 Nuxt 项目 `Typewords/app` 下的正式单词练习、Flow、显隐、音频和练习缓存
> 文档定位：后续开发或审查正式单词练习时优先阅读的当前事实文档

历史方案记录在 [`practice-words-v2-refactor.md`](./practice-words-v2-refactor.md)。历史文档只用于理解演进过程；与本文冲突时，以本文和当前代码为准。

## 1. 当前边界

- 重构版已经晋升为唯一正式实现，入口是 `/words`，练习页是 `/practice-words/:id`，不再保留 v1/v2 并行路由。
- 线上版本 1 练习缓存仍通过既有的单向迁移升级为版本 2；缓存版本标识不因页面晋升而改名。
- `/practice-sentences` 是独立实验页，本轮不处理其 session/cache。
- VSCode 壳项目不在单词练习实现范围内。
- `TypingSentence` 不转发 `wrong`；只在 `onCompleteSentence` 判断是否打错当前目标词。
- `TypingSentence` 继续依赖父层 `key` 重建，不监听 `sentence` prop。
- Footer 进度继续使用 `index / length`，包括首词 0%、末词不到 100% 和 loop 回退的现有表现。

## 2. 正式主链路

```text
Flow v6（严格校验）
  → createPracticeFlowRuntime()（Navigator 实例独享）
  → PracticeFlowCursor + nodeWorkingWords
  → practiceType / isWordMasked / 临时显示覆盖
  → PracticeSaveWord（PRACTICE_WORD_CACHE.version = 2）
```

核心文件：

- `app/core/composables/practice-words/practice-flow-types.ts`
- `app/core/composables/practice-words/practice-flow-config.ts`
- `app/core/composables/practice-words/practice-flow-runtime.ts`
- `app/core/composables/practice-words/usePracticeWordNavigator.ts`
- `app/core/composables/practice-words/usePracticeDisplayPolicy.ts`
- `app/core/composables/practice-words/practice-word-session.ts`
- `app/core/composables/practice-words/usePracticeWordSession.ts`
- `app/core/composables/practice-words/practice-audio.ts`
- `app/components/word/TypeWord.vue`
- `app/components/word/WordTypingCore.vue`
- `app/pages/(words)/practice-words/[id].vue`

其中 `usePracticeWordSession` 是跨端会话边界，统一负责 Flow、缓存恢复、题目、错词、FSRS 本地结算以及重学/下一组任务；页面仅保留路由、平台生命周期、远端交互提示和 UI 编排。`app/core` 不包含 UI 组件，也不反向依赖 `app/components`。

## 3. Flow v6

### 3.1 严格版本策略

`CURRENT_FLOW_VERSION` 为 `6`，版本仅是当前格式标识，不是迁移起点。

- 只接受结构完整且 `version === 6` 的 Flow。
- 旧版本、未来版本、非法 template/action、非法 `groupSize`、空 Node/Step 等统一回退 System。
- 用户 Flow 不迁移、不修补、不转换、不写回。
- 开发期旧 Flow 数据留在本地存储中，但读取时忽略；不会主动清理。
- 快照引用的 Flow 不存在，或 Cursor 与 Flow/当前词表不匹配时，整段回退 System 初始 Cursor。
- 不保留 `wrongRetry`、缺失 loop 等旧 Cursor 兼容分支。

### 3.2 Runtime 和 Cursor

- 每个 Navigator 通过 `createPracticeFlowRuntime()` 创建独立 Runtime。
- Runtime 独享 `activeFlowConfig`，Navigator 独享 Cursor 与 `nodeWorkingWords`，不存在模块级活动 Flow。
- Footer 读取页面 provide 的响应式 FlowConfig。
- Cursor 是唯一流程位置：

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

### 3.3 错词验证步骤

`PracticeLoopSubStep.clearWrongOnSuccess?: boolean` 表示该 subStep 是错词验证步骤：

- 仅在 loop 内、开关为 `true` 且当前词本次错误数为 0 时，从待复练 `wrongWords` 移除。
- 与 `practiceType` 无关，Spell、Listen、Dictation 都可以成为验证步骤。
- 不依据累计 `wrongTimesMap`；累计错误仍保留给统计和 FSRS。
- 清除后若后续步骤再次输错，沿用正常错误逻辑重新加入。
- 内置 Spell loop 和编辑器新建 Spell loop 显式设置为 `true`。

## 4. 显隐和输入模式

Flow schema、Step、subStep、wrongWordClear、Phase 和 sessionSnapshot 中均不存在 `display` 或 `displayOverride`。

默认显示直接由 `practiceType` 派生：

| practiceType | 单词 | 翻译 | 例句/短语/近义词 | 词源/关联词 |
| --- | --- | --- | --- | --- |
| FollowWrite | 显示 | 显示 | 显示 | 显示 |
| Spell | 遮罩 | 显示 | 显示 | 隐藏 |
| Listen | 遮罩 | 隐藏 | 隐藏 | 隐藏 |
| Dictation | 遮罩 | 显示 | 隐藏 | 隐藏 |
| Identify | 由识别面板决定 | 隐藏 | 隐藏 | 隐藏 |

正式版 Identify 不再区分 `SelfAssessment`、`WordTest` 和 `QuickIdentify` 子类型，而是在同一面板中同时提供自评按钮、直接拼写、选择题和批量标记。进入 Identify 阶段且当前单词存在时始终生成选择题 `question`，切词时重新生成，离开 Identify 阶段时清空；历史 `identifyMethod` 设置不再影响当前练习。

Footer 只维护两个临时状态：

- `wordMaskOverride`
- `translateOverride`

这些覆盖在 Phase 变化时复位，不进入 Flow，也不进入 sessionSnapshot。随机默写只洗牌并临时开启单词遮罩。

键入算法只由 `practiceType` 决定：仅 Dictation 使用整词输入并在空格时校验，其余类型均为逐字符输入。Footer、随机默写、hover、Esc 和答案揭示只改变 `isWordMasked` 画面状态，不改变键入算法。

## 5. 单词音频

单词音频和例句/短语 TTS 分开：

- `TypeWord` 负责调度单词音频、速度规则、取消旧音频和播放结束回调。
- `WordMetaPanel` 独立负责例句/短语 TTS、声色提示和例句高亮。
- `TypeWord` 只在允许串播时调用 `WordMetaPanel.playSentence(0)`。

首句自动串播必须同时满足：

1. `autoPlayFirstSentence` 已开启；
2. `practiceType === FollowWrite`；
3. 当前单词未遮罩，临时默写不串播；
4. 首句存在；
5. 触发源只能是进入新词时的 `NewWord`。

重复播放、同词重置、揭示生词、手动播放、快捷键、错误重试和其他 practiceType 都只播放单词。单词播放结束回调会校验当前单词标识，快速切词后不会串播上一词例句。

v1 音频逻辑保持不变。

## 6. Cache v2 与唯一迁移

### 6.1 通道与版本

v2 沿用已上线的练习缓存通道：

- 本地 key：`PracticeSaveWord`
- 远端类型：`practice_word`
- `PRACTICE_WORD_CACHE.version = 2`
- 已上线的 v1 缓存数据版本为 `1`

`PracticeSaveWordV2` 不再读取、写入或清理。

### 6.2 加载选择

- 本地和远端同时存在时，先比较格式版本：v2 永远优先于 v1，禁止降级。
- 同版本选择 `updated_at` 更新的一份。
- 当前版本 2 严格恢复 compact 数据和必需的 `sessionSnapshot`。
- 版本 1 执行唯一一次 v1→v2 转换，并把规范化的版本 2 写回本地和远端。
- v1→v2 转换统一由 core 的 `checkAndUpgradePracticeWordCache()` 完成；练习页 `load()` 和设置页导入/历史恢复调用同一个转换函数。
- 练习页 `load()` 先用 `shouldFetchRemote()` 选择本地或远端较新的缓存；选中缓存不是当前版本时才升级并写回本地和远端，版本相同则直接恢复。
- 设置页导入或恢复旧备份时，在业务入口先升级练习缓存，再写入本地和远端；通用同步层不包含练习缓存升级判断。
- 未知或未来版本不读取、不覆盖，页面提示客户端版本不支持。
- 没有缓存时创建新会话，首次有效保存直接写版本 2。
- 缓存首次初始化时读取完整本地和远端数据；页面隐藏时暂停并立即保存。重新可见时只检查远端元数据，发现其他设备的版本 2 更新时间更晚后弹窗询问，用户确认才重新加载完整缓存，选择保留当前进度则不覆盖内存会话且不再重复提示同一更新。
- 本地写入成功即视为练习进度已保存；远端失败不阻断练习或本地结算。

### 6.3 v1→v2 保留内容

转换保留：

- `taskWords`
- 当前 `words/index`
- `wrongWords/allWrongWords/wrongTimesMap/wrongTimes`
- `ratingMap`、排除词和计时统计
- 其余有效 `PracticeData` 与 `PracticeState`

转换规则：

- 根据 `wordPracticeMode + statStore.stage` 映射内置 Flow 的 Node/Step。
- `isTypingWrongWord` 映射到 `cursor.inWrongWordClear`，转换结果不再保留该字段。
- 当前 `wordPracticeType === Spell` 时，根据 index 和分组大小恢复 loop。
- 生成当前 `sessionSnapshot` 和工作词标识；快照不保存或恢复 v1 的 `identifyMethod`。
- `question` 置空后由页面根据当前 Identify 阶段和单词重新构建，不复用 v1 的旧题目。

重构版已经替换旧实现，不再设计 v1/v2 并存和双向兼容。通用缓存配置的当前版本直接为 2；只有读取到已上线的版本 1 数据时才执行一次 v1→v2 转换。

## 7. 统计与学习进度

- Flow 的 `taskNew` 计入新词，`taskReview` 计入复习词，`current` 同时计入二者。
- 同一 source 重复出现不重复计数。
- Review 或只包含复习 Node 的 Custom Flow，`newWordNumber` 为 0，结算不推进 `lastLearnIndex`。
- Navigator 的 Node 工作词表在进入 Node 时解析，Node 内后续 Step 使用稳定的 `nodeWorkingWords`。

### 7.1 无到期词时加入随机复习

- 正式版正常任务只使用 FSRS 到期复习词，不再为了达到复习比例固定补足历史词。
- `autoAddRandomReviewWhenNoDue` 默认为 `false`；首页和单词设置页共用同一个持久 Switch。
- 只有补充前的到期复习数为 0 时才显示首页 Switch、执行随机补充；开启后 Switch 保持显示，关闭时重新生成当前任务并移除随机补充词。
- 随机数量为 `floor(perDayStudyNumber * wordReviewRatio)`，候选仅来自当前学习进度之前的已学词，并排除新词、忽略词、已掌握词和重复词；候选不足时使用实际数量。
- 首页显式开启后提示加入数量；没有候选词时提示“无单词可以复习”，但持久偏好保持开启。自动初始化和“再来一组”不弹该提示。
- 随机复习词合并到 `taskWords.review`，与新词在一次 Flow 中完成；不记录单词级来源，继续沿用 FSRS 卡片有则更新、无则创建的结算逻辑。
- “重学一遍”复用当前任务；“再来一组”按当前持久偏好生成新任务，生成结果为空时保留结算弹窗。

## 8. 测试与验收

单测目录：`tests/unit`

- `practice-flow-runtime.test.ts`：v6 严格校验、回退、实例隔离、统计。
- `practice-word-navigator.test.ts`：7/8/14 词 loop、验证步骤消错、重加错词、Cursor 恢复和空 Node。
- `practice-view-audio.test.ts`：五类显隐默认值与首句串播条件。
- `practice-word-cache-v2.test.ts`：版本优先级、更新时间选择和 v1 stage→Cursor。
- `study-task.test.ts`：无到期词随机补充、开关条件、数量与候选排除规则。

提交前执行：

```bash
npm run test:unit
npx vue-tsc --noEmit
git diff --check
```

不要执行 Nuxt dev/build。
