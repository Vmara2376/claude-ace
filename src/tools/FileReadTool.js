/**
 * FileReadTool.js — ACE-integrated file reader
 * Author: OpenDemon
 */
import { ContextLoader } from '../ace/ContextLoader.js';
const loader = new ContextLoader();

export class FileReadTool {
  get name() { return 'FileRead'; }
  get description() { return 'Read a file. ACE automatically serves skeleton for large files. Use targetFunction to extract a specific function body. Use forceFull=true to bypass ACE.'; }
  get parameters() {
    return {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        targetFunction: { type: 'string', description: 'Name of a specific function to extract' },
        forceFull: { type: 'boolean', description: 'If true, bypass ACE and return full file content' }
      },
      required: ['path']
    };
  }
  async execute({ path, targetFunction, forceFull = false }) {
    return loader.load(path, { targetFunction, forceFull });
  }
}
