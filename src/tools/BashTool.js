/**
 * BashTool.js — Shell command execution with safety checks
 * Author: OpenDemon
 *
 * Security fix: Expanded blocklist with path protection and dangerous pattern detection.
 */
import { execSync } from 'child_process';

// Exact string patterns that are always blocked
const BLOCKED_PATTERNS = [
  // Fork bombs & destructive disk ops
  ':(){:|:&};:',
  'mkfs',
  'dd if=/dev/zero',
  'dd if=/dev/random',
  // Dangerous rm variants
  'rm -rf /',
  'rm -rf ~',
  'rm -fr /',
  'rm -fr ~',
  // Privilege escalation
  'sudo rm',
  'sudo chmod 777',
  'sudo chown',
  // Pipe-to-shell attacks
  'curl | bash',
  'curl | sh',
  'wget | bash',
  'wget | sh',
  'curl|bash',
  'curl|sh',
  'wget|bash',
  'wget|sh',
  // Reverse shells
  '/dev/tcp/',
  '/dev/udp/',
  'nc -e',
  'ncat -e',
  'bash -i',
  'sh -i',
  // Crontab / init manipulation
  'crontab -r',
  '> /etc/crontab',
  '>> /etc/crontab',
];

// Regex patterns for more complex dangerous constructs
const BLOCKED_REGEXES = [
  // Writing to system directories
  />\s*\/etc\//,
  />\s*\/usr\//,
  />\s*\/bin\//,
  />\s*\/sbin\//,
  />\s*\/lib\//,
  />\s*\/boot\//,
  />\s*\/sys\//,
  />\s*\/proc\//,
  // chmod 777 on sensitive paths
  /chmod\s+777\s+\//,
  // Removing system directories
  /rm\s+.*\s+\/etc/,
  /rm\s+.*\s+\/usr/,
  /rm\s+.*\s+\/bin/,
  // Backtick or $() injection into dangerous contexts
  /`[^`]*rm[^`]*`/,
  /\$\([^)]*rm[^)]*\)/,
];

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
    // Check exact string patterns
    for (const blocked of BLOCKED_PATTERNS) {
      if (command.includes(blocked)) {
        return `[Bash Error] Command blocked for safety: contains "${blocked}"`;
      }
    }

    // Check regex patterns
    for (const regex of BLOCKED_REGEXES) {
      if (regex.test(command)) {
        return `[Bash Error] Command blocked for safety: matches dangerous pattern "${regex.source}"`;
      }
    }

    try {
      const opts = {
        timeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      };
      const output = execSync(command, opts);
      return output || '[Bash] Command completed with no output';
    } catch (e) {
      return `[Bash Error] Exit code ${e.status}:\n${e.stderr || e.message}`;
    }
  }
}
