# 本地大模型翻译

启用后，文章编辑页的「一键翻译」可以完全跑在本地，不依赖任何云端翻译接口。

默认适配腾讯开源的 [Hy-MT2](https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF)：Apache-2.0，1.8B 稠密模型，Q4_K_M 量化后只有 1.13 GB，纯 CPU 就能跑。目标是端侧翻译，支持 33+ 语言，带术语约束、风格控制、分隔符保留、结构化数据翻译几类指令。

任何 OpenAI 兼容端点都能用，不限于 Hy-MT2。

## 1. 起一个本地翻译服务

llama.cpp：

```bash
winget install llama.cpp            # Windows，macOS/Linux 见 llama.cpp 官方文档
llama serve -hf tencent/Hy-MT2-1.8B-GGUF:Q4_K_M --port 8080
```

或者用 ollama：

```bash
ollama run hf.co/tencent/Hy-MT2-1.8B-GGUF:Q4_K_M
```

验证服务是否正常：

```bash
curl -s http://127.0.0.1:8080/v1/models
```

> 注意：如果只跑 `Hy-MT2-1.8B-GGUF`（Q4_K_M / Q6_K / Q8_0），标准 llama.cpp 就能加载。
> 只有 `Hy-MT2-1.8B-1.25bit-GGUF`（440 MB）需要自行编译带 STQ kernel 的 llama.cpp 分支，且该 kernel 目前只实现了 ARM NEON。

## 2. 打开开关

```bash
ENABLE_LOCAL_TRANSLATE=true
# 可选，默认 http://127.0.0.1:8080
LOCAL_TRANSLATE_TARGET=http://127.0.0.1:8080
```

然后

```bash
pnpm run dev     # http://localhost:5567
```

文章编辑页会出现「翻译」按钮和引擎下拉，默认选中「本地模型（Hy-MT2）」。

不设置开关时，这些入口不会出现，线上行为完全不变。

## 3. 逐句还是整篇

`getNetworkTranslate()` 原本是「一句一个请求」的循环。走云端接口这样没问题，但走本地模型时，每个请求都要重跑一遍完整 prompt —— 一篇文章 200 句就是 200 次 prefill，prompt 开销远大于输出本身。

所以本地模型走的是 `translateTextsBatch()`：利用 Hy-MT2 的分隔符保留能力，把整篇按编号一次发过去，让它按 `编号|||译文` 的格式逐行返回。请求数从 200 次降到 5 次左右（默认 40 句一块）。

某一块解析失败时会自动降级成逐句重试，不会整篇丢掉。

## 4. 生成参数

代码里用的是官方推荐的 1.8B / 7B 参数：

```
temperature 0.7 / top_p 0.6 / top_k 20 / repetition_penalty 1.05
```

另外模型**没有默认 system_prompt**，所有要求都写在 user message 里；源语言和目标语言必须用**全称**（本项目的 prompt 是中文，所以用「简体中文」「英语」这样的中文全称）。这两点踩了基本翻不出东西，改 prompt 时留意。

## 5. 还能怎么用

本地模型接进来之后，翻译层就不只是「把英文变中文」了：

- **术语约束**：`LocalLLMConfig.glossary` 传一组 `原文=译文`，可以把用户错词本里的词锁进译文，在文章练习中被动复习
- **风格控制**：`LocalLLMConfig.style` 可以要求「直译逐词对应」或「意译通顺」，同一篇出两版对照
- **结构化数据**：Hy-MT2 支持只翻可见文本、保留 Markdown / 代码标签，适合拿技术文档当练习材料

## 6. 已知限制

- `nitro.devProxy` 只在 `nuxt dev` 生效。`pnpm run generate` 的静态产物没有代理层，要么改用 `nuxt build` + node 自己加反向代理，要么让浏览器直连本地服务（需要给 llama.cpp 开 CORS）
- 语言检测没有实现（`Translator.detect()` 返回空），源语言是按现有逻辑硬编码成 `en` 的
- 本地推理是 CPU 饱和型，不要并发开太高；批量翻译是串行分块跑的
