/**
 * SkeletonExtractor.js
 * Uses Tree-sitter to parse TypeScript/JavaScript AST and extract structural skeletons.
 * Replaces function bodies with { ... } while preserving all signatures, types, and imports.
 *
 * Author: OpenDemon
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const Parser = require('tree-sitter');
const { typescript, tsx } = require('tree-sitter-typescript');

const BUFFER_SIZE = 2 * 1024 * 1024; // 2MB — handles files with very long lines

/**
 * Extract a structural skeleton from TypeScript/TSX source code.
 * @param {string} source - Full source code
 * @param {string} filePath - File path (used to detect .tsx)
 * @returns {string} Skeleton with function bodies replaced by { ... }
 */
export function extractSkeleton(source, filePath = '') {
  const isTsx = filePath.endsWith('.tsx');
  const parser = new Parser();
  parser.setLanguage(isTsx ? tsx : typescript);

  let tree;
  try {
    tree = parser.parse(source, null, { bufferSize: BUFFER_SIZE });
  } catch (e) {
    return source.split('\n').slice(0, 200).join('\n') + '\n// [ACE: parse failed, showing first 200 lines]';
  }

  const lines = source.split('\n');
  const replacements = [];

  function visit(node) {
    const bodyTypes = ['function_declaration', 'function', 'method_definition', 'arrow_function'];
    if (bodyTypes.includes(node.type)) {
      const bodyNode = node.children.find(c => c.type === 'statement_block');
      if (bodyNode) {
        const startLine = bodyNode.startPosition.row;
        const endLine = bodyNode.endPosition.row;
        if (endLine > startLine) {
          replacements.push({ startLine, endLine });
        }
      }
    }
    for (const child of node.children) visit(child);
  }

  visit(tree.rootNode);
  replacements.sort((a, b) => b.startLine - a.startLine);

  const resultLines = [...lines];
  for (const { startLine, endLine } of replacements) {
    const openBrace = resultLines[startLine];
    const closeBrace = resultLines[endLine];
    resultLines.splice(startLine, endLine - startLine + 1, openBrace, '  // ...', closeBrace);
  }

  return resultLines.join('\n');
}

/**
 * Check if a file is "type-dense" (mostly interface/type declarations).
 * Type-dense files should be served in full, not skeletonized.
 */
export function isTypeDense(source) {
  const lines = source.split('\n').filter(l => l.trim().length > 0);
  const typeLines = lines.filter(l =>
    /^\s*(export\s+)?(interface|type|enum)\s/.test(l) ||
    /^\s*[/*]/.test(l) ||
    /^\s*\}/.test(l)
  );
  return typeLines.length / lines.length > 0.55;
}
