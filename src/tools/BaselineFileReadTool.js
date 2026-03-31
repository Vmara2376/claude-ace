/**
 * BaselineFileReadTool.js — Full file reader (no ACE, for benchmarking)
 * Author: OpenDemon
 */
import fs from 'fs';

export class BaselineFileReadTool {
  get name() { return 'FileRead'; }
  get description() { return 'Read a file and return its full content.'; }
  get parameters() {
    return { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] };
  }
  async execute({ path }) {
    if (!fs.existsSync(path)) return `[Error] File not found: ${path}`;
    const content = fs.readFileSync(path, 'utf-8');
    return `=== FILE: ${path} ===\n${content}`;
  }
}
