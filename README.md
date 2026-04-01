# ACE-Coder

> 跨越工具的边界，重塑 AI 编程助手的终极理想态。

ACE-Coder (Adaptive Context Engine Coder) 是一个从第一性原理出发构建的下一代 AI 编程助手原型。它不仅是一个"打字员"，更是一个具备**活体语义图谱**、**自我修复能力**、**意图验证闭环**、**批判性架构思维**和**跨项目长期记忆**的"技术合伙人"。

---

## 🎯 核心愿景与基线对照

本项目以 **Anthropic 官方发布的 Claude Code 源码 (`@anthropic-ai/claude-code@2.1.88`)** 为基线对照组进行深度逆向工程与重构。

在对 Claude Code 源码进行深度分析后，我们发现其存在过度依赖文本检索（Grep/Glob）、缺乏语义理解、强绑定单一模型等局限性。ACE-Coder 旨在打破这些局限，实现五个维度的范式跨越：

| 维度 | Claude Code (基线) | ACE-Coder v0.2.0 (理想态) | 核心突破 |
|------|-------------------|--------------------|----------|
| **一：上下文理解** | 文本检索 (Grep/Glob) | **活体系统语义图谱** | Tree-sitter AST 骨架 + 按需展开，Token 消耗直降 **84.5%** |
| **二：运行模式** | 被动唤醒的 REPL | **主动演化与自我修复** | 后台 Watchdog 守护进程，主动监控并修复测试/Lint 错误 |
| **三：代码生成** | 直接修改 → 报错 → 重试 | **意图驱动的验证闭环** | 意图 → 测试 → 实现 → 自愈，骨架失败自动降级全量上下文 |
| **四：架构思维** | 顺从的"打字员" | **批判性思维架构师** | 拒绝糟糕设计，主动反问并提供安全/性能更优的架构建议 |
| **五：知识积累** | 仅限当前项目上下文 | **跨维度工程直觉** | 持久化跨项目记忆 + 三问质量门控，只存高价值经验 |

---

## 🚀 核心特性与实测战果

### 1. 自适应上下文引擎 (Adaptive Context Engine) — v0.2.0 升级

彻底抛弃低效的文本 Grep，使用 Tree-sitter 提取代码的 AST 骨架，并通过 **`ExpandSymbolTool`**（v0.2.0 新增）实现"按需展开"。

**工作流程：**
```
用户: "给 buildQuery 添加缓存"
Agent: SemanticSearch → 找到 buildQuery 在第 45 行
       FileRead(ACE)  → 获取骨架（节省 90% Token）
       ExpandSymbol("parseConfig") → 按需获取依赖函数的完整实现 ← 新增
       IntentVerify   → 实现 + 测试 + 验证
```

- **实测战果**：在处理长达 1144 行的 `BashTool.tsx` 时，传统全量读取消耗 182,843 tokens，而 ACE 仅消耗 **28,372 tokens**，节省高达 **84.5%**。

### 2. 意图驱动的验证闭环 (Intent Verification Loop) — v0.2.0 升级

将"修改代码"升级为原子操作，并新增 **Fallback 策略**：若骨架模式下测试失败，自动升级为全量上下文重试，确保代码质量永远不被 Token 优化所牺牲。

```
第一次尝试（骨架模式）→ 测试失败
  [Fallback Triggered] 自动切换为全量上下文
第二次尝试（全量模式）→ 测试通过 ✅
```

- **实测战果**：成功跑通 TTL 缓存、指数退避重试等复杂逻辑的自动 TDD 闭环，**8/8 测试全部通过**。

### 3. 批判性架构师 (Critical Architect)

当用户提出存在安全漏洞或性能瓶颈的需求时（例如："把密码明文存在全局数组里"），Agent 会触发 `[CRITIQUE: REJECTED]`，并给出专业的架构重构建议。

### 4. 后台守护进程 (Watchdog Agent)

持续运行的后台进程，主动扫描代码库状态，发现测试失败或潜在 Bug 时，自动复用验证闭环进行静默修复。

### 5. 跨项目长期记忆 (Cross-Project Memory) — v0.2.0 升级

借鉴 [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) 的 Learner Skill 设计，引入**三问质量门控机制**，确保记忆库只存储高价值的项目特有经验：

| 质量门控问题 | 要求 |
|------------|------|
| 这个能轻易 Google 到吗？ | 否（除非是项目特有的） |
| 这是当前代码库特有的知识吗？ | 是 |
| 这是通过真实调试发现的吗？ | 是 |

---

## 🛠️ 快速开始

### 环境要求
- Node.js >= 18
- OpenAI 兼容的 API Key（默认使用 `gpt-4.1-mini`）

### 安装与运行

```bash
# 1. 克隆仓库（私有仓库，需权限）
git clone https://github.com/OpenDemon/ace-coder.git
cd ace-coder

# 2. 安装依赖
npm install

# 3. 配置环境变量
export OPENAI_API_KEY="your-api-key"

# 4. 运行冒烟测试
npm start

# 5. 运行 v0.2.0 完整测试套件（8 个测试）
node benchmarks/test_v020.js

# 6. 运行 Token 基准测试（对比 Baseline 与 ACE）
npm run bench
```

---

## 📊 v0.2.0 测试结果

```
TEST SUITE 1: ExpandSymbolTool (Lazy Loading)
  ✅ PASS: ExpandSymbolTool: expands a specific function by name
  ✅ PASS: ExpandSymbolTool: returns error for non-existent symbol
  ✅ PASS: ExpandSymbolTool: skeleton mode hides body, ExpandSymbol reveals it

TEST SUITE 2: CrossProjectMemory Quality Gate (3-Question Filter)
  ✅ PASS: Quality Gate: REJECTS generic Googlable knowledge
  ✅ PASS: Quality Gate: ACCEPTS codebase-specific debugging lesson
  ✅ PASS: Quality Gate: ACCEPTS hard-won debugging lesson even if Googlable
  ✅ PASS: Quality Gate: recalled memories are high-quality only

TEST SUITE 3: IntentVerificationTool Fallback Strategy
  ✅ PASS: Fallback Strategy: IntentVerify succeeds on cross-function task

FINAL RESULTS: 8 passed, 0 failed 🎉
```

---

## 📚 架构设计

ACE-Coder 的核心架构分为三层：

```
┌─────────────────────────────────────────────────────────────┐
│                    ACE-Coder Agent Loop                     │
├──────────────────┬──────────────────┬───────────────────────┤
│  感知层           │  决策层           │   执行层              │
│  (Perception)    │  (Reasoning)     │   (Execution)         │
│                  │                  │                       │
│ SemanticSearch   │ CriticalArchitect│ IntentVerify          │
│ FileRead (ACE)   │ CrossProjectMemory  BashTool             │
│ ExpandSymbol ← 新│ WatchdogAgent    │ FileWrite             │
│ GrepTool         │                  │ GrepTool              │
└──────────────────┴──────────────────┴───────────────────────┘
```

1. **感知层 (Perception)**：`SemanticSearchTool`、`ContextLoader`、`ExpandSymbolTool` — 将物理文件转化为结构化语义图谱，支持按需展开。
2. **决策层 (Reasoning)**：`CriticalArchitectTool`、`CrossProjectMemory` — 架构评估和高质量历史经验检索。
3. **执行层 (Execution)**：`IntentVerificationTool`（含 Fallback）、`WatchdogAgent` — 代码生成、测试、验证和自愈。

---

## 📝 版本历史

### v0.2.0（当前版本）
- **新增** `ExpandSymbolTool`：骨架模式下按需展开任意函数完整实现，防止幻觉
- **升级** `IntentVerificationTool`：新增 Fallback 策略，骨架失败自动降级为全量上下文
- **升级** `CrossProjectMemory`：引入三问质量门控机制（借鉴 oh-my-claudecode Learner Skill）

### v0.1.0
- 五大维度初始实现：SemanticSearch、WatchdogAgent、IntentVerify、CriticalArchitect、CrossProjectMemory
- 真实 LLM API 回测：Token 消耗降低 84.5%

---

## 🤝 致谢

- [sanbuphy/claude-code-source-code](https://github.com/sanbuphy/claude-code-source-code) — Claude Code 源码提取
- [zxdxjtu/claude-code-sourcemap](https://github.com/zxdxjtu/claude-code-sourcemap) — 修复内部依赖的可运行版本
- [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) — Learner Skill 质量门控设计启发
- [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — 上下文优化最佳实践

---

## 📄 许可证

MIT License

---
*Built with ❤️ by OpenDemon*
