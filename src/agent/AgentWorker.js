/**
 * AgentWorker.js — Agent Worker Thread
 * Author: OpenDemon
 *
 * 在独立的 Worker Thread 中运行 Agent，通过 parentPort 与主线程通信。
 * 主线程的 readline 始终保持响应，用户可以在 Agent 执行期间输入新指令。
 *
 * 消息协议（Worker → 主线程）：
 *   { type: 'token',     token: string }           — 流式文本 token
 *   { type: 'toolStart', name: string, args: obj } — 工具开始执行
 *   { type: 'toolEnd',   name: string }            — 工具执行完毕
 *   { type: 'done',      stats: obj }              — 任务完成
 *   { type: 'error',     message: string }         — 发生错误
 *   { type: 'aborted' }                            — 任务被取消
 *
 * 消息协议（主线程 → Worker）：
 *   { type: 'chat',   message: string, env: obj, messages: array } — 发起对话
 *   { type: 'cancel' }                                             — 取消当前任务
 *   { type: 'syncMessages', messages: array }                      — 同步消息历史
 */
import { workerData, parentPort } from 'worker_threads';
import { Agent } from './Agent.js';

// 从 workerData 获取初始环境变量（API Key、Base URL、Model）
if (workerData?.env) {
  for (const [k, v] of Object.entries(workerData.env)) {
    process.env[k] = v;
  }
}

const agent = new Agent();

// 当前任务的 AbortController
let currentAbortController = null;

parentPort.on('message', async (msg) => {
  if (msg.type === 'cancel') {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    return;
  }

  if (msg.type === 'syncEnv') {
    // 同步环境变量（切换模型/Key 时）
    for (const [k, v] of Object.entries(msg.env || {})) {
      process.env[k] = v;
    }
    return;
  }

  if (msg.type === 'syncMessages') {
    // 同步消息历史（主线程持有权威副本）
    agent.messages = msg.messages;
    return;
  }

  if (msg.type === 'chat') {
    // 同步环境变量（确保用最新的 Key/Model）
    if (msg.env) {
      for (const [k, v] of Object.entries(msg.env)) {
        process.env[k] = v;
      }
    }

    // 同步消息历史
    if (msg.messages) {
      agent.messages = msg.messages;
    }

    currentAbortController = new AbortController();

    try {
      const result = await agent.chat(msg.message, {
        signal: currentAbortController.signal,
        onToken: (token) => {
          parentPort.postMessage({ type: 'token', token });
        },
        onToolStart: ({ name, args }) => {
          parentPort.postMessage({ type: 'toolStart', name, args });
        },
        onToolEnd: ({ name, result: toolResult }) => {
          parentPort.postMessage({ type: 'toolEnd', name });
        }
      });

      if (result.aborted) {
        parentPort.postMessage({ type: 'aborted' });
      } else {
        // 将更新后的消息历史同步回主线程
        parentPort.postMessage({
          type: 'done',
          stats: result.stats,
          messages: agent.messages
        });
      }
    } catch (err) {
      if (currentAbortController?.signal?.aborted) {
        parentPort.postMessage({ type: 'aborted' });
      } else {
        parentPort.postMessage({ type: 'error', message: err.message || String(err) });
      }
    } finally {
      currentAbortController = null;
    }
  }
});
