/**
 * BashTool.js — Shell command execution with safety checks
 * Author: OpenDemon
 */
import { execSync } from 'child_process';

const BLOCKED_PATTERNS = ['mkfs', ':(){:|:&};:', 'dd if=/dev/zero'];

export class BashTool {
  get name() { return 'Bash'; }
  get description() { return 'Execute a shell command. Dangerous commands are blocked.'; }
  get parameters() {
    return {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' }
      },
      required: ['command']
    };
  }
  async execute({ command, timeout = 30000 }) {
    for (const blocked of BLOCKED_PATTERNS) {
      if (command.includes(blocked)) return `[Bash Error] Command blocked for safety: "${blocked}"`;
    }
    try {
      // Windows 兼容：在 Windows 上使用 cmd.exe 执行命令
      const opts = {
        timeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      };
      const output = execSync(command, opts);
      return output || '[Bash] Command completed with no output';
    } catch (e) {
      return `[Bash Error] Exit code ${e.status}:\n${e.stderr || e.message}`;
    }
  }
}
