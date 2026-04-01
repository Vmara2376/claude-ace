/**
 * index.js — Claude-ACE Interactive CLI
 * Author: OpenDemon
 *
 * v0.6.0: Full Claude Code style CLI
 *   - Startup panel with recent activity history
 *   - / triggers interactive command picker (up/down)
 *   - /status, /skills, /resume, /rename, /rewind, /release-notes
 *   - Session persistence (save/load/rename)
 *   - Streaming output with typewriter effect
 *   - Markdown rendering with code syntax highlighting
 */
import readline from 'readline';
import chalk from 'chalk';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { select, input } from '@inquirer/prompts';
import { Agent } from './agent/Agent.js';
import { WatchdogAgent } from './watchdog/WatchdogAgent.js';
import { SessionManager } from './session/SessionManager.js';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const VERSION = '0.6.0';
const MODEL = process.env.OPENAI_MODEL || 'glm-5-turbo';

const RELEASE_NOTES = `
## v0.6.0
- \u542f\u52a8\u754c\u9762\u5c55\u793a\u6700\u8fd1\u5bf9\u8bdd\u5386\u53f2\uff08Recent Activity\uff09
- \u65b0\u589e /status\u3001/skills\u3001/resume\u3001/rename\u3001/rewind\u3001/release-notes \u547d\u4ee4
- \u5bf9\u8bdd\u5386\u53f2\u672c\u5730\u6301\u4e45\u5316\uff08\u4fdd\u5b58\u5230 ~/.claude-ace/sessions/\uff09

## v0.5.0
- Claude Code \u98ce\u683c ASCII logo
- \u4fe1\u4efb\u786e\u8ba4\u83dc\u5355
- / \u89e6\u53d1\u4ea4\u4e92\u5f0f\u547d\u4ee4\u83dc\u5355

## v0.4.0
- \u6d41\u5f0f\u8f93\u51fa\u6253\u5b57\u673a\u6548\u679c
- Markdown \u6e32\u67d3\u4e0e\u4ee3\u7801\u9ad8\u4eae
- \u5de5\u5177\u8c03\u7528\u5b9e\u65f6\u663e\u793a

## v0.3.0
- CallGraph \u8c03\u7528\u56fe\u5206\u6790
- CriticalArchitectTool + MemoryTool \u5168\u9762\u96c6\u6210
- WatchdogAgent \u771f\u5b9e\u8fd0\u884c npm test

## v0.2.0
- ExpandSymbolTool \u6309\u9700\u5c55\u5f00
- IntentVerify Fallback \u4fdd\u969c
- CrossProjectMemory \u4e09\u95ee\u8d28\u91cf\u95e8\u63a7

## v0.1.0
- \u4e94\u5927\u7ef4\u5ea6\u521d\u59cb\u5b9e\u73b0
- Token \u6d88\u8017\u964d\u4f4e 84.5%
`;

// ─── Markdown renderer ────────────────────────────────────────────────────────
marked.use(markedTerminal({
  code: (code) => {
    const lines = code.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length), 40);
    const w = Math.min(maxLen + 2, 76);
    const top    = chalk.gray(' \u250c' + '\u2500'.repeat(w) + '\u2510');
    const bottom = chalk.gray(' \u2514' + '\u2500'.repeat(w) + '\u2518');
    const body = lines.map(l => chalk.gray(' \u2502 ') + chalk.greenBright(l)).join('\n');
    return `\n${top}\n${body}\n${bottom}\n`;
  },
  codespan: (code) => chalk.cyanBright('`' + code + '`'),
  strong:   (text) => chalk.bold.white(text),
  em:       (text) => chalk.italic.gray(text),
  heading:  (text, level) => '\n' + chalk.bold.yellow('#'.repeat(level) + ' ' + text) + '\n',
  listitem: (text) => chalk.gray(' \u2022 ') + text,
  hr:       ()     => chalk.gray(' ' + '\u2500'.repeat(60)) + '\n',
  link:     (href, _title, text) => chalk.blue.underline(text || href),
}));

function renderMarkdown(text) {
  try { return marked(text); } catch (_) { return text; }
}

// ─── Tool display config ──────────────────────────────────────────────────────
const TOOL_DISPLAY = {
  FileRead:          { label: 'Reading' },
  FileWrite:         { label: 'Writing' },
  Bash:              { label: 'Running' },
  Grep:              { label: 'Searching' },
  SemanticSearch:    { label: 'Semantic search' },
  IntentVerify:      { label: 'Verifying' },
  ExpandSymbol:      { label: 'Expanding' },
  CriticalArchitect: { label: 'Architecture review' },
  Memory:            { label: 'Memory' },
  CallGraph:         { label: 'Call graph' },
};

function formatArgHint(name, args) {
  if (!args) return '';
  const val = args.path || args.targetFile || args.query || args.command || args.intent || args.action || '';
  if (!val) return '';
  const s = String(val);
  return chalk.gray(' ' + (s.length > 55 ? s.slice(0, 52) + '...' : s));
}

// ─── Banner with recent activity (Claude Code style) ─────────────────────────
function printBanner(sessions) {
  const cwd = process.cwd();
  const leftW = 34;
  const rightW = 44;
  const totalW = leftW + rightW + 3;

  const line = (left, right) => {
    const l = left.padEnd ? left : left;
    return chalk.gray('\u2502') + l + chalk.gray('\u2502') + right + chalk.gray('\u2502');
  };

  const pad = (str, w) => {
    // strip ANSI codes for length calculation
    const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
    const spaces = Math.max(0, w - plain.length);
    return str + ' '.repeat(spaces);
  };

  console.log('');
  console.log(chalk.gray('\u256d' + '\u2500'.repeat(leftW) + '\u252c' + '\u2500'.repeat(rightW + 1) + '\u2500\u256e'));

  // Row 1: logo left, "Recent activity" right
  const logoLine1 = '  ' + chalk.bold.cyan('\u258c\u2580\u2588\u2588\u2588\u2584\u2590\u2588') + '  ' + chalk.bold.white('Claude-ACE') + chalk.gray(' v' + VERSION);
  const recentTitle = ' ' + chalk.bold.white('Recent activity');
  console.log(line(pad(logoLine1, leftW), pad(recentTitle, rightW + 1)));

  // Row 2: logo left, session list right
  const logoLine2 = '  ' + chalk.bold.cyan('\u2580\u2584\u2588\u2588\u2588\u2588\u2588\u2580\u2588\u2580') + '  ' + chalk.gray('GitHub: OpenDemon');
  const recent = sessions.slice(0, 4);
  const r0 = recent[0]
    ? ' ' + chalk.gray(SessionManager.relativeTime(recent[0].updatedAt).padEnd(8)) + ' ' + chalk.white((recent[0].name || '').slice(0, 30))
    : ' ' + chalk.gray('\u6682\u65e0\u5386\u53f2\u8bb0\u5f55');
  console.log(line(pad(logoLine2, leftW), pad(r0, rightW + 1)));

  // Row 3: logo left, more sessions right
  const logoLine3 = '  ' + chalk.bold.cyan('  \u2598\u2598 \u259d\u259d') + '    ' + chalk.gray(cwd.length > 22 ? '...' + cwd.slice(-19) : cwd);
  const r1 = recent[1]
    ? ' ' + chalk.gray(SessionManager.relativeTime(recent[1].updatedAt).padEnd(8)) + ' ' + chalk.white((recent[1].name || '').slice(0, 30))
    : '';
  console.log(line(pad(logoLine3, leftW), pad(r1, rightW + 1)));

  // Row 4: model left, more sessions right
  const modelLine = '  ' + chalk.gray(MODEL + ' \u00b7 API Usage Billing');
  const r2 = recent[2]
    ? ' ' + chalk.gray(SessionManager.relativeTime(recent[2].updatedAt).padEnd(8)) + ' ' + chalk.white((recent[2].name || '').slice(0, 30))
    : '';
  console.log(line(pad(modelLine, leftW), pad(r2, rightW + 1)));

  // Row 5: empty left, /resume hint right
  const r3 = recent[3]
    ? ' ' + chalk.gray(SessionManager.relativeTime(recent[3].updatedAt).padEnd(8)) + ' ' + chalk.white((recent[3].name || '').slice(0, 30))
    : '';
  const resumeHint = sessions.length > 4 ? ' ' + chalk.gray('/resume \u67e5\u770b\u66f4\u591a') : r3;
  console.log(line(pad('', leftW), pad(resumeHint, rightW + 1)));

  console.log(chalk.gray('\u2570' + '\u2500'.repeat(leftW) + '\u2534' + '\u2500'.repeat(rightW + 1) + '\u2500\u256f'));
  console.log('');
}

// ─── Trust confirmation ───────────────────────────────────────────────────────
async function confirmTrust() {
  const cwd = process.cwd();
  console.log(chalk.gray('\u2500'.repeat(80)));
  console.log(chalk.white(' \u5de5\u4f5c\u76ee\u5f55\uff1a'));
  console.log('');
  console.log(chalk.white(' ' + cwd));
  console.log('');
  console.log(chalk.white(' \u5b89\u5168\u786e\u8ba4\uff1a\u8fd9\u662f\u60a8\u521b\u5efa\u7684\u9879\u76ee\u6216\u60a8\u4fe1\u4efb\u7684\u9879\u76ee\u5417\uff1f'));
  console.log(chalk.gray(' Claude-ACE \u5c06\u80fd\u591f\u8bfb\u53d6\u3001\u7f16\u8f91\u548c\u6267\u884c\u6b64\u76ee\u5f55\u4e2d\u7684\u6587\u4ef6\u3002'));
  console.log('');
  console.log(chalk.gray('\u2500'.repeat(80)));
  console.log('');
  try {
    const answer = await select({
      message: '',
      choices: [
        { name: chalk.white('1. \u662f\uff0c\u6211\u4fe1\u4efb\u6b64\u76ee\u5f55'), value: 'yes' },
        { name: chalk.gray('2. \u5426\uff0c\u9000\u51fa'), value: 'no' },
      ],
      theme: { prefix: '', style: { highlight: (t) => chalk.bold.cyan(t) } }
    });
    return answer === 'yes';
  } catch (_) { return false; }
}

// ─── Slash command menu ───────────────────────────────────────────────────────
const SLASH_COMMANDS = [
  { name: '/help            \u663e\u793a\u5e2e\u52a9\u4fe1\u606f', value: '/help' },
  { name: '/clear           \u6e05\u7a7a\u5f53\u524d\u5bf9\u8bdd\u5386\u53f2', value: '/clear' },
  { name: '/stats           \u663e\u793a Token \u7edf\u8ba1', value: '/stats' },
  { name: '/status          \u663e\u793a\u7248\u672c\u3001\u6a21\u578b\u3001API \u8fde\u901a\u6027', value: '/status' },
  { name: '/skills          \u5217\u51fa\u6240\u6709 ACE \u5de5\u5177\u80fd\u529b', value: '/skills' },
  { name: '/resume          \u6062\u590d\u4e4b\u524d\u7684\u5bf9\u8bdd', value: '/resume' },
  { name: '/rename          \u91cd\u547d\u540d\u5f53\u524d\u5bf9\u8bdd', value: '/rename' },
  { name: '/rewind          \u56de\u9000\u5230\u4e0a\u4e00\u6761\u6d88\u606f\u4e4b\u524d', value: '/rewind' },
  { name: '/release-notes   \u67e5\u770b\u7248\u672c\u66f4\u65b0\u65e5\u5fd7', value: '/release-notes' },
  { name: '/exit            \u9000\u51fa\u7a0b\u5e8f', value: '/exit' },
];

async function showSlashMenu() {
  try {
    return await select({
      message: '\u547d\u4ee4',
      choices: SLASH_COMMANDS,
      theme: { prefix: chalk.gray('/'), style: { highlight: (t) => chalk.bold.cyan(t) } }
    });
  } catch (_) { return null; }
}

// ─── Command handlers ─────────────────────────────────────────────────────────
function printHelp() {
  console.log('');
  console.log(chalk.bold.white(' \u547d\u4ee4\uff1a'));
  for (const cmd of SLASH_COMMANDS) {
    console.log(' ' + chalk.cyan(cmd.value.padEnd(18)) + chalk.gray(cmd.name.split('  ').slice(-1)[0].trim()));
  }
  console.log('');
  console.log(chalk.gray(' \u8f93\u5165 / \u5f39\u51fa\u547d\u4ee4\u83dc\u5355\uff0c\u4e0a\u4e0b\u7bad\u5934\u5207\u6362\u3002'));
  console.log('');
}

function printStats(stats) {
  console.log('');
  console.log(chalk.bold.white(' Token \u7edf\u8ba1\uff1a'));
  console.log('  \u8f93\u5165\uff1a  ' + chalk.yellow(stats.inputTokens.toLocaleString()));
  console.log('  \u8f93\u51fa\uff1a  ' + chalk.yellow(stats.outputTokens.toLocaleString()));
  console.log('  \u5de5\u5177\uff1a  ' + chalk.yellow(stats.toolCalls) + ' \u6b21\u8c03\u7528');
  console.log('');
}

async function printStatus() {
  const apiBase = process.env.OPENAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/';
  console.log('');
  console.log(chalk.bold.white(' \u72b6\u6001\uff1a'));
  console.log('  \u7248\u672c\uff1a    ' + chalk.cyan('v' + VERSION));
  console.log('  \u6a21\u578b\uff1a    ' + chalk.cyan(MODEL));
  console.log('  API\uff1a     ' + chalk.gray(apiBase));
  console.log('  \u4f5c\u8005\uff1a    ' + chalk.white('OpenDemon'));
  console.log('  GitHub\uff1a  ' + chalk.blue.underline('https://github.com/OpenDemon/claude-ace'));
  console.log('');
}

function printSkills() {
  console.log('');
  console.log(chalk.bold.white(' ACE \u5de5\u5177\u80fd\u529b\uff1a'));
  const skills = [
    ['FileRead',          '\u8bfb\u53d6\u6587\u4ef6\uff0c\u5927\u6587\u4ef6\u81ea\u52a8\u8fd4\u56de\u9aa8\u67b6\uff0c\u6309\u9700\u5c55\u5f00\u51fd\u6570'],
    ['FileWrite',         '\u5199\u5165\u6216\u8986\u76d6\u6587\u4ef6'],
    ['Bash',              '\u6267\u884c Shell \u547d\u4ee4\uff08ls\u3001node\u3001npm\u3001git \u7b49\uff09'],
    ['Grep',              '\u6b63\u5219\u641c\u7d22\u6587\u4ef6\u5185\u5bb9'],
    ['SemanticSearch',    'AST \u7ea7\u522b\u7b26\u53f7\u641c\u7d22\uff0c\u6bd4 Grep \u6548\u7387\u9ad8 10\u500d'],
    ['IntentVerify',      '\u610f\u56fe\u9a71\u52a8\u7684\u4ee3\u7801\u4fee\u6539 + \u81ea\u52a8\u6d4b\u8bd5\u9a8c\u8bc1\u95ed\u73af'],
    ['ExpandSymbol',      '\u6309\u9700\u5c55\u5f00\u51fd\u6570\u5b8c\u6574\u5b9e\u73b0\uff0c\u9632\u6b62\u5e7b\u89c9'],
    ['CriticalArchitect', '\u67b6\u6784\u5ba1\u67e5\uff1a\u5b89\u5168\u98ce\u9669\u3001\u6027\u80fd\u74f6\u9888\u3001\u53cd\u6a21\u5f0f\u5206\u6790'],
    ['Memory',            '\u8de8\u9879\u76ee\u8bb0\u5fc6\uff1a\u5b58\u50a8\u548c\u8c03\u53d6\u8c03\u8bd5\u7ecf\u9a8c'],
    ['CallGraph',         '\u8c03\u7528\u56fe\u5206\u6790\uff1a\u4fee\u6539\u51fd\u6570\u524d\u8bc4\u4f30\u5f71\u54cd\u8303\u56f4'],
  ];
  for (const [name, desc] of skills) {
    console.log('  ' + chalk.cyan(name.padEnd(18)) + chalk.gray(desc));
  }
  console.log('');
}

function printReleaseNotes() {
  console.log(renderMarkdown(RELEASE_NOTES));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const sm = new SessionManager();
  const sessions = sm.list(10);

  printBanner(sessions);

  const trusted = await confirmTrust();
  if (!trusted) {
    console.log(chalk.gray('\n \u5df2\u9000\u51fa\u3002\n'));
    process.exit(0);
  }

  console.log('');
  console.log(chalk.bold.cyan(' \u6b22\u8fce\u4f7f\u7528 Claude-ACE'));
  console.log('');

  const agent = new Agent();
  const watchdog = new WatchdogAgent(PROJECT_ROOT, { intervalMs: 300000 });
  watchdog.start();

  // Create a new session
  let sessionId = sm.create(process.cwd());
  let rewindStack = []; // stack of message snapshots for /rewind

  process.on('SIGINT', () => {
    sm.save(sessionId, agent.messages, agent.stats);
    console.log('\n' + chalk.gray(' \u518d\u89c1\uff01') + '\n');
    watchdog.stop();
    process.exit(0);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 200,
  });

  const askLine = () => new Promise((resolve) => {
    rl.question(chalk.bold.green('\u276f '), resolve);
  });

  while (true) {
    let userInput;
    try { userInput = await askLine(); } catch (_) { break; }

    const trimmed = userInput.trim();

    // Slash triggers menu
    if (trimmed === '/') {
      rl.pause();
      const cmd = await showSlashMenu();
      rl.resume();
      if (!cmd) continue;
      trimmed !== cmd && (userInput = cmd);
      // fall through to command handling below
      await handleCommand(cmd, agent, sm, sessionId, rl, watchdog, rewindStack);
      continue;
    }

    // Direct slash commands
    if (trimmed.startsWith('/')) {
      await handleCommand(trimmed, agent, sm, sessionId, rl, watchdog, rewindStack);
      continue;
    }

    if (!trimmed) continue;

    // Save rewind snapshot before each user turn
    rewindStack.push(JSON.parse(JSON.stringify(agent.messages)));
    if (rewindStack.length > 20) rewindStack.shift();

    // ── Stream response ─────────────────────────────────────────────────────
    console.log('');

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

    process.stdout.write(chalk.bold.cyan(' \u25cf ACE') + chalk.gray(' \u203a '));

    try {
      await agent.chat(trimmed, {
        onToken: (token) => {
          clearToolLine();
          if (streamedText === '') {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(chalk.bold.cyan(' \u25cf ACE') + chalk.gray(' \u203a '));
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
          const d = TOOL_DISPLAY[name] || { label: name };
          const hint = formatArgHint(name, args);
          process.stdout.write(chalk.gray(` \u25b6 ${d.label}`) + hint);
          toolLineActive = true;
        },
        onToolEnd: () => {
          clearToolLine();
          process.stdout.write(chalk.bold.cyan(' \u25cf ACE') + chalk.gray(' \u203a '));
          streamedText = '';
        }
      });

      clearToolLine();

      if (streamedText) {
        const rawLines = streamedText.split('\n').length;
        for (let i = 0; i < rawLines; i++) {
          readline.clearLine(process.stdout, 0);
          if (i < rawLines - 1) readline.moveCursor(process.stdout, 0, -1);
        }
        readline.cursorTo(process.stdout, 0);
        const rendered = renderMarkdown(streamedText);
        const indented = rendered.split('\n').map(l => ' ' + l).join('\n');
        process.stdout.write(chalk.bold.cyan('\u25cf ACE') + chalk.gray(' \u203a ') + indented);
      }

      console.log('');
      if (toolCount > 0) {
        const s = agent.stats;
        console.log(chalk.gray(` [${toolCount} \u6b21\u5de5\u5177\u8c03\u7528 \u00b7 \u7d2f\u8ba1\u8f93\u5165 ${s.inputTokens.toLocaleString()} tokens]`));
      }
      console.log('');

      // Auto-save session after each turn
      sm.save(sessionId, agent.messages, agent.stats);

    } catch (err) {
      clearToolLine();
      console.log('');
      console.log(chalk.red(` [\u9519\u8bef] ${err.message}`));
      if (err.message.includes('model') || err.message.includes('API') || err.message.includes('400')) {
        console.log(chalk.gray(' \u63d0\u793a\uff1a\u8bf7\u68c0\u67e5 OPENAI_API_KEY \u548c\u6a21\u578b\u540d\u79f0\u662f\u5426\u6b63\u786e\u3002'));
        console.log(chalk.gray(' \u5f53\u524d\u6a21\u578b\uff1a' + MODEL));
      }
      console.log('');
    }
  }
}

async function handleCommand(cmd, agent, sm, sessionId, rl, watchdog, rewindStack) {
  const base = cmd.split(' ')[0];

  if (base === '/exit' || base === '/quit') {
    sm.save(sessionId, agent.messages, agent.stats);
    console.log(chalk.gray('\n \u518d\u89c1\uff01\n'));
    watchdog.stop();
    rl.close();
    process.exit(0);
  }

  if (base === '/help') { printHelp(); return; }
  if (base === '/stats') { printStats(agent.stats); return; }
  if (base === '/status') { await printStatus(); return; }
  if (base === '/skills') { printSkills(); return; }
  if (base === '/release-notes') { printReleaseNotes(); return; }

  if (base === '/clear') {
    agent.messages = agent.messages.slice(0, 1);
    agent.stats = { inputTokens: 0, outputTokens: 0, toolCalls: 0 };
    rewindStack.length = 0;
    console.log(chalk.gray('\n \u5bf9\u8bdd\u5386\u53f2\u5df2\u6e05\u7a7a\u3002\n'));
    return;
  }

  if (base === '/rewind') {
    if (rewindStack.length === 0) {
      console.log(chalk.gray('\n \u65e0\u53ef\u56de\u9000\u7684\u5386\u53f2\u3002\n'));
      return;
    }
    agent.messages = rewindStack.pop();
    console.log(chalk.gray('\n \u5df2\u56de\u9000\u5230\u4e0a\u4e00\u6761\u6d88\u606f\u4e4b\u524d\u7684\u72b6\u6001\u3002\n'));
    return;
  }

  if (base === '/rename') {
    rl.pause();
    try {
      const newName = await input({
        message: '\u65b0\u540d\u79f0\uff1a',
        theme: { prefix: chalk.gray('\u276f') }
      });
      if (newName.trim()) {
        sm.rename(sessionId, newName.trim());
        console.log(chalk.gray(`\n \u5bf9\u8bdd\u5df2\u91cd\u547d\u540d\u4e3a\u300c${newName.trim()}\u300d\u3002\n`));
      }
    } catch (_) {}
    rl.resume();
    return;
  }

  if (base === '/resume') {
    const sessions = sm.list(20);
    if (sessions.length === 0) {
      console.log(chalk.gray('\n \u6682\u65e0\u5386\u53f2\u5bf9\u8bdd\u3002\n'));
      return;
    }
    rl.pause();
    try {
      const chosen = await select({
        message: '\u9009\u62e9\u8981\u6062\u590d\u7684\u5bf9\u8bdd',
        choices: sessions.map(s => ({
          name: chalk.gray(SessionManager.relativeTime(s.updatedAt).padEnd(10)) + ' ' + chalk.white((s.name || '').slice(0, 50)),
          value: s.id,
          short: s.name || s.id,
        })),
        theme: { prefix: '', style: { highlight: (t) => chalk.bold.cyan(t) } }
      });
      const loaded = sm.load(chosen);
      if (loaded) {
        agent.messages = loaded.messages;
        agent.stats = loaded.stats || { inputTokens: 0, outputTokens: 0, toolCalls: 0 };
        sessionId = loaded.id;
        rewindStack.length = 0;
        console.log(chalk.gray(`\n \u5df2\u6062\u590d\u5bf9\u8bdd\u300c${loaded.name}\u300d\uff0c\u5171 ${loaded.messages.length - 1} \u6761\u6d88\u606f\u3002\n`));
      }
    } catch (_) {}
    rl.resume();
    return;
  }

  console.log(chalk.gray(`\n \u672a\u77e5\u547d\u4ee4\uff1a${cmd}\uff0c\u8f93\u5165 /help \u67e5\u770b\u5e2e\u52a9\u3002\n`));
}

main().catch(console.error);
