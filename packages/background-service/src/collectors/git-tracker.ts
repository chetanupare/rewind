import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const log = getLogger();

interface GitStatus {
  current: string | null;
  tracking: string | null;
  files: Array<{ path: string; index: string; working_dir: string }>;
  ahead: number;
  behind: number;
}

export class GitTracker {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private knownRepos: Map<string, { branch: string; lastCommit: string }> = new Map();
  private activeRepoPaths: Set<string> = new Set();

  constructor(
    private bus: EventBus,
    private db: Database
  ) {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const windowTitle = event.payload.windowTitle as string;
      this.detectRepoFromTitle(windowTitle);
    });

    this.bus.on('FILE_OPENED', (event) => {
      const filePath = event.payload.filePath as string;
      this.detectRepoFromPath(filePath);
    });
  }

  async start(): Promise<void> {
    this.pollInterval = setInterval(() => this.poll(), 10_000);
    log.info('Git tracker started');
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async poll(): Promise<void> {
    for (const repoPath of this.activeRepoPaths) {
      try {
        await this.checkRepoStatus(repoPath);
      } catch (err) {
        log.debug({ err, repoPath }, 'Failed to check git repo status');
      }
    }
  }

  private detectRepoFromTitle(title: string): void {
    const patterns = [
      /([A-Z]:\\[a-zA-Z0-9_\-\\\/]+\.git)/,
      /([A-Z]:\\[a-zA-Z0-9_\-\\\/]+\\\.git)/,
      /([A-Z]:\\Users\\[a-zA-Z]+\\[a-zA-Z0-9_\-\\\/]+)/,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const possiblePath = match[1];
        this.checkAndAddRepo(possiblePath);
      }
    }
  }

  private detectRepoFromPath(filePath: string): void {
    let currentDir = path.dirname(filePath);
    const maxDepth = 10;
    let depth = 0;

    while (currentDir && depth < maxDepth) {
      const gitDir = path.join(currentDir, '.git');
      if (fs.existsSync(gitDir)) {
        this.addRepo(currentDir);
        break;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
      depth++;
    }
  }

  private checkAndAddRepo(dirPath: string): void {
    if (this.activeRepoPaths.has(dirPath)) return;

    const gitDir = path.join(dirPath, '.git');
    if (fs.existsSync(gitDir)) {
      this.addRepo(dirPath);
    }
  }

  private addRepo(repoPath: string): void {
    if (this.activeRepoPaths.has(repoPath)) return;

    this.activeRepoPaths.add(repoPath);
    log.info({ repoPath }, 'Git repository detected');

    this.bus.emit('GIT_REPO_DETECTED', 'git-tracker', {
      repoPath,
    });

    this.checkRepoStatus(repoPath);
  }

  private async checkRepoStatus(repoPath: string): Promise<void> {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(repoPath);

      const status = await git.status();
      const gitLog = await git.log({ maxCount: 1 });

      const currentBranch = status.current || 'unknown';
      const latestCommit = gitLog.latest?.hash || '';

      const known = this.knownRepos.get(repoPath);

      if (!known) {
        this.knownRepos.set(repoPath, {
          branch: currentBranch,
          lastCommit: latestCommit,
        });
      } else {
        if (known.branch !== currentBranch) {
          known.branch = currentBranch;
          this.trackBranchChange(repoPath, currentBranch);
        }

        if (known.lastCommit !== latestCommit && latestCommit) {
          known.lastCommit = latestCommit;

          const filesChanged = status.files.map((f: any) => f.path);

          this.trackCommit(repoPath, {
            branch: currentBranch,
            commitHash: latestCommit,
            commitMessage: gitLog.latest?.message || '',
            filesChanged,
          });
        }
      }
    } catch (err) {
      log.debug({ err, repoPath }, 'Failed to check git status');
    }
  }

  async detectGitRepo(dirPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(dirPath, '.git');
      return fs.existsSync(gitDir);
    } catch {
      return false;
    }
  }

  async getGitInfo(repoPath: string): Promise<{
    branch: string;
    commitHash: string;
    commitMessage: string;
    filesChanged: string[];
  } | null> {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(repoPath);

      const status = await git.status() as any;
      const gitLog = await git.log({ maxCount: 1 });

      return {
        branch: status.current ?? 'unknown',
        commitHash: gitLog.latest?.hash ?? '',
        commitMessage: gitLog.latest?.message ?? '',
        filesChanged: status.files.map((f: any) => f.path),
      };
    } catch (err) {
      return null;
    }
  }

  trackCommit(repoPath: string, info: {
    branch: string;
    commitHash: string;
    commitMessage: string;
    filesChanged: string[];
  }): void {
    const known = this.knownRepos.get(repoPath);
    if (known && known.lastCommit === info.commitHash) return;

    this.knownRepos.set(repoPath, {
      branch: info.branch,
      lastCommit: info.commitHash,
    });

    try {
      const stmt = this.db.prepare(
        `INSERT INTO git_events (timestamp, repo_path, branch, commit_hash, commit_message, files_changed)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      stmt.run(
        new Date().toISOString(),
        repoPath,
        info.branch,
        info.commitHash,
        info.commitMessage,
        JSON.stringify(info.filesChanged)
      );
    } catch (err) {
      log.warn({ err }, 'Failed to store git event');
    }

    this.bus.emit('GIT_COMMIT', 'git-tracker', {
      repoPath,
      branch: info.branch,
      commitHash: info.commitHash,
      commitMessage: info.commitMessage,
      filesChanged: info.filesChanged,
    });
  }

  trackBranchChange(repoPath: string, branch: string): void {
    this.bus.emit('GIT_BRANCH_CHANGED', 'git-tracker', {
      repoPath,
      branch,
    });
  }
}
