import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const log = getLogger();

const PS_SCRIPT = `Add-Type -AssemblyName System.Windows.Forms
$text = [System.Windows.Forms.Clipboard]::GetText()
Write-Output $text`;

const scriptPath = path.join(os.tmpdir(), `awm-clipboard-${process.pid}.ps1`);
fs.writeFileSync(scriptPath, PS_SCRIPT, 'utf-8');

export class ClipboardMonitor {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastContent: string = '';
  private lastContentHash: string = '';
  private polling = false;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {}

  async start(): Promise<void> {
    this.pollInterval = setInterval(() => this.poll(), 5_000);
    log.info('Clipboard monitor started');
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    try { fs.unlinkSync(scriptPath); } catch {}
  }

  private poll(): void {
    if (this.polling) return;
    this.polling = true;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        try {
          if (err) return;

          const content = (stdout || '').trim();
          if (!content || content === this.lastContent) return;
          if (content.length > 10_000) return;

          const contentHash = createHash('md5').update(content).digest('hex');
          if (contentHash === this.lastContentHash) return;

          this.lastContent = content;
          this.lastContentHash = contentHash;

          const contentType = this.detectContentType(content);
          const isSensitive = this.detectSensitive(content);

          if (!isSensitive) {
            this.storeClipboardEvent({
              timestamp: new Date().toISOString(),
              contentType,
              contentHash,
              contentPreview: content.substring(0, 200),
              isSensitive: 0,
              sourceApp: '',
            });
          }

          this.bus.emit('CLIPBOARD_CHANGED', 'clipboard-monitor', {
            contentType,
            contentHash,
            contentPreview: content.substring(0, 200),
            isSensitive,
          });
        } finally {
          this.polling = false;
        }
      }
    );
  }

  private detectContentType(content: string): string {
    if (/^(import|export|const|let|var|function|class|interface|type)\s/.test(content)) {
      return 'code';
    }
    if (/^[{\[]/.test(content) && /[}\]]$/.test(content)) {
      return 'code';
    }
    if (/^https?:\/\//.test(content)) {
      return 'text';
    }
    return 'text';
  }

  private detectSensitive(content: string): boolean {
    if (content.length < 8) return false;

    const codePatterns = [
      /^(import|export|const|let|var|function|class|interface|type|def|if|for|while|return|from|async|await)\s/m,
      /[{}\[\]();]/,
      /^\s*(\/\/|#|\/\*)/m,
      /=>/,
      /\b(null|undefined|true|false|None|True|False)\b/,
    ];

    const isLikelyCode = codePatterns.some(p => p.test(content));
    if (isLikelyCode) return false;

    const sensitivePatterns = [
      /^[\s]*password\s*[:=]\s*.+$/im,
      /^[\s]*api[_-]?key\s*[:=]\s*.+$/im,
      /^[\s]*secret\s*[:=]\s*.+$/im,
      /^[\s]*token\s*[:=]\s*.+$/im,
      /^[\s]*bearer\s+[a-zA-Z0-9\-._~+/]+=*$/im,
      /^[\s]*authorization\s*[:=]\s*.+$/im,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
      /^[a-zA-Z0-9]{32,}$/,
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
    ];

    return sensitivePatterns.some((p) => p.test(content));
  }

  private storeClipboardEvent(data: {
    timestamp: string;
    contentType: string;
    contentHash: string;
    contentPreview: string;
    isSensitive: number;
    sourceApp: string;
  }): void {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO clipboard_history (timestamp, content_type, content_hash, content_preview, is_sensitive, source_app)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      stmt.run(data.timestamp, data.contentType, data.contentHash, data.contentPreview, data.isSensitive, data.sourceApp);
    } catch (err) {
      log.warn({ err }, 'Failed to store clipboard event');
    }
  }
}
