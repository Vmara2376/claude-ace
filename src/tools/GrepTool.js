/**
 * GrepTool.js — Regex file search
 * Author: OpenDemon
 *
 * Security fix: Use spawnSync with argument array instead of execSync with shell
 * interpolation to prevent command injection vulnerabilities.
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

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

  async execute({ pattern, path: searchPath, filePattern }) {
    try {
      // Validate path exists
      const resolvedPath = path.resolve(searchPath);
      if (!existsSync(resolvedPath)) {
        return `[Grep] Path not found: ${searchPath}`;
      }

      // Build argument array — no shell interpolation, immune to injection
      const args = ['-rn', '--max-count=5'];

      if (filePattern) {
        args.push(`--include=${filePattern}`);
      }

      // Pattern and path are passed as separate arguments, never concatenated into a shell string
      args.push(pattern);
      args.push(resolvedPath);

      const result = spawnSync('grep', args, {
        encoding: 'utf-8',
        timeout: 15000,
        maxBuffer: 1024 * 1024
      });

      // grep exits with 1 when no matches found (not an error)
      if (result.status === 0 && result.stdout) {
        // Limit output to 50 lines
        const lines = result.stdout.split('\n').slice(0, 50);
        return lines.join('\n') || `[Grep] No matches found for pattern: ${pattern}`;
      }

      if (result.error) {
        return `[Grep] Error: ${result.error.message}`;
      }

      return `[Grep] No matches found for pattern: ${pattern}`;
    } catch (e) {
      return `[Grep] Error: ${e.message}`;
    }
  }
}
