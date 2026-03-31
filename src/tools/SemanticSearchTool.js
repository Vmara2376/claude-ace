/**
 * SemanticSearchTool.js — AST-aware symbol search
 * Author: OpenDemon
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const Parser = require('tree-sitter');
const { typescript, tsx } = require('tree-sitter-typescript');
const BUFFER_SIZE = 2 * 1024 * 1024;

export class SemanticSearchTool {
  get name() { return 'SemanticSearch'; }
  get description() { return 'Search for symbols (functions, classes, interfaces, types) in TypeScript/JavaScript files using AST parsing. Much more precise and token-efficient than Grep for symbol lookup.'; }
  get parameters() {
    return {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol name or partial name to search for' },
        path: { type: 'string', description: 'Directory or file path to search in' },
        kind: { type: 'string', enum: ['function', 'class', 'interface', 'type', 'all'], description: 'Kind of symbol (default: all)' }
      },
      required: ['query', 'path']
    };
  }
  async execute({ query, path: searchPath, kind = 'all' }) {
    const files = this._collectFiles(searchPath);
    const results = [];
    for (const filePath of files) {
      try {
        const source = fs.readFileSync(filePath, 'utf-8');
        const symbols = this._extractSymbols(source, filePath);
        const matches = symbols.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) && (kind === 'all' || s.kind === kind));
        results.push(...matches);
      } catch (e) {}
    }
    if (results.length === 0) return `[SemanticSearch] No symbols matching "${query}" found in ${searchPath}`;
    const output = results.slice(0, 30).map(r => `[${r.kind}] ${r.name}  ->  ${r.file}:${r.line}`).join('\n');
    return `[SemanticSearch] Found ${results.length} symbol(s) matching "${query}":\n\n${output}\n\nUse FileRead with targetFunction="<name>" to see the full implementation.`;
  }
  _collectFiles(searchPath) {
    const stat = fs.statSync(searchPath);
    if (stat.isFile()) return [searchPath];
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') walk(full);
        else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
      }
    };
    walk(searchPath);
    return files;
  }
  _extractSymbols(source, filePath) {
    const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
    const parser = new Parser();
    parser.setLanguage(isTsx ? tsx : typescript);
    let tree;
    try { tree = parser.parse(source, null, { bufferSize: BUFFER_SIZE }); } catch (e) { return []; }
    const symbols = [];
    const visit = (node) => {
      const typeMap = { function_declaration: 'function', function: 'function', class_declaration: 'class', interface_declaration: 'interface', type_alias_declaration: 'type' };
      if (typeMap[node.type]) {
        const nameNode = node.childForFieldName('name');
        if (nameNode) symbols.push({ kind: typeMap[node.type], name: nameNode.text, file: filePath, line: node.startPosition.row + 1 });
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
    return symbols;
  }
}
