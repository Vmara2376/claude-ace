/**
 * full_bench.js — A/B Benchmark: Baseline vs ACE
 * Author: OpenDemon
 */
import OpenAI from 'openai';
import chalk from 'chalk';
import { FileReadTool } from '../src/tools/FileReadTool.js';
import { BaselineFileReadTool } from '../src/tools/BaselineFileReadTool.js';
import { BashTool } from '../src/tools/BashTool.js';
import { GrepTool } from '../src/tools/GrepTool.js';
import { SemanticSearchTool } from '../src/tools/SemanticSearchTool.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_ACE = `You are ACE-Coder. When you see STRATEGY: SKELETON, only function signatures are shown. Use targetFunction to get specific function bodies. Be efficient.`;
const SYSTEM_BASELINE = `You are an AI coding assistant. Read files as needed to answer accurately.`;

function toOAITools(tools) {
  return tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

async function runTask(label, userPrompt, useACE) {
  const tools = useACE
    ? [new FileReadTool(), new BashTool(), new GrepTool(), new SemanticSearchTool()]
    : [new BaselineFileReadTool(), new BashTool(), new GrepTool()];

  const messages = [
    { role: 'system', content: useACE ? SYSTEM_ACE : SYSTEM_BASELINE },
    { role: 'user', content: userPrompt }
  ];

  let totalTokens = 0, inputTokens = 0, outputTokens = 0, toolCalls = 0;
  const callLog = [];

  for (let step = 0; step < 10; step++) {
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', messages, tools: toOAITools(tools), tool_choice: 'auto', temperature: 0.1
    });
    const msg = res.choices[0].message;
    messages.push(msg);
    if (res.usage) { inputTokens += res.usage.prompt_tokens; outputTokens += res.usage.completion_tokens; totalTokens += res.usage.total_tokens; }

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { totalTokens, inputTokens, outputTokens, toolCalls, callLog, answer: msg.content };
    }
    for (const tc of msg.tool_calls) {
      toolCalls++;
      const args = JSON.parse(tc.function.arguments);
      const tool = tools.find(t => t.name === tc.function.name);
      const result = tool ? await tool.execute(args) : `Tool not found`;
      callLog.push(`  ${toolCalls}. ${tc.function.name}(${JSON.stringify(args).substring(0, 80)})`);
      messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: result });
    }
  }
  return { totalTokens, inputTokens, outputTokens, toolCalls, callLog, answer: '[max steps]' };
}

const TASKS = [
  { name: 'Task 1: Understand large file architecture (BashTool.tsx, 1144 lines)', prompt: 'Read /home/ubuntu/cc-src/src/tools/BashTool/BashTool.tsx and give me a concise summary of its overall architecture and main functions.' },
  { name: 'Task 2: Find specific function', prompt: 'In /home/ubuntu/cc-src/src/tools/BashTool/BashTool.tsx, what does the isSearchOrReadBashCommand function do? How does it work?' },
  { name: 'Task 3: Cross-file interface analysis', prompt: 'Look at /home/ubuntu/cc-src/src/Tool.ts and /home/ubuntu/cc-src/src/tools/GrepTool/GrepTool.ts. How does GrepTool implement the Tool interface?' }
];

async function main() {
  console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║          ACE-Coder Full Benchmark (Real LLM API)         ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));

  const results = [];
  for (const task of TASKS) {
    console.log(chalk.white(`\n━━━ ${task.name} ━━━`));
    const baseline = await runTask('Baseline', task.prompt, false);
    console.log(`  [Baseline] ${baseline.totalTokens.toLocaleString()} tokens, ${baseline.toolCalls} tool calls`);
    await new Promise(r => setTimeout(r, 2000));
    const ace = await runTask('ACE', task.prompt, true);
    console.log(`  [ACE]      ${ace.totalTokens.toLocaleString()} tokens, ${ace.toolCalls} tool calls`);
    const saved = baseline.totalTokens - ace.totalTokens;
    const pct = (saved / baseline.totalTokens * 100).toFixed(1);
    console.log(chalk.green(`  [Saved]    ${saved.toLocaleString()} tokens (${pct}%)`));
    results.push({ task: task.name, baseline: baseline.totalTokens, ace: ace.totalTokens, saved, pct });
    await new Promise(r => setTimeout(r, 3000));
  }

  const totalB = results.reduce((s, r) => s + r.baseline, 0);
  const totalA = results.reduce((s, r) => s + r.ace, 0);
  const totalSaved = totalB - totalA;
  const totalPct = (totalSaved / totalB * 100).toFixed(1);

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('OVERALL SUMMARY'));
  console.log(`Total Baseline: ${totalB.toLocaleString()} tokens`);
  console.log(`Total ACE:      ${totalA.toLocaleString()} tokens`);
  console.log(chalk.green(`Total Saved:    ${totalSaved.toLocaleString()} tokens (${totalPct}%)`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  import('fs').then(({ default: fs }) => {
    fs.writeFileSync('./benchmarks/results.json', JSON.stringify(results, null, 2));
    console.log(chalk.gray('Results saved to benchmarks/results.json'));
  });
}

main().catch(console.error);
