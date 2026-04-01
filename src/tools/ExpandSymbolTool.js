/**
 * ExpandSymbolTool.js — Lazy Loading for ACE
 * Author: OpenDemon
 * 
 * This tool allows the Agent to explicitly request the full implementation
 * of a specific function/class when it only has the skeleton view.
 * This solves the "hallucination due to missing context" problem while
 * keeping the default token usage low.
 */

import { ContextLoader } from '../ace/ContextLoader.js';

export class ExpandSymbolTool {
  constructor() {
    this.loader = new ContextLoader();
  }

  get name() { return 'ExpandSymbol'; }
  get description() { 
    return 'Expand the full implementation of a specific function or class from a file. Use this when you only have the skeleton view and need to understand the internal logic of a specific symbol before modifying code or reusing it.'; 
  }
  get parameters() {
    return {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        symbolName: { type: 'string', description: 'Name of the function or class to expand (e.g., "parseConfig")' }
      },
      required: ['path', 'symbolName']
    };
  }

  async execute({ path, symbolName }) {
    // We reuse the existing _extractTargetFunction logic from ContextLoader
    // but expose it as a dedicated, semantic tool for the Agent.
    const result = this.loader.load(path, { targetFunction: symbolName });
    
    if (result.includes(`[ACE] Function "${symbolName}" not found`)) {
      return `[ExpandSymbol Error] Symbol "${symbolName}" not found in ${path}. Are you sure it exists in this file?`;
    }
    
    return result;
  }
}
