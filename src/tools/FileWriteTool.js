/**
 * FileWriteTool.js
 * Author: OpenDemon
 */
import fs from 'fs';
import path from 'path';

export class FileWriteTool {
  get name() { return 'FileWrite'; }
  get description() { return 'Write content to a file. Creates parent directories as needed.'; }
  get parameters() {
    return {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to write to' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    };
  }
  async execute({ path: filePath, content }) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return `[FileWrite] Successfully wrote ${content.length} chars to ${filePath}`;
  }
}
