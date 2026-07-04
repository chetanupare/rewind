import { Database, EventBus, getLogger } from '@ai-work-memory/shared';
import fs from 'fs';
import path from 'path';

const log = getLogger();

interface DetectedProject {
  id: number;
  name: string;
  path: string;
  technologies: string[];
  repoUrl: string;
  firstSeen: string;
  lastSeen: string;
  activityCount: number;
  isActive: boolean;
}

interface ProjectRule {
  pattern: RegExp;
  name: string;
  extractPath?: (match: RegExpMatchArray) => string;
}

export class ProjectDetector {
  private knownProjects: Map<string, DetectedProject> = new Map();
  private detectionRules: ProjectRule[] = [];

  constructor(
    private db: Database,
    private bus: EventBus
  ) {
    this.ensureTables();
    this.loadKnownProjects();
    this.setupDetectionRules();
    this.setupEventListeners();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS detected_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT,
        technologies TEXT DEFAULT '[]',
        repo_url TEXT,
        first_seen TEXT,
        last_seen TEXT,
        activity_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS project_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        activity_id INTEGER,
        timestamp TEXT NOT NULL,
        app TEXT,
        window_title TEXT,
        duration_seconds INTEGER,
        FOREIGN KEY (project_id) REFERENCES detected_projects(id)
      );

      CREATE INDEX IF NOT EXISTS idx_proj_act_project ON project_activities(project_id);
      CREATE INDEX IF NOT EXISTS idx_proj_act_timestamp ON project_activities(timestamp);
    `);
  }

  private loadKnownProjects(): void {
    const projects = this.db.prepare('SELECT * FROM detected_projects WHERE is_active = 1').all() as any[];
    for (const p of projects) {
      this.knownProjects.set(p.path || p.name, {
        ...p,
        technologies: JSON.parse(p.technologies || '[]'),
        isActive: p.is_active === 1,
      });
    }
  }

  private setupDetectionRules(): void {
    this.detectionRules = [
      {
        pattern: /([A-Z]:\\[a-zA-Z0-9_\-\\\/]+\.git)/,
        name: 'Git Repository',
      },
      {
        pattern: /([A-Z]:\\Users\\[a-zA-Z]+\\(?:Projects|Documents|Code|Dev|repos)\\([a-zA-Z0-9_\-]+))/i,
        name: 'Project Directory',
        extractPath: (m) => m[1],
      },
      {
        pattern: /(?:VS Code|Visual Studio|Cursor|IntelliJ|WebStorm)\s*[-–]\s*(.+)/i,
        name: 'IDE Project',
        extractPath: (m) => m[1],
      },
      {
        pattern: /([a-zA-Z0-9_\-]+)\s*[-–]\s*(?:main|master|develop|feature|bugfix|release)/i,
        name: 'Git Branch',
      },
    ];
  }

  private setupEventListeners(): void {
    this.bus.on('WINDOW_CHANGED', (event) => {
      const { appName, windowTitle } = event.payload as any;
      this.detectFromWindow(appName, windowTitle);
    });

    this.bus.on('GIT_REPO_DETECTED', (event) => {
      const { repoPath } = event.payload as any;
      this.detectFromGit(repoPath);
    });

    this.bus.on('FILE_OPENED', (event) => {
      const { filePath } = event.payload as any;
      this.detectFromFile(filePath);
    });
  }

  private detectFromWindow(appName: string, windowTitle: string): void {
    if (!windowTitle) return;

    const combined = `${appName} - ${windowTitle}`;

    for (const rule of this.detectionRules) {
      const match = combined.match(rule.pattern);
      if (match) {
        const projectPath = rule.extractPath ? rule.extractPath(match) : match[1];
        const projectName = this.extractProjectName(projectPath);
        
        if (projectName) {
          this.registerActivity(projectName, projectPath, appName, windowTitle);
        }
        break;
      }
    }

    this.detectFromWindowTitle(appName, windowTitle);
  }

  private detectFromWindowTitle(appName: string, windowTitle: string): void {
    const projectPatterns = [
      /([A-Z][a-zA-Z]+(?:CRM|API|App|Web|UI|Service|Module|System|Platform))/,
      /([a-zA-Z]+-[a-zA-Z]+)\s*[-–]/,
      /\[([a-zA-Z0-9_\-]+)\]/,
    ];

    for (const pattern of projectPatterns) {
      const match = windowTitle.match(pattern);
      if (match) {
        const projectName = match[1];
        this.registerActivity(projectName, '', appName, windowTitle);
        break;
      }
    }
  }

  private detectFromGit(repoPath: string): void {
    const projectName = path.basename(repoPath);
    this.registerProject(projectName, repoPath, 'git');
  }

  private detectFromFile(filePath: string): void {
    let currentDir = path.dirname(filePath);
    const maxDepth = 10;
    let depth = 0;

    while (currentDir && depth < maxDepth) {
      const gitDir = path.join(currentDir, '.git');
      if (fs.existsSync(gitDir)) {
        const projectName = path.basename(currentDir);
        this.registerProject(projectName, currentDir, 'filesystem');
        break;
      }

      const packageJson = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJson)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
          if (pkg.name) {
            this.registerProject(pkg.name, currentDir, 'package.json');
            break;
          }
        } catch {}
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
      depth++;
    }
  }

  private extractProjectName(projectPath: string): string {
    return path.basename(projectPath).replace(/\.git$/, '');
  }

  private registerProject(name: string, projectPath: string, source: string): void {
    const existing = this.knownProjects.get(projectPath || name);
    const now = new Date().toISOString();

    if (existing) {
      this.db.prepare(`
        UPDATE detected_projects SET last_seen = ?, activity_count = activity_count + 1
        WHERE id = ?
      `).run(now, existing.id);
      existing.lastSeen = now;
      existing.activityCount++;
    } else {
      const technologies = this.detectTechnologies(projectPath);
      const result = this.db.prepare(`
        INSERT INTO detected_projects (name, path, technologies, first_seen, last_seen, activity_count)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(name, projectPath, JSON.stringify(technologies), now, now);

      this.knownProjects.set(projectPath || name, {
        id: result.lastInsertRowid as number,
        name,
        path: projectPath,
        technologies,
        repoUrl: '',
        firstSeen: now,
        lastSeen: now,
        activityCount: 1,
        isActive: true,
      });

      this.bus.emit('PROJECT_DETECTED', 'project-detector', {
        projectId: result.lastInsertRowid,
        name,
        path: projectPath,
        technologies,
      });
    }
  }

  private registerActivity(projectName: string, projectPath: string, appName: string, windowTitle: string): void {
    let project = this.knownProjects.get(projectPath || projectName);
    
    if (!project) {
      this.registerProject(projectName, projectPath, 'auto');
      project = this.knownProjects.get(projectPath || projectName);
    }

    if (project) {
      this.db.prepare(`
        INSERT INTO project_activities (project_id, timestamp, app, window_title)
        VALUES (?, ?, ?, ?)
      `).run(project.id, new Date().toISOString(), appName, windowTitle);
    }
  }

  private detectTechnologies(projectPath: string): string[] {
    if (!projectPath || !fs.existsSync(projectPath)) return [];

    const techs = new Set<string>();
    const fileChecks: Record<string, string> = {
      'package.json': 'Node.js',
      'requirements.txt': 'Python',
      'Cargo.toml': 'Rust',
      'go.mod': 'Go',
      'pom.xml': 'Java',
      'Gemfile': 'Ruby',
      'composer.json': 'PHP',
      'Dockerfile': 'Docker',
      'docker-compose.yml': 'Docker',
      '.github': 'GitHub Actions',
    };

    try {
      const files = fs.readdirSync(projectPath);
      for (const file of files) {
        if (fileChecks[file]) {
          techs.add(fileChecks[file]);
        }
        if (file.endsWith('.ts') || file.endsWith('.tsx')) techs.add('TypeScript');
        if (file.endsWith('.js') || file.endsWith('.jsx')) techs.add('JavaScript');
        if (file.endsWith('.py')) techs.add('Python');
        if (file.endsWith('.rs')) techs.add('Rust');
        if (file.endsWith('.go')) techs.add('Go');
      }
    } catch {}

    return Array.from(techs);
  }

  async getActiveProjects(): Promise<DetectedProject[]> {
    return this.db.prepare(`
      SELECT * FROM detected_projects 
      WHERE is_active = 1 
      ORDER BY last_seen DESC
    `).all().map((p: any) => ({
      ...p,
      technologies: JSON.parse(p.technologies || '[]'),
      isActive: p.is_active === 1,
    })) as DetectedProject[];
  }

  async getProjectActivities(projectId: number, limit = 100): Promise<any[]> {
    return this.db.prepare(`
      SELECT * FROM project_activities
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(projectId, limit);
  }

  async getProjects(): Promise<DetectedProject[]> {
    return this.db.prepare(`
      SELECT * FROM detected_projects ORDER BY last_seen DESC
    `).all().map((p: any) => ({
      ...p,
      technologies: JSON.parse(p.technologies || '[]'),
      isActive: p.is_active === 1,
    })) as DetectedProject[];
  }
}
