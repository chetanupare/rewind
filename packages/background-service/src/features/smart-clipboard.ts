import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const log = getLogger();

interface ClipboardEntry {
  id: number;
  timestamp: string;
  contentType: 'text' | 'code' | 'url' | 'image' | 'file';
  content: string;
  contentHash: string;
  preview: string;
  sourceApp: string;
  pinned: boolean;
  favorite: boolean;
}

const CLIPBOARD_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$hasImage = [System.Windows.Forms.Clipboard]::ContainsImage()
$hasText = [System.Windows.Forms.Clipboard]::ContainsText()
$hasFileDrop = [System.Windows.Forms.Clipboard]::ContainsFileDropList()

if ($hasImage) {
    Write-Output "TYPE:image"
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($img) {
        $hash = [System.BitConverter]::ToString([System.Security.Cryptography.MD5]::Create().ComputeHash([System.IO.MemoryStream]::new().ToArray())).Replace("-","").Substring(0,16)
        Write-Output "HASH:$hash"
        Write-Output "SIZE:$($img.Width)x$($img.Height)"
    }
} elseif ($hasText) {
    $text = [System.Windows.Forms.Clipboard]::GetText()
    Write-Output "TYPE:text"
    Write-Output "TEXT:$text"
} elseif ($hasFileDrop) {
    $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
    Write-Output "TYPE:file"
    Write-Output "FILES:$($files -join '|')"
}
`;

export class SmartClipboard {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastContentHash: string = '';
  private scriptPath: string;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.scriptPath = path.join(os.tmpdir(), `rewindx-clipboard-${process.pid}.ps1`);
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clipboard_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content TEXT,
        content_hash TEXT NOT NULL,
        preview TEXT,
        source_app TEXT,
        pinned INTEGER DEFAULT 0,
        favorite INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_clipboard_time ON clipboard_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_clipboard_hash ON clipboard_history(content_hash);
      CREATE INDEX IF NOT EXISTS idx_clipboard_type ON clipboard_history(content_type);
      CREATE INDEX IF NOT EXISTS idx_clipboard_pinned ON clipboard_history(pinned);
    `);
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, CLIPBOARD_SCRIPT, 'utf-8');
      this.pollInterval = setInterval(() => this.poll(), 2000);
      log.info('Smart clipboard started');
    } catch (err) {
      log.warn({ err }, 'Failed to start clipboard monitor');
    }
  }

  private poll(): void {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        if (err) return;

        const lines = (stdout || '').trim().split('\n');
        let type = 'text';
        let content = '';
        let hash = '';

        for (const line of lines) {
          if (line.startsWith('TYPE:')) {
            type = line.substring(5).trim();
          } else if (line.startsWith('TEXT:')) {
            content = line.substring(5);
          } else if (line.startsWith('HASH:')) {
            hash = line.substring(5).trim();
          } else if (line.startsWith('FILES:')) {
            content = line.substring(6);
          }
        }

        if (!content && type !== 'image') return;

        if (type === 'text' && content) {
          hash = createHash('md5').update(content).digest('hex').substring(0, 16);
        }

        if (hash === this.lastContentHash) return;
        this.lastContentHash = hash;

        const contentType = this.detectContentType(content, type);
        const isSensitive = this.detectSensitive(content);

        if (isSensitive) {
          log.debug('Sensitive content detected, skipping');
          return;
        }

        this.recordClipboard({
          timestamp: new Date().toISOString(),
          contentType,
          content: content.substring(0, 10000),
          contentHash: hash,
          preview: content.substring(0, 200),
          sourceApp: '',
        });
      }
    );
  }

  private detectContentType(content: string, rawType: string): ClipboardEntry['contentType'] {
    if (rawType === 'image') return 'image';
    if (rawType === 'file') return 'file';

    if (/^https?:\/\//.test(content)) return 'url';

    const codePatterns = [
      /^(import|export|const|let|var|function|class|interface|type|def|if|for|while|return)\s/m,
      /[{}\[\]();]/,
      /^\s*(\/\/|#|\/\*)/m,
      /=>/,
      /\b(null|undefined|true|false|None|True|False)\b/,
    ];

    if (codePatterns.some(p => p.test(content))) return 'code';

    return 'text';
  }

  private detectSensitive(content: string): boolean {
    if (!content || content.length < 8) return false;

    const codePatterns = [
      /^(import|export|const|let|var|function|class)/m,
      /[{}\[\]();]/,
    ];
    if (codePatterns.some(p => p.test(content))) return false;

    const sensitivePatterns = [
      /^[\s]*password\s*[:=]\s*.+$/im,
      /^[\s]*api[_-]?key\s*[:=]\s*.+$/im,
      /^[\s]*secret\s*[:=]\s*.+$/im,
      /^[\s]*token\s*[:=]\s*.+$/im,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
      /^[a-zA-Z0-9]{32,}$/,
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
    ];

    return sensitivePatterns.some(p => p.test(content));
  }

  private recordClipboard(data: {
    timestamp: string;
    contentType: ClipboardEntry['contentType'];
    content: string;
    contentHash: string;
    preview: string;
    sourceApp: string;
  }): void {
    try {
      this.db.prepare(`
        INSERT INTO clipboard_history (timestamp, content_type, content, content_hash, preview, source_app)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(data.timestamp, data.contentType, data.content, data.contentHash, data.preview, data.sourceApp);

      this.bus.emit('CLIPBOARD_CHANGED', 'clipboard-monitor', {
        contentType: data.contentType,
        contentHash: data.contentHash,
        preview: data.preview,
      });

      log.debug({ type: data.contentType }, 'Clipboard entry recorded');
    } catch (err) {
      log.warn({ err }, 'Failed to record clipboard');
    }
  }

  async getHistory(limit = 100): Promise<ClipboardEntry[]> {
    return this.db.prepare(`
      SELECT * FROM clipboard_history 
      ORDER BY pinned DESC, created_at DESC 
      LIMIT ?
    `).all(limit) as ClipboardEntry[];
  }

  async getPinned(): Promise<ClipboardEntry[]> {
    return this.db.prepare(`
      SELECT * FROM clipboard_history WHERE pinned = 1 
      ORDER BY created_at DESC
    `).all() as ClipboardEntry[];
  }

  async togglePin(id: number): Promise<void> {
    this.db.prepare(`
      UPDATE clipboard_history SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?
    `).run(id);
  }

  async toggleFavorite(id: number): Promise<void> {
    this.db.prepare(`
      UPDATE clipboard_history SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END WHERE id = ?
    `).run(id);
  }

  async search(query: string): Promise<ClipboardEntry[]> {
    return this.db.prepare(`
      SELECT * FROM clipboard_history 
      WHERE content LIKE ? OR preview LIKE ?
      ORDER BY created_at DESC LIMIT 50
    `).all(`%${query}%`, `%${query}%`) as ClipboardEntry[];
  }

  async getByType(type: ClipboardEntry['contentType']): Promise<ClipboardEntry[]> {
    return this.db.prepare(`
      SELECT * FROM clipboard_history WHERE content_type = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(type) as ClipboardEntry[];
  }

  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM clipboard_history WHERE id = ?').run(id);
  }

  async clearOld(daysToKeep = 7): Promise<number> {
    const result = this.db.prepare(`
      DELETE FROM clipboard_history 
      WHERE pinned = 0 AND created_at < datetime('now', ? || ' days')
    `).run(-daysToKeep);
    return result.changes;
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    try {
      await fs.promises.unlink(this.scriptPath);
    } catch {}
  }
}
