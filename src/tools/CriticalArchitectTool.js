/**
 * CriticalArchitectTool.js — The AI Architect with Critical Thinking
 * Author: OpenDemon
 * 
 * This module implements Dimension 4 of the Ideal AI Coding Assistant:
 * "From Submissive Assistant to Critical Architect"
 * 
 * Instead of blindly executing user requests, this tool analyzes the proposed
 * architecture or feature request for:
 * 1. Security vulnerabilities
 * 2. Performance bottlenecks (O(n^2) etc.)
 * 3. Scalability issues
 * 4. Anti-patterns
 * 
 * It returns a structured critique and alternative proposals.
 *
 * Security fix: Use dynamic OpenAI client creation to respect user's current
 * model and API key configuration instead of hardcoding gpt-4.1-mini.
 */

import OpenAI from 'openai';

// 动态创建客户端，始终读取最新的环境变量
function createClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });
}

function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4.1-mini';
}

export class CriticalArchitectTool {
  get name() { return 'CriticalArchitect'; }
  get description() { 
    return 'Analyze a proposed architecture, feature, or code change for potential flaws (security, performance, scalability, anti-patterns) before implementation. Use this when the user asks for a significant design decision.'; 
  }
  get parameters() {
    return {
      type: 'object',
      properties: {
        proposal: { type: 'string', description: 'The user\'s proposed architecture or feature request' },
        context: { type: 'string', description: 'Relevant context about the current system (optional)' }
      },
      required: ['proposal']
    };
  }

  async execute({ proposal, context = '' }) {
    const openai = createClient();
    
    const systemPrompt = `You are a Principal Software Architect known for your rigorous critical thinking.
Your job is NOT to write code, but to CRITIQUE proposed architectures and feature requests.
Do not be a "yes-man". If a proposal is bad, say so clearly but professionally.

Analyze the proposal across these dimensions:
1. Security Risks
2. Performance & Scalability Bottlenecks
3. Maintainability & Anti-patterns
4. Edge Cases ignored

Format your response exactly like this:
[CRITIQUE: <REJECTED | ACCEPTED_WITH_WARNINGS | APPROVED>]

### 🔴 Critical Flaws (if any)
- ...

### 🟡 Warnings & Trade-offs
- ...

### 💡 Architect's Counter-Proposal
- ... (Provide a better way to achieve the user's underlying goal)
`;

    try {
      const response = await openai.chat.completions.create({
        model: getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context:\n${context}\n\nProposal to critique:\n${proposal}` }
        ],
        temperature: 0.2,
      });

      return response.choices[0].message.content;
    } catch (e) {
      return `[Architect Error] Failed to analyze proposal: ${e.message}`;
    }
  }
}
