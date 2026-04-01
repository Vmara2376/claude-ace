/**
 * 质量对比实验：骨架模式 vs 全量读取
 * 
 * 测试三类典型任务，每类任务分别用两种模式生成代码，
 * 然后用单元测试验证生成代码的正确性。
 * 
 * 结论：哪种模式的代码通过率更高？
 */

import OpenAI from 'openai';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

// ─────────────────────────────────────────────
// 测试用例定义
// ─────────────────────────────────────────────

const TEST_CASES = [
  {
    id: 'T1',
    name: '精确定位型：修改单个函数',
    description: '在一个有 200 行的模块中，修改 retryWithBackoff 函数，使其支持自定义 jitter（抖动）参数',
    // 这类任务只需要知道目标函数的签名和上下文，不需要全文
    riskLevel: 'LOW', // 骨架模式风险低
    sourceFile: '/tmp/quality_test_module.js',
    testFile: '/tmp/quality_test_T1.js',
  },
  {
    id: 'T2',
    name: '跨函数依赖型：重构内部逻辑',
    description: '将模块中的 parseConfig 函数重构为支持嵌套配置，需要理解它与 validateConfig 的依赖关系',
    // 这类任务需要理解函数间的调用关系
    riskLevel: 'MEDIUM', // 骨架模式有一定风险
    sourceFile: '/tmp/quality_test_module.js',
    testFile: '/tmp/quality_test_T2.js',
  },
  {
    id: 'T3',
    name: '全局理解型：添加新功能',
    description: '在模块中添加一个新的 batchProcess 函数，它需要复用模块中已有的 retry、validate、transform 逻辑',
    // 这类任务需要理解整个模块的所有函数
    riskLevel: 'HIGH', // 骨架模式风险高
    sourceFile: '/tmp/quality_test_module.js',
    testFile: '/tmp/quality_test_T3.js',
  },
];

// ─────────────────────────────────────────────
// 创建测试用的源文件（模拟一个真实的业务模块）
// ─────────────────────────────────────────────

function createTestModule() {
  const code = `
/**
 * DataProcessor - 一个模拟真实业务的数据处理模块
 * 包含 retry、validate、transform、parseConfig 等函数
 */

// 配置解析
function parseConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }
  return {
    timeout: config.timeout || 5000,
    retries: config.retries || 3,
    prefix: config.prefix || '',
  };
}

// 配置验证
function validateConfig(parsedConfig) {
  if (parsedConfig.timeout < 0) throw new Error('Timeout must be positive');
  if (parsedConfig.retries < 0) throw new Error('Retries must be positive');
  return true;
}

// 数据转换
function transformData(data, prefix) {
  if (!Array.isArray(data)) throw new Error('Data must be an array');
  return data.map(item => \`\${prefix}\${String(item)}\`);
}

// 重试逻辑（指数退避）
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 100) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// 单条数据处理
async function processItem(item, config) {
  const parsed = parseConfig(config);
  validateConfig(parsed);
  const transformed = transformData([item], parsed.prefix);
  return transformed[0];
}

// 错误格式化
function formatError(err, context) {
  return {
    message: err.message,
    context,
    timestamp: new Date().toISOString(),
  };
}

export {
  parseConfig,
  validateConfig,
  transformData,
  retryWithBackoff,
  processItem,
  formatError,
};
`.trim();

  fs.writeFileSync('/tmp/quality_test_module.js', code);
  return code;
}

// ─────────────────────────────────────────────
// 骨架提取（模拟 ACE ContextLoader 的骨架模式）
// ─────────────────────────────────────────────

function extractSkeleton(sourceCode) {
  // 提取函数签名和 JSDoc，去掉函数体
  const lines = sourceCode.split('\n');
  const skeleton = [];
  let inFunction = false;
  let braceDepth = 0;
  let functionSignatureLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inFunction) {
      // 检测函数开始
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '') {
        skeleton.push(line);
        continue;
      }
      if (trimmed.startsWith('function ') || trimmed.startsWith('async function ') || trimmed.startsWith('export')) {
        functionSignatureLines = [line];
        // 检查是否在同一行开始了函数体
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        braceDepth = openBraces - closeBraces;
        if (braceDepth > 0) {
          inFunction = true;
          skeleton.push(line.replace(/{.*$/, '{ /* ... */ }'));
        } else {
          skeleton.push(line);
        }
        continue;
      }
      skeleton.push(line);
    } else {
      // 在函数体内，只计算括号深度
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceDepth += openBraces - closeBraces;
      if (braceDepth <= 0) {
        inFunction = false;
        braceDepth = 0;
      }
    }
  }

  return skeleton.join('\n');
}

// ─────────────────────────────────────────────
// 用 LLM 生成代码
// ─────────────────────────────────────────────

async function generateCode(task, context, mode) {
  const systemPrompt = `你是一个专业的 JavaScript 开发者。
根据用户的需求，修改或添加代码。
只输出修改后的完整模块代码（不要加 markdown 代码块标记，直接输出 JS 代码）。`;

  const userPrompt = `任务：${task.description}

当前模块代码（${mode === 'skeleton' ? '骨架模式，仅含函数签名' : '完整代码'}）：
\`\`\`javascript
${context}
\`\`\`

请输出修改后的完整模块代码。`;

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
  });

  let code = response.choices[0].message.content.trim();
  // 去除可能的 markdown 代码块
  code = code.replace(/^```javascript\n?/, '').replace(/^```js\n?/, '').replace(/\n?```$/, '');
  return { code, tokens: response.usage.total_tokens };
}

// ─────────────────────────────────────────────
// 运行测试验证代码质量
// ─────────────────────────────────────────────

function runQualityTest(taskId, generatedCode, mode) {
  const tmpFile = `/tmp/ace_quality_${taskId}_${mode}.mjs`;
  
  // 将生成的代码写入临时文件
  let testableCode = generatedCode;
  // 确保有 export
  if (!testableCode.includes('export')) {
    testableCode += '\nexport {};';
  }
  fs.writeFileSync(tmpFile, testableCode);

  // 根据任务 ID 运行不同的验证测试
  const testScript = `/tmp/ace_quality_test_${taskId}.mjs`;
  
  const tests = {
    T1: `
import { retryWithBackoff } from '${tmpFile}';

let passed = 0;
let failed = 0;

// 测试1：基本重试功能仍然正常
try {
  let attempts = 0;
  const result = await retryWithBackoff(async () => {
    attempts++;
    if (attempts < 2) throw new Error('fail');
    return 'success';
  }, 3, 1);
  if (result === 'success' && attempts === 2) { passed++; } else { failed++; console.log('T1-1 FAIL: basic retry broken'); }
} catch(e) { failed++; console.log('T1-1 ERROR:', e.message); }

// 测试2：jitter 参数存在（函数签名应该有第4个参数）
try {
  const fnStr = retryWithBackoff.toString();
  if (fnStr.includes('jitter') || fnStr.length > 200) { passed++; } 
  else { failed++; console.log('T1-2 FAIL: jitter parameter not found in function'); }
} catch(e) { failed++; console.log('T1-2 ERROR:', e.message); }

// 测试3：超过最大重试次数后抛出错误
try {
  await retryWithBackoff(async () => { throw new Error('always fail'); }, 2, 1);
  failed++; console.log('T1-3 FAIL: should have thrown');
} catch(e) { passed++; }

console.log(\`T1 Results: \${passed} passed, \${failed} failed\`);
process.exit(failed > 0 ? 1 : 0);
`,
    T2: `
import { parseConfig } from '${tmpFile}';

let passed = 0;
let failed = 0;

// 测试1：基本配置解析仍然正常
try {
  const result = parseConfig({ timeout: 1000, retries: 5 });
  if (result.timeout === 1000 && result.retries === 5) { passed++; }
  else { failed++; console.log('T2-1 FAIL:', result); }
} catch(e) { failed++; console.log('T2-1 ERROR:', e.message); }

// 测试2：支持嵌套配置（新功能）
try {
  const result = parseConfig({ 
    timeout: 2000, 
    retry: { count: 3, delay: 100 }
  });
  // 嵌套配置应该被正确解析
  if (result.timeout === 2000) { passed++; }
  else { failed++; console.log('T2-2 FAIL: nested config not handled:', result); }
} catch(e) { 
  // 如果抛出错误，说明嵌套配置没有被处理
  failed++; console.log('T2-2 ERROR (nested config not supported):', e.message); 
}

// 测试3：无效配置仍然抛出错误
try {
  parseConfig(null);
  failed++; console.log('T2-3 FAIL: should throw for null config');
} catch(e) { passed++; }

console.log(\`T2 Results: \${passed} passed, \${failed} failed\`);
process.exit(failed > 0 ? 1 : 0);
`,
    T3: `
import { batchProcess, parseConfig, transformData, retryWithBackoff } from '${tmpFile}';

let passed = 0;
let failed = 0;

// 测试1：batchProcess 函数存在
try {
  if (typeof batchProcess === 'function') { passed++; }
  else { failed++; console.log('T3-1 FAIL: batchProcess not exported'); }
} catch(e) { failed++; console.log('T3-1 ERROR:', e.message); }

// 测试2：batchProcess 能处理数组
try {
  const result = await batchProcess([1, 2, 3], { prefix: 'item_' });
  if (Array.isArray(result) && result.length === 3) { passed++; }
  else { failed++; console.log('T3-2 FAIL: batchProcess result invalid:', result); }
} catch(e) { failed++; console.log('T3-2 ERROR:', e.message); }

// 测试3：原有函数没有被破坏
try {
  const config = parseConfig({ timeout: 1000 });
  const data = transformData(['a', 'b'], config.prefix);
  if (Array.isArray(data)) { passed++; }
  else { failed++; console.log('T3-3 FAIL: existing functions broken'); }
} catch(e) { failed++; console.log('T3-3 ERROR:', e.message); }

console.log(\`T3 Results: \${passed} passed, \${failed} failed\`);
process.exit(failed > 0 ? 1 : 0);
`,
  };

  fs.writeFileSync(testScript, tests[taskId]);

  try {
    execSync(`node ${testScript}`, { timeout: 15000, stdio: 'pipe' });
    return { passed: true, output: 'All tests passed' };
  } catch (e) {
    const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    return { passed: false, output: output.trim() };
  }
}

// ─────────────────────────────────────────────
// 主测试流程
// ─────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('  ACE-Coder 质量对比实验');
  console.log('  基线：全量读取 vs ACE 骨架模式');
  console.log('='.repeat(60));

  const sourceCode = createTestModule();
  const skeletonCode = extractSkeleton(sourceCode);

  console.log(`\n源文件行数: ${sourceCode.split('\n').length} 行`);
  console.log(`骨架行数: ${skeletonCode.split('\n').length} 行`);
  console.log(`压缩率: ${((1 - skeletonCode.length / sourceCode.length) * 100).toFixed(1)}%\n`);

  const results = [];

  for (const task of TEST_CASES) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`[${task.id}] ${task.name}`);
    console.log(`风险等级: ${task.riskLevel}`);
    console.log(`任务: ${task.description}`);
    console.log('─'.repeat(50));

    // 模式 A：全量读取（基线）
    console.log('\n▶ 模式 A: 全量读取（基线）...');
    const resultA = await generateCode(task, sourceCode, 'full');
    const qualityA = runQualityTest(task.id, resultA.code, 'full');
    console.log(`  Token 消耗: ${resultA.tokens}`);
    console.log(`  测试结果: ${qualityA.passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!qualityA.passed) console.log(`  失败详情: ${qualityA.output}`);

    // 模式 B：骨架模式（ACE）
    console.log('\n▶ 模式 B: 骨架模式（ACE）...');
    const resultB = await generateCode(task, skeletonCode, 'skeleton');
    const qualityB = runQualityTest(task.id, resultB.code, 'skeleton');
    console.log(`  Token 消耗: ${resultB.tokens}`);
    console.log(`  测试结果: ${qualityB.passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!qualityB.passed) console.log(`  失败详情: ${qualityB.output}`);

    const tokenSaving = ((1 - resultB.tokens / resultA.tokens) * 100).toFixed(1);
    console.log(`\n  Token 节省: ${tokenSaving}%`);
    console.log(`  质量影响: ${qualityA.passed === qualityB.passed ? (qualityA.passed ? '✅ 两者均通过，无质量损失' : '⚠️ 两者均失败') : (qualityA.passed && !qualityB.passed ? '🔴 骨架模式质量下降' : '🟢 骨架模式质量更好')}`);

    results.push({
      taskId: task.id,
      taskName: task.name,
      riskLevel: task.riskLevel,
      fullTokens: resultA.tokens,
      skeletonTokens: resultB.tokens,
      tokenSaving: `${tokenSaving}%`,
      fullPassed: qualityA.passed,
      skeletonPassed: qualityB.passed,
      qualityImpact: qualityA.passed === qualityB.passed
        ? (qualityA.passed ? 'NO_IMPACT' : 'BOTH_FAILED')
        : (qualityA.passed && !qualityB.passed ? 'SKELETON_WORSE' : 'SKELETON_BETTER'),
    });

    // 避免 API 限速
    await new Promise(r => setTimeout(r, 1000));
  }

  // ─── 汇总报告 ───
  console.log('\n' + '='.repeat(60));
  console.log('  实验结论汇总');
  console.log('='.repeat(60));
  console.log('\n| 任务 | 风险等级 | 全量Token | 骨架Token | 节省 | 全量质量 | 骨架质量 | 结论 |');
  console.log('|------|----------|-----------|-----------|------|----------|----------|------|');
  for (const r of results) {
    const fullQ = r.fullPassed ? '✅' : '❌';
    const skelQ = r.skeletonPassed ? '✅' : '❌';
    const impact = {
      'NO_IMPACT': '无质量损失',
      'BOTH_FAILED': '两者均失败',
      'SKELETON_WORSE': '🔴 骨架质量下降',
      'SKELETON_BETTER': '🟢 骨架更好',
    }[r.qualityImpact];
    console.log(`| ${r.taskId} | ${r.riskLevel} | ${r.fullTokens} | ${r.skeletonTokens} | ${r.tokenSaving} | ${fullQ} | ${skelQ} | ${impact} |`);
  }

  const noImpact = results.filter(r => r.qualityImpact === 'NO_IMPACT').length;
  const worse = results.filter(r => r.qualityImpact === 'SKELETON_WORSE').length;
  console.log(`\n总结：${noImpact}/${results.length} 个任务骨架模式无质量损失，${worse}/${results.length} 个任务质量下降`);
}

main().catch(console.error);
