/**
 * ContextLoader.js — Adaptive Context Engine
 * Author: OpenDemon
 */
import fs from 'fs';
import { extractSkeleton, isTypeDense } from './SkeletonExtractor.js';

const SKELETON_THRESHOLD = 200;

export class ContextLoader {
  load(filePath, options = {}) {
    if (!fs.existsSync(filePath)) return `[ACE Error] File not found: ${filePath}`;
    const source = fs.readFileSync(filePath, 'utf-8');
    const lines = source.split('\n');

    if (options.forceFull) return `=== FILE: ${filePath} ===\n=== STRATEGY: FULL (forced) ===\n${source}`;
    if (options.targetFunction) return this._extractTargetFunction(source, filePath, options.targetFunction);
    if (lines.length < SKELETON_THRESHOLD) return `=== FILE: ${filePath} ===\n=== STRATEGY: FULL (Small File, ${lines.length} lines) ===\n${source}`;
    if (isTypeDense(source)) return `=== FILE: ${filePath} ===\n=== STRATEGY: FULL (Type-Dense File) ===\n${source}`;

    const skeleton = extractSkeleton(source, filePath);
    const skeletonLines = skeleton.split('\n').length;
    return `=== FILE: ${filePath} ===\n=== STRATEGY: SKELETON (Large File, ${lines.length} lines -> ${skeletonLines} skeleton lines) ===\n=== NOTE: Function bodies replaced with { // ... }. Use FileRead with targetFunction="<name>" to see full body. ===\n${skeleton}`;
  }

  _extractTargetFunction(source, filePath, targetFunction) {
    const lines = source.split('\n');
    const results = [];
    let inTarget = false, braceDepth = 0, startLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inTarget && (line.includes(`function ${targetFunction}`) || line.includes(`${targetFunction}(`) || line.includes(`${targetFunction} =`))) {
        inTarget = true; startLine = i; braceDepth = 0;
      }
      if (inTarget) {
        results.push(line);
        braceDepth += (line.match(/\{/g)||[]).length;
        braceDepth -= (line.match(/\}/g)||[]).length;
        if (braceDepth <= 0 && results.length > 1) break;
      }
    }
    if (results.length === 0) return `[ACE] Function "${targetFunction}" not found in ${filePath}.`;
    return `=== FILE: ${filePath} ===\n=== STRATEGY: TARGETED (function: ${targetFunction}, lines ${startLine+1}-${startLine+results.length}) ===\n${results.join('\n')}`;
  }
}
