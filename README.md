# ACE-Coder (Adaptive Context Engine Coder)

> **A**daptive **C**ontext **E**ngine for AI Coding Assistants

ACE-Coder is a next-generation AI coding assistant built from first principles. It moves beyond the paradigm of "AI as a typist" and aims to be a true "Technical Partner". It reduces LLM token consumption by **84.5%** while implementing the five core dimensions required for the ultimate AI coding assistant.

Author: OpenDemon

## The Five Dimensions of the Ideal AI Assistant

This project implements the five core dimensions required for the ultimate AI coding assistant:

### 1. From Text Search to Living Semantic Graph (`SemanticSearchTool` & `ContextLoader`)
Instead of reading thousands of lines of text, ACE-Coder uses `tree-sitter` to parse your codebase into an Abstract Syntax Tree (AST). It extracts structural skeletons (classes, methods, interfaces) and only reads the exact lines it needs.
**Result:** Reduces Token consumption by up to 85% for large files.

### 2. From Passive Execution to Active Evolution (`WatchdogAgent`)
ACE-Coder isn't just a REPL you have to wake up. It includes a background daemon (`WatchdogAgent`) that continuously monitors your codebase for test failures and linting errors, automatically initiating self-healing processes.

### 3. From Code Generation to Intent-Driven Verification (`IntentVerificationTool`)
When you ask ACE-Coder to change code, it doesn't just write it. It automatically generates a unit test for your intent, runs the test, and if it fails, self-heals the code until the test passes. You review the intent, not the code.

### 4. From Submissive Assistant to Critical Architect (`CriticalArchitectTool`)
If you propose a bad architecture (e.g., storing passwords in plain text), ACE-Coder will reject it. It analyzes proposals for security, performance, and scalability flaws, and provides professional counter-proposals.

### 5. From Project Context to Cross-Dimensional Intuition (`CrossProjectMemory`)
ACE-Coder maintains a persistent memory store (`~/.ace-memory`). It learns lessons from one project and recalls them in another. It also remembers your preferences (e.g., "always use vitest") so you never have to repeat yourself.

## Benchmark Results (Real LLM API)

Tested on real Claude Code source files using `gpt-4.1-mini`:

| Task | Baseline Tokens | ACE Tokens | Saved |
|------|----------------|------------|-------|
| Understand large file architecture (BashTool.tsx, 1144 lines) | 84,151 | 7,646 | **90.9%** |
| Find specific function in large file | 84,185 | 7,654 | **90.9%** |
| Cross-file interface analysis | 14,507 | 13,072 | **9.9%** |
| **Total** | **182,843** | **28,372** | **84.5%** |

## Architecture

```
ace-coder/
├── src/
│   ├── ace/
│   │   ├── SkeletonExtractor.js    # Tree-sitter AST skeleton extraction
│   │   └── ContextLoader.js        # Adaptive strategy decision engine
│   ├── tools/
│   │   ├── FileReadTool.js         # ACE-integrated file reader
│   │   ├── BaselineFileReadTool.js # Baseline (full read) for benchmarking
│   │   ├── FileWriteTool.js        # File write tool
│   │   ├── BashTool.js             # Shell command execution
│   │   ├── GrepTool.js             # Regex file search
│   │   ├── SemanticSearchTool.js   # AST-aware symbol search
│   │   ├── IntentVerificationTool.js # Intent-driven verification loop
│   │   └── CriticalArchitectTool.js  # AI Architect for critique
│   ├── watchdog/
│   │   └── WatchdogAgent.js        # Background self-healing daemon
│   ├── memory/
│   │   └── CrossProjectMemory.js   # Persistent cross-project memory
│   ├── agent/
│   │   └── Agent.js                # Core agent loop with tool orchestration
│   └── index.js                    # Entry point (interactive REPL)
├── benchmarks/
│   └── full_bench.js               # A/B benchmark: Baseline vs ACE
└── docs/
    └── ACE_DESIGN.md               # Architecture design document
```

## Quick Start

```bash
# Install dependencies
npm install

# Set your API key
export OPENAI_API_KEY=your_key_here

# Start interactive mode
npm start

# Run benchmark
npm run bench
```

## Roadmap

- [x] Adaptive Context Engine (ACE)
- [x] SemanticSearchTool (AST-based symbol search)
- [x] Benchmark suite with real LLM API validation
- [x] IntentVerificationTool (auto test generation + self-healing loop)
- [x] WatchdogAgent (background self-healing daemon)
- [x] CriticalArchitectTool (AI Architect for critique)
- [x] CrossProjectMemory (persistent cross-project memory)
- [ ] Multi-Agent Orchestration (parallel subtask execution)

## License

MIT © OpenDemon
