/**
 * Agent.js — Core agent loop with tool orchestration
 * Author: OpenDemon
 */
import OpenAI from 'openai';
import { FileReadTool } from '../tools/FileReadTool.js';
import { FileWriteTool } from '../tools/FileWriteTool.js';
import { BashTool } from '../tools/BashTool.js';
import { GrepTool } from '../tools/GrepTool.js';
import { SemanticSearchTool } from '../tools/SemanticSearchTool.js';
import { IntentVerificationTool } from '../tools/IntentVerificationTool.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are ACE-Coder, an advanced AI coding assistant powered by the Adaptive Context Engine (ACE).

## Your Tools
- **FileRead**: Read files. ACE automatically serves skeletons for large files (>200 lines). Use targetFunction="name" to get a specific function's full body. Use forceFull=true only when you truly need the entire file.
- **FileWrite**: Write or overwrite files.
- **Bash**: Execute shell commands (ls, node, npm, git, etc.)
- **Grep**: Search file contents with regex.
- **SemanticSearch**: Find functions/classes/interfaces by name using AST parsing. Use this BEFORE Grep for symbol lookup — it's 10x more token-efficient.
- **IntentVerify**: Implement a code change with automatic test generation and self-healing verification. Use this for any non-trivial modification.

## ACE Workflow
1. When exploring a codebase, use SemanticSearch first to locate symbols.
2. When reading large files, trust the skeleton — use targetFunction to drill into specifics.
3. When making code changes, prefer IntentVerify over direct FileWrite for non-trivial changes.
4. Be concise in your responses — the user cares about results, not process narration.

## Key Principle
You are not a typist. You are a technical co-founder. Think architecturally, act precisely.`;

export class Agent {
  constructor() {
    this.tools = [
      new FileReadTool(),
      new FileWriteTool(),
      new BashTool(),
      new GrepTool(),
      new SemanticSearchTool(),
      new IntentVerificationTool()
    ];
    this.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    this.stats = { inputTokens: 0, outputTokens: 0, toolCalls: 0 };
  }

  _toOpenAITools() {
    return this.tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }));
  }

  async chat(userMessage) {
    this.messages.push({ role: 'user', content: userMessage });
    
    for (let step = 0; step < 20; step++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: this.messages,
        tools: this._toOpenAITools(),
        tool_choice: 'auto',
        temperature: 0.1
      });

      const msg = response.choices[0].message;
      this.messages.push(msg);

      if (response.usage) {
        this.stats.inputTokens += response.usage.prompt_tokens;
        this.stats.outputTokens += response.usage.completion_tokens;
      }

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return { answer: msg.content, stats: this.stats };
      }

      for (const tc of msg.tool_calls) {
        this.stats.toolCalls++;
        const args = JSON.parse(tc.function.arguments);
        const tool = this.tools.find(t => t.name === tc.function.name);
        const result = tool
          ? await tool.execute(args)
          : `[Error] Tool "${tc.function.name}" not found`;

        this.messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: result
        });
      }
    }

    return { answer: '[Agent] Max steps reached', stats: this.stats };
  }

  resetStats() {
    this.stats = { inputTokens: 0, outputTokens: 0, toolCalls: 0 };
  }
}
