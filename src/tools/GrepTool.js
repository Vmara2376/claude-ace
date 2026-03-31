/**
 * GrepTool.js — Regex file search
 * Author: OpenDemon
 */
import { execSync } from 'child_process';

export class GrepTool {
  get name() { return 'Grep'; }
  get description() { return 'Search for a regex pattern in files. Returns matching lines with file path and line number.'; }
  get parameters() {
    return {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'Directory or file path to search in' },
        filePattern: { type: 'string', description: 'Glob pattern for files (e.g. "*.ts")' }
      },
      required: ['pattern', 'path']
    };
  }
  async execute({ pattern, path, filePattern }) {
    try {
      const include = filePattern ? `--include="${filePattern}"` : '';
      const escapedPattern = pattern.replace(/"/g, '\\"');
      const cmd = `grep -rn ${include} "${escapedPattern}" "${path}" 2>/dev/null | head -50`;
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
      return output || `[Grep] No matches found for pattern: ${pattern}`;
    } catch (e) {
      return `[Grep] No matches found for pattern: ${pattern}`;
    }
  }
}
