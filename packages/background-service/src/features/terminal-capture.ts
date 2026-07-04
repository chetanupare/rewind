import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const log = getLogger();

interface TerminalCommand {
  id: number;
  timestamp: string;
  terminal: string;
  command: string;
  output: string;
  exitCode: number | null;
  workingDirectory: string;
  duration: number;
}

const TERMINAL_PS_SCRIPT = `
$terminals = @('powershell', 'cmd', 'bash', 'zsh', 'fish', 'wt', 'WindowsTerminal')

foreach ($proc in $terminals) {
    try {
        $procs = Get-Process -Name $proc -ErrorAction SilentlyContinue
        foreach ($p in $procs) {
            if ($p.MainWindowTitle) {
                Write-Output "TERM:$($p.Id)|$proc|$($p.MainWindowTitle)"
            }
        }
    } catch {}
}
`;

export class TerminalCapture {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private activeTerminals: Map<number, { name: string; title: string; lastCommand: string }> = new Map();
  private scriptPath: string;

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.scriptPath = path.join(os.tmpdir(), `rewindx-terminal-${process.pid}.ps1`);
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS terminal_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        terminal TEXT NOT NULL,
        command TEXT,
        output TEXT,
        exit_code INTEGER,
        working_directory TEXT,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_terminal_time ON terminal_commands(timestamp);
      CREATE INDEX IF NOT EXISTS idx_terminal_cmd ON terminal_commands(command);
    `);
  }

  async start(): Promise<void> {
    try {
      await fs.promises.writeFile(this.scriptPath, TERMINAL_PS_SCRIPT, 'utf-8');
      this.pollInterval = setInterval(() => this.poll(), 5000);
      log.info('Terminal capture started');
    } catch (err) {
      log.warn({ err }, 'Failed to start terminal capture');
    }
  }

  private poll(): void {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        if (err) return;

        const lines = (stdout || '').trim().split('\n').filter(l => l.startsWith('TERM:'));
        const currentPids = new Set<number>();

        for (const line of lines) {
          const parts = line.substring(5).split('|');
          if (parts.length < 3) continue;

          const pid = parseInt(parts[0], 10);
          const name = parts[1];
          const title = parts[2];

          currentPids.add(pid);

          const existing = this.activeTerminals.get(pid);
          if (!existing) {
            this.activeTerminals.set(pid, { name, title, lastCommand: '' });
            this.detectCommand(title, name);
          } else if (existing.title !== title) {
            existing.title = title;
            this.detectCommand(title, name);
          }
        }

        for (const [pid] of this.activeTerminals) {
          if (!currentPids.has(pid)) {
            this.activeTerminals.delete(pid);
          }
        }
      }
    );
  }

  private detectCommand(title: string, terminal: string): void {
    const commandPatterns = [
      /(?:PS>|>\s*|\$)\s*(.+)/,
      /(?:bash|zsh|fish)\s*[-–]\s*(.+)/,
      /(.+?)\s*[-–]\s*(?:PowerShell|Command Prompt|Terminal)/,
    ];

    for (const pattern of commandPatterns) {
      const match = title.match(pattern);
      if (match) {
        const command = match[1].trim();
        if (command && command.length > 2) {
          this.recordCommand(command, terminal);
          break;
        }
      }
    }

    const knownCommands = [
      'git', 'npm', 'yarn', 'pnpm', 'docker', 'kubectl',
      'python', 'pip', 'node', 'cargo', 'go', 'make',
      'ssh', 'scp', 'curl', 'wget', 'apt', 'brew',
    ];

    const lower = title.toLowerCase();
    for (const cmd of knownCommands) {
      if (lower.includes(cmd)) {
        this.recordCommand(title, terminal);
        break;
      }
    }
  }

  private recordCommand(command: string, terminal: string): void {
    try {
      this.db.prepare(`
        INSERT INTO terminal_commands (timestamp, terminal, command)
        VALUES (?, ?, ?)
      `).run(new Date().toISOString(), terminal, command);

      this.bus.emit('TERMINAL_COMMAND', 'terminal-capture', {
        terminal,
        command,
      });

      log.debug({ terminal, command }, 'Terminal command captured');
    } catch (err) {
      log.warn({ err }, 'Failed to record terminal command');
    }
  }

  async getCommands(options: { limit?: number; terminal?: string; date?: string } = {}): Promise<TerminalCommand[]> {
    let query = 'SELECT * FROM terminal_commands';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.terminal) {
      conditions.push('terminal = ?');
      params.push(options.terminal);
    }
    if (options.date) {
      conditions.push('date(timestamp) = ?');
      params.push(options.date);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(options.limit || 100);

    return this.db.prepare(query).all(...params) as TerminalCommand[];
  }

  async getTopCommands(limit = 10): Promise<Array<{ command: string; count: number }>> {
    return this.db.prepare(`
      SELECT command, COUNT(*) as count 
      FROM terminal_commands 
      GROUP BY command 
      ORDER BY count DESC 
      LIMIT ?
    `).all(limit) as Array<{ command: string; count: number }>;
  }

  async getStats(date: string): Promise<{
    totalCommands: number;
    topTerminals: Array<{ terminal: string; count: number }>;
    topCommands: Array<{ command: string; count: number }>;
  }> {
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const total = (this.db.prepare(
      'SELECT COUNT(*) as count FROM terminal_commands WHERE timestamp BETWEEN ? AND ?'
    ).get(start, end) as { count: number }).count;

    const topTerminals = this.db.prepare(`
      SELECT terminal, COUNT(*) as count FROM terminal_commands
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY terminal ORDER BY count DESC LIMIT 5
    `).all(start, end) as Array<{ terminal: string; count: number }>;

    const topCommands = this.db.prepare(`
      SELECT command, COUNT(*) as count FROM terminal_commands
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY command ORDER BY count DESC LIMIT 10
    `).all(start, end) as Array<{ command: string; count: number }>;

    return { totalCommands: total, topTerminals, topCommands };
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
