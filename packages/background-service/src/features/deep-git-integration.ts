import { EventBus, Database, getLogger } from '@ai-work-memory/shared';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const log = getLogger();

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
  branch: string;
}

interface GitBranch {
  name: string;
  current: boolean;
  lastCommit: string;
  lastCommitDate: string;
}

interface GitRepo {
  path: string;
  name: string;
  branches: GitBranch[];
  currentBranch: string;
  lastActivity: string;
  totalCommits: number;
}

export class DeepGitIntegration {
  private repos: Map<string, GitRepo> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS git_repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        current_branch TEXT,
        last_activity TEXT,
        total_commits INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS git_branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        last_commit TEXT,
        last_commit_date TEXT,
        FOREIGN KEY (repo_id) REFERENCES git_repos(id)
      );

      CREATE TABLE IF NOT EXISTS git_commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        hash TEXT NOT NULL,
        message TEXT,
        author TEXT,
        date TEXT NOT NULL,
        files_changed TEXT DEFAULT '[]',
        insertions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        branch TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (repo_id) REFERENCES git_repos(id)
      );

      CREATE TABLE IF NOT EXISTS git_file_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commit_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT,
        insertions INTEGER DEFAULT 0,
        deletions INTEGER DEFAULT 0,
        FOREIGN KEY (commit_id) REFERENCES git_commits(id)
      );

      CREATE INDEX IF NOT EXISTS idx_git_commits_repo ON git_commits(repo_id);
      CREATE INDEX IF NOT EXISTS idx_git_commits_date ON git_commits(date);
      CREATE INDEX IF NOT EXISTS idx_git_commits_hash ON git_commits(hash);
    `);
  }

  private setupEventListeners(): void {
    this.bus.on('GIT_REPO_DETECTED', (event) => {
      const { repoPath } = event.payload as any;
      this.addRepo(repoPath);
    });

    this.bus.on('FILE_OPENED', (event) => {
      const { filePath } = event.payload as any;
      this.detectRepoFromFile(filePath);
    });
  }

  private detectRepoFromFile(filePath: string): void {
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

  async addRepo(repoPath: string): Promise<void> {
    if (this.repos.has(repoPath)) return;

    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(repoPath);

      const status = await git.status();
      const gitLogResult = await git.log({ maxCount: 1 });
      const branches = await git.branchLocal();

      const repo: GitRepo = {
        path: repoPath,
        name: path.basename(repoPath),
        branches: [],
        currentBranch: status.current || 'unknown',
        lastActivity: gitLogResult.latest?.date || new Date().toISOString(),
        totalCommits: gitLogResult.total,
      };

      for (const branch of branches.all) {
        repo.branches.push({
          name: branch,
          current: branch === status.current,
          lastCommit: '',
          lastCommitDate: '',
        });
      }

      this.repos.set(repoPath, repo);

      const existing = this.db.prepare('SELECT id FROM git_repos WHERE path = ?').get(repoPath) as { id: number } | undefined;

      if (existing) {
        this.db.prepare(`
          UPDATE git_repos SET current_branch = ?, last_activity = ?, total_commits = ?
          WHERE path = ?
        `).run(repo.currentBranch, repo.lastActivity, repo.totalCommits, repoPath);
      } else {
        this.db.prepare(`
          INSERT INTO git_repos (path, name, current_branch, last_activity, total_commits)
          VALUES (?, ?, ?, ?, ?)
        `).run(repoPath, repo.name, repo.currentBranch, repo.lastActivity, repo.totalCommits);
      }

      log.info({ repoPath, branch: repo.currentBranch }, 'Git repository tracked');

    } catch (err) {
      log.debug({ err, repoPath }, 'Failed to add git repo');
    }
  }

  async syncRepo(repoPath: string): Promise<void> {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(repoPath);

      const status = await git.status();
      const gitLog = await git.log({ maxCount: 20 });

      const repoRow = this.db.prepare('SELECT id FROM git_repos WHERE path = ?').get(repoPath) as { id: number } | undefined;
      if (!repoRow) return;

      for (const commit of gitLog.all) {
        const existing = this.db.prepare('SELECT id FROM git_commits WHERE hash = ?').get(commit.hash) as { id: number } | undefined;
        if (existing) continue;

        const diff = await git.diffSummary([`${commit.hash}~1..${commit.hash}`]).catch(() => null);

        const filesChanged = diff ? diff.files.map(f => f.file) : [];
        const insertions = diff ? diff.insertions : 0;
        const deletions = diff ? diff.deletions : 0;

        this.db.prepare(`
          INSERT INTO git_commits (repo_id, hash, message, author, date, files_changed, insertions, deletions, branch)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          repoRow.id,
          commit.hash,
          commit.message,
          commit.author_name,
          commit.date,
          JSON.stringify(filesChanged),
          insertions,
          deletions,
          status.current
        );

        this.bus.emit('GIT_COMMIT_DEEP', 'git-integration', {
          repoPath,
          hash: commit.hash,
          message: commit.message,
          branch: status.current,
          filesChanged,
          insertions,
          deletions,
        });
      }

      this.db.prepare('UPDATE git_repos SET last_activity = ?, current_branch = ? WHERE id = ?')
        .run(new Date().toISOString(), status.current, repoRow.id);

    } catch (err) {
      log.debug({ err, repoPath }, 'Failed to sync repo');
    }
  }

  async getRepoStats(repoPath: string): Promise<{
    totalCommits: number;
    commitsToday: number;
    commitsThisWeek: number;
    topBranches: Array<{ name: string; commits: number }>;
    topFiles: Array<{ path: string; changes: number }>;
  } | null> {
    const repo = this.db.prepare('SELECT id FROM git_repos WHERE path = ?').get(repoPath) as { id: number } | undefined;
    if (!repo) return null;

    const totalCommits = (this.db.prepare('SELECT COUNT(*) as count FROM git_commits WHERE repo_id = ?').get(repo.id) as { count: number }).count;

    const today = new Date().toISOString().split('T')[0];
    const commitsToday = (this.db.prepare(
      "SELECT COUNT(*) as count FROM git_commits WHERE repo_id = ? AND date(date) = ?"
    ).get(repo.id, today) as { count: number }).count;

    const commitsThisWeek = (this.db.prepare(
      "SELECT COUNT(*) as count FROM git_commits WHERE repo_id = ? AND date(date) > datetime('now', '-7 days')"
    ).get(repo.id) as { count: number }).count;

    const topBranches = this.db.prepare(`
      SELECT branch as name, COUNT(*) as commits FROM git_commits
      WHERE repo_id = ? AND branch IS NOT NULL
      GROUP BY branch ORDER BY commits DESC LIMIT 5
    `).all(repo.id) as Array<{ name: string; commits: number }>;

    const topFiles = this.db.prepare(`
      SELECT file_path as path, COUNT(*) as changes FROM git_file_changes
      WHERE commit_id IN (SELECT id FROM git_commits WHERE repo_id = ?)
      GROUP BY file_path ORDER BY changes DESC LIMIT 10
    `).all(repo.id) as Array<{ path: string; changes: number }>;

    return {
      totalCommits,
      commitsToday,
      commitsThisWeek,
      topBranches,
      topFiles,
    };
  }

  async getCommitHistory(repoPath: string, limit = 50): Promise<GitCommit[]> {
    const repo = this.db.prepare('SELECT id FROM git_repos WHERE path = ?').get(repoPath) as { id: number } | undefined;
    if (!repo) return [];

    const commits = this.db.prepare(`
      SELECT * FROM git_commits WHERE repo_id = ? ORDER BY date DESC LIMIT ?
    `).all(repo.id, limit) as any[];

    return commits.map(c => ({
      ...c,
      filesChanged: JSON.parse(c.files_changed || '[]'),
    }));
  }

  async getRepos(): Promise<GitRepo[]> {
    return Array.from(this.repos.values());
  }

  async getActiveRepos(): Promise<GitRepo[]> {
    const repos = this.db.prepare(`
      SELECT * FROM git_repos ORDER BY last_activity DESC LIMIT 10
    `).all() as any[];

    return repos.map(r => ({
      path: r.path,
      name: r.name,
      branches: [],
      currentBranch: r.current_branch,
      lastActivity: r.last_activity,
      totalCommits: r.total_commits,
    }));
  }

  async startPolling(intervalMs = 30000): Promise<void> {
    this.pollInterval = setInterval(async () => {
      for (const repoPath of this.repos.keys()) {
        await this.syncRepo(repoPath);
      }
    }, intervalMs);
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
