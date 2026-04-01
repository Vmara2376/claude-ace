/**
 * FileWriteTool.js
 * Author: OpenDemon
 *
 * Security fix: Block writes to system-sensitive directories to prevent
 * LLM hallucination from accidentally overwriting critical system files.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

// Absolute path prefixes that are always blocked for writes
const BLOCKED_PATH_PREFIXES = [
  '/etc/',
  '/usr/',
  '/bin/',
  '/sbin/',
  '/lib/',
  '/lib64/',
  '/boot/',
  '/sys/',
  '/proc/',
  '/dev/',
  '/root/',
  'C:\\Windows\\',
  'C:\\Program Files\\',
  'C:\\Program Files (x86)\\',
];

// Specific filenames that are always blocked regardless of directory
const BLOCKED_FILENAMES = [
  'passwd',
  'shadow',
  'sudoers',
  '.bashrc',
  '.bash_profile',
  '.profile',
  '.zshrc',
  '.ssh/authorized_keys',
  '.ssh/id_rsa',
  '.ssh/id_ed25519',
];

export class FileWriteTool {
  get name() { return 'FileWrite'; }
  get description() { return 'Write content to a file. Creates parent directories as needed. System directories are protected.'; }
  get parameters() {
    return {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to write to' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    };
  }

  async execute({ path: filePath, content }) {
    // Resolve to absolute path to prevent path traversal attacks (e.g. ../../etc/passwd)
    const resolvedPath = path.resolve(filePath);
    const normalizedPath = resolvedPath.replace(/\\/g, '/');

    // Check against blocked path prefixes
    for (const prefix of BLOCKED_PATH_PREFIXES) {
      const normalizedPrefix = prefix.replace(/\\/g, '/');
      if (normalizedPath.startsWith(normalizedPrefix) ||
          normalizedPath.toLowerCase().startsWith(normalizedPrefix.toLowerCase())) {
        return `[FileWrite Error] Write blocked: path "${filePath}" is in a protected system directory.`;
      }
    }

    // Check against blocked filenames
    const basename = path.basename(resolvedPath);
    for (const blocked of BLOCKED_FILENAMES) {
      if (basename === blocked || normalizedPath.endsWith('/' + blocked)) {
        return `[FileWrite Error] Write blocked: "${basename}" is a protected system file.`;
      }
    }

    // Warn if writing outside the home directory (but allow it)
    const homeDir = os.homedir().replace(/\\/g, '/');
    if (!normalizedPath.startsWith(homeDir)) {
      // Still allow writes outside home (e.g. project in /var/www), just proceed
    }

    try {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, content, 'utf-8');
      return `[FileWrite] Successfully wrote ${content.length} chars to ${resolvedPath}`;
    } catch (e) {
      return `[FileWrite Error] ${e.message}`;
    }
  }
}
