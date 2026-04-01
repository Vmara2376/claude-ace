/**
 * index.js — Claude-ACE Interactive CLI
 * Author: OpenDemon
 *
 * v0.4.0: Rich CLI experience
 *   - Streaming output (typewriter effect)
 *   - Markdown rendering with code syntax highlighting
 *   - Real-time tool call progress display
 *   - Up/down arrow key history navigation
 *   - /help, /clear, /stats, /exit commands
 */
import readline from 'readline';
import chalk from 'chalk';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { Agent } from './agent/Agent.js';
import { WatchdogAgent } from './watchdog/WatchdogAgent.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── Markdown renderer setup ──────────────────────────────────────────────────
marked.use(markedTerminal({
  code: (code) => {
    const lines = code.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length), 40);
    const w = Math.min(maxLen + 2, 78);
    const top    = chalk.gray('  ┌' + '─'.repeat(w) + '┐');
    const bottom = chalk.gray('  └' + '─'.repeat(w) + '┘');
    const body = lines.map(l => chalk.gray('  │ ') + chalk.greenBright(l)).join('\n');
    return `\n${top}\n${body}\n${bottom}\n`;
  },
  codespan: (code) => chalk.cyanBright('`' + code + '`'),
  strong:   (text) => chalk.bold.white(text),
  em:       (text) => chalk.italic.gray(text),
  heading:  (text, level) => '\n' + chalk.bold.yellow('#'.repeat(level) + ' ' + text) + '\n',
  listitem: (text) => chalk.gray('  • ') + text,
  hr:       ()     => chalk.gray('  ' + '─'.repeat(60)) + '\n',
  link:     (href, _title, text) => chalk.blue.underline(text || href),
}));

function renderMarkdown(text) {
  try { return marked(text); } catch (_) { return text; }
}

// ─── Tool display config ──────────────────────────────────────────────────────
const TOOL_DISPLAY = {
  FileRead:          { icon: '📂', label: 'Reading' },
  FileWrite:         { icon: '✏️ ', label: 'Writing' },
  Bash:              { icon: '⚡', label: 'Running' },
  Grep:              { icon: '🔍', label: 'Searching' },
  SemanticSearch:    { icon: '🧠', label: 'Semantic search' },
  IntentVerify:      { icon: '🧪', label: 'Verifying' },
  ExpandSymbol:      { icon: '🔬', label: 'Expanding' },
  CriticalArchitect: { icon: '🏛️ ', label: 'Architecture review' },
  Memory:            { icon: '💾', label: 'Memory' },
  CallGraph:         { icon: '🕸️ ', label: 'Call graph' },
};

function formatArgHint(name, args) {
  if (!args) return '';
  const val = args.path || args.targetFile || args.query || args.command || args.intent || args.action || '';
  if (!val) return '';
  const s = String(val);
  return chalk.gray(' ' + (s.length > 55 ? s.slice(0, 52) + '...' : s));
}

// ─── Banner & help ────────────────────────────────────────────────────────────
function printBanner() {
  console.log('');
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('  ║') + chalk.bold.white('  Claude-ACE') + chalk.gray(' — Claude 省钱版') + chalk.bold.cyan('               ║'));
  console.log(chalk.bold.cyan('  ║') + chalk.gray('  节约 90% Token · 支持 OpenAI 及国产模型') + chalk.bold.cyan('  ║'));
  console.log(chalk.bold.cyan('  ╚══════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray('  输入问题开始对话。/help 查看命令。Ctrl+C 退出。'));
  console.log('');
}

function printHelp() {
  console.log('');
  console.log(chalk.bold.white('  命令：'));
  console.log('  ' + chalk.cyan('/help ') + '   显示此帮助');
  console.log('  ' + chalk.cyan('/clear') + '   清空对话历史');
  console.log('  ' + chalk.cyan('/stats') + '   显示 Token 统计');
  console.log('  ' + chalk.cyan('/exit ') + '   退出程序');
  console.log('');
}

function printStats(stats) {
  console.log('');
  console.log(chalk.bold.white('  Token 统计：'));
  console.log('  输入：  ' + chalk.yellow(stats.inputTokens.toLocaleString()));
  console.log('  输出：  ' + chalk.yellow(stats.outputTokens.toLocaleString()));
  console.log('  工具：  ' + chalk.yellow(stats.toolCalls) + ' 次调用');
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  printBanner();

  const agent = new Agent();

  // Start Watchdog (5 min interval, quiet)
  const watchdog = new WatchdogAgent(PROJECT_ROOT, { intervalMs: 300000 });
  watchdog.start();

  process.on('SIGINT', () => {
    console.log('\n' + chalk.gray('  再见！') + '\n');
    watchdog.stop();
    process.exit(0);
  });

  // ─── REPL loop ───────────────────────────────────────────────────────────────
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 200,
  });

  const askLine = () => new Promise((resolve) => {
    rl.question(chalk.bold.green('  You') + chalk.gray(' › '), resolve);
  });

  while (true) {
    let userInput;
    try {
      userInput = await askLine();
    } catch (_) { break; }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    // Built-in commands
    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log(chalk.gray('\n  再见！\n'));
      watchdog.stop();
      rl.close();
      process.exit(0);
    }
    if (trimmed === '/help')  { printHelp();             continue; }
    if (trimmed === '/stats') { printStats(agent.stats); continue; }
    if (trimmed === '/clear') {
      agent.messages = agent.messages.slice(0, 1);
      agent.resetStats();
      console.log(chalk.gray('\n  对话历史已清空。\n'));
      continue;
    }

    // ── Stream response ─────────────────────────────────────────────────────
    console.log('');
    process.stdout.write(chalk.bold.cyan('  ACE') + chalk.gray(' › '));

    let streamedText = '';
    let toolCount = 0;
    let toolLineActive = false;

    const clearToolLine = () => {
      if (toolLineActive) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        toolLineActive = false;
      }
    };

    try {
      await agent.chat(trimmed, {
        onToken: (token) => {
          clearToolLine();
          if (streamedText === '') {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(chalk.bold.cyan('  ACE') + chalk.gray(' › '));
          }
          streamedText += token;
          process.stdout.write(token);
        },
        onToolStart: ({ name, args }) => {
          toolCount++;
          clearToolLine();
          if (streamedText && !streamedText.endsWith('\n')) {
            process.stdout.write('\n');
            streamedText = '';
          }
          const d = TOOL_DISPLAY[name] || { icon: '🔧', label: name };
          const hint = formatArgHint(name, args);
          process.stdout.write(chalk.gray(`  ${d.icon} ${d.label}`) + hint);
          toolLineActive = true;
        },
        onToolEnd: () => {
          clearToolLine();
          process.stdout.write(chalk.bold.cyan('  ACE') + chalk.gray(' › '));
          streamedText = '';
        }
      });

      clearToolLine();

      // Re-render final answer as Markdown
      if (streamedText) {
        const rawLines = streamedText.split('\n').length;
        for (let i = 0; i < rawLines; i++) {
          readline.clearLine(process.stdout, 0);
          if (i < rawLines - 1) readline.moveCursor(process.stdout, 0, -1);
        }
        readline.cursorTo(process.stdout, 0);

        const rendered = renderMarkdown(streamedText);
        const indented = rendered.split('\n').map(l => '  ' + l).join('\n');
        process.stdout.write(chalk.bold.cyan('ACE') + chalk.gray(' › ') + indented);
      }

      console.log('');
      if (toolCount > 0) {
        const s = agent.stats;
        console.log(chalk.gray(`  [${toolCount} 次工具调用 · 累计输入 ${s.inputTokens.toLocaleString()} tokens]`));
      }
      console.log('');

    } catch (err) {
      clearToolLine();
      console.log('');
      console.log(chalk.red(`  [错误] ${err.message}`));
      if (err.message.includes('model') || err.message.includes('API') || err.message.includes('400')) {
        console.log(chalk.gray('  提示：请检查 OPENAI_API_KEY 和模型名称是否正确。'));
        console.log(chalk.gray('  当前模型：' + (process.env.OPENAI_MODEL || 'glm-5（默认）')));
      }
      console.log('');
    }
  }
}

main().catch(console.error);
