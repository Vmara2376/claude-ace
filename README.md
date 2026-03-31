# ACE-Coder

> **A**daptive **C**ontext **E**ngine for AI Coding Assistants

ACE-Coder is a next-generation AI coding assistant prototype that reduces LLM token consumption by **84.5%** while maintaining full code understanding capability. It achieves this through an **Adaptive Context Engine (ACE)** that intelligently serves file skeletons (AST-extracted signatures) instead of full file contents when appropriate.

## Key Features

- **Adaptive Context Engine (ACE)**: Automatically chooses between full-read, skeleton, and targeted extraction strategies based on file size and type density
- **Tree-sitter AST Parsing**: Millisecond-level parsing of TypeScript/JavaScript files to extract structural skeletons
- **SemanticSearchTool**: Replaces grep-based search with AST-aware symbol lookup
- **IntentVerificationTool**: Automatically generates and runs tests to verify code changes (coming soon)
- **Multi-model Support**: Works with any OpenAI-compatible API (GPT-4.1, Gemini, DeepSeek, etc.)

## Benchmark Results (Real LLM API)

Tested on real Claude Code source files using `gpt-4.1-mini`:

| Task | Baseline Tokens | ACE Tokens | Saved |
|------|----------------|------------|-------|
| Understand large file architecture (BashTool.tsx, 1144 lines) | 84,151 | 7,646 | **90.9%** |
| Find specific function in large file | 84,185 | 7,654 | **90.9%** |
| Cross-file interface analysis | 14,507 | 13,072 | **9.9%** |
| **Total** | **182,843** | **28,372** | **84.5%** |

> Note: Token savings vary by task type. Skeleton strategy excels at architecture understanding and function lookup. For type-dense files (pure interfaces/types), savings are lower by design — ACE preserves critical type information.

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
│   │   └── SemanticSearchTool.js   # AST-aware symbol search
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

## How ACE Works

ACE applies a three-tier strategy based on file characteristics:

1. **Small files (< 200 lines)**: Full read — no overhead, no risk of missing context
2. **Medium/Large files (≥ 200 lines)**: Skeleton extraction — Tree-sitter parses the AST and returns only imports, type definitions, and function signatures (bodies replaced with `{ ... }`)
3. **Type-dense files** (detected via heuristic): Full read — files consisting primarily of interface/type declarations are served in full, as their "body" IS the content

The LLM is instructed via system prompt to use the skeleton as a map, then call `FileRead` with `targetFunction` or `Grep` to drill into specific sections on demand.

## Roadmap

- [x] Adaptive Context Engine (ACE)
- [x] SemanticSearchTool (AST-based symbol search)
- [x] Benchmark suite with real LLM API validation
- [ ] IntentVerificationTool (auto test generation + self-healing loop)
- [ ] Developer Profile Memory (persistent preference learning)
- [ ] Multi-Agent Orchestration (parallel subtask execution)
- [ ] Cross-project Knowledge Transfer

## License

MIT © OpenDemon
