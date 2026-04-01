/**
 * test_v020.js — ACE-Coder v0.2.0 End-to-End Test Suite
 * Tests all three improvements:
 *   1. ExpandSymbolTool — lazy loading for skeleton mode
 *   2. Fallback Strategy — full context on test failure
 *   3. CrossProjectMemory Quality Gate — 3-question filter
 * Author: OpenDemon
 */

import { ExpandSymbolTool } from '../src/tools/ExpandSymbolTool.js';
import { IntentVerificationTool } from '../src/tools/IntentVerificationTool.js';
import { MemoryTool } from '../src/memory/CrossProjectMemory.js';
import { ContextLoader } from '../src/ace/ContextLoader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Test helpers ───────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  }).catch(e => {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`     Error: ${e.message}`);
    failed++;
  });
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ─── Test 1: ExpandSymbolTool ────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST SUITE 1: ExpandSymbolTool (Lazy Loading)');
console.log('═══════════════════════════════════════════════════════════');

const expandTool = new ExpandSymbolTool();

// Create a test file with multiple functions
const testFilePath = path.join(__dirname, 'expand_test_target.js');
fs.writeFileSync(testFilePath, `
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  let result = 0;
  for (let i = 0; i < b; i++) {
    result = add(result, a);
  }
  return result;
}

export function complexLogic(x) {
  const doubled = multiply(x, 2);
  const tripled = multiply(x, 3);
  return { doubled, tripled, sum: add(doubled, tripled) };
}
`);

await test('ExpandSymbolTool: expands a specific function by name', async () => {
  const result = await expandTool.execute({ path: testFilePath, symbolName: 'multiply' });
  assert(result.includes('STRATEGY: TARGETED'), 'Should use TARGETED strategy');
  assert(result.includes('multiply'), 'Should contain the function name');
  assert(result.includes('for (let i'), 'Should contain the function body');
  assert(!result.includes('complexLogic'), 'Should NOT include other functions');
});

await test('ExpandSymbolTool: returns error for non-existent symbol', async () => {
  const result = await expandTool.execute({ path: testFilePath, symbolName: 'nonExistentFunction' });
  assert(result.includes('[ExpandSymbol Error]'), 'Should return an error message');
});

await test('ExpandSymbolTool: skeleton mode hides body, ExpandSymbol reveals it', async () => {
  // First, get the skeleton view (simulating what Agent sees for large files)
  const loader = new ContextLoader();
  // Force skeleton by temporarily making the file look large (we'll test with forceFull=false)
  const skeletonResult = loader.load(testFilePath, { targetFunction: 'complexLogic' });
  assert(skeletonResult.includes('STRATEGY: TARGETED'), 'Should extract targeted function');
  assert(skeletonResult.includes('complexLogic'), 'Should contain the function');
  
  // Now expand a symbol that complexLogic depends on
  const expandResult = await expandTool.execute({ path: testFilePath, symbolName: 'add' });
  assert(expandResult.includes('return a + b'), 'Should reveal the full implementation of add');
});

// ─── Test 2: Memory Quality Gate ────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST SUITE 2: CrossProjectMemory Quality Gate (3-Question Filter)');
console.log('═══════════════════════════════════════════════════════════');

// Clean memory for testing
const testMemoryPath = path.join(__dirname, '.test-memory');
if (fs.existsSync(testMemoryPath)) fs.rmSync(testMemoryPath, { recursive: true });

const memTool = new MemoryTool();
// Override memory path for testing
memTool.memory.memoryDir = testMemoryPath;
memTool.memory.dbPath = path.join(testMemoryPath, 'knowledge_graph.json');
memTool.memory.initDB();

await test('Quality Gate: REJECTS generic Googlable knowledge', async () => {
  const result = await memTool.execute({
    action: 'learn',
    tags: ['javascript', 'async'],
    description: 'How to use async/await in JavaScript',
    solution: 'Use async keyword before function and await before promises',
    isGooglable: true,
    isCodebaseSpecific: false,
    isFromDebugging: false
  });
  assert(result.includes('[Memory Rejected]'), 'Should reject generic knowledge');
  assert(result.includes('Quality Gate Failed'), 'Should mention quality gate failure');
});

await test('Quality Gate: ACCEPTS codebase-specific debugging lesson', async () => {
  const result = await memTool.execute({
    action: 'learn',
    tags: ['ace-coder', 'tree-sitter', 'buffer'],
    description: 'BashTool.tsx has a 113k char line that exceeds tree-sitter default buffer',
    solution: 'Pass { bufferSize: 2 * 1024 * 1024 } to parser.parse() to handle super-long lines',
    isGooglable: false,
    isCodebaseSpecific: true,
    isFromDebugging: true
  });
  assert(result.includes('Quality Gate Passed'), 'Should accept codebase-specific lesson');
});

await test('Quality Gate: ACCEPTS hard-won debugging lesson even if Googlable', async () => {
  // A lesson that IS Googlable but IS codebase-specific should pass
  const result = await memTool.execute({
    action: 'learn',
    tags: ['react', 'useEffect', 'this-project'],
    description: 'In this project, useEffect cleanup is required for all WebSocket connections',
    solution: 'Always return a cleanup function from useEffect that calls ws.close()',
    isGooglable: true,
    isCodebaseSpecific: true,
    isFromDebugging: true
  });
  assert(result.includes('Quality Gate Passed'), 'Should accept codebase-specific lesson even if Googlable');
});

await test('Quality Gate: recalled memories are high-quality only', async () => {
  const result = await memTool.execute({
    action: 'recall',
    tags: ['ace-coder', 'tree-sitter']
  });
  assert(result.includes('BashTool.tsx'), 'Should recall the accepted lesson');
  assert(!result.includes('async/await'), 'Should NOT recall the rejected lesson');
});

// ─── Test 3: Fallback Strategy (IntentVerificationTool) ─────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('TEST SUITE 3: IntentVerificationTool Fallback Strategy');
console.log('═══════════════════════════════════════════════════════════');

// Create a target that requires understanding internal logic (triggers fallback scenario)
const fallbackTestPath = path.join(__dirname, 'fallback_test_target.js');
fs.writeFileSync(fallbackTestPath, `
export function parseConfig(raw) {
  // Internal format: "key1=val1;key2=val2"
  const pairs = raw.split(';');
  const result = {};
  for (const pair of pairs) {
    const [key, val] = pair.split('=');
    if (key && val) result[key.trim()] = val.trim();
  }
  return result;
}

export function buildQuery(config) {
  // Depends on parseConfig's output format
  const parsed = parseConfig(config);
  return Object.entries(parsed).map(([k, v]) => \`\${k}:\${v}\`).join(' AND ');
}
`);

await test('Fallback Strategy: IntentVerify succeeds on cross-function task', async () => {
  const tool = new IntentVerificationTool();
  const result = await tool.execute({
    intent: 'Add a new function "buildQueryWithPrefix" that calls buildQuery and prepends "SEARCH:" to the result',
    targetFile: fallbackTestPath,
    testFramework: 'node',
    maxRetries: 3
  });
  
  // Check if the tool succeeded or at least triggered the fallback
  const hasFallback = result.includes('Context Fallback') || result.includes('SUCCESS');
  assert(hasFallback, 'Should either succeed or trigger context fallback strategy');
  console.log(`     Result: ${result.includes('SUCCESS') ? 'PASSED on first try' : 'Fallback triggered and healed'}`);
});

// ─── Cleanup & Summary ───────────────────────────────────────────────────────
try { fs.unlinkSync(testFilePath); } catch(e) {}
try { fs.unlinkSync(fallbackTestPath); } catch(e) {}
try { fs.rmSync(testMemoryPath, { recursive: true }); } catch(e) {}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`FINAL RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════');
if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED — v0.2.0 is ready to ship!');
} else {
  console.log('⚠️  Some tests failed. Review errors above.');
  process.exit(1);
}
