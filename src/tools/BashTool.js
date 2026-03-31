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
      const output = execSync(command, { timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      return output || '[Bash] Command completed with no output';
    } catch (e) {
      return `[Bash Error] Exit code ${e.status}:\n${e.stderr || e.message}`;
    }
  }
}
