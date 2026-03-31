# ACE-Coder Architecture Design

## Overview

ACE-Coder implements an **Adaptive Context Engine (ACE)** that intelligently manages what code context is sent to the LLM, dramatically reducing token consumption while maintaining full task completion capability.

## Core Insight

Traditional AI coding assistants suffer from a fundamental inefficiency: they read entire files even when only a small portion is relevant. For a 1,144-line file like `BashTool.tsx`, this wastes ~84,000 tokens per query.

ACE solves this by applying a **three-tier strategy** based on file characteristics:

| Tier | Condition | Strategy | Token Reduction |
|------|-----------|----------|-----------------|
| 1 | < 200 lines | Full read | 0% (no overhead) |
| 2 | ≥ 200 lines, type-dense | Full read | 0% (types ARE the content) |
| 3 | ≥ 200 lines, implementation-heavy | Skeleton | **70-97%** |

## Skeleton Extraction

The skeleton extractor uses Tree-sitter to parse the TypeScript/TSX AST and:
1. Preserves all `import` statements
2. Preserves all type/interface/enum declarations
3. Preserves all function signatures (name, parameters, return type)
4. Replaces function bodies with `{ // ... }`

This gives the LLM a perfect "table of contents" for the file, enabling it to:
- Understand the overall architecture without reading implementation details
- Identify which function to drill into using `targetFunction`
- Make architectural decisions based on signatures alone

## Tool Hierarchy

```
SemanticSearch  →  Find symbol location (AST-based, most efficient)
FileRead        →  Read file (ACE-adaptive) or targeted function
Grep            →  Fallback text search
Bash            →  Execute commands, run tests
FileWrite       →  Write files
IntentVerify    →  Implement + verify changes (self-healing loop)
```

## IntentVerificationTool Design

The verification loop implements a TDD-like workflow:

```
User Intent
    ↓
Generate Test (defines "correct")
    ↓
Generate Implementation
    ↓
Run Test
    ↓ FAIL
Self-Heal (LLM fixes implementation based on error)
    ↓
Run Test again (up to maxRetries)
    ↓ PASS
Return clean result to main agent
```

Key benefits:
- Main agent context stays clean (no error logs)
- Code is mathematically verified before delivery
- Self-healing eliminates "hallucinated" implementations

## Benchmark Results

Tested on real Claude Code source files with `gpt-4.1-mini`:

| Task | Baseline | ACE | Saved |
|------|----------|-----|-------|
| Understand BashTool.tsx (1144 lines) | 84,151 | 7,646 | **90.9%** |
| Find specific function | 84,185 | 7,654 | **90.9%** |
| Cross-file analysis | 14,507 | 13,072 | **9.9%** |
| **Total** | **182,843** | **28,372** | **84.5%** |
