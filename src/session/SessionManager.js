/**
 * SessionManager.js — Persistent conversation session management
 * Author: OpenDemon
 *
 * Stores sessions as JSON files in ~/.claude-ace/sessions/
 * Each session has: id, name, createdAt, updatedAt, messages, stats, cwd
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const SESSIONS_DIR = path.join(os.homedir(), '.claude-ace', 'sessions');

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function sessionPath(id) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

export class SessionManager {
  constructor() {
    ensureDir();
    this.currentId = null;
  }

  /** Create a new session and return its id */
  create(cwd, firstMessage = '') {
    ensureDir();
    const id = generateId();
    const preview = firstMessage.slice(0, 60) || '新对话';
    const session = {
      id,
      name: preview,
      cwd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      stats: { inputTokens: 0, outputTokens: 0, toolCalls: 0 },
    };
    fs.writeFileSync(sessionPath(id), JSON.stringify(session, null, 2));
    this.currentId = id;
    return id;
  }

  /** Save current session state */
  save(id, messages, stats) {
    ensureDir();
    const p = sessionPath(id);
    let session = {};
    try { session = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) {}
    session.messages = messages;
    session.stats = stats;
    session.updatedAt = new Date().toISOString();
    // Auto-update name from first user message if still default
    const firstUser = messages.find(m => m.role === 'user');
    if (firstUser && session.name === '新对话') {
      session.name = (typeof firstUser.content === 'string'
        ? firstUser.content
        : firstUser.content?.[0]?.text || '').slice(0, 60);
    }
    fs.writeFileSync(p, JSON.stringify(session, null, 2));
  }

  /** Load a session by id */
  load(id) {
    const p = sessionPath(id);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) { return null; }
  }

  /** Rename a session */
  rename(id, newName) {
    const p = sessionPath(id);
    if (!fs.existsSync(p)) return false;
    try {
      const session = JSON.parse(fs.readFileSync(p, 'utf-8'));
      session.name = newName.slice(0, 80);
      session.updatedAt = new Date().toISOString();
      fs.writeFileSync(p, JSON.stringify(session, null, 2));
      return true;
    } catch (_) { return false; }
  }

  /** List all sessions sorted by updatedAt desc */
  list(limit = 10) {
    ensureDir();
    try {
      return fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try { return JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')); }
          catch (_) { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, limit);
    } catch (_) { return []; }
  }

  /** Delete a session */
  delete(id) {
    const p = sessionPath(id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  /** Format relative time */
  static relativeTime(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}小时前`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}天前`;
    return new Date(isoStr).toLocaleDateString('zh-CN');
  }
}
